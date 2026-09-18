create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.v5_categories (
  slug text primary key,
  name text not null,
  sort_order integer not null,
  nav_visible boolean not null default true
);
insert into public.v5_categories(slug,name,sort_order,nav_visible) values
('indland','Indland',10,true),('udland','Udland',20,true),('penge','Penge',30,true),('kultur','Kultur',40,true),('tema','Tema',50,true),('viden','Viden',60,true),('liv','Liv',70,true),('kommentar','Kommentar',80,false)
on conflict do nothing;

create table public.v5_hero_assets (
  id uuid primary key default gen_random_uuid(),
  public_url text not null unique,
  storage_path text not null unique,
  source_url text not null,
  rights_source_url text,
  license text not null,
  credit text,
  mime_type text not null,
  width integer not null check(width >= 800),
  height integer not null check(height >= 450),
  sha256 text not null,
  created_at timestamptz not null default now()
);

create table public.v5_articles (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  slug text not null unique,
  headline text not null,
  deck text,
  body_markdown text not null,
  category_slug text not null references public.v5_categories(slug),
  article_kind text not null default 'news' check(article_kind in ('news','analysis','comment','magazine')),
  sagen_kort jsonb not null check(jsonb_typeof(sagen_kort)='array' and jsonb_array_length(sagen_kort)=2),
  source_metadata jsonb not null default '[]'::jsonb check(jsonb_typeof(source_metadata)='array'),
  hero_asset_id uuid not null references public.v5_hero_assets(id),
  hero_alt text not null default '',
  frontpage_destination text not null default 'normal' check(frontpage_destination in ('lead','special_1','special_2','normal')),
  special_label text,
  is_breaking boolean not null default false,
  published_at timestamptz not null default now(),
  engine_version text not null default 'v5' check(engine_version='v5'),
  created_at timestamptz not null default now()
);
create index v5_articles_published_idx on public.v5_articles(published_at desc);
create index v5_articles_category_idx on public.v5_articles(category_slug,published_at desc);
create index v5_articles_search_headline_trgm on public.v5_articles using gin(headline gin_trgm_ops);
create index v5_articles_search_body_trgm on public.v5_articles using gin(body_markdown gin_trgm_ops);

create table public.v5_special_sections (
  slot smallint primary key check(slot in (1,2)),
  title text not null,
  kicker text,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.v5_special_sections(slot,title,kicker,active) values
(1,'Specialredaktion','SPECIALREDAKTION',false),(2,'Specialredaktion','SPECIALREDAKTION',false)
on conflict do nothing;

create table public.v5_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check(status in ('pending','active','unsubscribed')),
  confirmation_token_hash text,
  daily_news boolean not null default true,
  magazine_viden boolean not null default false,
  magazine_liv boolean not null default false,
  preferred_theme text not null default 'system' check(preferred_theme in ('system','light','dark')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace view public.v5_public_articles with (security_invoker=true) as
select a.id,a.slug,a.headline,a.deck,a.body_markdown,a.category_slug,c.name as category_name,a.article_kind,
       a.sagen_kort,a.hero_alt,a.frontpage_destination,a.special_label,a.is_breaking,a.published_at,a.source_metadata,
       h.public_url as hero_url,h.credit as hero_credit,h.license as hero_license,h.source_url as hero_source_url
from public.v5_articles a
join public.v5_categories c on c.slug=a.category_slug
join public.v5_hero_assets h on h.id=a.hero_asset_id;

create or replace view public.v5_public_special_sections with (security_invoker=true) as
select slot,title,kicker,active,updated_at from public.v5_special_sections where active=true;

alter table public.v5_categories enable row level security;
alter table public.v5_hero_assets enable row level security;
alter table public.v5_articles enable row level security;
alter table public.v5_special_sections enable row level security;
alter table public.v5_newsletter_subscribers enable row level security;

create policy v5_categories_public_read on public.v5_categories for select to anon using(true);
create policy v5_articles_public_read on public.v5_articles for select to anon using(published_at <= now());
create policy v5_hero_public_read on public.v5_hero_assets for select to anon using(true);
create policy v5_special_public_read on public.v5_special_sections for select to anon using(active=true);

grant select on public.v5_public_articles, public.v5_public_special_sections to anon;

create or replace function public.v5_publish_article(p_article jsonb)
returns public.v5_articles
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.v5_articles;
begin
  insert into public.v5_articles(
    idempotency_key,slug,headline,deck,body_markdown,category_slug,article_kind,sagen_kort,source_metadata,
    hero_asset_id,hero_alt,frontpage_destination,special_label,is_breaking,published_at
  ) values (
    p_article->>'idempotency_key', p_article->>'slug', p_article->>'headline', nullif(p_article->>'deck',''),
    p_article->>'body_markdown', p_article->>'category_slug', coalesce(p_article->>'article_kind','news'),
    p_article->'sagen_kort', coalesce(p_article->'source_metadata','[]'::jsonb),
    (p_article->>'hero_asset_id')::uuid, coalesce(p_article->>'hero_alt',''),
    coalesce(p_article->>'frontpage_destination','normal'), nullif(p_article->>'special_label',''),
    coalesce((p_article->>'is_breaking')::boolean,false), coalesce((p_article->>'published_at')::timestamptz,now())
  )
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into v_row;
  return v_row;
end;$$;
revoke all on function public.v5_publish_article(jsonb) from public, anon, authenticated;
grant execute on function public.v5_publish_article(jsonb) to service_role;

create or replace function public.v5_search_articles(p_query text,p_limit integer default 40)
returns setof public.v5_public_articles
language sql stable security invoker set search_path=public as $$
  select * from public.v5_public_articles
  where headline ilike '%'||p_query||'%' or body_markdown ilike '%'||p_query||'%'
  order by published_at desc limit least(greatest(p_limit,1),100);
$$;
grant execute on function public.v5_search_articles(text,integer) to anon;

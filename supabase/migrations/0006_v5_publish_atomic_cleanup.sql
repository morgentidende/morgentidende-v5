do $$
begin
  if exists (select 1 from pg_extension where extname='pg_trgm') then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

create index if not exists v5_articles_hero_asset_idx on public.v5_articles(hero_asset_id);
create index if not exists v5_hero_ingest_asset_idx on public.v5_hero_ingest_requests(hero_asset_id);
create unique index if not exists v5_one_current_lead_idx on public.v5_articles((1)) where frontpage_destination='lead';

create or replace function public.v5_publish_article(p_article jsonb)
returns public.v5_articles
language plpgsql security definer set search_path=public as $$
declare
  v_existing public.v5_articles;
  v_row public.v5_articles;
  v_destination text := coalesce(p_article->>'frontpage_destination','normal');
begin
  select * into v_existing from public.v5_articles where idempotency_key=p_article->>'idempotency_key';
  if found then return v_existing; end if;
  if v_destination='lead' then
    update public.v5_articles set frontpage_destination='normal' where frontpage_destination='lead';
  end if;
  insert into public.v5_articles(
    idempotency_key,slug,headline,deck,body_markdown,category_slug,article_kind,sagen_kort,source_metadata,hero_asset_id,hero_alt,frontpage_destination,special_label,is_breaking,published_at
  ) values (
    p_article->>'idempotency_key',p_article->>'slug',p_article->>'headline',nullif(p_article->>'deck',''),p_article->>'body_markdown',p_article->>'category_slug',
    coalesce(p_article->>'article_kind','news'),p_article->'sagen_kort',coalesce(p_article->'source_metadata','[]'::jsonb),(p_article->>'hero_asset_id')::uuid,
    coalesce(p_article->>'hero_alt',''),v_destination,nullif(p_article->>'special_label',''),coalesce((p_article->>'is_breaking')::boolean,false),now()
  ) returning * into v_row;
  return v_row;
end;$$;
revoke all on function public.v5_publish_article(jsonb) from public,anon,authenticated;
grant execute on function public.v5_publish_article(jsonb) to service_role;

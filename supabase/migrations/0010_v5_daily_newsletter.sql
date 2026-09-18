create extension if not exists pg_cron;

create table if not exists public.v5_newsletter_daily_picks (
  local_date date not null,
  rank smallint not null check (rank between 1 and 6),
  article_id uuid not null references public.v5_articles(id) on delete cascade,
  reason text,
  underreported_score smallint check (underreported_score between 0 and 100),
  created_at timestamptz not null default now(),
  primary key(local_date,rank),
  unique(local_date,article_id)
);
create index if not exists v5_newsletter_daily_picks_article_idx on public.v5_newsletter_daily_picks(article_id);
alter table public.v5_newsletter_daily_picks enable row level security;
revoke all on public.v5_newsletter_daily_picks from anon, authenticated;

create table if not exists public.v5_newsletter_dispatches (
  local_date date primary key,
  status text not null check(status in ('sending','sent','failed')),
  article_ids uuid[] not null default '{}',
  recipient_count integer not null default 0,
  ses_message_ids jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.v5_newsletter_dispatches enable row level security;
revoke all on public.v5_newsletter_dispatches from anon, authenticated;

insert into public.v5_runtime_config(key,value)
values ('newsletter_cron_token', encode(extensions.gen_random_bytes(32),'hex'))
on conflict(key) do nothing;

create or replace function public.v5_trigger_daily_newsletter()
returns bigint language plpgsql security definer set search_path=public,extensions,net as $$
declare v_local timestamp; v_date date; v_base text; v_token text; v_request bigint;
begin
  v_local := now() at time zone 'Europe/Copenhagen'; v_date := v_local::date;
  if extract(hour from v_local) <> 6 then return null; end if;
  if exists(select 1 from public.v5_newsletter_dispatches where local_date=v_date and status in ('sending','sent')) then return null; end if;
  select value into v_base from public.v5_runtime_config where key='edge_functions_base_url';
  select value into v_token from public.v5_runtime_config where key='newsletter_cron_token';
  if v_base is null or v_token is null then raise exception 'NEWSLETTER_RUNTIME_NOT_CONFIGURED'; end if;
  select net.http_post(url:=v_base||'/v5-daily-newsletter',headers:=jsonb_build_object('content-type','application/json','x-v5-newsletter-token',v_token),body:=jsonb_build_object('local_date',v_date::text),timeout_milliseconds:=30000) into v_request;
  return v_request;
end $$;
revoke all on function public.v5_trigger_daily_newsletter() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from cron.job where jobname='v5-daily-newsletter-0600-copenhagen') then perform cron.unschedule('v5-daily-newsletter-0600-copenhagen'); end if;
  perform cron.schedule('v5-daily-newsletter-0600-copenhagen','0 4,5 * * *','select public.v5_trigger_daily_newsletter();');
end $$;
-- One tiny technical bridge is retained because the editorial AI cannot itself persist remote binary bytes in Postgres.
-- There is no queue and no semantic logic here.
create extension if not exists http with schema extensions;

create table public.v5_hero_ingest_requests (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  rights_source_url text,
  license text not null,
  credit text,
  status text not null default 'pending' check(status in ('pending','ready','failed')),
  hero_asset_id uuid references public.v5_hero_assets(id),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.v5_hero_ingest_requests enable row level security;

create table public.v5_runtime_config(key text primary key,value text not null);
alter table public.v5_runtime_config enable row level security;

create or replace function public.v5_ingest_hero(p_source_url text,p_rights_source_url text,p_license text,p_credit text default null)
returns uuid
language plpgsql security definer set search_path=public,extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_base text;
  v_response extensions.http_response;
begin
  insert into public.v5_hero_ingest_requests(id,source_url,rights_source_url,license,credit)
  values(v_id,p_source_url,p_rights_source_url,p_license,p_credit);
  select value into v_base from public.v5_runtime_config where key='edge_functions_base_url';
  if v_base is null then raise exception 'V5_EDGE_URL_NOT_CONFIGURED'; end if;
  select * into v_response from extensions.http((
    'POST', v_base||'/v5-hero-ingest', array[extensions.http_header('content-type','application/json')],
    'application/json', jsonb_build_object('request_id',v_id)::text
  )::extensions.http_request);
  if v_response.status < 200 or v_response.status >= 300 then
    update public.v5_hero_ingest_requests set status='failed',error='edge_http_'||v_response.status,completed_at=now() where id=v_id;
  end if;
  return v_id;
end;$$;
revoke all on function public.v5_ingest_hero(text,text,text,text) from public,anon,authenticated;
grant execute on function public.v5_ingest_hero(text,text,text,text) to service_role;

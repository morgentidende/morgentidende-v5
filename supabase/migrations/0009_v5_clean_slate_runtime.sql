-- Consolidate the final clean-slate V5 runtime.
-- V5 has one semantic editorial owner. This migration contains only technical persistence/transport work.

create extension if not exists pg_net with schema extensions;

-- Production site URL used by newsletter confirmation links.
insert into public.v5_runtime_config(key,value) values
('edge_functions_base_url','https://wmyoplpweamkflbtvqid.supabase.co/functions/v1'),
('site_url','https://morgentidende.dk')
on conflict(key) do update set value=excluded.value;

-- Front-page destinations added after the initial schema.
alter table public.v5_articles drop constraint if exists v5_articles_frontpage_destination_check;
alter table public.v5_articles
  add constraint v5_articles_frontpage_destination_check
  check(frontpage_destination in ('lead','theme','special_1','special_2','normal','archive'));

-- A single current lead is a technical invariant, not an editorial decision.
create unique index if not exists v5_one_current_lead_idx
  on public.v5_articles((1))
  where frontpage_destination='lead';

-- Remote hero entrypoint. It creates a one-time capability and dispatches to the one V5 hero Edge Function.
create or replace function public.v5_ingest_hero(
  p_source_url text,
  p_rights_source_url text,
  p_license text,
  p_credit text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_cap text := encode(gen_random_bytes(32),'hex');
  v_base text;
begin
  insert into public.v5_hero_ingest_requests(
    id,source_url,rights_source_url,license,credit,capability_hash
  )
  values(
    v_id,p_source_url,p_rights_source_url,p_license,p_credit,
    encode(digest(v_cap,'sha256'),'hex')
  );

  select value into v_base
  from public.v5_runtime_config
  where key='edge_functions_base_url';

  if v_base is null then
    raise exception 'V5_EDGE_URL_NOT_CONFIGURED';
  end if;

  perform net.http_post(
    url := v_base||'/v5-hero-ingest',
    headers := '{"content-type":"application/json"}'::jsonb,
    body := jsonb_build_object('request_id',v_id,'capability',v_cap),
    timeout_milliseconds := 30000
  );

  return v_id;
end;
$$;

revoke all on function public.v5_ingest_hero(text,text,text,text) from public,anon,authenticated;
grant execute on function public.v5_ingest_hero(text,text,text,text) to service_role;

-- Inline/generated images use the exact same Edge Function and storage/validation implementation.
create or replace function public.v5_ingest_inline_hero(
  p_data_base64 text,
  p_mime_type text,
  p_source_url text,
  p_rights_source_url text,
  p_license text,
  p_credit text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_cap text := encode(gen_random_bytes(32),'hex');
  v_base text;
begin
  insert into public.v5_hero_ingest_requests(
    id,source_url,rights_source_url,license,credit,capability_hash
  )
  values(
    v_id,p_source_url,p_rights_source_url,p_license,p_credit,
    encode(digest(v_cap,'sha256'),'hex')
  );

  select value into v_base
  from public.v5_runtime_config
  where key='edge_functions_base_url';

  if v_base is null then
    raise exception 'V5_EDGE_URL_NOT_CONFIGURED';
  end if;

  perform net.http_post(
    url := v_base||'/v5-hero-ingest',
    headers := '{"content-type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'request_id',v_id,
      'capability',v_cap,
      'data_base64',p_data_base64,
      'mime_type',p_mime_type
    ),
    timeout_milliseconds := 30000
  );

  return v_id;
end;
$$;

revoke all on function public.v5_ingest_inline_hero(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.v5_ingest_inline_hero(text,text,text,text,text,text) to service_role;

comment on function public.v5_ingest_inline_hero(text,text,text,text,text,text)
is 'Thin inline-image entrypoint into the single v5-hero-ingest Edge Function. No separate ingest implementation.';

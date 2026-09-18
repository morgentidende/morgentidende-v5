alter table public.v5_hero_ingest_requests add column if not exists capability_hash text;

create or replace function public.v5_ingest_hero(p_source_url text,p_rights_source_url text,p_license text,p_credit text default null)
returns uuid
language plpgsql security definer set search_path=public,extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_cap text := encode(gen_random_bytes(32),'hex');
  v_base text;
  v_response extensions.http_response;
begin
  insert into public.v5_hero_ingest_requests(id,source_url,rights_source_url,license,credit,capability_hash)
  values(v_id,p_source_url,p_rights_source_url,p_license,p_credit,encode(digest(v_cap,'sha256'),'hex'));
  select value into v_base from public.v5_runtime_config where key='edge_functions_base_url';
  if v_base is null then raise exception 'V5_EDGE_URL_NOT_CONFIGURED'; end if;
  select * into v_response from extensions.http((
    'POST',v_base||'/v5-hero-ingest',array[extensions.http_header('content-type','application/json')],
    'application/json',jsonb_build_object('request_id',v_id,'capability',v_cap)::text
  )::extensions.http_request);
  if v_response.status < 200 or v_response.status >= 300 then
    update public.v5_hero_ingest_requests set status='failed',error='edge_http_'||v_response.status,completed_at=now(),capability_hash=null where id=v_id;
  end if;
  return v_id;
end;$$;
revoke all on function public.v5_ingest_hero(text,text,text,text) from public,anon,authenticated;
grant execute on function public.v5_ingest_hero(text,text,text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('v5-heroes','v5-heroes',true,15000000,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

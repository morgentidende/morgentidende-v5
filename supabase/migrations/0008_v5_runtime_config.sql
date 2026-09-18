insert into public.v5_runtime_config(key,value) values
('edge_functions_base_url','https://wmyoplpweamkflbtvqid.supabase.co/functions/v1'),
('site_url','https://v5.morgentidende.dk')
on conflict(key) do update set value=excluded.value;

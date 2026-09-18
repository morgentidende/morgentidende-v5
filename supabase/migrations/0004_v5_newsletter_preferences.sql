alter table public.v5_newsletter_subscribers
  add column if not exists manage_token uuid not null default gen_random_uuid() unique,
  add column if not exists last_confirmation_sent_at timestamptz;

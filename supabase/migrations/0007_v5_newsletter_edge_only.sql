drop function if exists public.v5_confirm_newsletter(text);
drop function if exists public.v5_get_newsletter_preferences(uuid);
drop function if exists public.v5_set_newsletter_preferences(uuid,boolean,boolean,boolean,text);
drop function if exists public.v5_unsubscribe_newsletter(uuid);

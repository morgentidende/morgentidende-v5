import { createClient } from '@supabase/supabase-js';

export const V5_SUPABASE_URL = 'https://wmyoplpweamkflbtvqid.supabase.co';
export const V5_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jwg4dAe_iuR8eXhrR6eh5w_OVr3hi2c';

export function getSupabase() {
  return createClient(V5_SUPABASE_URL, V5_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

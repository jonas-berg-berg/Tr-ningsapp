import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

/**
 * Supabase-klient med service role. Kringgår RLS – endast för betrodd serverkod
 * (inlösen av inbjudningar, cron, push). Får aldrig importeras från klientkod.
 */
export function createAdminClient() {
  return createClient(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

import { createBrowserClient } from '@supabase/ssr';
import { requireEnv } from './env';

/** Supabase-klient för webbläsaren (anon-nyckel, användarens session via cookies). */
export function createClient() {
  return createBrowserClient(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}

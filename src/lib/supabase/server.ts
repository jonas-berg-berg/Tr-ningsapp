import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireEnv } from './env';

/**
 * Supabase-klient för serverkomponenter, server actions och route handlers.
 * Använder anon-nyckeln och användarens session från cookies, så RLS gäller.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Anropad från en serverkomponent, där cookies inte kan sättas.
            // Ofarligt så länge proxy/middleware förnyar sessionen.
          }
        },
      },
    },
  );
}

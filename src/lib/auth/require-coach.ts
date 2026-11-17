import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

export const NOT_COACH = 'Bara tränare kan göra det här. Logga in igen.';

/**
 * Inloggad tränare, annars null. Läser rollen med användarens egen klient
 * (profiles_select_own). RLS är den riktiga gränsen; det här styr UX och
 * stoppar server actions tidigt.
 */
export async function getCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'coach') return null;
  return { supabase, userId: user.id };
}

/** För /tranare-sidor: skickar alla som inte är tränare till startsidan. */
export async function requireCoachPage() {
  const coach = await getCoach();
  if (!coach) redirect('/');
  return coach;
}

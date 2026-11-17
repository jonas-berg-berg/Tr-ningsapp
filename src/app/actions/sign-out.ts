'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Loggar ut med användarens egen (cookie-)klient och går till inloggningen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Utloggning misslyckades', { code: error.code });
  redirect('/login');
}

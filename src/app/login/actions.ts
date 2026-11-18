'use server';

import { redirect } from 'next/navigation';
import { normalizeUsername, usernameToEmail } from '@/lib/auth/username';
import { createClient } from '@/lib/supabase/server';

export type LoginState = { error: string } | undefined;

const LOGIN_FAILED = 'Fel användarnamn eller lösenord';

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const password = String(formData.get('password') ?? '');
  if (!username || !password) return { error: LOGIN_FAILED };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    // Bara felkod och status loggas – aldrig användarnamn eller lösenord.
    console.error('login misslyckades', { code: error.code, status: error.status });
    return { error: LOGIN_FAILED };
  }

  redirect('/');
}

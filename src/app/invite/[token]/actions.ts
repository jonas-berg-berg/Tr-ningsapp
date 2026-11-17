'use server';

import { redirect } from 'next/navigation';
import { normalizeUsername, usernameToEmail } from '@/lib/auth/username';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { INVALID_INVITE, isValidToken } from './invite';

export type InviteState = { error: string } | undefined;

const USERNAME_TAKEN = 'Användarnamnet är upptaget';
const GENERIC = 'Något gick fel. Försök igen.';

/**
 * Löser in en inbjudan. Inbjudan låses först med en villkorlig update
 * (used_at is null), så två samtidiga inlösen aldrig båda lyckas. Misslyckas
 * något efteråt släpps låset och ett ev. skapat konto tas bort.
 */
export async function redeemInvite(token: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!isValidToken(token)) return { error: INVALID_INVITE };
  if (!username) {
    return { error: 'Användarnamnet ska vara 3–20 tecken: bokstäver a–ö, siffror, punkt, - eller _.' };
  }
  if (password.length < 8) return { error: 'Lösenordet måste vara minst 8 tecken.' };

  const admin = createAdminClient();

  // 1. Lås inbjudan.
  const { data: invite, error: claimError } = await admin
    .from('invites')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select('display_name, role')
    .maybeSingle();
  if (claimError) return { error: GENERIC };
  if (!invite) return { error: INVALID_INVITE };

  const release = async () => {
    await admin.from('invites').update({ used_at: null }).eq('token', token);
  };

  // 2. Användarnamnet ledigt?
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (lookupError || existing) {
    await release();
    return { error: lookupError ? GENERIC : USERNAME_TAKEN };
  }

  // 3. Skapa kontot.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    await release();
    if (createError?.code === 'email_exists' || createError?.code === 'user_already_exists') {
      return { error: USERNAME_TAKEN };
    }
    if (createError?.code === 'weak_password') return { error: 'Lösenordet är för svagt. Välj ett längre.' };
    return { error: GENERIC };
  }

  // 4. Profil med inbjudans roll.
  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    display_name: invite.display_name,
    username,
    role: invite.role,
  });
  if (profileError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id);
    if (deleteError) console.error('Kunde inte ta bort kontot efter misslyckad profil', { code: deleteError.code });
    await release();
    return { error: profileError.code === '23505' ? USERNAME_TAKEN : GENERIC };
  }

  // 5. Logga in (sessionen sparas i cookies) och gå till startsidan.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (signInError) redirect('/login');
  redirect('/');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { field, UUID_RE, type FormState } from '@/lib/actions/form-state';
import { getCoach, NOT_COACH } from '@/lib/auth/require-coach';
import { requestOrigin } from '@/lib/origin-server';
import { createAdminClient } from '@/lib/supabase/admin';

const GENERIC = 'Något gick fel. Försök igen.';

/** Skapar en inbjudan (tränarens egen klient, RLS invites_coach_all) och ger länken. */
export async function createInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const name = field(formData, 'display_name');
  const role = field(formData, 'role');
  if (name.length < 1 || name.length > 40) return { error: 'Skriv ett namn (högst 40 tecken).' };
  if (role !== 'player' && role !== 'coach') return { error: 'Välj spelare eller tränare.' };

  const { data, error } = await coach.supabase
    .from('invites')
    .insert({ display_name: name, role })
    .select('token')
    .single();
  if (error || !data) {
    console.error('Kunde inte skapa inbjudan', { code: error?.code });
    return { error: GENERIC };
  }

  revalidatePath('/tranare/spelare');
  const link = `${await requestOrigin()}/invite/${data.token}`;
  return { ok: `Inbjudan till ${name} skapad. Skicka länken till ${role === 'coach' ? 'tränaren' : 'spelaren'}.`, link };
}

/**
 * Tar bort en spelare: auth-användaren raderas (admin), vilket kaskaderar till
 * profil och loggar. Den enda tränar-action som använder admin-klienten, och
 * den nås bara efter rollkontrollen och ett bekräftelsesteg.
 */
export async function removePlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const id = field(formData, 'id');
  if (!UUID_RE.test(id)) return { error: GENERIC };
  if (id === coach.userId) return { error: 'Du kan inte ta bort dig själv.' };

  // Bekräfta med tränarens egen klient att det är en spelare.
  const { data: profile } = await coach.supabase.from('profiles').select('role').eq('id', id).maybeSingle();
  if (!profile) return { error: 'Spelaren finns inte.' };
  if (profile.role !== 'player') return { error: 'Bara spelare kan tas bort här.' };

  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) {
    console.error('Kunde inte ta bort spelaren', { code: error.code });
    return { error: GENERIC };
  }

  revalidatePath('/tranare', 'layout');
  redirect('/tranare/spelare');
}

/** Tar bort en oanvänd inbjudan (tränarens egen klient, RLS invites_coach_all). Länken slutar fungera. */
export async function deleteInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const token = field(formData, 'token');
  if (!UUID_RE.test(token)) return { error: GENERIC };

  const { error } = await coach.supabase.from('invites').delete().eq('token', token).is('used_at', null);
  if (error) {
    console.error('Kunde inte ta bort inbjudan', { code: error.code });
    return { error: GENERIC };
  }
  revalidatePath('/tranare/spelare');
  return { ok: 'Inbjudan är borttagen.' };
}

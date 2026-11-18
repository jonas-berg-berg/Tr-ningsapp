'use server';

import { revalidatePath } from 'next/cache';
import { field, type FormState } from '@/lib/actions/form-state';
import { getCoach, NOT_COACH } from '@/lib/auth/require-coach';

const KINDS = ['training', 'match', 'other'];

/** Sätter eller tar bort kind_override för en händelse. Tomt värde = automatisk typ. */
export async function setKindOverride(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const uid = field(formData, 'uid');
  const override = field(formData, 'kind_override');
  if (uid === '' || uid.length > 500) return { error: 'Händelsen finns inte.' };
  if (override !== '' && !KINDS.includes(override)) return { error: 'Välj en typ.' };

  const { data, error } = await coach.supabase
    .from('calendar_events')
    .update({ kind_override: override || null })
    .eq('uid', uid)
    .select('uid');
  if (error) {
    console.error('Kunde inte ändra händelsetyp', { code: error.code });
    return { error: 'Något gick fel. Försök igen.' };
  }
  if (!data || data.length === 0) return { error: 'Händelsen finns inte.' };
  revalidatePath('/tranare/kalender');
  return { ok: 'Sparat.' };
}

'use server';

import { revalidatePath } from 'next/cache';
import { parseKm } from '@/lib/actions/log-result';
import { field, isISODate, UUID_RE, type FormState } from '@/lib/actions/form-state';
import { getCoach, NOT_COACH } from '@/lib/auth/require-coach';

const GENERIC = 'Något gick fel. Försök igen.';

export async function createMission(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const kind = field(formData, 'kind');
  const name = field(formData, 'name');
  const description = field(formData, 'description');
  const activeFrom = field(formData, 'active_from');
  const rawKm = field(formData, 'target_km');
  const weekdays = formData
    .getAll('weekdays')
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);

  if (kind !== 'daily' && kind !== 'weekly') return { error: 'Välj typ av uppdrag.' };
  if (name.length < 1 || name.length > 80) return { error: 'Skriv ett namn (högst 80 tecken).' };
  if (description.length > 300) return { error: 'Beskrivningen får vara högst 300 tecken.' };
  if (!isISODate(activeFrom)) return { error: 'Välj ett giltigt startdatum.' };
  const targetKm = kind === 'weekly' && rawKm !== '' ? parseKm(rawKm) : null;
  if (kind === 'weekly' && rawKm !== '' && targetKm === null) {
    return { error: 'Ange km-målet som ett tal större än 0 (högst 100).' };
  }

  const { error } = await coach.supabase.from('missions').insert({
    kind,
    name,
    description: description || null,
    target_km: targetKm,
    weekdays: kind === 'weekly' ? [...new Set(weekdays)].sort((a, b) => a - b) : [],
    active_from: activeFrom,
  });
  if (error) {
    console.error('Kunde inte skapa uppdrag', { code: error.code });
    return { error: GENERIC };
  }
  revalidatePath('/tranare/uppdrag');
  return { ok: `Uppdraget ${name} är skapat.` };
}

/** Avslutar ett uppdrag genom att sätta active_to. Uppdrag raderas aldrig. */
export async function endMission(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const id = field(formData, 'id');
  const lastDay = field(formData, 'active_to');
  if (!UUID_RE.test(id)) return { error: GENERIC };
  if (!isISODate(lastDay)) return { error: 'Välj ett giltigt datum.' };

  const { data: mission } = await coach.supabase.from('missions').select('active_from').eq('id', id).maybeSingle();
  if (!mission) return { error: 'Uppdraget finns inte.' };
  if (lastDay < (mission.active_from as string)) return { error: 'Sista dagen kan inte vara före startdagen.' };

  const { error } = await coach.supabase.from('missions').update({ active_to: lastDay }).eq('id', id);
  if (error) {
    console.error('Kunde inte avsluta uppdrag', { code: error.code });
    return { error: GENERIC };
  }
  revalidatePath('/tranare/uppdrag');
  return { ok: 'Uppdraget är avslutat.' };
}

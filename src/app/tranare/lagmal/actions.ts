'use server';

import { revalidatePath } from 'next/cache';
import { field, isISODate, UUID_RE, type FormState } from '@/lib/actions/form-state';
import { getCoach, NOT_COACH } from '@/lib/auth/require-coach';

const GENERIC = 'Något gick fel. Försök igen.';
const METRICS = ['sessions', 'extra', 'km'];

export async function createGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const name = field(formData, 'name');
  const metric = field(formData, 'metric');
  const target = Number(field(formData, 'target').replace(',', '.'));
  const startsOn = field(formData, 'starts_on');
  const endsOn = field(formData, 'ends_on');
  const reward = field(formData, 'reward');

  if (name.length < 1 || name.length > 80) return { error: 'Skriv ett namn (högst 80 tecken).' };
  if (!METRICS.includes(metric)) return { error: 'Välj vad som räknas.' };
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) return { error: 'Målvärdet ska vara ett tal större än 0.' };
  if (!isISODate(startsOn) || !isISODate(endsOn)) return { error: 'Välj giltiga datum.' };
  if (endsOn < startsOn) return { error: 'Slutdatum kan inte vara före startdatum.' };
  if (reward.length > 120) return { error: 'Belöningen får vara högst 120 tecken.' };

  const { error } = await coach.supabase.from('team_goals').insert({
    name,
    metric,
    target,
    starts_on: startsOn,
    ends_on: endsOn,
    reward: reward || null,
  });
  if (error) {
    console.error('Kunde inte skapa lagmål', { code: error.code });
    return { error: GENERIC };
  }
  revalidatePath('/tranare/lagmal');
  return { ok: `Lagmålet ${name} är skapat.` };
}

/** Avslutar ett lagmål genom att sätta ends_on. Lagmål raderas aldrig. */
export async function endGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const id = field(formData, 'id');
  const endsOn = field(formData, 'ends_on');
  if (!UUID_RE.test(id)) return { error: GENERIC };
  if (!isISODate(endsOn)) return { error: 'Välj ett giltigt datum.' };

  const { data: goal } = await coach.supabase.from('team_goals').select('starts_on').eq('id', id).maybeSingle();
  if (!goal) return { error: 'Lagmålet finns inte.' };
  if (endsOn < (goal.starts_on as string)) return { error: 'Slutdatum kan inte vara före startdatum.' };

  const { error } = await coach.supabase.from('team_goals').update({ ends_on: endsOn }).eq('id', id);
  if (error) {
    console.error('Kunde inte avsluta lagmål', { code: error.code });
    return { error: GENERIC };
  }
  revalidatePath('/tranare/lagmal');
  return { ok: 'Lagmålet är avslutat.' };
}

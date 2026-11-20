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

/**
 * Ändrar lagmålets period. Startdatumet styr vilka pass som räknas, så det
 * måste gå att flytta bakåt om målet skapades med fel datum. Avsluta ett mål
 * genom att sätta sista dag till idag. Lagmål raderas aldrig.
 */
export async function updateGoalDates(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const id = field(formData, 'id');
  const startsOn = field(formData, 'starts_on');
  const endsOn = field(formData, 'ends_on');
  if (!UUID_RE.test(id)) return { error: GENERIC };
  if (!isISODate(startsOn) || !isISODate(endsOn)) return { error: 'Välj giltiga datum.' };
  if (endsOn < startsOn) return { error: 'Sista dag kan inte vara före första dag.' };

  const { data, error } = await coach.supabase
    .from('team_goals')
    .update({ starts_on: startsOn, ends_on: endsOn })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('Kunde inte ändra lagmål', { code: error.code });
    return { error: GENERIC };
  }
  if (!data || data.length === 0) return { error: 'Lagmålet finns inte.' };
  revalidatePath('/tranare/lagmal');
  revalidatePath('/');
  return { ok: 'Datumen är sparade.' };
}

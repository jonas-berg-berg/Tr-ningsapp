'use server';

import { revalidatePath } from 'next/cache';
import { field, type FormState } from '@/lib/actions/form-state';
import { getCoach, NOT_COACH } from '@/lib/auth/require-coach';
import { CalendarSyncError, runCalendarSync } from '@/lib/sportadmin/sync';
import { isCalendarUrl } from '@/lib/sportadmin/url';

/** Byter Sportadmin-länken. Fältet är skrivskyddat åt andra hållet: tomt = behåll nuvarande. */
export async function saveSportadminUrl(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const url = field(formData, 'url');
  if (url === '') return { ok: 'Ingen ändring, länken är kvar.' };
  if (!isCalendarUrl(url)) return { error: 'Länken ska börja med https:// eller webcal://.' };

  const { error } = await coach.supabase.from('settings').upsert({ key: 'sportadmin_url', value: url });
  if (error) {
    console.error('Kunde inte spara Sportadmin-länken', { code: error.code });
    return { error: 'Något gick fel. Försök igen.' };
  }
  revalidatePath('/tranare/installningar');
  return { ok: 'Länken är sparad. Tryck på Synka nu för att hämta kalendern.' };
}

/** "Synka nu": samma synk som cron-jobbet, men bara efter rollkontrollen. */
export async function syncNow(): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  try {
    const { upserted, cancelled } = await runCalendarSync();
    revalidatePath('/tranare', 'layout');
    return { ok: `Klart! ${upserted} händelser uppdaterade, ${cancelled} inställda.` };
  } catch (e) {
    if (e instanceof CalendarSyncError) return { error: e.message };
    console.error('Synk misslyckades', { name: e instanceof Error ? e.name : typeof e });
    return { error: 'Synken misslyckades. Försök igen.' };
  }
}

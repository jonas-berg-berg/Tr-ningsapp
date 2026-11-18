'use server';

import { revalidatePath } from 'next/cache';
import { parseKm } from '@/lib/actions/log-result';
import { field, isISODate, UUID_RE, type FormState } from '@/lib/actions/form-state';
import { passwordResetError } from '@/lib/auth/password-reset';
import { getCoach, NOT_COACH } from '@/lib/auth/require-coach';
import { toStockholmDate } from '@/lib/dates';
import { parseJerseyNumber } from '@/lib/jersey';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OtherOrgKind } from '@/lib/types';

const GENERIC = 'Något gick fel. Försök igen.';
const OTHER_KINDS: OtherOrgKind[] = ['annat_lag', 'fotboll', 'ovrigt'];

/**
 * Tränaren lägger till en logg för valfritt (passerat) datum. Skrivs med
 * tränarens egen klient; RLS logs_coach_all tillåter det. `what` är
 * 'event:<uid>' | 'other:<kind>' | 'extra:<missionId>' | 'weekly:<missionId>'.
 */
export async function addLog(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };
  const { supabase } = coach;

  const playerId = field(formData, 'player_id');
  const date = field(formData, 'date');
  const what = field(formData, 'what');
  if (!UUID_RE.test(playerId)) return { error: GENERIC };
  if (!isISODate(date)) return { error: 'Välj ett giltigt datum.' };
  if (date > toStockholmDate(new Date())) return { error: 'Det går inte att logga framtida dagar.' };

  const sep = what.indexOf(':');
  const kind = sep > 0 ? what.slice(0, sep) : '';
  const ref = sep > 0 ? what.slice(sep + 1) : '';
  let row: Record<string, unknown>;

  if (kind === 'event') {
    const { data: event } = await supabase
      .from('calendar_events_effective')
      .select('uid, summary, kind, date')
      .eq('uid', ref)
      .maybeSingle();
    if (!event || (event.kind !== 'training' && event.kind !== 'match') || event.date !== date) {
      return { error: 'Händelsen finns inte den dagen.' };
    }
    row = { type: event.kind, event_uid: event.uid, event_title: event.summary };
  } else if (kind === 'other') {
    if (!OTHER_KINDS.includes(ref as OtherOrgKind)) return { error: GENERIC };
    row = { type: 'other_org', other_kind: ref };
  } else if (kind === 'extra' || kind === 'weekly') {
    if (!UUID_RE.test(ref)) return { error: GENERIC };
    const { data: mission } = await supabase.from('missions').select('id, kind, target_km').eq('id', ref).maybeSingle();
    const expected = kind === 'extra' ? 'daily' : 'weekly';
    if (!mission || mission.kind !== expected) return { error: 'Uppdraget finns inte.' };
    row = { type: kind, mission_id: mission.id };
    if (kind === 'weekly') {
      const rawKm = field(formData, 'km');
      const km = rawKm === '' ? null : parseKm(rawKm);
      if (rawKm !== '' && km === null) return { error: 'Ange km som ett tal större än 0 (högst 100).' };
      if (mission.target_km !== null && km === null) return { error: 'Ange antal km för veckouppdraget.' };
      row.km = km;
    }
  } else {
    return { error: 'Välj vad som ska loggas.' };
  }

  const { error } = await supabase.from('logs').insert({ ...row, player_id: playerId, date });
  if (error?.code === '23505') return { ok: 'Passet fanns redan.' };
  if (error) {
    console.error('Tränarens logg nekad', { code: error.code, type: row.type });
    return { error: GENERIC };
  }
  revalidatePath(`/tranare/spelare/${playerId}`);
  return { ok: 'Passet är registrerat.' };
}

export async function deleteLog(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const id = field(formData, 'id');
  const playerId = field(formData, 'player_id');
  if (!UUID_RE.test(id) || !UUID_RE.test(playerId)) return { error: GENERIC };

  const { data, error } = await coach.supabase
    .from('logs')
    .delete()
    .eq('id', id)
    .eq('player_id', playerId)
    .select('id');
  if (error) {
    console.error('Kunde inte ta bort logg', { code: error.code });
    return { error: GENERIC };
  }
  revalidatePath(`/tranare/spelare/${playerId}`);
  if (!data || data.length === 0) return { error: 'Passet finns inte längre.' };
  return { ok: 'Borttaget.' };
}

/**
 * "Nytt lösenord": tränaren sätter ett nytt lösenord åt en spelare som glömt
 * sitt, så att historiken finns kvar (i stället för Ta bort + ny inbjudan).
 * Rollkontroll och spelarkontroll med tränarens egen klient (RLS), sedan
 * admin-klienten bara för själva lösenordsbytet.
 */
export async function setPlayerPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const targetId = field(formData, 'player_id');
  // Inte trimmat: mellanslag i lösenordet är tillåtna.
  const rawPassword = formData.get('password');
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  let targetRole: 'player' | 'coach' | null = null;
  if (UUID_RE.test(targetId)) {
    const { data: profile, error } = await coach.supabase.from('profiles').select('role').eq('id', targetId).maybeSingle();
    if (error) {
      console.error('Kunde inte läsa spelaren', { code: error.code });
      return { error: GENERIC };
    }
    targetRole = (profile?.role as 'player' | 'coach' | undefined) ?? null;
  }
  const problem = passwordResetError({ coachId: coach.userId, targetId, targetRole, password });
  if (problem) return { error: problem };

  const { error } = await createAdminClient().auth.admin.updateUserById(targetId, { password });
  if (error) {
    console.error('Kunde inte byta lösenord', { code: error.code });
    if (error.code === 'weak_password') return { error: 'Lösenordet är för svagt. Välj ett längre.' };
    return { error: GENERIC };
  }
  return { ok: 'Lösenordet är bytt. Berätta det nya lösenordet för spelaren.' };
}

/** Tränaren sätter eller tar bort spelarens tröjnummer (visas på spelarkortet). */
export async function setJerseyNumber(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await getCoach();
  if (!coach) return { error: NOT_COACH };

  const playerId = field(formData, 'player_id');
  if (!UUID_RE.test(playerId)) return { error: GENERIC };
  const jersey = parseJerseyNumber(field(formData, 'jersey_number'));
  if (jersey === undefined) return { error: 'Ange ett nummer mellan 0 och 99, eller lämna tomt.' };

  const { data, error } = await coach.supabase
    .from('profiles')
    .update({ jersey_number: jersey })
    .eq('id', playerId)
    .select('id');
  if (error) {
    console.error('Kunde inte spara tröjnummer', { code: error.code });
    return { error: GENERIC };
  }
  if (!data || data.length === 0) return { error: 'Spelaren finns inte längre.' };
  revalidatePath(`/tranare/spelare/${playerId}`);
  revalidatePath('/');
  return { ok: jersey === null ? 'Numret är borttaget.' : `Nummer ${jersey} är sparat.` };
}

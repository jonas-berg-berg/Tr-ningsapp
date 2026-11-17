'use server';

import { revalidatePath } from 'next/cache';
import { GENERIC_ERROR, LOG_REJECTED, logInsertResult, parseKm, type ActionResult } from '@/lib/actions/log-result';
import { toStockholmDate } from '@/lib/dates';
import { canPlayerLog } from '@/lib/logging';
import { createClient } from '@/lib/supabase/server';
import type { ISODate, OtherOrgKind } from '@/lib/types';

// Alla skrivningar går via användarens egen klient (JWT), så RLS och created_by gäller.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OTHER_KINDS: OtherOrgKind[] = ['annat_lag', 'fotboll', 'ovrigt'];
const TOO_OLD = 'Det går bara att registrera pass för idag och igår.';
const NOT_LOGGED_IN = 'Du är inte inloggad. Logga in igen.';

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function checkDate(date: unknown): string | null {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return LOG_REJECTED;
  if (!canPlayerLog(date, toStockholmDate(new Date()))) return TOO_OLD;
  return null;
}

async function insertLog(row: Record<string, unknown>): Promise<ActionResult> {
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: NOT_LOGGED_IN };
  const { error } = await supabase.from('logs').insert({ ...row, player_id: userId });
  const result = logInsertResult(error);
  if (error && !result.ok) console.error('Logg nekad', { code: error.code, type: row.type });
  revalidatePath('/');
  return result;
}

export async function logEvent(eventUid: string): Promise<ActionResult> {
  if (typeof eventUid !== 'string' || eventUid === '') return { ok: false, error: LOG_REJECTED };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: NOT_LOGGED_IN };

  const { data: event } = await supabase
    .from('calendar_events_effective')
    .select('uid, summary, kind, date, cancelled')
    .eq('uid', eventUid)
    .maybeSingle();
  if (!event || event.cancelled || (event.kind !== 'training' && event.kind !== 'match')) {
    return { ok: false, error: LOG_REJECTED };
  }
  const dateError = checkDate(event.date);
  if (dateError) return { ok: false, error: dateError };

  return insertLog({
    date: event.date,
    type: event.kind,
    event_uid: event.uid,
    event_title: event.summary,
  });
}

export async function logOtherOrg(date: ISODate, kind: OtherOrgKind): Promise<ActionResult> {
  if (!OTHER_KINDS.includes(kind)) return { ok: false, error: LOG_REJECTED };
  const dateError = checkDate(date);
  if (dateError) return { ok: false, error: dateError };
  return insertLog({ date, type: 'other_org', other_kind: kind });
}

export async function logExtra(date: ISODate, missionId: string): Promise<ActionResult> {
  if (typeof missionId !== 'string' || missionId === '') return { ok: false, error: LOG_REJECTED };
  const dateError = checkDate(date);
  if (dateError) return { ok: false, error: dateError };
  return insertLog({ date, type: 'extra', mission_id: missionId });
}

export async function logWeekly(date: ISODate, missionId: string, km: number): Promise<ActionResult> {
  if (typeof missionId !== 'string' || missionId === '') return { ok: false, error: LOG_REJECTED };
  const parsedKm = parseKm(km);
  if (parsedKm === null) return { ok: false, error: 'Ange km som ett tal större än 0 (högst 100).' };
  const dateError = checkDate(date);
  if (dateError) return { ok: false, error: dateError };
  return insertLog({ date, type: 'weekly', mission_id: missionId, km: parsedKm });
}

export async function undoLog(logId: string): Promise<ActionResult> {
  if (typeof logId !== 'string' || logId === '') return { ok: false, error: GENERIC_ERROR };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: NOT_LOGGED_IN };

  // RLS begränsar till egna, självskapade loggar från idag och igår.
  const { data, error } = await supabase
    .from('logs')
    .delete()
    .eq('id', logId)
    .eq('player_id', userId)
    .select('id');
  revalidatePath('/');
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data || data.length === 0) return { ok: false, error: 'Det går inte att ångra det här passet.' };
  return { ok: true };
}

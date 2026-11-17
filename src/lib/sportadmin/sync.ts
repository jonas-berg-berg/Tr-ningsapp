import type { SupabaseClient } from '@supabase/supabase-js';
import { diffEvents } from './diff';
import { parseFeed } from './parse';

export class CalendarSyncError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CalendarSyncError';
  }
}

export interface SyncDeps {
  fetchFn: typeof fetch;
  supabase: SupabaseClient;
  now: () => Date;
}

export async function runCalendarSync(
  deps: Partial<SyncDeps> = {},
): Promise<{ upserted: number; cancelled: number }> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = (deps.now ?? (() => new Date()))();
  // Dynamisk import: admin-klienten har 'server-only' och behövs inte när fakes injiceras.
  const supabase = deps.supabase ?? (await import('../supabase/admin')).createAdminClient();

  const { data: setting, error: settingError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'sportadmin_url')
    .maybeSingle();
  if (settingError) throw new CalendarSyncError('Kunde inte läsa kalenderlänken.', { cause: settingError });
  const rawUrl = (setting?.value as string | undefined)?.trim();
  if (!rawUrl) throw new CalendarSyncError('Ingen Sportadmin-länk är inställd.');
  const url = rawUrl.replace(/^webcal:\/\//i, 'https://');

  let body: string;
  try {
    const res = await fetchFn(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (res.status !== 200) {
      throw new CalendarSyncError(`Sportadmin svarade med status ${res.status}.`);
    }
    body = await res.text();
  } catch (e) {
    if (e instanceof CalendarSyncError) throw e;
    throw new CalendarSyncError('Kunde inte hämta kalendern från Sportadmin.', { cause: e });
  }

  if (!body.includes('BEGIN:VCALENDAR')) {
    throw new CalendarSyncError('Svaret från Sportadmin var inte en kalender.');
  }

  let incoming;
  try {
    incoming = parseFeed(body);
  } catch (e) {
    throw new CalendarSyncError('Kalendern från Sportadmin kunde inte läsas.', { cause: e });
  }

  // Bara det diffen behöver: framtida händelser (starts_at > now).
  const { data: rows, error: readError } = await supabase
    .from('calendar_events')
    .select('uid, starts_at, cancelled')
    .gt('starts_at', now.toISOString());
  if (readError) throw new CalendarSyncError('Kunde inte läsa sparade händelser.', { cause: readError });
  const existing = (rows ?? []).map((r: { uid: string; starts_at: string; cancelled: boolean }) => ({
    uid: r.uid,
    startsAt: new Date(r.starts_at),
    cancelled: r.cancelled,
  }));

  // Ett tomt flöde när vi har framtida händelser är nästan säkert ett fel hos Sportadmin.
  if (incoming.length === 0 && existing.some((e) => !e.cancelled)) {
    throw new CalendarSyncError('Kalendern från Sportadmin var tom, ingen ändring gjordes.');
  }

  const { upserts, cancelUids } = diffEvents(incoming, existing, now);

  if (upserts.length > 0) {
    // kind_override och description skrivs aldrig.
    const payload = upserts.map((e) => ({
      uid: e.uid,
      summary: e.summary,
      kind: e.kind,
      date: e.date,
      starts_at: e.startsAt.toISOString(),
      ends_at: e.endsAt.toISOString(),
      location: e.location,
      cancelled: false,
      updated_at: now.toISOString(),
    }));
    const { error } = await supabase.from('calendar_events').upsert(payload, { onConflict: 'uid' });
    if (error) throw new CalendarSyncError('Kunde inte spara kalendern.', { cause: error });
  }
  if (cancelUids.length > 0) {
    const { error } = await supabase
      .from('calendar_events')
      .update({ cancelled: true, updated_at: now.toISOString() })
      .in('uid', cancelUids);
    if (error) throw new CalendarSyncError('Kunde inte markera inställda händelser.', { cause: error });
  }
  return { upserted: upserts.length, cancelled: cancelUids.length };
}

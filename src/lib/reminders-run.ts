import type { SupabaseClient } from '@supabase/supabase-js';
import { reminderMessage } from './reminder-message';
import { remindersDue } from './reminders';
import { fetchAll } from './supabase/fetch-all';
import { LOG_COLUMNS, toLog, toMission } from './supabase/rows';
import type { LogEntry } from './types';

export type PushResult = 'sent' | 'gone' | 'error';

export interface PushSubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface RemindersDeps {
  supabase?: SupabaseClient;
  sendPush?: (sub: PushSubRow, payload: { title: string; body: string }) => Promise<PushResult>;
  now?: () => Date;
}

/** Skickar timmens påminnelser. Returnerar antal skickade och borttagna (döda) prenumerationer. */
export async function runReminders(deps: RemindersDeps = {}): Promise<{ sent: number; removed: number }> {
  const now = (deps.now ?? (() => new Date()))();
  // Dynamiska importer: server-only-moduler behövs inte när fakes injiceras.
  const supabase = deps.supabase ?? (await import('./supabase/admin')).createAdminClient();
  const send = deps.sendPush ?? (await import('./push')).sendPush;

  const [profiles, logRows, missions, subs] = await Promise.all([
    fetchAll<{ id: string }>((from, to) =>
      supabase.from('profiles').select('id').eq('role', 'player').order('id').range(from, to),
    ),
    fetchAll<Record<string, unknown>>((from, to) =>
      supabase.from('logs').select(LOG_COLUMNS).order('date').order('id').range(from, to),
    ),
    fetchAll<Record<string, unknown>>((from, to) =>
      supabase.from('missions').select('*').order('id').range(from, to),
    ),
    fetchAll<PushSubRow & { player_id: string }>((from, to) =>
      supabase.from('push_subscriptions').select('id, player_id, endpoint, p256dh, auth').order('id').range(from, to),
    ),
  ]);

  const logsByPlayer = new Map<string, LogEntry[]>(profiles.map((p) => [p.id, []]));
  for (const row of logRows) {
    const log = toLog(row);
    logsByPlayer.get(log.playerId)?.push(log);
  }
  const players = profiles.map((p) => ({ id: p.id, logs: logsByPlayer.get(p.id) ?? [] }));

  const due = remindersDue(now, players, missions.map(toMission));
  const subsByPlayer = new Map<string, PushSubRow[]>();
  for (const s of subs) {
    const list = subsByPlayer.get(s.player_id) ?? [];
    list.push(s);
    subsByPlayer.set(s.player_id, list);
  }

  let sent = 0;
  const gone: string[] = [];
  for (const item of due) {
    const payload = reminderMessage(item.kind, item.streak);
    for (const sub of subsByPlayer.get(item.playerId) ?? []) {
      const result = await send(sub, payload);
      if (result === 'sent') sent++;
      else if (result === 'gone') gone.push(sub.endpoint);
    }
  }

  if (gone.length > 0) {
    const { error } = await supabase.from('push_subscriptions').delete().in('endpoint', gone);
    if (error) {
      console.error('Kunde inte ta bort döda prenumerationer', { code: error.code });
      return { sent, removed: 0 };
    }
  }
  return { sent, removed: gone.length };
}

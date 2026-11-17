import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { LOG_COLUMNS, toLog } from '@/lib/supabase/rows';
import type { LogEntry } from '@/lib/types';

/* Läsningar för tränarsidorna. Alltid med tränarens egen klient (RLS: is_coach()). */

export async function loadPlayers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, role')
    .order('display_name');
  if (error) throw new Error(`Kunde inte läsa spelarna: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.display_name as string,
    username: p.username as string,
    role: p.role as 'player' | 'coach',
  }));
}

/** Alla loggar (alla spelare, eller en). Sidhämtning så att inget kapas vid 1000 rader. */
export async function loadLogs(supabase: SupabaseClient, playerId?: string): Promise<LogEntry[]> {
  const rows = await fetchAll((from, to) => {
    let q = supabase.from('logs').select(LOG_COLUMNS);
    if (playerId) q = q.eq('player_id', playerId);
    return q.order('date').order('id').range(from, to);
  });
  return rows.map(toLog);
}

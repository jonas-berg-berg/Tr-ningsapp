import 'server-only';
import { teamCards, type TeamCard } from '@/lib/card';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAll } from '@/lib/supabase/fetch-all';
import type { ISODate } from '@/lib/types';

/**
 * Lagkemi: alla spelares betyg. Spelare får inte läsa varandras loggar (RLS),
 * så den här läsningen sker med service role på servern, och bara betyg och
 * nivå (utan namn eller id) lämnar funktionen. Anroparen ska redan ha
 * kontrollerat att användaren är med i laget (har en profil).
 */
export async function loadTeamCards(me: string, today: ISODate): Promise<TeamCard[]> {
  const admin = createAdminClient();
  const { data: players, error } = await admin.from('profiles').select('id').eq('role', 'player');
  if (error) throw new Error(`Kunde inte läsa laget: ${error.message}`);
  const ids = (players ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const rows = await fetchAll<{ player_id: string; date: string }>((from, to) =>
    admin.from('logs').select('player_id, date').in('player_id', ids).lte('date', today).order('id').range(from, to),
  );
  return teamCards(rows.map((r) => ({ playerId: r.player_id, date: r.date })), ids, me, today);
}

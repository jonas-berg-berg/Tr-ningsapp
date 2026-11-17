import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toEvent, toGoal, toLog, toMission } from '@/lib/supabase/rows';
import type { ISODate } from '@/lib/types';

/** Allt startsidan behöver, läst med användarens egen (RLS-)klient. */
export async function loadTodayData(supabase: SupabaseClient, userId: string, viewDate: ISODate) {
  const [events, logs, missions, goals] = await Promise.all([
    supabase
      .from('calendar_events_effective')
      .select('uid, summary, kind, date, starts_at, ends_at, location, cancelled')
      .eq('date', viewDate),
    // Egna loggar (tränaren ser alla via RLS, så filtrera alltid på spelaren).
    supabase
      .from('logs')
      .select('id, player_id, date, type, event_uid, other_kind, mission_id, km')
      .eq('player_id', userId)
      .order('date', { ascending: false }),
    supabase.from('missions').select('*'),
    supabase.from('team_goals').select('*').lte('starts_on', viewDate).gte('ends_on', viewDate),
  ]);

  const firstError = events.error ?? logs.error ?? missions.error ?? goals.error;
  if (firstError) throw new Error(`Kunde inte läsa startsidans data: ${firstError.message}`);

  const goalList = (goals.data ?? []).map(toGoal);
  const totals = await Promise.all(
    goalList.map(async (g) => {
      const { data, error } = await supabase.rpc('team_goal_total', { goal_id: g.id });
      if (error) console.error('team_goal_total misslyckades', { goalId: g.id, code: error.code });
      return [g.id, error ? 0 : Number(data ?? 0)] as const;
    }),
  );

  return {
    events: (events.data ?? []).map(toEvent),
    logs: (logs.data ?? []).map(toLog),
    missions: (missions.data ?? []).map(toMission),
    goals: goalList,
    goalTotals: Object.fromEntries(totals) as Record<string, number>,
  };
}

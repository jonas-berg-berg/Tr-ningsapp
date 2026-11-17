import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarEvent, ISODate, LogEntry, Mission, TeamGoal } from '@/lib/types';

/* Radmappning från Supabase till domäntyperna i src/lib/types.ts. */

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function toEvent(r: Row): CalendarEvent {
  return {
    uid: r.uid as string,
    summary: (r.summary as string | null) ?? '',
    startsAt: new Date(r.starts_at as string),
    endsAt: new Date(r.ends_at as string),
    location: (r.location as string | null) ?? null,
    description: null,
    kind: r.kind as CalendarEvent['kind'],
    date: r.date as ISODate,
    cancelled: Boolean(r.cancelled),
  };
}

export function toLog(r: Row): LogEntry {
  return {
    id: r.id as string,
    playerId: r.player_id as string,
    date: r.date as ISODate,
    type: r.type as LogEntry['type'],
    eventUid: (r.event_uid as string | null) ?? null,
    otherKind: (r.other_kind as LogEntry['otherKind']) ?? null,
    missionId: (r.mission_id as string | null) ?? null,
    km: num(r.km),
  };
}

export function toMission(r: Row): Mission {
  return {
    id: r.id as string,
    kind: r.kind as Mission['kind'],
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    targetKm: num(r.target_km),
    weekdays: ((r.weekdays as number[] | null) ?? []).map(Number),
    activeFrom: r.active_from as ISODate,
    activeTo: (r.active_to as ISODate | null) ?? null,
  };
}

export function toGoal(r: Row): TeamGoal {
  return {
    id: r.id as string,
    name: r.name as string,
    metric: r.metric as TeamGoal['metric'],
    target: Number(r.target),
    startsOn: r.starts_on as ISODate,
    endsOn: r.ends_on as ISODate,
    reward: (r.reward as string | null) ?? '',
  };
}

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

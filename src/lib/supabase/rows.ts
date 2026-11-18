import type { CalendarEvent, ISODate, LogEntry, Mission, TeamGoal } from '../types';

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

/** Kolumnerna som `toLog` behöver. */
export const LOG_COLUMNS = 'id, player_id, date, type, event_uid, other_kind, mission_id, km';

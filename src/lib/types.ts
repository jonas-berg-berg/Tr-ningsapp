export type EventKind = 'training' | 'match' | 'other';
export type LogType = 'training' | 'match' | 'other_org' | 'extra' | 'weekly';
export type OtherOrgKind = 'annat_lag' | 'fotboll' | 'ovrigt';
export type ISODate = string; // 'YYYY-MM-DD' i Stockholmstid
export type WeekKey = string; // 'YYYY-Www', t.ex. '2026-W47'

export interface CalendarEventInput {
  uid: string;
  summary: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  description: string | null;
}

export interface CalendarEvent extends CalendarEventInput {
  kind: EventKind;
  date: ISODate;
  cancelled: boolean;
}

export interface LogEntry {
  id: string;
  playerId: string;
  date: ISODate;
  type: LogType;
  eventUid: string | null;
  otherKind: OtherOrgKind | null;
  missionId: string | null;
  km: number | null;
}

export interface Mission {
  id: string;
  kind: 'daily' | 'weekly';
  name: string;
  description: string | null;
  targetKm: number | null;
  weekdays: number[]; // ISO 1=mån..7=sön
  activeFrom: ISODate;
  activeTo: ISODate | null;
}

export interface TeamGoal {
  id: string;
  name: string;
  metric: 'sessions' | 'extra' | 'km';
  target: number;
  startsOn: ISODate;
  endsOn: ISODate;
  reward: string;
}

import type { LogEntry, TeamGoal } from './types';

/** Lagmålets framsteg: loggar inom startsOn..endsOn (inklusive). Råtal, ingen avrundning. */
export function goalProgress(goal: TeamGoal, logs: LogEntry[]): number {
  const inRange = logs.filter((l) => l.date >= goal.startsOn && l.date <= goal.endsOn);
  switch (goal.metric) {
    case 'sessions':
      return inRange.length;
    case 'extra':
      return inRange.filter((l) => l.type === 'extra').length;
    case 'km':
      return inRange.reduce((sum, l) => sum + (l.km ?? 0), 0);
  }
}

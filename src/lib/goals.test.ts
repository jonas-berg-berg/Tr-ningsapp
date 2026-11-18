import { describe, expect, it } from 'vitest';
import { goalProgress } from './goals';
import type { LogEntry, TeamGoal } from './types';

function log(p: Partial<LogEntry>): LogEntry {
  return {
    id: 'l', playerId: 'p1', date: '2026-11-18', type: 'training',
    eventUid: null, otherKind: null, missionId: null, km: null, ...p,
  };
}
const goal = (metric: TeamGoal['metric']): TeamGoal => ({
  id: 'g', name: 'Mål', metric, target: 10,
  startsOn: '2026-11-10', endsOn: '2026-11-20', reward: 'Pizza',
});

describe('goalProgress', () => {
  it('sessions: räknar loggar i perioden, inte före startsOn', () => {
    const logs = [
      log({ date: '2026-11-10' }), log({ date: '2026-11-15' }), log({ date: '2026-11-20' }),
      log({ date: '2026-11-09' }), log({ date: '2026-11-21' }),
    ];
    expect(goalProgress(goal('sessions'), logs)).toBe(3);
  });

  it('extra: bara type extra', () => {
    const logs = [log({ type: 'extra' }), log({ type: 'training' }), log({ type: 'extra', date: '2026-11-01' })];
    expect(goalProgress(goal('extra'), logs)).toBe(1);
  });

  it('km: summerar km, null räknas som 0', () => {
    const logs = [
      log({ type: 'weekly', km: 8 }), log({ type: 'weekly', km: 5.5 }),
      log({ type: 'weekly', km: 3, date: '2026-11-01' }), log({}),
    ];
    expect(goalProgress(goal('km'), logs)).toBe(13.5);
  });
});

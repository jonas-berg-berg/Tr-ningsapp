import type { TodayView } from './today';

/** Vad den stora knappen "Checka in passet" gör just nu. */
export type CheckIn =
  | { kind: 'event'; uid: string; label: string }
  | { kind: 'extra'; missionId: string; label: string }
  | { kind: 'other'; label: string }
  | null;

/**
 * Nästa pass att checka in, i samma ordning som listan: kalenderns pass,
 * sedan extrapasset om det är dagens uppdrag, sedan annan träning (kräver ett val).
 * Ett frivilligt extrapass checkas aldrig in av knappen. null = inget kvar.
 */
export function nextCheckIn(view: Pick<TodayView, 'events' | 'extra' | 'otherOrg'>): CheckIn {
  const event = view.events.find((e) => !e.checked);
  if (event) {
    return { kind: 'event', uid: event.uid, label: `${event.kind === 'match' ? 'Match' : 'Lagträning'} ${event.time}` };
  }
  if (view.extra && !view.extra.checked && view.extra.emphasized) {
    return { kind: 'extra', missionId: view.extra.missionId, label: `Extrapass: ${view.extra.name}` };
  }
  if (!view.otherOrg.checked) return { kind: 'other', label: 'Annan träning' };
  return null;
}

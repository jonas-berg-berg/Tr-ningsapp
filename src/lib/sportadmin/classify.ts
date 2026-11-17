import type { EventKind } from '../types';

export function classifyEvent(summary: string): EventKind {
  const s = summary.trim().toLowerCase();
  if (s.startsWith('match:')) return 'match';
  if (s.startsWith('träning')) return 'training';
  return 'other';
}

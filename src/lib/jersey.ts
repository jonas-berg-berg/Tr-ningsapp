/**
 * Tröjnummer från tränarens formulär. '' betyder inget nummer (null).
 * Ger undefined om värdet är ogiltigt (inte ett heltal 0–99).
 */
export function parseJerseyNumber(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^\d{1,2}$/.test(s)) return undefined;
  return Number(s);
}

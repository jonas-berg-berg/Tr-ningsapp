/** En kalenderlänk måste börja med https:// eller webcal:// och vara en giltig URL med värd. */
export function isCalendarUrl(raw: string): boolean {
  const value = raw.trim();
  if (!/^(https|webcal):\/\//i.test(value) || value.length > 2000) return false;
  try {
    return new URL(value).hostname !== '';
  } catch {
    return false;
  }
}

/** Visar början av länken (högst 30 tecken, högst halva), aldrig hela: den räknas som en hemlighet. */
export function maskUrl(raw: string, visible = 30): string {
  return `${raw.slice(0, Math.min(visible, Math.floor(raw.length / 2)))}…`;
}

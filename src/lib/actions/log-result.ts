export type ActionResult = { ok: true } | { ok: false; error: string };

export const LOG_REJECTED = 'Det går inte att registrera det här passet.';
export const GENERIC_ERROR = 'Något gick fel. Försök igen.';

/**
 * Tolkar resultatet av en logg-insert. unique_violation betyder att passet
 * redan är registrerat (t.ex. dubbeltryck) och räknas som lyckat.
 */
export function logInsertResult(error: { code?: string; message?: string } | null): ActionResult {
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: true };
  if (error.code === '42501') return { ok: false, error: LOG_REJECTED };
  return { ok: false, error: GENERIC_ERROR };
}

/** Km som decimaltal med komma eller punkt, > 0 och ≤ 100. Annars null. */
export function parseKm(raw: string | number): number | null {
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else {
    const s = raw.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    n = Number(s);
  }
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

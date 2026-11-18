/** Resultat från tränarens formulär-actions (useActionState). */
export type FormState = { ok?: string; error?: string; link?: string } | undefined;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ett trimmat textfält från formuläret ('' om det saknas). */
export function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

/** Giltigt kalenderdatum 'YYYY-MM-DD'. */
export function isISODate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

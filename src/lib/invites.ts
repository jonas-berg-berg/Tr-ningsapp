/** Hur länge en inbjudningslänk gäller. */
export const INVITE_VALID_DAYS = 7;

/** Äldsta tillåtna created_at (ISO) för en inbjudan som löses in vid `now`. */
export function inviteCutoff(now: Date): string {
  return new Date(now.getTime() - INVITE_VALID_DAYS * 86_400_000).toISOString();
}

/** Har inbjudan gått ut? Ogiltigt datum räknas som utgånget. */
export function isInviteExpired(createdAt: string | Date, now: Date): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return true;
  return t < now.getTime() - INVITE_VALID_DAYS * 86_400_000;
}

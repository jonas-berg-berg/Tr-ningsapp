/** Appens origin från förfrågans host och x-forwarded-proto. Ingen hårdkodad domän. */
export function originFrom(host: string | null, forwardedProto: string | null): string | null {
  if (!host) return null;
  const proto =
    forwardedProto?.split(',')[0].trim() || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

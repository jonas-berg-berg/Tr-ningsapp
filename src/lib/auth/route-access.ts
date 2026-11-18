/**
 * Vad proxyn gör med en utloggad förfrågan:
 * - 'allow': publik sida (inloggning, inbjudan) eller cron (egen Bearer-kontroll)
 * - 'unauthorized': API-anrop får 401 JSON, inte en omdirigering till en HTML-sida
 * - 'redirect': sidor skickas till /login
 */
export function unauthenticatedAccess(pathname: string): 'allow' | 'unauthorized' | 'redirect' {
  if (pathname === '/login' || pathname.startsWith('/invite/') || pathname.startsWith('/api/cron/')) return 'allow';
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'unauthorized';
  return 'redirect';
}

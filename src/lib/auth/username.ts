const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

/**
 * Normaliserar ett användarnamn: trimmar, gemener, å/ä/ö blir a/a/o.
 * Tillåtna tecken är a-z, 0-9, punkt, understreck och bindestreck (3–20 st).
 * Returnerar null om resultatet inte är giltigt.
 */
export function normalizeUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o');
  return USERNAME_RE.test(u) ? u : null;
}

/** Spelare har ingen e-post; Supabase Auth får en intern adress per användarnamn. */
export function usernameToEmail(u: string): string {
  return `${u}@spelare.traningsappen.invalid`;
}

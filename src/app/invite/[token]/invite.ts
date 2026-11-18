import 'server-only';
import { inviteCutoff } from '@/lib/invites';
import { createAdminClient } from '@/lib/supabase/admin';

export const INVALID_INVITE = 'Länken är ogiltig eller redan använd';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidToken(token: string): boolean {
  return UUID_RE.test(token);
}

/** Visningsnamnet för en oanvänd inbjudan som inte gått ut (7 dagar), annars null. */
export async function findOpenInvite(token: string): Promise<{ displayName: string } | null> {
  if (!isValidToken(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('invites')
    .select('display_name')
    .eq('token', token)
    .is('used_at', null)
    .gte('created_at', inviteCutoff(new Date()))
    .maybeSingle();
  return data ? { displayName: data.display_name as string } : null;
}

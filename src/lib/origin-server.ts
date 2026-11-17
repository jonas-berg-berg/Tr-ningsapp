import 'server-only';
import { headers } from 'next/headers';
import { originFrom } from './origin';

/** Appens origin för den aktuella förfrågan (host + x-forwarded-proto). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  return originFrom(h.get('host'), h.get('x-forwarded-proto')) ?? '';
}

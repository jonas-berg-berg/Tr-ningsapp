import { connection } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 2048) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512;

/** Registrera (eller flytta till den inloggade spelaren) en push-prenumeration. */
export async function POST(req: Request) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Inte inloggad' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ogiltig begäran' }, { status: 400 });
  }
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!b || !isHttpsUrl(b.endpoint) || !isKey(b.keys?.p256dh) || !isKey(b.keys?.auth)) {
    return Response.json({ error: 'Ogiltig prenumeration' }, { status: 400 });
  }

  // endpoint är globalt unik (delad enhet): admin-upsert flyttar raden till sessionens användare.
  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .upsert(
      { player_id: user.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
      { onConflict: 'endpoint' },
    );
  if (error) {
    console.error('Kunde inte spara prenumeration', { code: error.code });
    return Response.json({ error: 'Kunde inte spara prenumerationen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

/** Ta bort den egna prenumerationen för en endpoint (RLS begränsar till egna rader). */
export async function DELETE(req: Request) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Inte inloggad' }, { status: 401 });

  let endpoint: unknown;
  try {
    endpoint = ((await req.json()) as { endpoint?: unknown } | null)?.endpoint;
  } catch {
    return Response.json({ error: 'Ogiltig begäran' }, { status: 400 });
  }
  if (!isHttpsUrl(endpoint)) return Response.json({ error: 'Ogiltig prenumeration' }, { status: 400 });

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('player_id', user.id);
  if (error) {
    console.error('Kunde inte ta bort prenumeration', { code: error.code });
    return Response.json({ error: 'Kunde inte ta bort prenumerationen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

import 'server-only';
import * as webpush from 'web-push';
import type { PushResult } from './reminders-run';

export { reminderMessage } from './reminder-message';

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('VAPID-nycklar saknas');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.invalid', publicKey, privateKey);
  configured = true;
}

/** Skickar en push. 404/410 = prenumerationen är död ('gone'), övriga fel = 'error'. */
export async function sendPush(sub: PushSub, payload: { title: string; body: string }): Promise<PushResult> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ ...payload, url: '/' }),
      { TTL: 60 * 60 * 6 },
    );
    return 'sent';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    console.error('Push misslyckades', { status });
    return 'error';
  }
}

import { connection } from 'next/server';
import { isAuthorizedCron } from '../../../../lib/cron-auth';
import { runReminders } from '../../../../lib/reminders-run';

// Med cacheComponents körs GET vid anropstillfället; connection() gör det explicit.
export async function GET(req: Request) {
  await connection();
  if (!isAuthorizedCron(req, process.env.CRON_SECRET ?? '')) {
    return Response.json({ error: 'Obehörig' }, { status: 401 });
  }
  try {
    // ?now=<ISO> är bara till för lokal testning, aldrig i produktion.
    let now: Date | undefined;
    const override = new URL(req.url).searchParams.get('now');
    if (override && process.env.NODE_ENV !== 'production') {
      const parsed = new Date(override);
      if (Number.isNaN(parsed.getTime())) {
        return Response.json({ error: 'Ogiltigt now-värde' }, { status: 400 });
      }
      now = parsed;
    }
    return Response.json(await runReminders(now ? { now: () => now } : {}));
  } catch (e) {
    // Logga bara kod/typ, aldrig hela felet (kan innehålla nycklar eller endpoints).
    console.error('Påminnelser misslyckades', { name: e instanceof Error ? e.name : 'okänt' });
    return Response.json({ error: 'Påminnelser misslyckades.' }, { status: 500 });
  }
}

import { connection } from 'next/server';
import { isAuthorizedCron } from '../../../../lib/cron-auth';
import { CalendarSyncError, runCalendarSync } from '../../../../lib/sportadmin/sync';

// Med cacheComponents körs GET vid anropstillfället; connection() gör det explicit.
export async function GET(req: Request) {
  await connection();
  if (!isAuthorizedCron(req, process.env.CRON_SECRET ?? '')) {
    return Response.json({ error: 'Obehörig' }, { status: 401 });
  }
  try {
    return Response.json(await runCalendarSync());
  } catch (e) {
    const cause = e instanceof Error ? (e.cause as { name?: string; code?: string } | undefined) : undefined;
    // Logga aldrig hela felkedjan: den kan innehålla flödets URL.
    console.error('Kalendersynk misslyckades', {
      message: e instanceof Error ? e.message : 'okänt fel',
      causeName: cause?.name,
      causeCode: cause?.code,
    });
    const message = e instanceof CalendarSyncError ? e.message : 'Kalendersynk misslyckades.';
    return Response.json({ error: message }, { status: 502 });
  }
}

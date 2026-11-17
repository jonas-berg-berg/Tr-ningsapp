import { isAuthorizedCron } from '../../../../lib/cron-auth';
import { CalendarSyncError, runCalendarSync } from '../../../../lib/sportadmin/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req, process.env.CRON_SECRET ?? '')) {
    return Response.json({ error: 'Obehörig' }, { status: 401 });
  }
  try {
    return Response.json(await runCalendarSync());
  } catch (e) {
    console.error('Kalendersynk misslyckades', e);
    const message = e instanceof CalendarSyncError ? e.message : 'Kalendersynk misslyckades.';
    return Response.json({ error: message }, { status: 502 });
  }
}

-- 0002_cron: schemalägger de två anropen mot appens cron-rutter (varje timme, vid minut 5).
-- Kräver Supabase (pg_cron, pg_net och Vault finns inte i den lokala testdatabasen,
-- därför laddas den här filen aldrig av `npm run test:db`).
--
-- Appens URL och cron-hemligheten läses ur Supabase Vault vid varje körning, så inga
-- hemligheter ligger i git. Lägg in dem i Vault (se README, steg 5):
--   select vault.create_secret('https://din-app.vercel.app', 'app_url');
--   select vault.create_secret('din-cron-hemlighet', 'cron_secret');

-- Enligt Supabases dokumentation ska pg_cron ligga i pg_catalog och pg_net i extensions.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Idempotent: ta bort befintliga jobb med samma namn innan de skapas på nytt.
select cron.unschedule(jobname)
from cron.job
where jobname in ('sync-calendar', 'send-reminders');

select cron.schedule(
  'sync-calendar',
  '5 * * * *',
  $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/sync-calendar',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    -- Standard är 5 s; kalendersynken och utskicket kan ta längre tid.
    timeout_milliseconds := 30000
  );
  $job$
);

select cron.schedule(
  'send-reminders',
  '5 * * * *',
  $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    -- Standard är 5 s; kalendersynken och utskicket kan ta längre tid.
    timeout_milliseconds := 30000
  );
  $job$
);

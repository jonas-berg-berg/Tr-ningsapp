# Träningsappen – byggplan

> **För agenter som bygger:** OBLIGATORISK DELFÄRDIGHET: Använd superpowers:subagent-driven-development (rekommenderas) eller superpowers:executing-plans för att genomföra planen uppgift för uppgift. Stegen använder kryssrutor (`- [ ]`) för att följa framstegen.

**Mål:** En mobilanpassad webbapp (PWA) där lag P11/12 loggar lagträning, match, annan organiserad träning och egenträning. Appen räknar streaks med frysdag, visar lagmål och skickar påminnelser. Tränarna ser allas statistik.

**Arkitektur:** All affärslogik ligger som rena TypeScript-funktioner i `src/lib/` och testas med Vitest:
- datum i Stockholmstid
- klassning av Sportadmin-händelser
- streaks
- lagmål
- loggfönster
- påminnelsebeslut
- vybyggare

Next.js (App Router) står för sidor, server actions och API-rutter. Supabase (Postgres i EU, Auth och RLS) lagrar allt. Supabase Cron (pg_cron + pg_net) anropar appens cron-rutter varje timme, eftersom Vercels gratisnivå bara tillåter dagliga cron-jobb.

**Teknik:** Next.js 15 (TypeScript, App Router), Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `node-ical`, `web-push`, Vitest, Supabase CLI (lokal databas och pgTAP-tester), Vercel.

**Spec:** `docs/superpowers/specs/2026-11-17-traningsappen-design.md`

## Globala krav

- Allt gränssnitt är på svenska.
- Alla dagberäkningar görs i tidszonen `Europe/Stockholm`. Datum lagras som `date` i formatet `YYYY-MM-DD`, aldrig som UTC-datum.
- Veckor räknas måndag–söndag (ISO).
- Ett lag. Inga topplistor, inga foton, ingen föräldravy och inga flera lag.
- Personuppgifter: bara visningsnamn (förnamn, eventuellt med efternamnsinitial), användarnamn och lösenord. Ingen e-post. Supabase-projektet ligger i EU-region.
- En spelare kan bara läsa sina egna loggar. Tränare (`role = 'coach'`) kan läsa och rätta allt. Detta tvingas fram med RLS, inte bara i gränssnittet.
- Sportadmin-länken är hemlig och lagras i tabellen `settings`. Den ska aldrig finnas i koden, i git eller i klientkod.
- Spelare kan registrera pass för **idag och igår** (Stockholmstid). Tränare kan registrera och rätta valfritt datum.
- 1 frysdag per ISO-vecka. Den andra missade dagen samma vecka bryter dagstreaken.
- Påminnelser: kl. 19:00 Stockholmstid om dagen inte är aktiv, och söndag kl. 15:00 om veckouppdraget inte är klart.
- Alla cron-rutter kräver `Authorization: Bearer ${CRON_SECRET}`.

## Fokus vid granskning

1. **Midnatt och sommartid.** En registrering kl. 23:30 eller 00:30 Stockholmstid, och veckan då klockan ställs om, ska hamna på rätt datum och i rätt vecka. Testas i Uppgift 1 och 3.
2. **Inställd händelse efter avbockning.** Om en träning försvinner ur Sportadmin efter att en spelare kryssat "Jag var där" ska loggen och streaken finnas kvar. Testas i Uppgift 5 (sync-diff) och Uppgift 4 (FK utan cascade).
3. **Dubbeltryck.** Två snabba tryck på samma knapp ska ge en enda logg. Testas i Uppgift 4 (unika index) och Uppgift 7 (idempotent action).
4. **Två matcher samma dag** (Svart och Röd, till exempel 6 december). Båda visas, och var och en kan kryssas oberoende. Testas i Uppgift 7 (`buildTodayView`).
5. **Registrering av "igår" över veckogräns.** En registrering på måndag för söndag ska räknas till förra veckans veckouppdrag och frysdag. Testas i Uppgift 3 och 6.

---

## Filstruktur

```
src/lib/dates.ts                 Stockholmsdatum, ISO-vecka, datumaritmetik
src/lib/sportadmin/classify.ts   SUMMARY → 'training' | 'match' | 'other'
src/lib/sportadmin/parse.ts      iCal-text → CalendarEventInput[]
src/lib/sportadmin/diff.ts       nya/ändrade/inställda händelser mot databasen
src/lib/streaks.ts               dagstreak med frysdag, veckostreak
src/lib/goals.ts                 lagmålens framsteg
src/lib/logging.ts               loggfönster, aktiv dag
src/lib/reminders.ts             vem ska få påminnelse nu
src/lib/views/today.ts           spelarens startsida
src/lib/views/stats.ts           personlig statistik
src/lib/views/coach.ts           tränaröversikt
src/lib/auth/username.ts         användarnamn → syntetisk e-post, validering
src/lib/types.ts                 delade typer
src/lib/supabase/{server,client,admin}.ts
supabase/migrations/0001_init.sql
supabase/tests/rls.test.sql
src/app/...                      sidor, actions, API-rutter
public/manifest.webmanifest, public/sw.js
tests/fixtures/sportadmin.ics    anonymiserad kopia av flödets struktur
```

## Delade typer (`src/lib/types.ts`)

```ts
export type EventKind = 'training' | 'match' | 'other';
export type LogType = 'training' | 'match' | 'other_org' | 'extra' | 'weekly';
export type OtherOrgKind = 'annat_lag' | 'fotboll' | 'ovrigt';
export type ISODate = string;   // 'YYYY-MM-DD' i Stockholmstid
export type WeekKey = string;   // 'YYYY-Www', t.ex. '2026-W47'

export interface CalendarEventInput { uid: string; summary: string; startsAt: Date; endsAt: Date; location: string | null; description: string | null; }
export interface CalendarEvent extends CalendarEventInput { kind: EventKind; date: ISODate; cancelled: boolean; }
export interface LogEntry { id: string; playerId: string; date: ISODate; type: LogType; eventUid: string | null; otherKind: OtherOrgKind | null; missionId: string | null; km: number | null; }
export interface Mission { id: string; kind: 'daily' | 'weekly'; name: string; description: string | null; targetKm: number | null; weekdays: number[]; activeFrom: ISODate; activeTo: ISODate | null; } // weekdays: ISO 1=mån..7=sön
export interface TeamGoal { id: string; name: string; metric: 'sessions' | 'extra' | 'km'; target: number; startsOn: ISODate; endsOn: ISODate; reward: string; }
```

---

### Uppgift 1: Projektgrund och datumfunktioner

**Filer:**
- Skapa: Next.js-projekt i repo-roten (`npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint --no-import-alias`), `vitest.config.ts`, `src/lib/types.ts`, `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Gränssnitt:**
- Producerar: `toStockholmDate(d: Date): ISODate`, `isoWeekKey(date: ISODate): WeekKey`, `addDays(date: ISODate, n: number): ISODate`, `isoWeekday(date: ISODate): number` (1–7), `stockholmHour(d: Date): number`, `weekDates(week: WeekKey): ISODate[]`

- [ ] **Steg 1: Skapa projektet, installera `vitest` och lägg till `"test": "vitest run"` i package.json. Lägg in typerna ovan.**
- [ ] **Steg 2: Skriv de fallerande testerna**

```ts
expect(toStockholmDate(new Date('2026-11-17T22:30:00Z'))).toBe('2026-11-17'); // 23:30 lokal
expect(toStockholmDate(new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18'); // 00:30 lokal
expect(toStockholmDate(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02'); // sommartid, 00:30 lokal
expect(toStockholmDate(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25'); // omställningsnatt
expect(isoWeekKey('2026-11-16')).toBe('2026-W47');
expect(isoWeekKey('2026-11-22')).toBe('2026-W47');
expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
expect(isoWeekday('2026-11-22')).toBe(7);
expect(stockholmHour(new Date('2026-11-17T18:00:00Z'))).toBe(19);
expect(stockholmHour(new Date('2026-07-01T17:00:00Z'))).toBe(19);
expect(weekDates('2026-W47')).toEqual(['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22']);
```

- [ ] **Steg 3: Kör `npm test`. Förväntat: FAIL (funktionerna saknas).**
- [ ] **Steg 4: Implementera i `src/lib/dates.ts`.** Använd `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' })` för konvertering. ISODate-aritmetik görs som UTC-middag (`T12:00:00Z`) så att sommartid aldrig påverkar.
- [ ] **Steg 5: Kör `npm test`. Förväntat: PASS.**
- [ ] **Steg 6: Commit `feat: projektgrund och Stockholmsdatum`**

### Uppgift 2: Läsa och klassa Sportadmin-kalendern

**Filer:**
- Skapa: `src/lib/sportadmin/classify.ts`, `src/lib/sportadmin/parse.ts`, `tests/fixtures/sportadmin.ics`
- Test: `src/lib/sportadmin/classify.test.ts`, `src/lib/sportadmin/parse.test.ts`

**Gränssnitt:**
- Konsumerar: `toStockholmDate`
- Producerar: `classifyEvent(summary: string): EventKind`, `parseFeed(ics: string): CalendarEventInput[]`

Fixturen är en VCALENDAR med `X-WR-TIMEZONE:Europe/Stockholm` och VEVENTs med `DTSTART;TZID=Europe/Stockholm`. Den innehåller:
- en händelse med SUMMARY `Träning - P11/12`
- en med `Fotografering  - P11/12` (två mellanslag, som i originalet)
- två matcher den 2026-12-06 med SUMMARY `Match: Lag A - FBC Lerum Utveckling P11/12 Svart (Serie X)` kl. 12:00 och `Match: FBC Lerum Utveckling P11/12 Röd - Lag B (Serie Y)` kl. 16:10
- en händelse med DESCRIPTION som innehåller `\n`

Inga riktiga personnamn.

- [ ] **Steg 1: Skriv tester**

```ts
expect(classifyEvent('Träning - P11/12')).toBe('training');
expect(classifyEvent('  träning extra')).toBe('training');
expect(classifyEvent('Match: A - B (Serie)')).toBe('match');
expect(classifyEvent('Fotografering  - P11/12')).toBe('other');
expect(classifyEvent('Matchgenomgång')).toBe('other'); // bara "Match:" räknas
const ev = parseFeed(fixture);
expect(ev).toHaveLength(5);
expect(ev.find(e => e.summary.startsWith('Träning'))!.startsAt.toISOString()).toBe('2026-11-17T18:00:00.000Z');
expect(ev.filter(e => toStockholmDate(e.startsAt) === '2026-12-06')).toHaveLength(2);
expect(ev.every(e => e.uid.length > 0)).toBe(true);
```

- [ ] **Steg 2: Kör testerna. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera.** `classifyEvent` trimmar, gör om till gemener och kollar prefixen `match:` och `träning`. `parseFeed` använder `ical.sync.parseICS` från `node-ical`, filtrerar `type === 'VEVENT'` och sätter `null` för tomma fält.
- [ ] **Steg 4: Kör testerna. Förväntat: PASS.**
- [ ] **Steg 5: Commit `feat: läsa och klassa Sportadmin-kalendern`**

### Uppgift 3: Streaks med frysdag

**Filer:**
- Skapa: `src/lib/streaks.ts`
- Test: `src/lib/streaks.test.ts`

**Gränssnitt:**
- Konsumerar: `addDays`, `isoWeekKey`
- Producerar: `dayStreak(activeDates: Set<ISODate>, today: ISODate): { current: number; frozenDates: ISODate[] }`, `weekStreak(completedWeeks: Set<WeekKey>, today: ISODate): number`

**Algoritm för `dayStreak`** (spec: 1 frysdag per ISO-vecka):

Gå bakåt dag för dag. Om `today` inte är aktiv hoppar du över den utan att räkna den som missad, eftersom dagen pågår. För varje dag gäller:
- Aktiv dag: `current += 1`.
- Inaktiv dag och veckans frysdag inte använd: markera den som frusen och fortsätt. En frusen dag räknas inte i `current`.
- Annars: stopp.

Stoppa också vid första aktiva dag minus 1 när inga fler aktiva dagar finns bakåt. Frusna dagar efter den sista äkta aktiva dagen (bakåt räknat) tas bort ur `frozenDates`.

**`weekStreak`:** räkna veckor i rad bakåt med veckonyckel i `completedWeeks`. Om innevarande vecka inte är klar ännu bryter den inte streaken, utan räkningen börjar från förra veckan.

- [ ] **Steg 1: Skriv tester** (hjälpfunktionen `S(...dates)` bygger ett Set)

```ts
expect(dayStreak(S(), '2026-11-18').current).toBe(0);
expect(dayStreak(S('2026-11-16','2026-11-17','2026-11-18'), '2026-11-18').current).toBe(3);
expect(dayStreak(S('2026-11-16','2026-11-17'), '2026-11-18').current).toBe(2);           // idag pågår
const r = dayStreak(S('2026-11-16','2026-11-18'), '2026-11-18');                          // tis missad
expect(r.current).toBe(2); expect(r.frozenDates).toEqual(['2026-11-17']);
expect(dayStreak(S('2026-11-16','2026-11-19'), '2026-11-19').current).toBe(1);             // två missar samma vecka
expect(dayStreak(S('2026-11-14','2026-11-16','2026-11-18'), '2026-11-18').current).toBe(3); // en frysdag i v46 och en i v47
expect(dayStreak(S('2026-11-15'), '2026-11-17').current).toBe(1);                          // sön aktiv, mån frusen, tis = idag
expect(weekStreak(new Set(['2026-W45','2026-W46']), '2026-11-18')).toBe(2);               // v47 pågår
expect(weekStreak(new Set(['2026-W45','2026-W46','2026-W47']), '2026-11-22')).toBe(3);
expect(weekStreak(new Set(['2026-W45']), '2026-11-18')).toBe(0);                          // v46 missad
```

- [ ] **Steg 2: Kör testerna. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera `src/lib/streaks.ts`.**
- [ ] **Steg 4: Kör testerna. Förväntat: PASS.**
- [ ] **Steg 5: Commit `feat: dag- och veckostreaks med frysdag`**

### Uppgift 4: Databas, behörigheter och Supabase-klienter

**Filer:**
- Skapa: `supabase/migrations/0001_init.sql`, `supabase/tests/rls.test.sql`, `src/lib/supabase/server.ts` (cookies, anon-nyckel), `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts` (service role, endast server), `.env.example`

**Gränssnitt:**
- Producerar tabeller (snake_case i SQL, mappas till typerna ovan):
  - `profiles(id uuid pk references auth.users, display_name text not null, username text unique not null, role text check in ('player','coach') default 'player', created_at)`
  - `invites(token uuid pk default gen_random_uuid(), display_name text not null, role text not null default 'player', created_by uuid, used_at timestamptz)`
  - `calendar_events(uid text pk, summary text, kind text, kind_override text null, date date, starts_at timestamptz, ends_at timestamptz, location text, cancelled bool default false, updated_at)`. Den effektiva typen är `coalesce(kind_override, kind)` via vyn `calendar_events_effective`.
  - `missions(id uuid pk, kind text check in ('daily','weekly'), name, description, target_km numeric null, weekdays int[] default '{}', active_from date, active_to date null)`
  - `logs(id uuid pk, player_id uuid references profiles not null, date date not null, type text check in ('training','match','other_org','extra','weekly'), event_uid text null` (**ingen FK** till `calendar_events`, så att inställda händelser inte raderar loggar)`, event_title text null, other_kind text null, mission_id uuid null, km numeric null check (km is null or km > 0), created_by uuid, created_at)`
    - Unika index: `(player_id, event_uid) where event_uid is not null`, `(player_id, date, type) where type in ('extra','other_org')`, `(player_id, date, mission_id) where type = 'weekly'`
  - `team_goals(id uuid pk, name, metric text check in ('sessions','extra','km'), target numeric, starts_on date, ends_on date, reward text)`
  - `push_subscriptions(id uuid pk, player_id uuid references profiles, endpoint text unique, p256dh text, auth text, created_at)`
  - `settings(key text pk, value text)`
  - SQL-funktionen `is_coach() returns bool` (security definer)
- **RLS:**
  - `logs`: spelare har select, insert och delete på egna rader där `date between (now() at time zone 'Europe/Stockholm')::date - 1 and (now() at time zone 'Europe/Stockholm')::date`. Coach har allt.
  - `profiles`: spelare har select på egen rad. Coach har allt.
  - `calendar_events`, `missions` och `team_goals`: alla inloggade har select. Coach har skrivrätt.
  - `push_subscriptions`: egna rader.
  - `settings`: bara coach.
  - `invites`: bara coach (inlösen sker med service role).
- RPC: `team_goal_total(goal_id uuid) returns numeric` (security definer). Spelare kan alltså se lagets summa utan att kunna läsa andras loggar.

- [ ] **Steg 1: Skriv pgTAP-tester i `supabase/tests/rls.test.sql`** med två spelare (A, B) och en tränare:
  - A ser 0 av B:s loggar.
  - A kan inte infoga en logg med `player_id = B`.
  - A kan inte infoga en logg med `date` = idag − 2 eller idag + 1.
  - A kan infoga med datum idag och idag − 1.
  - En andra insert av samma `(player_id, event_uid)` ger `unique_violation`.
  - Tränaren ser alla loggar.
  - A kan inte läsa `settings`.
  - `team_goal_total` returnerar summan av både A:s och B:s loggar när A anropar den.
  - När en rad i `calendar_events` raderas finns loggen kvar.
- [ ] **Steg 2: Kör `supabase start && supabase test db`. Förväntat: FAIL (tabellerna saknas).**
- [ ] **Steg 3: Skriv `0001_init.sql` enligt gränssnittet ovan.**
- [ ] **Steg 4: Kör `supabase db reset && supabase test db`. Förväntat: alla PASS.**
- [ ] **Steg 5: Skapa de tre Supabase-klienterna och `.env.example`** med `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` och `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. `admin.ts` börjar med `import 'server-only'`.
- [ ] **Steg 6: Commit `feat: databasschema med RLS`**

### Uppgift 5: Synk av Sportadmin-kalendern

**Filer:**
- Skapa: `src/lib/sportadmin/diff.ts`, `src/app/api/cron/sync-calendar/route.ts`, `src/lib/cron-auth.ts`
- Test: `src/lib/sportadmin/diff.test.ts`, `src/lib/cron-auth.test.ts`

**Gränssnitt:**
- Konsumerar: `parseFeed`, `classifyEvent`, `toStockholmDate`, admin-klienten
- Producerar:
  - `diffEvents(incoming: CalendarEventInput[], existing: CalendarEvent[], now: Date): { upserts: CalendarEvent[]; cancelUids: string[] }`
  - `isAuthorizedCron(req: Request, secret: string): boolean`
  - `GET /api/cron/sync-calendar` → `{ upserted: number; cancelled: number }`

Regler för `diffEvents`:
- Varje inkommande händelse blir en upsert med `kind = classifyEvent(summary)` och `date = toStockholmDate(startsAt)`. `cancelled` blir `false`, så att en händelse som kommer tillbaka återställs.
- En befintlig händelse som saknas i flödet och har `startsAt > now` hamnar i `cancelUids`.
- Händelser som redan har varit och saknas i flödet rörs aldrig. Sportadmin slutar ofta skicka gamla händelser.

- [ ] **Steg 1: Skriv tester**

```ts
// ny händelse → upsert, kind 'match', date '2026-12-06'
// befintlig framtida som saknas → cancelUids innehåller dess uid
// befintlig passerad som saknas → inte i cancelUids
// befintlig cancelled som dyker upp igen → upsert med cancelled false
expect(isAuthorizedCron(new Request('http://x', { headers: { authorization: 'Bearer s' } }), 's')).toBe(true);
expect(isAuthorizedCron(new Request('http://x'), 's')).toBe(false);
```

- [ ] **Steg 2: Kör testerna. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera `diffEvents` och `isAuthorizedCron`.**
- [ ] **Steg 4: Implementera rutten:** kontrollera cron-auth (401 annars), läs `settings.sportadmin_url`, gör om `webcal://` till `https://`, `fetch` med timeout på 15 s. Vid fel eller annat än 200: logga felet och returnera 502 utan att ändra databasen. Annars kör du `parseFeed` och `diffEvents`, upsertar och sätter `cancelled = true`. `kind_override` skrivs aldrig över.
- [ ] **Steg 5: Kör testerna. Förväntat: PASS. Manuellt: lägg in Jonas länk i lokala `settings` och kör `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sync-calendar`. Förväntat: `upserted` > 0.**
- [ ] **Steg 6: Commit `feat: synk av Sportadmin-kalendern`**

### Uppgift 6: Loggregler, lagmål och påminnelsebeslut

**Filer:**
- Skapa: `src/lib/logging.ts`, `src/lib/goals.ts`, `src/lib/reminders.ts`
- Test: `src/lib/logging.test.ts`, `src/lib/goals.test.ts`, `src/lib/reminders.test.ts`

**Gränssnitt:**
- Konsumerar: `dates`, `streaks`
- Producerar:
  - `canPlayerLog(date: ISODate, today: ISODate): boolean`
  - `activeDates(logs: LogEntry[]): Set<ISODate>`. Alla loggtyper utom `'weekly'` gör dagen aktiv. En `'weekly'`-logg (löprundan) gör också dagen aktiv, eftersom det är träning.
  - `completedWeeks(logs: LogEntry[], missions: Mission[]): Set<WeekKey>`. En vecka är klar om summan av `km` för `type = 'weekly'` och missionen ≥ `targetKm`. Om `targetKm` är null räcker en logg.
  - `goalProgress(goal: TeamGoal, logs: LogEntry[]): number`. Bara loggar inom `startsOn`..`endsOn` räknas. `sessions` räknar alla loggar, `extra` räknar `type = 'extra'` och `km` summerar `km`.
  - `remindersDue(now: Date, players: { id: string; logs: LogEntry[] }[], missions: Mission[]): { playerId: string; kind: 'daily' | 'weekly'; streak: number }[]`

Regler för påminnelser:
- **daily:** Stockholmstimmen är 19 och spelaren har ingen aktiv dag idag.
- **weekly:** isoWeekday är 7, timmen är 15, det finns en aktiv weekly-mission och veckan är inte klar.

- [ ] **Steg 1: Skriv tester**

```ts
expect(canPlayerLog('2026-11-18','2026-11-18')).toBe(true);
expect(canPlayerLog('2026-11-17','2026-11-18')).toBe(true);
expect(canPlayerLog('2026-11-16','2026-11-18')).toBe(false);
expect(canPlayerLog('2026-11-19','2026-11-18')).toBe(false);
// completedWeeks: weekly-logg 5 km sön 22/11 + 4 km lör 21/11, target 8 → '2026-W47'
// completedWeeks: en logg daterad sön 22/11, inlagd mån 23/11 → räknas till '2026-W47', inte W48
// goalProgress sessions: 3 loggar inom perioden + 1 före startsOn → 3
// goalProgress km: 8 + 5.5 → 13.5
// remindersDue kl 18:00Z 2026-11-18 (19 lokal), spelare utan logg idag → daily; med logg → inget
// remindersDue kl 17:00Z → tomt
// remindersDue sön 2026-11-22 14:00Z (15 lokal), weekly ej klar → weekly
```

- [ ] **Steg 2: Kör testerna. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera de tre filerna.**
- [ ] **Steg 4: Kör testerna. Förväntat: PASS.**
- [ ] **Steg 5: Commit `feat: loggregler, lagmål och påminnelsebeslut`**

### Uppgift 7: Inloggning, inbjudningar och spelarens startsida

**Filer:**
- Skapa: `src/lib/auth/username.ts`, `src/lib/views/today.ts`, `src/middleware.ts` (sessionsuppdatering och skydd av allt utom `/login` och `/invite/*`), `src/app/login/page.tsx`, `src/app/invite/[token]/page.tsx` och `actions.ts`, `src/app/(player)/page.tsx`, `src/app/(player)/actions.ts`, `src/components/` (TodayCard, StreakBadge, GoalMeter)
- Test: `src/lib/auth/username.test.ts`, `src/lib/views/today.test.ts`

**Gränssnitt:**
- Konsumerar: allt i `src/lib`, Supabase-klienterna
- Producerar:
  - `normalizeUsername(raw: string): string | null`: gemener, `a-z0-9._-`, 3–20 tecken, å/ä/ö blir a/a/o, annars null.
  - `usernameToEmail(u: string): string`: ger `${u}@spelare.traningsappen.invalid`.
  - `buildTodayView(input: { today: ISODate; events: CalendarEvent[]; logs: LogEntry[]; missions: Mission[]; goals: TeamGoal[]; goalTotals: Record<string, number> }): TodayView`
  - Server actions:
    - `logEvent(eventUid: string)`
    - `logOtherOrg(date: ISODate, kind: OtherOrgKind)`
    - `logExtra(date: ISODate, missionId: string)`
    - `logWeekly(date: ISODate, missionId: string, km: number)`
    - `undoLog(logId: string)`

```ts
interface TodayView {
  date: ISODate;
  dayStreak: number; weekStreak: number; frozenThisWeek: boolean;
  events: { uid: string; kind: 'training' | 'match'; title: string; time: string; checked: boolean }[]; // 'other' och cancelled utelämnas, sorterade på tid
  otherOrg: { checked: boolean; kind: OtherOrgKind | null };
  extra: { missionId: string; name: string; description: string | null; checked: boolean; emphasized: boolean } | null; // emphasized = ingen organiserad logg idag
  weekly: { missionId: string; name: string; targetKm: number | null; doneKm: number; complete: boolean; availableToday: boolean } | null;
  goals: { id: string; name: string; total: number; target: number; reward: string }[];
  canLogYesterday: boolean;
}
```

- [ ] **Steg 1: Skriv tester**
  - `normalizeUsername('Elias_09')` ger `'elias_09'`, `'Åke'` ger `'ake'` och `'a'` ger `null`.
  - I `buildTodayView` med två matcher 2026-12-06 och en fotografering visas 2 events. Ordningen är kl. 12:00 före 16:10, och `kind` är `'match'` på båda.
  - En kryssad match ger `checked: true` bara på den matchen.
  - `extra.emphasized` är `true` utan organiserad logg och `false` med en `'training'`-logg.
  - En cancelled händelse visas inte.
  - En händelse med `kind_override = 'training'` på en fotografering visas.
  - `weekly.availableToday` är `true` på lördag när weekdays är `[6,7]`, och `false` på onsdag.
- [ ] **Steg 2: Kör testerna. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera `username.ts` och `today.ts`.**
- [ ] **Steg 4: Kör testerna. Förväntat: PASS.**
- [ ] **Steg 5: Bygg inbjudningsflödet.** `/invite/[token]` visar visningsnamnet och ett formulär för användarnamn och lösenord (minst 8 tecken). Actionen gör följande med admin-klienten:
  - kontrollerar att `used_at` är null (annars "Länken är redan använd")
  - kontrollerar att användarnamnet är ledigt (annars "Användarnamnet är upptaget")
  - kör `auth.admin.createUser({ email: usernameToEmail(u), password, email_confirm: true })`
  - skapar `profiles`-raden med inbjudans roll
  - sätter `used_at`
  - loggar in och skickar spelaren till `/`

  `/login` har fälten användarnamn och lösenord och kör `signInWithPassword`. Sessionen ligger kvar via cookies.
- [ ] **Steg 6: Bygg startsidan enligt skissen i specen** med `buildTodayView`. Den har en växlare mellan "Idag" och "Igår" (igår-läget använder samma vy med `today − 1`). Actions validerar med `canPlayerLog` och returnerar ett svenskt felmeddelande om de nekas. Vid `unique_violation` returnerar de ok, så att dubbeltryck blir idempotenta. Löpregistreringen frågar efter km (decimaltal, > 0). `revalidatePath('/')` körs efter varje action. `GoalMeter` för `metric = 'km'` visas som en resa (spec): en linje Lerum → Stockholm (45 mil = 450 km, skalad mot `target`) med en prick vid `total`.
- [ ] **Steg 7: Manuellt test lokalt:** skapa en inbjudan direkt i databasen, lös in den, kryssa i en träning två gånger snabbt och kontrollera att det blir en enda rad i `logs`.
- [ ] **Steg 8: Commit `feat: inloggning, inbjudningar och startsida`**

### Uppgift 8: Personlig statistik och tränarvy

**Filer:**
- Skapa: `src/lib/views/stats.ts`, `src/lib/views/coach.ts`, `src/app/(player)/statistik/page.tsx`, `src/app/tranare/page.tsx`, `src/app/tranare/spelare/[id]/page.tsx`, `src/app/tranare/{spelare,uppdrag,lagmal,kalender,installningar}/page.tsx` med `actions.ts`
- Test: `src/lib/views/stats.test.ts`, `src/lib/views/coach.test.ts`

**Gränssnitt:**
- Konsumerar: `streaks`, `logging`, `goals`
- Producerar:
  - `buildMonthStats(logs: LogEntry[], month: string /* 'YYYY-MM' */, today: ISODate): { days: { date: ISODate; active: boolean; frozen: boolean }[]; longestStreak: number; countsByType: Record<LogType, number>; totalKm: number }`
  - `buildCoachOverview(players: { id: string; name: string; logs: LogEntry[] }[], today: ISODate): { id: string; name: string; activeToday: boolean; dayStreak: number; active7: number; active30: number }[]`
  - `longestStreak(activeDates: Set<ISODate>): number`. Den använder samma frysregel som `dayStreak`, men över hela historiken.

- [ ] **Steg 1: Skriv tester**
  - `buildMonthStats` för `'2026-11'` ger 30 dagar.
  - En frusen dag ger `frozen: true` och `active: false`.
  - `countsByType.match` räknar matcher.
  - `totalKm` summerar.
  - `buildCoachOverview` räknar `active7` som aktiva dagar i `today − 6`..`today`.
  - En spelare utan loggar ger nollor och inte ett fel.
- [ ] **Steg 2: Kör testerna. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera vybyggarna.**
- [ ] **Steg 4: Kör testerna. Förväntat: PASS.**
- [ ] **Steg 5: Bygg sidorna.**
  - `/statistik`: månadskalender (aktiv 🔥, frusen ❄️), längsta streak, pass per typ och km. Den visar bara den egna statistiken.
  - `/tranare`: en tabell som går att sortera på varje kolumn. Ett klick på en spelare visar spelarens statistik och loggar, där tränaren kan lägga till och ta bort loggar oavsett datum.
  - `/tranare/spelare`: lägga till spelare eller tränare. Det skapar en inbjudan och visar länken med en "Kopiera"-knapp. Här kan man också ta bort spelare.
  - `/tranare/uppdrag` och `/tranare/lagmal`: skapa och avsluta (genom att sätta `active_to` eller `ends_on`). Historiken raderas aldrig.
  - `/tranare/kalender`: kommande händelser med typ och en väljare för `kind_override`.
  - `/tranare/installningar`: Sportadmin-länken (visas maskerad) och knappen "Synka nu", som anropar synklogiken på serversidan.

  Alla `/tranare`-sidor kontrollerar `role = 'coach'` på servern och skickar annars vidare till `/`.
- [ ] **Steg 6: Commit `feat: statistik och tränarvy`**

### Uppgift 9: PWA och påminnelser

**Filer:**
- Skapa: `public/manifest.webmanifest`, `public/sw.js`, ikoner i `public/icons/` (192 och 512, enkel platshållare), `src/components/InstallGuide.tsx`, `src/components/EnableNotifications.tsx`, `src/app/api/push/subscribe/route.ts`, `src/app/api/cron/reminders/route.ts`, `src/lib/push.ts`
- Test: `src/lib/push.test.ts`

**Gränssnitt:**
- Konsumerar: `remindersDue`, `isAuthorizedCron`, admin-klienten
- Producerar:
  - `reminderMessage(kind: 'daily' | 'weekly', streak: number): { title: string; body: string }`
  - `POST /api/push/subscribe` (body: PushSubscription JSON)
  - `GET /api/cron/reminders` → `{ sent: number; removed: number }`

Exakta texter:
- **daily, streak > 0:** title `Din streak på ${streak} dagar väntar 🔥`, body `Logga dagens träning innan midnatt.`
- **daily, streak 0:** title `Dags att träna 💪`, body `Gör dagens extrapass och starta en ny streak.`
- **weekly:** title `Helgens löprunda`, body `Veckouppdraget är inte klart än – du har till midnatt.`

- [ ] **Steg 1: Skriv test** för `reminderMessage` med de tre texterna ovan.
- [ ] **Steg 2: Kör testet. Förväntat: FAIL.**
- [ ] **Steg 3: Implementera `reminderMessage` och `sendPush(sub, payload)`** med `web-push` och VAPID-nycklarna. Vid status 404 eller 410 tas prenumerationen bort.
- [ ] **Steg 4: Kör testet. Förväntat: PASS.**
- [ ] **Steg 5: Lägg in manifestet.**
  - Manifestet: `name` "Träningsappen", `short_name` "Träning", `display: standalone` och `lang: sv`.
  - `sw.js` hanterar `push` (visar notis) och `notificationclick` (öppnar `/`).
  - `InstallGuide` visas på iPhone när appen inte är installerad (`navigator.standalone` är falskt). Den förklarar Dela → "Lägg till på hemskärmen" i tre steg.
  - `EnableNotifications` frågar om tillåtelse efter ett användartryck och postar prenumerationen.
  - Rutten `reminders` kör `remindersDue` med `now` och skickar notiserna.
- [ ] **Steg 6: Manuellt test:** kör `npx web-push generate-vapid-keys`, prenumerera i Chrome lokalt, sätt systemklockan eller injicera `now` via `?now=` (bara när `NODE_ENV !== 'production'`) och kontrollera att notisen kommer.
- [ ] **Steg 7: Commit `feat: PWA och påminnelser`**

### Uppgift 10: Driftsättning och guide för Jonas

**Filer:**
- Skapa: `supabase/migrations/0002_cron.sql`, `README.md` (svenska)

**Gränssnitt:**
- Konsumerar: cron-rutterna från Uppgift 5 och 9

- [ ] **Steg 1: Skriv `0002_cron.sql`** som aktiverar `pg_cron` och `pg_net` och schemalägger två jobb som körs `'5 * * * *'`. De gör `net.http_get` mot `<APP_URL>/api/cron/sync-calendar` och `<APP_URL>/api/cron/reminders` med Bearer-hemligheten. URL och hemlighet läses från Supabase Vault (`vault.decrypted_secrets`, namnen `app_url` och `cron_secret`) så att de inte hamnar i git.
- [ ] **Steg 2: Skriv README.md för Jonas på svenska.** Den ska täcka:
  - skapa ett Supabase-projekt i region **EU (Stockholm eller Frankfurt)**
  - `supabase link` och `supabase db push`
  - lägga in Vault-hemligheterna
  - skapa Vercel-projektet från GitHub-repot och lägga in miljövariablerna
  - lägga in Sportadmin-länken under Inställningar
  - skapa första tränarkontot (SQL-snippet som skapar en coach-inbjudan) och dela inbjudningslänkar i lagchatten
  - checklistan att stämma av GDPR med föreningen innan lansering
- [ ] **Steg 3: Verifiera i produktion:**
  - `curl` mot sync-rutten utan hemlighet ger 401, och med hemlighet ger den 200.
  - Tränarvyn visar veckans träningar från Sportadmin.
  - En testspelare på iPhone kan installera appen, slå på notiser och registrera ett pass.
- [ ] **Steg 4: Commit `chore: driftsättning och README`**

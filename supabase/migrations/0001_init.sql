-- 0001_init: schema, behörighetsfunktioner och Row Level Security för träningsappen.
-- RLS är säkerhetsgränsen: varje spelare ser bara sin egen data, tränaren ser allt.
-- "Idag" räknas alltid i Stockholmstid.

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  username text unique not null,
  role text not null default 'player' check (role in ('player', 'coach')),
  created_at timestamptz not null default now()
);

create table public.invites (
  token uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null default 'player' check (role in ('player', 'coach')),
  created_by uuid default auth.uid(),
  used_at timestamptz
);

create table public.calendar_events (
  uid text primary key,
  summary text,
  kind text check (kind in ('training', 'match', 'other')),
  kind_override text check (kind_override in ('training', 'match', 'other')),
  date date,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  cancelled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'weekly')),
  name text not null,
  description text,
  target_km numeric check (target_km is null or target_km > 0),
  weekdays int[] not null default '{}',
  active_from date not null,
  active_to date
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  type text not null check (type in ('training', 'match', 'other_org', 'extra', 'weekly')),
  -- Ingen FK till calendar_events: en inställd/raderad händelse får inte radera loggar.
  event_uid text,
  event_title text,
  other_kind text check (other_kind in ('annat_lag', 'fotboll', 'ovrigt')),
  -- Uppdrag tas aldrig bort (de avslutas via active_to), så restrict skyddar historiken.
  mission_id uuid references public.missions (id) on delete restrict,
  km numeric check (km is null or km > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- Träning/match måste peka på en händelse (annars kringgås unika indexet).
  constraint logs_event_required check (type not in ('training', 'match') or event_uid is not null),
  -- Veckouppdrag måste peka på ett uppdrag (NULL är distinkt i unika indexet).
  constraint logs_weekly_mission_required check (type <> 'weekly' or mission_id is not null),
  constraint logs_other_kind_required check (type <> 'other_org' or other_kind is not null),
  -- Km bara på veckouppdrag och med rimligt tak, så lagmål inte kan blåsas upp.
  constraint logs_km_weekly_only check (km is null or (type = 'weekly' and km <= 100))
);

create unique index logs_player_event_uidx
  on public.logs (player_id, event_uid) where event_uid is not null;
create unique index logs_player_date_type_uidx
  on public.logs (player_id, date, type) where type in ('extra', 'other_org');
create unique index logs_player_date_mission_uidx
  on public.logs (player_id, date, mission_id) where type = 'weekly';
create index logs_date_idx on public.logs (date);

create table public.team_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  metric text not null check (metric in ('sessions', 'extra', 'km')),
  target numeric not null check (target > 0),
  starts_on date not null,
  ends_on date not null,
  reward text,
  check (ends_on >= starts_on)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value text
);

-- Effektiv händelsetyp. security_invoker gör att vyn följer anroparens RLS.
create view public.calendar_events_effective
with (security_invoker = true) as
select
  uid,
  summary,
  coalesce(kind_override, kind) as kind,
  kind as source_kind,
  kind_override,
  date,
  starts_at,
  ends_at,
  location,
  cancelled,
  updated_at
from public.calendar_events;

-- ---------------------------------------------------------------------------
-- Funktioner
-- ---------------------------------------------------------------------------

-- security definer så att den kan läsa profiles utan att trigga profiles-RLS (rekursion).
create function public.is_coach() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coach'
  )
$$;

-- Lagets summa mot ett lagmål. security definer: spelare ser summan utan att kunna läsa andras loggar.
create function public.team_goal_total(goal_id uuid) returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case g.metric
    when 'sessions' then (
      select count(*)::numeric from public.logs l
      where l.date between g.starts_on and g.ends_on)
    when 'extra' then (
      select count(*)::numeric from public.logs l
      where l.type = 'extra' and l.date between g.starts_on and g.ends_on)
    when 'km' then (
      select coalesce(sum(l.km), 0) from public.logs l
      where l.date between g.starts_on and g.ends_on)
  end
  from public.team_goals g
  where g.id = team_goal_total.goal_id
$$;

revoke all on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated, service_role;
revoke all on function public.team_goal_total(uuid) from public, anon, service_role;
grant execute on function public.team_goal_total(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.calendar_events enable row level security;
alter table public.missions enable row level security;
alter table public.logs enable row level security;
alter table public.team_goals enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.settings enable row level security;

-- profiles: spelare läser bara sin egen rad; alla skrivningar via tränare eller service role.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_coach_all on public.profiles
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- invites: bara tränaren (inlösen sker med service role).
create policy invites_coach_all on public.invites
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- calendar_events, missions, team_goals: alla inloggade läser, tränaren skriver.
create policy calendar_events_select on public.calendar_events
  for select to authenticated using (true);
create policy calendar_events_coach_all on public.calendar_events
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create policy missions_select on public.missions
  for select to authenticated using (true);
create policy missions_coach_all on public.missions
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create policy team_goals_select on public.team_goals
  for select to authenticated using (true);
create policy team_goals_coach_all on public.team_goals
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- logs: spelare läser alla egna; infogar/raderar egna bara för idag och igår (Stockholm).
-- Ingen UPDATE för spelare.
create policy logs_select_own on public.logs
  for select to authenticated using (player_id = auth.uid());
-- Träning/match kräver en icke inställd kalenderhändelse samma dag och av samma (effektiva) typ.
-- Extrapass/veckouppdrag kräver ett aktivt uppdrag av rätt sort (daily/weekly).
create policy logs_insert_own_recent on public.logs
  for insert to authenticated with check (
    player_id = auth.uid()
    and created_by = auth.uid()
    and date between (now() at time zone 'Europe/Stockholm')::date - 1
                 and (now() at time zone 'Europe/Stockholm')::date
    and (
      (type in ('training', 'match') and exists (
        select 1 from public.calendar_events e
        where e.uid = logs.event_uid
          and e.date = logs.date
          and not e.cancelled
          and coalesce(e.kind_override, e.kind) = logs.type))
      or (type in ('extra', 'weekly') and exists (
        select 1 from public.missions m
        where m.id = logs.mission_id
          and m.kind = case logs.type when 'extra' then 'daily' else 'weekly' end
          and m.active_from <= logs.date
          and (m.active_to is null or m.active_to >= logs.date)))
      or type = 'other_org'
    )
  );
-- Spelare får bara radera egna loggar de själva skapat, så tränarens rättningar står kvar.
create policy logs_delete_own_recent on public.logs
  for delete to authenticated using (
    player_id = auth.uid()
    and created_by = auth.uid()
    and date between (now() at time zone 'Europe/Stockholm')::date - 1
                 and (now() at time zone 'Europe/Stockholm')::date
  );
create policy logs_coach_all on public.logs
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- push_subscriptions: bara egna rader.
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());

-- settings: bara tränaren.
create policy settings_coach_all on public.settings
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

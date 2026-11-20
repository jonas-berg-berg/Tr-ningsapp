-- 0004_extra_per_mission: flera extrapass samma dag, ett per uppdrag.
-- Tidigare fick en spelare bara logga ett extrapass per dag (oavsett uppdrag), så
-- minipasset och konditionspasset gick inte att göra samma dag. Annan träning är
-- fortfarande en per dag.
-- "if exists"/"if not exists": går att köra en gång till utan fel.
drop index if exists public.logs_player_date_type_uidx;

create unique index if not exists logs_player_date_other_uidx
  on public.logs (player_id, date) where type = 'other_org';
create unique index if not exists logs_player_date_extra_uidx
  on public.logs (player_id, date, mission_id) where type = 'extra';

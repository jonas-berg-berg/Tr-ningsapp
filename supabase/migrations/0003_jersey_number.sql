-- 0003_jersey_number: tröjnummer på spelarkortet. Tränaren fyller i det på spelarsidan
-- (RLS profiles_coach_all); spelare kan inte ändra sin profil. Tomt = inget nummer.
alter table public.profiles
  add column jersey_number smallint check (jersey_number between 0 and 99);

# Träningsappen

En liten app för laget där spelarna loggar sin egenträning, ser sina streaks och lagets gemensamma mål. Tränaren ser vem som tränat, hanterar uppdrag och lagmål och får kalendern från Sportadmin. Appen fungerar som en vanlig app på mobilen (PWA) och kan skicka påminnelser.

- **Spelare:** loggar träning, match, annan träning, extrapass och veckouppdrag (t.ex. löpning i km). Ser sin streak och lagets mål.
- **Tränare:** skapar inbjudningslänkar, uppdrag och lagmål, klistrar in Sportadmin-länken och ser statistik per spelare.
- **Tekniken:** Next.js (hostas på Vercel), Supabase (databas och inloggning) och Supabase Cron som anropar appen varje timme för att synka kalendern och skicka påminnelser.

Den här guiden tar dig från noll till en app som lagets spelare kan installera. Räkna med 45–60 minuter första gången.

## Det här behöver du

Tre gratiskonton räcker för ett lag:

| Konto | Används till | Kostnad |
| --- | --- | --- |
| [GitHub](https://github.com) | Koden ligger här | Gratis |
| [Supabase](https://supabase.com) | Databas och inloggning | Gratisnivån räcker |
| [Vercel](https://vercel.com) | Kör appen på nätet | Gratisnivån ("Hobby") räcker |

Du behöver också Node.js installerat på datorn (version 20 eller nyare, hämtas på [nodejs.org](https://nodejs.org)) och koden nedladdad (`git clone` eller GitHub Desktop). En lösenordshanterare är starkt rekommenderad för alla hemligheter nedan.

> Hobby-nivån hos Vercel är avsedd för icke-kommersiellt bruk. Ett föreningslag passar, men kolla Vercels villkor om föreningen tar betalt för appen.

## Steg för steg

### 1. Skapa Supabase-projektet (i EU)

1. Logga in på Supabase och välj att skapa ett nytt projekt.
2. Välj **region i EU**: *Stockholm* (`eu-north-1`) om den finns, annars *Frankfurt*. Det är viktigt för GDPR att datan ligger i EU.
3. Du får välja ett **databaslösenord**. Spara det i lösenordshanteraren direkt, du behöver det i steg 2.
4. Vänta tills projektet är klart (någon minut).
5. Spara också **Project ref** (en kort kod i projektets URL, `https://supabase.com/dashboard/project/<project-ref>`).

**Obligatoriskt: stäng av nya registreringar.** I Supabase, under Authentication (inställningar för inloggning, ofta *Sign In / Providers* eller *Settings*), stäng av att nya användare får registrera sig själva (*Allow new users to sign up*). Appens publika nyckel (`anon`) syns i webbläsaren, så utan det här steget kan vem som helst skapa ett konto direkt mot Supabase. Ett sådant konto ser ingenting i appen (behörighetsreglerna kräver en profil, som bara skapas via en inbjudan, och appen visar "Ditt konto är inte kopplat till laget"), men det här är det första skyddet för spelarnas träningstider, platser och lagets data. Appen skapar konton själv via inbjudningslänkarna och påverkas inte.

### 2. Skapa databasen med Supabase CLI

Kör i en terminal, i projektmappen:

```bash
npm install
npx supabase login
npx supabase link --project-ref DIN-PROJECT-REF
npx supabase db push
```

- `login` öppnar webbläsaren så att du kan godkänna.
- `link` frågar efter databaslösenordet från steg 1.
- `db push` visar vilka migreringar som körs och frågar om du vill fortsätta. Det ska vara **fyra**: `0001_init.sql` (tabeller och behörigheter), `0002_cron.sql` (de schemalagda anropen), `0003_jersey_number.sql` (tröjnummer på spelarkortet) och `0004_extra_per_mission.sql` (flera extrapass samma dag). Svara `Y`. Har du redan kört de tidigare visar `db push` bara de nya.

Om `0002_cron.sql` klagar på att något saknas: gå till Supabase, Database, Extensions, slå på `pg_cron` och `pg_net`, och kör `npx supabase db push` igen.

### 3. Skapa hemligheter: VAPID-nycklar och CRON_SECRET

VAPID-nycklarna används för att skicka påminnelser till telefonerna:

```bash
npx web-push generate-vapid-keys
```

Du får en *Public Key* och en *Private Key*. Spara båda.

CRON_SECRET är ett långt slumpmässigt lösenord som skyddar de två cron-adresserna så att bara Supabase kan anropa dem. Skapa ett:

```bash
# Mac/Linux
openssl rand -hex 32

# Windows eller om openssl saknas (fungerar överallt där Node finns)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Spara det i lösenordshanteraren. Det ska aldrig skrivas i koden eller i chatten.

### 4. Lägg ut appen på Vercel

1. Lägg koden i ett eget (gärna privat) GitHub-repo om den inte redan ligger där.
2. I Vercel: *Add New → Project*, välj repot och importera det.
3. Lägg in miljövariablerna nedan (under *Environment Variables*) **innan** du trycker *Deploy*.
4. Tryck *Deploy*. Efter någon minut får du en adress, t.ex. `https://traningsappen-xxxx.vercel.app`. Skriv ner den.

| Variabel | Värde | Var hittar du det |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Projektets URL | Supabase: Project Settings, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Den publika nyckeln (`anon`) | Supabase: Project Settings, API |
| `SUPABASE_SERVICE_ROLE_KEY` | Den hemliga nyckeln (`service_role`) | Supabase: Project Settings, API |
| `CRON_SECRET` | Värdet från steg 3 | Din lösenordshanterare |
| `VAPID_PUBLIC_KEY` | Public Key från steg 3 | Från `generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Private Key från steg 3 | Från `generate-vapid-keys` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **Samma** värde som `VAPID_PUBLIC_KEY` | Från `generate-vapid-keys` |
| `VAPID_SUBJECT` (valfri) | `mailto:` plus en kontaktadress, t.ex. `mailto:tranare@exempel.se` | Din egen adress |

Bra att veta:

- Nycklarna på Supabase-sidan kan ligga under en flik som heter något i stil med *Legacy API keys*. Där heter de `anon` och `service_role`. Använder du Supabases nyare nycklar (publishable respektive secret) går de in på samma ställen.
- `SUPABASE_SERVICE_ROLE_KEY` kringgår alla behörighetsregler. Den får bara finnas i Vercel, aldrig i koden, aldrig i chatten.
- Värden som börjar med `NEXT_PUBLIC_` byggs in när appen byggs. Ändrar du dem senare måste du göra en ny deploy (Vercel: Deployments, *Redeploy*).
- Vercels *Functions*-region styr var koden körs. Välj gärna Stockholm (`arn1`) eller en annan EU-region under projektets Settings, Functions. Då stannar även trafiken i EU.

### 5. Lägg in app-adressen och hemligheten i Vault

Supabase-jobben från steg 2 läser två hemligheter ur Vault, så att inget känsligt ligger i koden. Öppna Supabase, **SQL Editor**, klistra in och kör (byt ut värdena):

```sql
select vault.create_secret('https://din-app.vercel.app', 'app_url');
select vault.create_secret('SAMMA-VÄRDE-SOM-CRON_SECRET-I-VERCEL', 'cron_secret');
```

- `app_url` är Vercel-adressen från steg 4, **utan** snedstreck på slutet.
- `cron_secret` måste vara exakt samma värde som `CRON_SECRET` i Vercel.

Du kan också lägga in dem i Supabase under Project Settings, Vault. Namnen ska vara exakt `app_url` och `cron_secret`.

Har du skrivit fel? Rätta i Vault (eller ta bort hemligheten och skapa den igen). Jobben läser värdena vid varje körning, så du behöver inte göra något mer.

### 6. Skapa ditt eget tränarkonto

Det första kontot måste skapas för hand, eftersom inbjudningar normalt skapas av en inloggad tränare. I Supabase **SQL Editor**:

```sql
insert into invites (display_name, role) values ('Jonas', 'coach') returning token;
```

Byt `Jonas` mot ditt förnamn. Resultatet är en lång kod (token). Öppna sedan i webbläsaren:

```
https://din-app.vercel.app/invite/<token>
```

Välj användarnamn och lösenord (minst 8 tecken, spara i lösenordshanteraren). Du är nu inloggad som tränare. På startsidan finns en knapp till **Tränarvyn**.

Länken fungerar bara en gång och gäller i 7 dagar.

### 7. Ställ in appen som tränare

I Tränarvyn finns menyn Översikt, Spelare, Uppdrag, Lagmål, Kalender och Inställningar.

1. **Inställningar:** klistra in Sportadmin-länken (kalenderlänken/prenumerationslänken till lagets kalender) och tryck *Spara länk*, därefter *Synka nu*. Under **Kalender** ska du nu se de kommande träningarna och matcherna. Länken är hemlig och visas bara maskerad i appen.
2. **Uppdrag:** skapa det dagliga uppdraget (typ *Dagligt extrapass*, t.ex. namn "Splits 3×10"). Skapa veckouppdraget (typ *Veckouppdrag*, t.ex. "Löpning", km-mål 8, kryssa dagarna lör och sön).
3. **Lagmål:** skapa ett lagmål, t.ex. "200 pass före jul", välj vad som räknas, målvärde och datum (och en belöning om ni vill).
4. **Spelare:** skriv spelarens förnamn, välj *Spelare* och tryck *Skapa inbjudan*. Kopiera länken och skicka den i lagchatten (eller direkt till spelaren). Gör en inbjudan per spelare. Länken fungerar bara en gång och gäller i 7 dagar. Oanvända inbjudningar listas under *Inbjudningar som inte använts*, där du kan *Ta bort inbjudan* (länken slutar då fungera) om den hamnat fel.

Kalendern synkas automatiskt varje timme (vid minut 5). Påminnelser skickas av det andra jobbet.

### 8. Spelarna kommer igång

**Innan du skickar riktiga inbjudningar:** gå igenom *Testa hela flödet med en testspelare* under "Kontrollera att allt fungerar" nedan.

Varje spelare:

1. Öppnar sin personliga länk på telefonen och väljer användarnamn och lösenord.
2. **iPhone:** öppna appen i Safari, tryck på Dela-knappen och välj *Lägg till på hemskärmen*. Öppna sedan appen från hemskärmen. Notiser fungerar på iPhone bara när appen är installerad så (iOS 16.4 eller nyare).
   **Android:** välj *Installera app* eller *Lägg till på startskärmen* i webbläsarens meny.
3. Trycker på *Slå på notiser* i appen och tillåter notiser när telefonen frågar.

## Kontrollera att allt fungerar

Byt ut adressen och hemligheten. De här kommandona kan köras i terminalen på Mac/Linux (på Windows: Git Bash eller WSL).

- [ ] **Utan hemlighet ska appen neka (401):**

  ```bash
  curl -i https://din-app.vercel.app/api/cron/sync-calendar
  curl -i https://din-app.vercel.app/api/cron/reminders
  ```

- [ ] **Med hemlighet ska det gå bra (200):**

  ```bash
  curl -i -H "Authorization: Bearer DIN-CRON_SECRET" https://din-app.vercel.app/api/cron/sync-calendar
  curl -i -H "Authorization: Bearer DIN-CRON_SECRET" https://din-app.vercel.app/api/cron/reminders
  ```

  Synk-anropet ger 200 först när Sportadmin-länken är inlagd (steg 7). Utan länk får du ett felmeddelande, vilket är väntat.
- [ ] **Nya registreringar är avstängda** i Supabase (Authentication, *Allow new users to sign up* är av), se steg 1.
- [ ] Tränarvyn, Kalender, visar veckans träningar från Sportadmin.
- [ ] De schemalagda jobben går: i Supabase SQL Editor, `select jobname, schedule from cron.job;` ska visa `sync-calendar` och `send-reminders` med `5 * * * *`. Efter nästa hela timme visar `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;` om de lyckades. (Jobben skickar anropet och loggar det i pg_net, svaret syns i `select status_code, content from net._http_response order by created desc limit 5;`.)

### Testa hela flödet med en testspelare innan riktiga inbjudningar

Delar av flödet (inloggningen hos Supabase, notiserna och de schemalagda jobben) går bara att prova på riktigt. Gör det med en testspelare, t.ex. "Test", innan lagets spelare får sina länkar.

- [ ] **Inbjudan:** Tränarvyn, Spelare: skriv `Test`, välj *Spelare*, *Skapa inbjudan* och kopiera länken.
- [ ] **Konto:** öppna länken på en telefon (gärna en iPhone), välj användarnamn och lösenord. Du ska hamna på startsidan med "Hej Test!".
  - Får du ett fel om e-postformat eller en ogiltig adress när kontot skapas: appen ger varje spelare en intern adress som slutar på `.invalid` (funktionen `usernameToEmail` i `src/lib/auth/username.ts`). Godkänner inte Supabase den domänen måste den bytas i koden, till exempel till en domän ni äger, **innan någon riktig spelare skapar konto**. Användarnamnet blir en del av adressen, så den går inte att byta i efterhand för befintliga konton.
- [ ] **Logga in:** tryck *Logga ut* längst ned på startsidan och logga in igen med användarnamn och lösenord.
- [ ] **Kryssa:** installera appen på hemskärmen (steg 8), tryck *Slå på notiser* och kryssa *Jag var på lagträningen* (eller *Annan träning* om det inte finns någon träning idag). Streaken ska visa 1 dag.
- [ ] **Ångra:** tryck på samma rad igen. Krysset ska försvinna och streaken gå tillbaka. (Löpning i veckouppdraget ångras med *Ångra*.)
- [ ] **Påminnelse:** se till att testspelaren inte har något pass idag och vänta till kl. 19:00 (svensk tid). En notis ska komma. Det går inte att tidsresa i produktion (`?now=` fungerar bara lokalt), så kontrollera alternativt efter kl. 19:05 i Supabase SQL Editor:

  ```sql
  select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
  select status_code, content from net._http_response order by created desc limit 5;
  ```

  Svaret från 19-körningen ska vara `{"sent":1,...}` (eller fler om fler har notiser på). Ett manuellt `curl` med hemligheten (ovan) skickar bara påminnelser om det råkar vara rätt timme.
- [ ] **Nytt lösenord:** Tränarvyn, Spelare, *Test*, rutan *Nytt lösenord*: sätt ett nytt och logga in med det.
- [ ] **Städa:** ta bort testspelaren (Tränarvyn, Spelare, *Ta bort*).

## Innan ni startar: GDPR-checklista

Appen är gjord för att spara så lite som möjligt. Stäm av med föreningen innan lansering:

- [ ] Bara **förnamn och användarnamn** sparas om spelaren, plus de pass spelaren själv loggar. Ingen e-postadress, inga foton, inga personnummer.
- [ ] Datan ligger i **EU** (Supabase-regionen i steg 1, och gärna Vercels EU-region i steg 4).
- [ ] Du vet **vilka som har tränaråtkomst** (varje tränarkonto skapas med en inbjudan med rollen *Tränare*). Ge den bara till dem som behöver den.
- [ ] **Nya registreringar är avstängda** i Supabase (steg 1), så att bara inbjudna har konton.
- [ ] Du vet hur en spelare **tas bort**: Tränarvyn, Spelare, *Ta bort* vid spelarens namn. Kontot och alla spelarens loggar raderas för gott (lagmålens summor sjunker i samma veva).
- [ ] Prata med föreningens **GDPR-ansvarige** (eller styrelsen) om att appen finns, vad den sparar och vem som är ansvarig.
- [ ] **Föräldrarna är informerade** innan barn under 18 får sina länkar, om vad som sparas och hur man begär radering.
- [ ] Sportadmin-länken är hemlig. Dela den inte, och byt den i Inställningar om den läckt.

## Felsökning

**Kalendern är tom eller "Synka nu" ger fel**
- Kontrollera att Sportadmin-länken är rätt kopierad (hela länken, Inställningar visar den maskerad) och klistra in den igen.
- Felmeddelandet "Kalendern från Sportadmin var tom, ingen ändring gjordes" betyder att Sportadmin svarade med en tom kalender trots att appen har kommande träningar sparade. Det räknas medvetet som ett fel, så att ett avbrott hos Sportadmin inte tömmer er kalender. Prova igen om en stund. Är säsongen slut och det inte finns några kommande händelser sparade är en tom kalender inget fel.
- "Ingen Sportadmin-länk är inställd" betyder att länken saknas under Inställningar.
- Se loggarna i Vercel (projektet, Logs) för mer detaljer.

**Notiser kommer inte**
- På iPhone måste appen vara tillagd på hemskärmen och öppnas därifrån, och iOS måste vara 16.4 eller nyare.
- Kontrollera att notiser är tillåtna för appen i telefonens inställningar. Står det att notiser är blockerade i appen måste du slå på dem där.
- Kontrollera att `VAPID_*`-variablerna är ifyllda i Vercel (och att `NEXT_PUBLIC_VAPID_PUBLIC_KEY` är samma som `VAPID_PUBLIC_KEY`) och att du gjort en ny deploy efter ändringen.
- Kontrollera att `app_url` och `cron_secret` i Vault är rätt (steg 5) och att kommandot med `curl` och hemlighet ger 200.

**En spelare har glömt sitt lösenord**
Appen har ingen e-post och därmed ingen "glömt lösenord"-länk. Gör så här: Tränarvyn, Spelare, klicka på spelarens namn och fyll i rutan *Nytt lösenord* (minst 8 tecken), tryck *Spara nytt lösenord* och berätta lösenordet för spelaren. Användarnamnet visas i samma ruta. Spelarens loggar och streaks finns kvar. Ta **inte** bort spelaren för att ge en ny inbjudan, då raderas all historik.

**En inbjudningslänk är "ogiltig eller redan använd"**
Länken har redan använts, tagits bort eller är äldre än 7 dagar. Skapa en ny inbjudan under Tränarvyn, Spelare.

**Någon ser "Ditt konto är inte kopplat till laget"**
Kontot finns i Supabase men har ingen profil i laget, t.ex. för att någon registrerat sig själv innan registreringen stängdes av (steg 1). Kontot ser ingen data. Ta bort det i Supabase under Authentication, Users, och kontrollera att nya registreringar är avstängda.

**Notiser kommer till fel person på en delad telefon**
Notiserna följer den som senast slog på dem på telefonen. Den som lämnar telefonen ska trycka *Logga ut*, då stängs telefonens notiser av. Nästa person loggar in och trycker *Slå på notiser*.

**Cron-jobben verkar inte köra**
Kör `select * from cron.job;` i SQL Editor. Saknas jobben, kör `npx supabase db push` igen. Kontrollera sedan Vault enligt ovan.

## Utveckling lokalt

Det här behövs bara om du eller Claude Code ska ändra i appen.

```bash
npm install
cp .env.example .env.local   # fyll i värdena, se steg 4
npm run dev                  # http://localhost:3000
npm test                     # enhetstester
npm run test:db              # databastester (behörighetsreglerna)
npm run lint
npm run build                # produktionsbygge
```

`npm run test:db` kräver en vanlig PostgreSQL som lyssnar på port 54329 på den här datorn (användare `postgres`). Testet skapar och tömmer sin egen databas `traningsappen_test` och laddar `supabase/tests/shim.sql`, `0001_init.sql`, `0003_jersey_number.sql` och `0004_extra_per_mission.sql`. `0002_cron.sql` laddas aldrig lokalt eftersom den kräver Supabase. Andra inställningar går att ge med miljövariablerna `PGHOST`, `PGPORT` och `PGUSER`.

`AGENTS.md` innehåller en påminnelse till Claude Code om att den här Next.js-versionen skiljer sig från det den kan sedan tidigare. Behåll filen.

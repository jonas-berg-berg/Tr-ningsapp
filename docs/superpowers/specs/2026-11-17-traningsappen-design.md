# Träningsappen – design

*Innebandylag, killar 14–15 år · Jonas Berg (tränare) · 2026-11-17*

## Syfte och varför

Spelarna ska göra egenträning mellan lagets träningar, till exempel 3×10 bulgarian splits de dagar de inte har någon organiserad träning och en löprunda på 8 km varje helg. Idag finns det inget sätt att följa upp det, och det är svårt att motivera tonåringar till att träna på egen hand.

Appen ska få dem att **vilja** träna, med hjälp av streaks och gemensamma lagmål. Den ska också göra det **synligt för tränarna** vem som gör jobbet, så att det finns en mild press att faktiskt utföra det.

## Mål

- Spelaren loggar sin dag med ett eller några få tryck. Det ska ta under 10 sekunder.
- **Streaks** driver jämnhet: aktiva dagar i rad, och veckor i rad med helgrundan avklarad.
- **Gemensamma lagmål** som alla bidrar till och som ger en belöning laget har valt.
- **Personlig statistik.** Spelaren ser bara sin egen, och tränarna ser allas.
- Lagets träningar och matcher hämtas automatiskt från Sportadmin, så att tränarna aldrig behöver lägga in något dubbelt.

## Icke-mål (inte nu)

- Topplistor eller rangordning mellan spelare. Det är parkerat och kan komma senare.
- Foton som bevis.
- Flera lag eller hela klubben. Appen är byggd för ett lag.
- Föräldravy.
- App Store och Google Play.
- Att hämta närvaro från Sportadmin.

## Anti-mål (då har vi misslyckats, även om allt fungerar tekniskt)

- Appen pekar ut eller förnedrar de som tränar minst inför de andra.
- Loggningen känns krånglig, så att de slutar använda den efter två veckor.
- Spelarnas personuppgifter sprids eller samlas in i onödan.

## Begränsningar

- Spelarna är minderåriga. Spara så lite personuppgifter som möjligt: förnamn (eventuellt med efternamnsinitial) och inloggningsuppgifter. Inga bilder. Datan ska ligga inom EU. Stäm av med föreningens GDPR-rutiner innan lansering.
- Det måste fungera bra i mobilen, både iPhone och Android.
- Det ska vara gratis att driva för ett lag.
- Jonas lär sig Claude Code, så koden ska vara begriplig och följa vanliga mönster.

## Tillvägagångssätt (valt: 1)

1. **Webbapp som sparas på hemskärmen (PWA) med Supabase och Vercel – VALD.** Den känns som en app och kostar inget för ett lag. Kalendern hämtas automatiskt, och push-påminnelser fungerar även på iPhone när appen ligger på hemskärmen. Det är ett vanligt stack att lära sig.
2. **WordPress.** Jonas kan miljön, men WordPress är sämre lämpat för en appkänsla i mobilen, för inloggning och för påminnelser.
3. **Riktig mobilapp.** Den ger bäst känsla, men Apple-kontot kostar ungefär 1 000 kr per år, varje release granskas och det är mycket mer att bygga. Överdrivet för ett lag.

(En publicerad sida i Claude valdes bort eftersom det är osäkert hur inloggning och tränarbehörighet skulle fungera där.)

## Det Jonas har bestämt

- **Ett lag.**
- **Inga topplistor nu, inga foton.**
- **Streaks: ja.**
- **Statistiken är personlig.** Spelaren ser sin egen, och tränarna ser allas.
- **Lagmål: ja.** Till exempel ett antal gemensamma pass. Lagträningar och matcher räknas in.
- **Spelarna kryssar själva i "Jag var där"** på lagträningar och matcher. Tränarna ser vem som kryssat.
- **Extrapasset gäller dagar utan organiserad träning av något slag.** Med organiserad träning menas lagträning, match, träning med annat lag i klubben eller fotboll.
- **Lagets kalender hämtas från Sportadmin** via kalenderlänken (webcal/iCal). Ledaren ser alla lagets aktiviteter där.

## Så fungerar det

### Aktiv dag (kärnregeln)

En dag är **aktiv** för en spelare om spelaren har loggat minst ett av följande:

| Loggning | När den visas | Hur |
|---|---|---|
| Jag var på lagträningen | Dagar med träning i Sportadmin-kalendern | Ett tryck |
| Jag spelade match | Dagar med match i Sportadmin-kalendern | Ett tryck |
| Annan organiserad träning (annat lag i klubben / fotboll / övrigt) | Alla dagar | Ett tryck + val av typ |
| Dagens extrapass (t.ex. splits 3×10) | Alla dagar, framhävt de dagar spelaren inte loggat organiserad träning | Ett tryck |

Den som loggar extrapass en dag med organiserad träning får det ändå räknat i statistik och lagmål, men det krävs inte för att dagen ska vara aktiv.

### Streaks

- **Dagstreak:** antal aktiva dagar i rad.
- **Veckostreak:** antal veckor i rad (mån–sön) som veckouppdraget, till exempel 8 km löpning, är avklarat.
- **1 frysdag per vecka** (Jonas beslut): en missad dag per vecka (mån–sön) bryter inte dagstreaken. Frysdagen används automatiskt och räknas inte som en aktiv dag. En andra missad dag samma vecka nollställer streaken.

### Uppdrag (ställs in av tränarna)

- **Dagligt extrapass:** namn och beskrivning, till exempel "Bulgarian splits 3×10 per ben".
- **Veckouppdrag:** namn, mål, till exempel "Löpning 8 km", och vilka dagar det gäller, till exempel lördag och söndag. Spelaren anger km när hen loggar löpning.
- Tränarna kan ändra eller byta uppdrag över säsongen. Historiken behålls.

### Lagmål

Tränarna skapar ett mål med:
- **Mått:** antal loggade pass (alla typer), antal extrapass eller löpta km.
- **Målvärde och slutdatum**, till exempel 200 pass före 20 december.
- **Belöning** som fritext, till exempel "Pizza efter träningen".

Alla spelare ser en mätare med lagets totala summa och hur mycket som återstår. **Ingen ser vem som bidragit med vad**, det ser bara tränarna.

Km-mål kan visas som en resa, till exempel från Lerum till Stockholm, med en prick som rör sig längs en linje.

*Senare:* "Full vecka" (alla aktiva varje dag), lagstreak och "Slå tränarna".

### Spelarens startsida (skiss)

```
Hej Elias!                🔥 9 dagar   📅 3 veckor

IDAG – tisdag 17 nov
 [✓] Jag var på lagträningen 18:00
 [ ] Annan träning (fotboll, annat lag…)
 [ ] Extrapass: Splits 3×10        (frivilligt idag)

DENNA VECKA
 Löpning 8 km (lör–sön)   ○ inte gjort än

LAGMÅL: 200 pass före jul
 ███████████░░░░░░  132 / 200   🍕 Pizza!

Min statistik ›
```

### Spelarens statistik

Kalendervy per månad med aktiva dagar markerade, längsta streak, antal pass per typ och löpta km. Bara den egna.

### Tränarvy

- En lista över alla spelare med dagens status, nuvarande streak och antal aktiva dagar de senaste 7 och 30 dagarna, sorterbar.
- Klicka på en spelare för att se samma statistik som spelaren själv ser.
- Hantera spelare (lägga till och ta bort), uppdrag, lagmål och Sportadmin-länken.
- Flera tränare kan ha tränarbehörighet.

### Sportadmin-kopplingen

- Lagets kalenderlänk (`https://portalweb.sportadmin.se/webcal?id=…`, kalendern "P11/12") läggs in i inställningarna. Länken räknas som en hemlighet: den ska ligga i miljövariabel eller databas, aldrig i koden eller i git.
- Flödet är vanlig iCal (VEVENT med SUMMARY, DTSTART, DTEND, DESCRIPTION, LOCATION, UID, tidszon Europe/Stockholm). Sportadmin anger själv att det uppdateras varje timme (`X-PUBLISHED-TTL: PT1H`). Ett schemalagt jobb hämtar det varje timme och sparar händelserna efter UID.
- **Klassning** (flödet saknar CATEGORIES):
  - SUMMARY börjar med `Match:` → **match**. Titeln innehåller motståndare och serie, som visas för spelaren.
  - SUMMARY börjar med `Träning` → **lagträning**.
  - Allt annat, till exempel `Fotografering` → **övrigt**. Det visas inte som en avbockningsbar aktivitet och räknas inte. Tränaren kan manuellt göra om en sådan händelse till träning eller match.
- **Laget har två matchlag (Svart och Röd)**, så alla spelar inte alla matcher, och samma dag kan ha två matcher. Alla matcher visas för alla spelare, och var och en kryssar bara i den match hen spelade.
- Om en träning ställs in i Sportadmin försvinner den i appen. Den som redan kryssat "Jag var där" behåller sin loggning.

### Inloggning

*Mitt förslag:* Tränaren lägger till en spelare med förnamn, och appen skapar en personlig inbjudningslänk som skickas till spelaren, till exempel i lagchatten. Spelaren väljer användarnamn och lösenord första gången och lägger appen på hemskärmen. Det krävs ingen e-post. Inloggningen ligger kvar så att spelaren inte behöver logga in igen.

### Loggning i efterhand

*Mitt förslag:* spelaren kan registrera pass för **idag och igår**, inte längre bakåt. Den som glömde att trycka en kväll förlorar alltså inte sin streak, men det går inte att fylla i en hel vecka i efterhand. Tränare kan rätta loggningar hur långt bakåt som helst.

### Påminnelser

**Ingår i första versionen** (Jonas beslut). Pushnotis (Web Push) kl. 19 om dagen inte är aktiv ännu ("Din streak på 9 dagar väntar 🔥"), och på söndag eftermiddag om veckouppdraget inte är gjort. Spelaren slår på notiser vid första inloggningen och kan stänga av dem. På iPhone kräver det att appen ligger på hemskärmen, så appen ska guida spelaren dit.

## Teknik (mina val)

- **Next.js** (React) som PWA, med manifest och service worker så att den kan läggas på hemskärmen.
- **Supabase** för databas (Postgres), inloggning och behörighetsregler (Row Level Security, så att spelare bara kan läsa sin egen data). Region EU.
- **Vercel** som webbhotell, med Vercel Cron för att hämta Sportadmin-kalendern varje timme.
- Ett iCal-bibliotek, till exempel `node-ical`, för att tolka kalendern.
- Svenska i hela gränssnittet. Tidszon Europe/Stockholm för alla dagberäkningar.

## Lämnas till den som bygger

- Datamodell, filstruktur, komponentuppdelning och visuell stil (sportig, mörk eller ljus, lagets färger om Jonas skickar dem).
- Hur kalenderhändelser klassas som träning eller match, utifrån hur Sportadmins flöde faktiskt ser ut.
- Exakt utformning av statistikvyerna.

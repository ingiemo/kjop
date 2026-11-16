# Kjøp eller dropp

En liten nettapp for iPhone som regner ut **kostnad per bruk** før du kjøper noe.

- Kalkulator med vurdering (Kjøp / Tenk deg om / Dropp), «verdt det»-dato og arbeidstid
- Sammenlign to alternativer
- Lagret-liste med tenketid og registrering av faktisk bruk
- Spart-oversikt med sparemål, unne-seg-kvote og graf
- Egne kategorier og grenser

All data lagres **bare på enheten** (localStorage). Ingen innlogging, ingen server.
Ta eksport innimellom under Innstillinger, siden iOS kan rydde bort data fra nettsider.

## Teknisk

Ren HTML, CSS og JavaScript (ES-moduler) uten byggesteg. Fungerer offline via service worker.

## Publisere en ny versjon

1. Gjør endringene.
2. Øk `VERSION` i `sw.js` (f.eks. `v1` → `v2`). Uten dette får ikke telefonen de nye filene.
3. Legger du til en ny fil, legg den også inn i `FILES` i `sw.js`.
4. Commit og push. GitHub Pages oppdateres etter et minutt eller to.
5. Åpne appen på telefonen. Trykk «Oppdater» når det dukker opp.

## Teste lokalt

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Åpne http://localhost:5173. Service workeren er slått av på localhost, så du alltid ser
ferske filer. Legg til `?sw` i adressen for å teste offline.

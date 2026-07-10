# MacroMind

Tägliches Wissens-Quiz zu Wirtschaft, Politik, Finanzmärkten, Geopolitik und Technologie/KI.
**1008 Fragen** in 3 Schwierigkeitsstufen, Rang-System, 28 Achievements, Tages-Streaks,
Fortschritts-Charts, Wissens-Check mit Spaced Repetition und Freunde-Challenges per Code.

**Live:** https://johann-macro.github.io/macromind/ (Updates: einfach `git push` – GitHub Pages baut automatisch)

## Starten

**Am einfachsten:** Doppelklick auf `index.html` – die App läuft komplett offline im Browser,
ohne Installation, ohne Build-Schritt.

**Alternativ mit lokalem Server** (z. B. für Tests am Handy im selben WLAN):

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1
```

Dann im Browser: `http://localhost:8123/`

**Fürs Handy (empfohlen):** Den kompletten Ordner unverändert auf einen statischen
Hoster legen (z. B. GitHub Pages, Netlify Drop, Cloudflare Pages – alle kostenlos).
Danach auf dem Handy öffnen und über „Zum Startbildschirm hinzufügen" wie eine
echte App installieren (PWA-Manifest ist enthalten). So können auch die Freunde
mit derselben URL spielen.

## Wichtige Konzepte

- **Tageswechsel:** exakt um Mitternacht deutscher Zeit (Europe/Berlin, automatische
  Sommer-/Winterzeit). Jeden Tag 3 × 10 neue Fragen, Rotation ohne Wiederholung.
- **Konten:** Benutzername + 4-stellige PIN (gehasht gespeichert) oder Gast-Modus.
  Daten liegen im Browser (localStorage). **Geräteübergreifend:** In den Einstellungen
  „Daten exportieren" → Sync-Code auf dem anderen Gerät importieren.
- **Challenge:** Nach einer Runde „Freund herausfordern" → Code kopieren und per
  WhatsApp/Chat schicken. Der Freund gibt ihn unter „Challenge-Code eingeben" ein,
  spielt exakt dieselben Fragen und sieht den direkten Vergleich. Der Code enthält
  alles Nötige selbst – es gibt keinen Server und nichts, das „kaputtgehen" kann.
- **Wissens-Check:** wiederholt Fragen aus der eigenen Historie (möglichst aus
  verschiedenen Tagen) und zeigt den Vergleich zur damaligen Antwort. Zählt nicht
  in die Profil-Statistik.

## Projektstruktur

```
index.html              App-Shell
css/styles.css          Design (Dark/Light, Rang-Effekte)
js/util.js              Berlin-Zeitzone, Hashing, Codierung – ALLE Datumslogik läuft hierüber
js/i18n.js              UI-Übersetzungen: Deutsch, Englisch, Rumänisch, Polnisch
js/badwords.js          Namensfilter inkl. Leetspeak-Normalisierung
js/ranks.js             10 Ränge mit Schwellenwerten
js/achievements.js      28 Erfolge
js/data/questions-l*.js Fragenpool (3 × 336 Fragen: Basis + Erweiterungen B und C)
js/store.js             Konten, Persistenz, Sync-Codes
js/engine.js            Spiellogik: Tagesauswahl, Runden-Zustandsmaschine,
                        zentrale finishRound(), Challenge-Codes, Statistik
js/charts.js            SVG-Fortschritts-Chart
js/ui-*.js              Views (Auth, Home, Quiz, Historie, Statistik, Profil, Einstellungen)
js/app.js               Router + Boot
tools/serve.ps1         Mini-Dev-Server (PowerShell, kein Node nötig)
```

## Fragen erweitern

Neue Fragen einfach in `js/data/questions-l1.js` (bzw. l2/l3) ergänzen:

```js
{ id: 'l1-085', type: 'fact', topic: 'macro',
  q: 'Fragetext …',
  o: ['Antwort A', 'Antwort B', 'Antwort C', 'Antwort D'],
  c: 0,                      // Index der richtigen Antwort (0–3)
  e: 'Erklärung …',
  asOf: '2026-07'            // optional: nur für zeitgebundene Fragen
},
```

Typen: `def` (Definition), `concept` (Konzept), `fact` (Fakten), `est` (Schätzfrage),
`profile` (Steckbrief – bewusst selten, max. 1 pro Tages-Set).
Zeitgebundene Fragen (`asOf`) werden im Wissens-Check weitgehend ausgeschlossen
und mit „Stand: …" gekennzeichnet.

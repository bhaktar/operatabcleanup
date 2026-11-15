# Tab-Ablage

Browser-Erweiterung (Manifest V3) für **Opera GX** und alle Chromium-Browser (Chrome, Edge, Brave, Vivaldi).
Sie legt offene Tabs – vor allem YouTube-Videos – als **visuelle Liste mit Vorschaubildern** ab und schließt sie danach.

## Das Problem

Hunderte offene Tabs, viele davon YouTube-Videos, die man „später noch schauen“ will. Die Tabs bleiben nur offen,
damit man den Überblick behält. Jeder Tab kostet aber Arbeitsspeicher und Rechenzeit, der PC wird langsam.

**Tab-Ablage** ersetzt die offenen Tabs durch eine leichte Übersichtsseite: Vorschaubild, Titel, Kanal bzw. Domain,
Datum und Kategorie. Ein Klick öffnet das Video wieder – bei YouTube sogar an der Stelle, an der du aufgehört hast.

## Funktionen

- **Ablegen & schließen** per Popup: alle Tabs, nur das aktuelle Fenster, nur YouTube-Tabs oder nur den aktuellen Tab.
  Angeheftete Tabs, Browser-Seiten (`chrome://`, `opera://`, `about:` …) und die eigenen Seiten der Erweiterung bleiben offen;
  optional auch der gerade aktive Tab. Fortschrittsanzeige im Popup und in der Übersicht.
- **Sicher**: Erst wird gespeichert, dann geschlossen. Das Schließen wird nie lange blockiert – Metadaten werden danach
  im Hintergrund nachgeladen. Würde das Schließen den Browser beenden, wird vorher die Übersicht geöffnet.
- **Duplikaterkennung**: YouTube nach Video-ID (`watch`, `youtu.be`, `shorts`, `embed`, `live`, Playlists), sonst nach
  normalisierter URL (ohne `utm_*`, `si`, `feature`, `pp`, `fbclid`, `gclid` … und ohne `www.`).
- **YouTube**: Vorschaubild `https://i.ytimg.com/vi/<id>/mqdefault.jpg`, Kanal und sauberer Titel über YouTube-oEmbed,
  **Zeitmarke** aus `&t=` bzw. – falls der Tab geladen war – die aktuelle Abspielposition. Beim Öffnen geht es dort weiter.
- **Webseiten**: `og:image` / `twitter:image` und Beschreibung werden aus dem offenen Tab gelesen (max. 1,5 s je Tab,
  6 parallel). Verworfene/schlafende Tabs bekommen das Vorschaubild nachträglich per Seitenabruf (abschaltbar), sonst eine
  Ersatzkarte mit großem Favicon und Domain. Gespeichert werden nur Bild-**URLs**, nie Bilddaten.
- **Kategorien** – einfach verwaltbar (hinzufügen, umbenennen, löschen, sortieren, Farbe) und optional mit
  Regeln für die automatische Zuordnung (Domains + Stichwörter, Prioritätsreihenfolge). Standard:
  Spirituelles, Finanzen, Astrologie & Zukunftsforschung, Musik, Tutorial/Lernen, Gaming, Podcast/Interview, Technik,
  Nachrichten, Sonstiges-Video (YouTube) sowie Shopping, Social Media, Entwicklung, Dokumente/Wissen, Sonstiges (Web).
  Dazu ein Katalog mit 18 **Vorschlägen** (z. B. Gesundheit & Ernährung, Krypto, KI & Tools), die erst wirken,
  wenn du sie aktivierst. Manuell gesetzte Kategorien bleiben erhalten; „Neu kategorisieren“ wendet die Regeln auf
  alle übrigen Einträge an.
- **Übersicht** (eigener Tab): responsives Raster mit 16:9-Vorschaubildern, Filter nach Kategorie und Typ (YouTube/Web),
  Gruppierung nach Kategorie, Kanal, Domain oder Datum, Suche, Sortierung, Seitenaufteilung (ab 200 Einträgen pro Seite,
  einstellbar). Bilder werden erst beim Scrollen geladen.
- **Kartenaktionen**: Öffnen (Klick = Vordergrund, Mittelklick/Strg+Klick = Hintergrund), „gesehen“ (Archiv-Ansicht
  „Gesehen“), Löschen (mit „Rückgängig“), Kategorie ändern.
- **Mehrfachauswahl** mit Kontrollkästchen (Umschalt+Klick für Bereiche, ganze Gruppe, ganze Seite, alle Treffer):
  öffnen (Warnung ab 10 Tabs), als gesehen markieren, Kategorie setzen, löschen.
- **Automatik** (optional): inaktive Tabs nach N Stunden ablegen, Tab-Limit.
- **Kontextmenü**: „Tab ablegen“, „Alle Tabs rechts davon ablegen“, „Link für später ablegen“ und – für YouTube –
  **„An Tab-Ablage senden“** (Link direkt in eine Kategorie) bzw. **„Dieses Video ablegen in“** (auf einer Video-Seite).
- **Export/Import**: JSON (für Claude Cowork), Lesezeichen-HTML (Netscape-Format, als Sicherung oder für jeden Browser).
  Importiert werden JSON, Lesezeichen-HTML und einfache URL-Listen (eine URL pro Zeile).
- Dunkles Design im Opera-GX-Stil (Rot/Pink), helles Design automatisch über das System-Farbschema oder per Einstellung.

## Installation in Opera GX

1. Diesen Ordner herunterladen bzw. das Repository klonen.
2. In Opera GX `opera://extensions` in die Adresszeile eingeben.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **„Entpackte Erweiterung laden“** klicken und den Ordner **`extension`** (der mit der `manifest.json`) auswählen.
5. Das Symbol über das Puzzle-Symbol in der Seitenleiste/Symbolleiste anheften.

In Chrome/Edge/Brave genauso über `chrome://extensions` bzw. `edge://extensions`.

> Hinweis: Die Erweiterung fordert Zugriff auf „alle Websites“ an. Das ist nötig, um aus offenen Tabs das Vorschaubild
> (`og:image`) zu lesen und YouTube-oEmbed abzufragen. Es werden keine Daten an Dritte gesendet (siehe Datenschutz).

## Benutzung

- **Symbol anklicken** → Popup mit Anzahl offener und abgelegter Tabs.
  - **Alle Tabs ablegen & schließen** – alle normalen Fenster.
  - **Nur dieses Fenster ablegen**, **Nur YouTube-Tabs ablegen**, **Diesen Tab ablegen**.
  - **Übersicht öffnen**.
- **Übersicht**: links Ansicht (Abgelegt/Gesehen), Typ und Kategorien mit Anzahl; oben Suche (Taste `/`), Sortierung und
  Gruppierung. Unter „Nach dem Öffnen“ legst du fest, ob ein geöffneter Eintrag aus der Liste verschwindet (Standard),
  nach „Gesehen“ wandert oder bleibt.
- **Rechtsklick** auf eine Seite: „Tab ablegen“ oder „Alle Tabs rechts davon ablegen“; auf einen Link: „Link für später
  ablegen“ (YouTube-Links bekommen direkt ihr Vorschaubild).
- **Einstellungen** (Popup → Einstellungen oder Rechtsklick aufs Symbol → Optionen): ganz oben die **Kategorien**,
  danach Verhalten, Automatik, Export/Import, alles löschen. In der Übersicht führt „verwalten“ neben „Kategorien“
  (oder „Kategorien verwalten …“ im Kategorie-Menü einer Karte) direkt dorthin.

## YouTube per Rechtsklick in eine Kategorie ablegen

- **Rechtsklick auf einen YouTube-Link** (Video, Short, Live, Playlist oder `youtu.be`, auch `m.` und `music.`) →
  **„An Tab-Ablage senden“** → Kategorie wählen. Ganz oben steht **„Automatisch (Regeln)“**, darunter alle deine
  Kategorien in ihrer Reihenfolge. Das Video wird gespeichert, der Link bleibt einfach ein Link.
- **Rechtsklick auf eine YouTube-Video- oder Shorts-Seite** (auf die Seite oder das Video – bei YouTube erscheint das
  Browser-Menü beim zweiten Rechtsklick auf das Video) → **„Dieses Video ablegen in“** → Kategorie. Die aktuelle
  Abspielposition wird übernommen. Mit dem Häkchen **„Tab danach schließen“** (im selben Untermenü bzw. in den
  Einstellungen, Standard: an) wird der Tab danach geschlossen.
- Eine gewählte Kategorie gilt als **manuell** (wie eine Änderung in der Übersicht) und wird von „Neu kategorisieren“
  nicht überschrieben. Ist das Video schon abgelegt (gleiche Video-ID), wird nur die Kategorie aktualisiert –
  es entsteht kein Duplikat.
- Titel und Kanal kommen kurz danach über YouTube-oEmbed (das Kontextmenü liefert nur die Link-Adresse); bis dahin
  zeigt die Karte die URL. Das Vorschaubild steht sofort fest.
- **Rückmeldung** am Symbol der Erweiterung: **✓** (grün) = neu abgelegt, **↻** (orange) = war schon da, Kategorie
  aktualisiert, **!** (rot) = kein YouTube-Video erkannt. Der Tooltip des Symbols nennt für ein paar Sekunden die
  Kategorie. (Bewusst ohne Systembenachrichtigungen – dafür bräuchte die Erweiterung eine weitere Berechtigung.)
- Das Menü wird automatisch neu aufgebaut, sobald sich Kategorien ändern (Einstellungen, Übersicht, Import).

## Kategorien verwalten

Einstellungen → **Kategorien** (oberster Abschnitt):

- **+ Kategorie hinzufügen** legt eine neue Kategorie oben in der Liste an. Eine Kategorie braucht **keine** Regeln:
  Ohne Stichwörter/Domains wird sie nie automatisch vergeben, steht aber in der Übersicht und im Rechtsklick-Menü zur
  Auswahl (gut für Listen wie „Später mit Partner schauen“).
- **Umbenennen**: Namen ändern und Feld verlassen (oder Enter). Alle gespeicherten Einträge der Kategorie werden
  mit umbenannt.
- **Löschen** fragt nach und verschiebt vorhandene Einträge nach **„Sonstiges“** – oder in eine andere Kategorie deiner
  Wahl bzw. „Automatisch neu zuordnen (Regeln)“.
- **↑ / ↓** ändert die Priorität: Passen mehrere Kategorien, gewinnt die obere.
- **Farbe** je Kategorie: färbt das Abzeichen auf den Karten und den Punkt in der Seitenleiste der Übersicht.
- **„Automatisch zuordnen, wenn …“** (aufklappbar, optional): Bereich (YouTube und Web / nur YouTube / nur Web),
  Domains, Stichwörter, „automatische Zuordnung aktiv“ und „Auffang-Kategorie“ (bekommt alles, was sonst nirgends passt).
  Zuerst zählen Domains, dann Stichwörter in Titel und Kanal, dann in der Seitenbeschreibung. Stichwörter: Groß-/
  Kleinschreibung egal, Suche am Wortanfang („aktie“ findet „Aktien“); Stichwörter mit höchstens 3 Zeichen nur als
  ganzes Wort („ki“ findet nicht „Kirche“, „etf“ nicht „Netflix“).
- **Zuordnung testen**: URL und/oder Titel eingeben und sehen, welche Kategorie herauskäme.
- Änderungen gelten **sofort** – in der Übersicht, im Rechtsklick-Menü und für die automatische Zuordnung.

### Vorschläge („Weitere Kategorien“)

Aufklappbar unter den Kategorien. Vorschläge sind **nicht aktiv** und beeinflussen nichts, bis du sie aktivierst:
**Aktivieren** übernimmt die Kategorie mit Beispiel-Stichwörtern (oben in der Liste, also mit hoher Priorität),
**Nur Kategorie** ohne Stichwörter. Danach ist es eine normale Kategorie; „Deaktivieren …“ löscht sie über den
normalen Löschdialog. Enthalten: Gesundheit & Ernährung, Sport & Fitness, Psychologie & Persönlichkeitsentwicklung,
Philosophie & Wissen, Geopolitik & Gesellschaft, Wirtschaft & Makro, Krypto, Immobilien & Wohnen,
Selbstversorgung & Garten, KI & Tools, Business & Online-Geld, Kochen & Rezepte, Reisen & Auswandern,
Musik zum Entspannen, Heimwerken & DIY, Lernen & Sprachen, Unterhaltung & Comedy, Grenzwissen.

### Aktualisierung bestehender Installationen

Beim ersten Start nach dem Update werden die Kategorien einmalig ergänzt, ohne deine Änderungen zu überschreiben:
„Finanzen/Börse“ heißt jetzt **„Finanzen“** (deine Stichwörter bleiben, Aktien/ETF/Börse/Krypto/Bitcoin/Dividende/
Elliott/Charttechnik/Trading kommen dazu; gespeicherte Einträge werden mit umbenannt), **„Spirituelles“** (vor
Finanzen) und **„Astrologie & Zukunftsforschung“** (nach Finanzen – so landet „DAX Prognose“ weiterhin bei Finanzen)
werden hinzugefügt, falls es sie noch nicht gibt. Gleichnamige Kategorien (früher z. B. „Nachrichten“ für YouTube und
Web getrennt) werden zusammengeführt. Wer danach eine dieser Kategorien löscht, bekommt sie nicht wieder.

## Automatik

In den Einstellungen unter **Automatik** (standardmäßig aus):

- **Inaktive Tabs automatisch ablegen** nach N Stunden ohne Nutzung (Standard 6 h). Grundlage ist `tab.lastAccessed`
  (bzw. eine eigene Aufzeichnung bei älteren Browsern).
- **Tab-Limit**: Sind mehr als X Tabs offen (Standard 50), werden die am längsten ungenutzten abgelegt.
- Geprüft wird alle 15 Minuten (`chrome.alarms`). Nie automatisch abgelegt werden **angeheftete** Tabs, Tabs, die gerade
  **Ton abspielen**, die **aktiven** Tabs jedes Fensters und Domains auf der **Ausnahmeliste** (z. B. `mail.google.com`).

## Workflow mit Claude Cowork

Die Regeln sortieren schon grob vor. Für eine feinere, inhaltliche Einordnung (z. B. nach Themen, die nur du kennst)
kannst du Claude Cowork helfen lassen:

1. Übersicht → **Daten → Als JSON exportieren** (Datei `tab-ablage_JJJJ-MM-TT_hhmm.json`).
2. Die Datei in Cowork öffnen/hochladen und z. B. diesen Prompt verwenden:

   ```text
   Im Anhang ist ein Export meiner Browser-Erweiterung „Tab-Ablage“ (JSON, format "tab-ablage", version 1).
   Bitte ordne jedem Eintrag in "items" eine passende Kategorie im Feld "category" zu.

   Regeln:
   - Verwende möglichst die Kategorien aus "categories" (das sind meine aktuellen Kategorien).
     Neue Kategorien sind erlaubt, wenn sie mindestens 5 Einträge bündeln (z. B. "Kochen", "Reisen",
     "Elliott-Wellen") – sie werden beim Import automatisch angelegt.
   - Nutze title, channel, domain und description. Bei YouTube ist "channel" der Kanal.
   - Ändere KEINE anderen Felder, insbesondere nicht "id" und "url". Entferne keine Einträge.
   - Setze "categoryManual": true bei jedem Eintrag, dessen Kategorie du bewusst festlegst.
   - Gib die komplette Datei als gültiges JSON zurück (gleiche Struktur), Dateiname tab-ablage-kategorisiert.json.
   - Fasse am Ende kurz zusammen, wie viele Einträge in welcher Kategorie gelandet sind.
   ```

3. Übersicht → **Daten → Importieren …** und die Datei von Cowork auswählen.
   Einträge werden über `id` bzw. die normalisierte URL zusammengeführt. Eine Kategorie, die von der Regel-Kategorie
   abweicht (oder `categoryManual: true`), wird als **manuell** übernommen und von „Neu kategorisieren“ nicht überschrieben.
   Neue Einträge in der Datei werden hinzugefügt, ungültige (z. B. `chrome://`) übersprungen. Unbekannte Kategorien
   werden als neue Kategorien (ohne Regeln) angelegt und erscheinen sofort in Übersicht und Rechtsklick-Menü.

Tipp: Cowork kann auch neue Regeln vorschlagen („Welche Domains/Kanäle sollten dauerhaft in welche Kategorie?“) –
die trägst du dann unter Einstellungen → Kategorien → „Automatisch zuordnen, wenn …“ ein.

## Datenschema

### JSON-Export (`format: "tab-ablage"`, `version: 1`)

```json
{
  "format": "tab-ablage",
  "version": 1,
  "exportedAt": "2026-11-15T10:00:00.000Z",
  "hinweis": "…",
  "categories": ["Musik", "Tutorial/Lernen", "…"],
  "count": 2,
  "items": [
    {
      "id": "0w4x9k21m3a8pq",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
      "type": "youtube",
      "domain": "youtube.com",
      "channel": "Rick Astley",
      "category": "Musik",
      "categoryManual": false,
      "status": "active",
      "savedAt": "2026-11-15T09:33:00.000Z",
      "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      "description": "",
      "youtube": { "kind": "video", "videoId": "dQw4w9WgXcQ", "playlistId": null, "t": 42 }
    },
    {
      "id": "1k9…",
      "url": "https://www.heise.de/news/beispiel.html",
      "title": "Beispielartikel",
      "type": "web",
      "domain": "heise.de",
      "channel": "",
      "category": "Nachrichten",
      "categoryManual": false,
      "status": "archived",
      "savedAt": "2026-11-14T18:02:11.000Z",
      "thumbnail": "https://www.heise.de/…/vorschau.jpg",
      "description": "Kurzbeschreibung aus og:description"
    }
  ]
}
```

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | String | Stabile ID (Hash aus Video-ID bzw. normalisierter URL). Beim Import optional. |
| `url` | String | **Pflicht beim Import.** Bei YouTube inkl. `&t=` zum Weiterschauen. |
| `title` | String | Titel (YouTube-Titel aus oEmbed, ohne „- YouTube“). |
| `type` | `"youtube"` \| `"web"` | Wird beim Import aus der URL bestimmt. |
| `domain` | String | Hostname ohne `www.`. |
| `channel` | String | YouTube-Kanal, sonst leer. |
| `category` | String | Kategorie. Beim Import: gesetzt → wird übernommen (siehe oben). Leer → Regeln. |
| `categoryManual` | Boolean | `true` = manuell, wird von „Neu kategorisieren“ nicht verändert. |
| `status` | `"active"` \| `"archived"` | Abgelegt bzw. „Gesehen“. |
| `savedAt` | ISO-Datum | Zeitpunkt des Ablegens (beim Import auch Millisekunden/Sekunden-Zahl möglich). |
| `thumbnail` | String | Bild-URL (nie `data:`). |
| `description` | String | Kurzbeschreibung der Seite (max. 300 Zeichen). |
| `youtube` | Objekt | Nur bei YouTube: `kind` (`video`/`short`/`playlist`), `videoId`, `playlistId`, `t` (Sekunden). |

Akzeptiert werden beim Import auch ein reines Array von Einträgen oder `{"items": {"<id>": {…}}}`.

### Interner Speicher (`chrome.storage.local`)

| Schlüssel | Inhalt |
|---|---|
| `items` | Objekt `{ [id]: Eintrag }` – wie oben, zusätzlich `key`, `favIconUrl`, `siteName`, `yt`, `t`, `manualCategory`, `archivedAt`, `updatedAt`, `source` (`tab`/`link`/`auto`/`import`), `enriched`, `enrichTries`, `unavailable`. |
| `settings` | Einstellungen (Verhalten, Automatik, Ausnahmeliste, Farbschema, `closeAfterFile`). |
| `rules` | Kategorien `[{ id, name, color, scope: "youtube"\|"web"\|"alle", domains: [], keywords: [], enabled, fallback }]` in Prioritätsreihenfolge. `enabled` = automatische Zuordnung aktiv, `fallback` = Auffang-Kategorie. Namen sind eindeutig. |
| `rulesVersion` | Version des Kategorie-Formats (aktuell 2), steuert die einmalige Migration. |
| `autoLog` | Zeitpunkt/Anzahl des letzten automatischen Ablegens. |

Schreibzugriffe auf `items` laufen gebündelt über den Hintergrunddienst (ein Schreiber, keine Konflikte).

## Datenschutz

Alles bleibt **lokal** im Browser (`chrome.storage.local`). Es gibt kein Konto, keinen Server, kein Tracking.
Netzwerkanfragen entstehen nur:

- an `www.youtube.com/oembed` (Titel und Kanal eines abgelegten Videos),
- an `i.ytimg.com` (Vorschaubilder in der Übersicht),
- an die abgelegten Seiten selbst bzw. deren Bild-Server (Vorschaubild; ohne Cookies – abschaltbar unter
  „Vorschaubilder … nachträglich von der Seite laden“).

Export-Dateien entstehen nur, wenn du sie selbst herunterlädst.

## Tipps für Opera GX

- **RAM-Limiter ≠ weniger Tabs**: Der GX Control RAM-Limiter begrenzt den Speicher, indem er Tabs drosselt bzw.
  entlädt – die Tabs bleiben aber offen, belegen weiter Prozesse, Tab-Leiste und Sitzungswiederherstellung. Hunderte
  Tabs verlangsamen Start, Tab-Leiste und Synchronisierung trotzdem. Tab-Ablage reduziert die **Anzahl** der Tabs –
  beides ergänzt sich gut („Hard Limit“ moderat setzen und Tabs regelmäßig ablegen).
- **Tab-Snoozing einschalten**: Einstellungen (`opera://settings`) → nach „Snooze“ / „Tabs schlafen legen“ suchen →
  inaktive Tabs schlafen lassen. So kosten die Tabs, die du noch offen hast, weniger RAM. (Schlafende Tabs legt
  Tab-Ablage problemlos ab; das Vorschaubild wird dann nachträglich geladen.)
- **Seite beim Start**: Unter „Beim Start“ lieber „Startseite“ statt „Vorherige Sitzung“ wählen, wenn du die Tabs
  ohnehin abgelegt hast – der Browser startet dann deutlich schneller.
- **Arbeitsbereiche (Workspaces)**: „Alle Tabs ablegen“ arbeitet mit allen Tabs, die Opera der Erweiterungs-Schnittstelle
  meldet. Ob Tabs aus gerade nicht sichtbaren Arbeitsbereichen dazugehören, hängt von Opera ab – am besten einmal mit
  wenigen Tabs ausprobieren. Angeheftete Tabs bleiben immer offen.

## Entwicklung

Kein Build-Schritt – reines HTML/CSS/JavaScript (ES-Module).

```text
extension/
  manifest.json        Manifest V3
  background.js        Service Worker: Ablegen/Schließen, Anreicherung, Automatik, Kontextmenü
  popup.html/.js/.css  Popup
  overview.html/.js/.css Übersicht
  options.html/.js/.css  Einstellungen
  theme.css            gemeinsames Farbschema (dunkel/hell)
  lib/url.js           URL-Normalisierung, YouTube-Erkennung, Zeitmarken (rein, testbar)
  lib/categorize.js    Regel-Engine + Standardkategorien (rein, testbar)
  lib/categories.js    Umbenennen/Löschen/Ergänzen von Kategorien, Migration (rein, testbar)
  lib/suggestions.js   Katalog der Kategorie-Vorschläge (rein, testbar)
  lib/menus.js         Aufbau des YouTube-Kontextmenüs aus den Kategorien, URL-Muster (rein, testbar)
  lib/items.js         Datenmodell, Export/Import, Lesezeichen-HTML (rein, testbar)
  lib/meta.js          og:image/Beschreibung aus HTML (rein, testbar)
  lib/settings.js      Einstellungen/Regeln in chrome.storage
  lib/ui.js            gemeinsame UI-Helfer
  icons/               PNG-Icons (erzeugt mit tools/make_icons.py)
tools/
  make_icons.py        erzeugt die Icons (nur Python-Standardbibliothek)
  smoke.cjs            Rauchtest mit Playwright (lädt die Erweiterung in Chromium)
tests/                 Node-Tests (node --test, ohne Abhängigkeiten)
```

```bash
node --test                  # Unit-Tests (URL, YouTube, Kategorien, Migration, Vorschläge, Menüs, Import/Export, Manifest)
python3 tools/make_icons.py  # Icons neu erzeugen
node tools/smoke.cjs         # optional: Rauchtest, braucht Playwright + Chrome/Chromium
```

Zur Fehlersuche stellt der Service Worker `globalThis.tabAblage` bereit (`handleMenuClick`, `rebuildMenus`,
`menuState`) – dieselben Funktionen, die das Kontextmenü verwendet. Der Rauchtest nutzt sie, weil sich native
Kontextmenüs nicht fernsteuern lassen.

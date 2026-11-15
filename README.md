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
- **Automatische Kategorien** über eine editierbare Regel-Engine (Domains + Stichwörter, Prioritätsreihenfolge).
  YouTube: Musik, Tutorial/Lernen, Gaming, Nachrichten, Podcast/Interview, Finanzen/Börse, Technik, Sonstiges-Video.
  Web: Shopping, Nachrichten, Social Media, Entwicklung, Dokumente/Wissen, Sonstiges.
  Manuell gesetzte Kategorien bleiben erhalten; „Neu kategorisieren“ wendet die Regeln auf alle übrigen Einträge an.
- **Übersicht** (eigener Tab): responsives Raster mit 16:9-Vorschaubildern, Filter nach Kategorie und Typ (YouTube/Web),
  Gruppierung nach Kategorie, Kanal, Domain oder Datum, Suche, Sortierung, Seitenaufteilung (ab 200 Einträgen pro Seite,
  einstellbar). Bilder werden erst beim Scrollen geladen.
- **Kartenaktionen**: Öffnen (Klick = Vordergrund, Mittelklick/Strg+Klick = Hintergrund), „gesehen“ (Archiv-Ansicht
  „Gesehen“), Löschen (mit „Rückgängig“), Kategorie ändern.
- **Mehrfachauswahl** mit Kontrollkästchen (Umschalt+Klick für Bereiche, ganze Gruppe, ganze Seite, alle Treffer):
  öffnen (Warnung ab 10 Tabs), als gesehen markieren, Kategorie setzen, löschen.
- **Automatik** (optional): inaktive Tabs nach N Stunden ablegen, Tab-Limit.
- **Kontextmenü**: „Tab ablegen“, „Alle Tabs rechts davon ablegen“, „Link für später ablegen“.
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
- **Einstellungen** (Popup → Einstellungen oder Rechtsklick aufs Symbol → Optionen): Verhalten, Automatik,
  Kategorien-Regeln (inkl. Regeltester), Export/Import, alles löschen.

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
   - Verwende möglichst diese Kategorien: Musik, Tutorial/Lernen, Gaming, Nachrichten, Podcast/Interview,
     Finanzen/Börse, Technik, Sonstiges-Video (für YouTube) sowie Shopping, Nachrichten, Social Media,
     Entwicklung, Dokumente/Wissen, Sonstiges (für Webseiten). Neue Kategorien sind erlaubt, wenn sie
     mindestens 5 Einträge bündeln (z. B. "Kochen", "Reisen", "Elliott-Wellen").
   - Nutze title, channel, domain und description. Bei YouTube ist "channel" der Kanal.
   - Ändere KEINE anderen Felder, insbesondere nicht "id" und "url". Entferne keine Einträge.
   - Setze "categoryManual": true bei jedem Eintrag, dessen Kategorie du bewusst festlegst.
   - Gib die komplette Datei als gültiges JSON zurück (gleiche Struktur), Dateiname tab-ablage-kategorisiert.json.
   - Fasse am Ende kurz zusammen, wie viele Einträge in welcher Kategorie gelandet sind.
   ```

3. Übersicht → **Daten → Importieren …** und die Datei von Cowork auswählen.
   Einträge werden über `id` bzw. die normalisierte URL zusammengeführt. Eine Kategorie, die von der Regel-Kategorie
   abweicht (oder `categoryManual: true`), wird als **manuell** übernommen und von „Neu kategorisieren“ nicht überschrieben.
   Neue Einträge in der Datei werden hinzugefügt, ungültige (z. B. `chrome://`) übersprungen.

Tipp: Cowork kann auch neue Regeln vorschlagen („Welche Domains/Kanäle sollten dauerhaft in welche Kategorie?“) –
die trägst du dann unter Einstellungen → Kategorien-Regeln ein.

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
| `settings` | Einstellungen (Verhalten, Automatik, Ausnahmeliste, Farbschema). |
| `rules` | Regel-Liste `[{ id, name, scope: "youtube"\|"web"\|"alle", domains: [], keywords: [], enabled }]` in Prioritätsreihenfolge. |
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
  lib/categorize.js    Regel-Engine + Standardregeln (rein, testbar)
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
node --test                  # Unit-Tests (URL, YouTube, Kategorien, Import/Export, Manifest-Prüfung)
python3 tools/make_icons.py  # Icons neu erzeugen
node tools/smoke.cjs         # optional: Rauchtest, braucht Playwright + Chrome/Chromium
```

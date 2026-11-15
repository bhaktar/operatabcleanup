#!/usr/bin/env node
/*
 * Rauchtest: lädt die entpackte Erweiterung in Chromium (Playwright), öffnet einige Tabs,
 * löst "Alle Tabs ablegen & schließen" über das Popup aus und prüft Speicher + Übersicht.
 *
 *   node tools/smoke.cjs            (Playwright muss installiert/auflösbar sein)
 *
 * Optionale Umgebungsvariablen:
 *   CHROME_PATH   Pfad zu Chrome/Chromium (Standard: Playwright-Chromium bzw. /usr/bin/google-chrome)
 *   SHOT_DIR      Ordner für Screenshots (Standard: OS-Temp)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

let playwright;
try {
  playwright = require('playwright');
} catch {
  try {
    playwright = require(require.resolve('playwright', { paths: [process.env.NODE_PATH || '', '/opt/node-tools/node_modules'] }));
  } catch {
    console.error('Playwright nicht gefunden – Rauchtest übersprungen.');
    process.exit(2);
  }
}

const EXT = path.resolve(__dirname, '..', 'extension');
const SHOTS = process.env.SHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tab-ablage-shots-'));

function startServer() {
  const page = (title, extra = '') => `<!doctype html><html><head><title>${title}</title>
    <meta property="og:image" content="/bild-${encodeURIComponent(title)}.png">
    <meta name="description" content="Beschreibung von ${title}">${extra}</head><body><h1>${title}</h1></body></html>`;
  const png = fs.readFileSync(path.join(EXT, 'icons', 'icon128.png'));
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/bild-')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(png); }
    const name = decodeURIComponent(req.url.replace(/^\//, '').replace(/\?.*$/, '')) || 'start';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page(`Seite ${name}`));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tab-ablage-profile-'));
  const args = [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--proxy-bypass-list=127.0.0.1;localhost',
  ];
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) args.push(`--proxy-server=${proxy}`, '--ignore-certificate-errors');
  const launch = { headless: false, args };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  else if (fs.existsSync('/usr/bin/google-chrome')) launch.executablePath = '/usr/bin/google-chrome';

  const ctx = await playwright.chromium.launchPersistentContext(userDir, launch);
  const errors = [];
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(`pageerror ${p.url()}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${p.url()}: ${m.text()}`); });
  };
  ctx.on('page', watch);
  // YouTube-Seiten lokal nachbilden (kein Netz/Captcha nötig); oEmbed läuft im Service Worker
  // weiterhin echt über das Netz und darf fehlschlagen.
  await ctx.route(/^https:\/\/(www\.youtube\.com|youtu\.be)\/(watch|[A-Za-z0-9_-]{11})/, (route) => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html><head><title>(2) Testvideo - YouTube</title></head><body><video></video></body></html>',
  }));
  let ok = true;
  const check = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) ok = false; };

  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = sw.url().split('/')[2];
    check(!!extId, `Erweiterung geladen (ID ${extId})`);

    // Tabs öffnen: 3 Webseiten (eine doppelt mit Tracking), 2 YouTube-Links (Duplikat), 1 angehefteter Tab
    const urls = [
      `${base}/eins`, `${base}/zwei?utm_source=test`, `${base}/zwei`, `${base}/drei`,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
    ];
    for (const u of urls) {
      const p = await ctx.newPage();
      await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    }
    // ersten (leeren) Tab anheften
    const pinnedId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ url: 'about:blank' });
      if (t) await chrome.tabs.update(t.id, { pinned: true });
      return t ? t.id : null;
    });
    const before = await sw.evaluate(() => chrome.tabs.query({}).then((t) => t.length));
    console.log(`     ${before} Tabs offen vor dem Ablegen`);

    // Popup als Seite öffnen und "Alle Tabs ablegen" klicken
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForFunction(() => document.getElementById('stat-open').textContent !== '–');
    check(Number(await popup.textContent('#stat-open')) >= urls.length, 'Popup zeigt Anzahl offener Tabs');
    await popup.click('#btn-all');

    // warten, bis gespeichert und geschlossen
    await sw.evaluate(() => new Promise((resolve) => {
      const t0 = Date.now();
      const tick = async () => {
        const tabs = await chrome.tabs.query({});
        const open = tabs.filter((t) => /^https?:/.test(t.url || t.pendingUrl || ''));
        if (!open.length || Date.now() - t0 > 30000) return resolve();
        setTimeout(tick, 300);
      };
      tick();
    }));
    await new Promise((r) => setTimeout(r, 1500));

    const { items } = await sw.evaluate(() => chrome.storage.local.get('items'));
    const list = Object.values(items || {});
    if (process.env.DEBUG) console.log(list.map((i) => `     ${i.type} ${i.url} | ${i.title}`).join('\n'));
    check(list.length === 4, `4 Einträge nach Duplikaterkennung gespeichert (ist: ${list.length})`);
    const yt = list.find((i) => i.type === 'youtube');
    check(!!yt && yt.thumbnail === 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', 'YouTube-Thumbnail gesetzt');
    check(!!yt && yt.t === 42, `YouTube-Zeitmarke übernommen (t=${yt && yt.t})`);
    const web = list.filter((i) => i.type === 'web');
    check(web.every((i) => i.category), 'alle Einträge kategorisiert');
    check(web.some((i) => /\/bild-/.test(i.thumbnail || '')), 'og:image aus offenem Tab gelesen');
    check(list.every((i) => !String(i.thumbnail || '').startsWith('data:') && !String(i.favIconUrl || '').startsWith('data:')), 'keine data:-URLs gespeichert');

    const tabsAfter = await sw.evaluate(() => chrome.tabs.query({}));
    const own = tabsAfter.filter((t) => (t.url || '').includes('/overview.html'));
    check(own.length === 1, 'Übersicht wurde geöffnet');
    check(tabsAfter.some((t) => t.id === pinnedId), 'angehefteter Tab blieb offen');
    check(!tabsAfter.some((t) => /^https?:/.test(t.url || '')), 'Web-Tabs geschlossen');

    // Anreicherung abwarten (oEmbed – kann ohne Netz fehlschlagen, wird toleriert)
    await new Promise((r) => setTimeout(r, 6000));
    const after = Object.values((await sw.evaluate(() => chrome.storage.local.get('items'))).items);
    const yt2 = after.find((i) => i.type === 'youtube');
    console.log(`     oEmbed: Kanal="${yt2.channel}", Titel="${yt2.title}", Kategorie="${yt2.category}" (Netzwerk-abhängig)`);

    // Übersicht prüfen
    const ov = ctx.pages().find((p) => p.url().includes('/overview.html')) || await ctx.newPage();
    if (!ov.url().includes('/overview.html')) await ov.goto(`chrome-extension://${extId}/overview.html`);
    await ov.setViewportSize({ width: 1400, height: 900 });
    await ov.reload();
    await ov.waitForSelector('.card', { timeout: 10000 });
    check((await ov.$$('.card')).length === 4, 'Übersicht zeigt 4 Karten');
    await ov.screenshot({ path: path.join(SHOTS, 'overview.png') });
    await ov.emulateMedia({ colorScheme: 'dark' });
    await ov.screenshot({ path: path.join(SHOTS, 'overview-dunkel.png') });
    await popup.emulateMedia({ colorScheme: 'dark' });
    await popup.setViewportSize({ width: 340, height: 460 });
    await popup.reload();
    await popup.waitForTimeout(500);
    await popup.screenshot({ path: path.join(SHOTS, 'popup-dunkel.png') });

    // Suche, Gruppierung, Kategorie ändern, als gesehen markieren, löschen
    await ov.fill('#search', 'eins');
    await ov.waitForTimeout(500);
    check((await ov.$$('.card')).length === 1, 'Suche filtert');
    await ov.fill('#search', '');
    await ov.waitForTimeout(400);
    await ov.selectOption('#group', 'domain');
    await ov.waitForTimeout(200);
    check((await ov.$$('.group-head')).length >= 2, 'Gruppierung nach Domain');
    await ov.click('.card .badge');
    await ov.fill('#catmenu-input', 'Testkategorie');
    await ov.press('#catmenu-input', 'Enter');
    await ov.waitForTimeout(800);
    const manual = Object.values((await sw.evaluate(() => chrome.storage.local.get('items'))).items).filter((i) => i.manualCategory);
    check(manual.length === 1 && manual[0].category === 'Testkategorie', 'manuelle Kategorie gespeichert');
    await ov.click('.card [data-act="seen"]');
    await ov.waitForTimeout(800);
    check(Number(await ov.textContent('#count-archived')) === 1, 'als gesehen markiert');
    await ov.click('.card [data-act="delete"]');
    await ov.waitForTimeout(800);
    check(Object.keys((await sw.evaluate(() => chrome.storage.local.get('items'))).items).length === 3, 'Eintrag gelöscht');
    await ov.click('#toast button');
    await ov.waitForTimeout(800);
    check(Object.keys((await sw.evaluate(() => chrome.storage.local.get('items'))).items).length === 4, 'Löschen rückgängig gemacht');

    // Öffnen im Hintergrund (Strg+Klick) -> Eintrag wird entfernt (Standard)
    const n0 = (await sw.evaluate(() => chrome.tabs.query({}))).length;
    await ov.click('.card .title', { modifiers: ['Control'] });
    await ov.waitForTimeout(1200);
    const n1 = (await sw.evaluate(() => chrome.tabs.query({}))).length;
    check(n1 === n0 + 1, 'Strg+Klick öffnet Tab');
    check(Object.keys((await sw.evaluate(() => chrome.storage.local.get('items'))).items).length === 3, 'nach dem Öffnen aus Liste entfernt');

    // Auswahl + Sammelaktion
    await ov.click('#bulk-all').catch(() => {});
    const firstBox = await ov.$('.card .sel input');
    await firstBox.check({ force: true });
    await ov.waitForTimeout(200);
    check(!(await ov.$eval('#bulk', (e) => e.hidden)), 'Sammelleiste erscheint bei Auswahl');
    await ov.screenshot({ path: path.join(SHOTS, 'overview-auswahl.png') });

    // Einstellungen
    const opt = await ctx.newPage();
    await opt.goto(`chrome-extension://${extId}/options.html`);
    await opt.waitForSelector('.cat');
    check((await opt.$$('.cat')).length >= 10, 'Optionen zeigen Kategorien');
    await opt.fill('#test-url', 'https://www.amazon.de/dp/1');
    check((await opt.textContent('#test-result')).includes('Shopping'), 'Regeltest in den Optionen');
    await opt.check('#autoEnabled');
    await opt.waitForTimeout(700);
    const settings = (await sw.evaluate(() => chrome.storage.local.get('settings'))).settings;
    check(settings && settings.autoArchive.enabled === true, 'Einstellung gespeichert');
    await opt.setViewportSize({ width: 1100, height: 1400 });
    await opt.screenshot({ path: path.join(SHOTS, 'options.png'), fullPage: false });

    // Automatik direkt prüfen: Schwellwert sehr klein -> inaktiver Tab wird abgelegt
    const p = await ctx.newPage();
    await p.goto(`${base}/auto`);
    await ov.bringToFront();
    await sw.evaluate(async () => {
      const r = await chrome.storage.local.get('settings');
      r.settings.autoArchive = { enabled: true, hours: 0.25 };
      await chrome.storage.local.set({ settings: r.settings });
    });
    // lastAccessed lässt sich nicht fälschen; Tab-Limit testen: max 1
    await sw.evaluate(async () => {
      const r = await chrome.storage.local.get('settings');
      r.settings.tabLimit = { enabled: true, max: 1 };
      await chrome.storage.local.set({ settings: r.settings });
    });
    await opt.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ cmd: 'settingsChanged' }, res)));
    await new Promise((r) => setTimeout(r, 4000));
    const autoItems = Object.values((await sw.evaluate(() => chrome.storage.local.get('items'))).items);
    check(autoItems.some((i) => i.source === 'auto' && i.url.endsWith('/auto')), 'Tab-Limit legt inaktiven Tab automatisch ab');

    // Export im Format prüfen (über Modul im Seitenkontext)
    const exp = await ov.evaluate(async () => {
      const { exportData } = await import('./lib/items.js');
      const { getRules } = await import('./lib/settings.js');
      const { items } = await chrome.storage.local.get('items');
      return exportData(items, await getRules());
    });
    check(exp.format === 'tab-ablage' && exp.items.length === autoItems.length, 'JSON-Export erzeugt');

    // ---------------------------------------------------------------- Kategorien & Kontextmenü
    await sw.evaluate(async () => {
      const r = await chrome.storage.local.get('settings');
      r.settings.tabLimit = { enabled: false, max: 50 };
      r.settings.autoArchive = { enabled: false, hours: 6 };
      await chrome.storage.local.set({ settings: r.settings });
    });
    const rulesNow = async () => sw.evaluate(() => chrome.storage.local.get(['rules', 'rulesVersion']));
    const itemsNow = async () => Object.values((await sw.evaluate(() => chrome.storage.local.get('items'))).items || {});
    // Hook des Service Workers: dieselben Funktionen, die das Kontextmenü verwendet
    const menuIds = async () => sw.evaluate(async () => {
      await globalThis.tabAblage.menuState.chain;
      return globalThis.tabAblage.menuState.lastBuilt;
    });
    const findVid = async (id) => (await itemsNow()).find((i) => i.yt && i.yt.videoId === id);
    const rv = await rulesNow();
    check(rv.rulesVersion === 2 && ['Spirituelles', 'Astrologie & Zukunftsforschung', 'Finanzen'].every((n) => rv.rules.some((r) => r.name === n)),
      'Neuinstallation: Standardkategorien inkl. Spirituelles/Astrologie/Finanzen gespeichert');
    let ids = await menuIds();
    check(ids.includes('yt-link') && ids.includes('yt-page') && ids.includes('yt-link|cat|Spirituelles') && ids.includes('yt-page|close'),
      `Kontextmenü mit Kategorien aufgebaut (${ids.length} Einträge)`);
    check(ids.includes('save-link'), '„Link für später ablegen“ weiterhin vorhanden');

    // Link in Kategorie senden
    const n0Items = (await itemsNow()).length;
    await sw.evaluate(() => globalThis.tabAblage.handleMenuClick({ menuItemId: 'yt-link|cat|Gaming', linkUrl: 'https://youtu.be/abcdefghijk?si=x' }, null));
    let vid = await findVid('abcdefghijk');
    check(vid && vid.category === 'Gaming' && vid.manualCategory === true && vid.thumbnail.includes('/abcdefghijk/'),
      'Link in Kategorie „Gaming“ abgelegt (manuell, Thumbnail)');
    check((await sw.evaluate(() => chrome.action.getBadgeText({}))) === '✓', 'Badge „✓“ als Rückmeldung');
    await sw.evaluate(() => globalThis.tabAblage.handleMenuClick({ menuItemId: 'yt-link|cat|Musik', linkUrl: 'https://www.youtube.com/watch?v=abcdefghijk&t=10' }, null));
    vid = await findVid('abcdefghijk');
    check((await itemsNow()).length === n0Items + 1 && vid.category === 'Musik', 'gleiches Video erneut: Kategorie aktualisiert, kein Duplikat');
    check((await sw.evaluate(() => chrome.action.getBadgeText({}))) === '↻', 'Badge „↻“ meldet „schon vorhanden“');

    // Videoseite selbst ablegen (Seiten-Variante, Tab wird standardmäßig geschlossen)
    const ytPage = await ctx.newPage();
    await ytPage.goto('https://www.youtube.com/watch?v=zyxwvutsrqp', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const pageTab = await sw.evaluate(async () => (await chrome.tabs.query({ url: '*://www.youtube.com/watch*' }))[0]);
    await sw.evaluate((t) => globalThis.tabAblage.handleMenuClick({ menuItemId: 'yt-page|cat|Technik', pageUrl: t.url }, t), pageTab);
    vid = await findVid('zyxwvutsrqp');
    check(vid && vid.category === 'Technik' && vid.manualCategory, 'Videoseite in „Technik“ abgelegt');
    check(!(await sw.evaluate((id) => chrome.tabs.get(id).then(() => true, () => false), pageTab.id)), 'Tab danach geschlossen (Standard)');

    // Kategorien in den Optionen verwalten
    await opt.bringToFront();
    await opt.reload();
    await opt.waitForSelector('.cat');
    await opt.click('#cat-add');
    await opt.waitForTimeout(300);
    const nameInput = opt.locator('.cat').first().locator('.c-name');
    await nameInput.fill('Testliste');
    await nameInput.press('Enter');
    await opt.waitForTimeout(1200);
    check((await rulesNow()).rules.some((r) => r.name === 'Testliste' && !r.keywords.length), 'Kategorie ohne Regeln hinzugefügt');
    check((await menuIds()).includes('yt-link|cat|Testliste'), 'Kontextmenü enthält neue Kategorie sofort');
    const editCat = (name, fn) => opt.evaluate(([n, src]) => {
      const card = [...document.querySelectorAll('.cat')].find((x) => x.querySelector('.c-name').value === n);
      // eslint-disable-next-line no-new-func
      new Function('card', src)(card);
    }, [name, fn]);
    await editCat('Musik', `const el = card.querySelector('.c-name'); el.value = 'Lieder';
      el.dispatchEvent(new Event('change', { bubbles: true }));`);
    await opt.waitForTimeout(1200);
    vid = await findVid('abcdefghijk');
    check(vid.category === 'Lieder' && (await rulesNow()).rules.some((r) => r.name === 'Lieder'), 'Umbenennen ändert Kategorie und Einträge');
    check((await menuIds()).includes('yt-link|cat|Lieder'), 'Kontextmenü nach Umbenennen aktualisiert');
    await editCat('Lieder', `const c = card.querySelector('.c-color'); c.value = '#123456';
      c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));`);
    await opt.waitForTimeout(1200);
    await ov.bringToFront();
    await ov.waitForTimeout(600);
    const badgeStyle = await ov.evaluate(() => [...document.querySelectorAll('.badge')].find((b) => b.textContent === 'Lieder')?.getAttribute('style') || '');
    check(badgeStyle.includes('#123456'), 'Kategoriefarbe erscheint in der Übersicht');
    await opt.bringToFront();
    await editCat('Lieder', `card.querySelector('.c-del').click();`);
    await opt.waitForSelector('#del-dialog[open]');
    check((await opt.$eval('#del-target', (s) => s.value)) === 'Sonstiges', 'Löschdialog schlägt „Sonstiges“ vor');
    await opt.click('#del-ok');
    await opt.waitForTimeout(1200);
    vid = await findVid('abcdefghijk');
    check(vid.category === 'Sonstiges' && !(await rulesNow()).rules.some((r) => r.name === 'Lieder'), 'Löschen verschiebt Einträge nach „Sonstiges“');

    // Vorschläge
    check(!(await rulesNow()).rules.some((r) => r.name === 'Krypto'), 'Vorschlag „Krypto“ standardmäßig inaktiv');
    await opt.click('#sug-box summary');
    await opt.click('[data-sug="sug-krypto"] [data-sug-on]');
    await opt.waitForTimeout(1200);
    const kr = (await rulesNow()).rules.find((r) => r.name === 'Krypto');
    check(kr && kr.keywords.includes('bitcoin'), 'Vorschlag aktiviert (mit Stichwörtern)');
    check((await menuIds()).includes('yt-link|cat|Krypto'), 'aktivierter Vorschlag im Kontextmenü');
    check(await opt.$eval('[data-sug="sug-krypto"] button', (b) => b.disabled && b.textContent === 'Aktiv'), 'Vorschlag zeigt „Aktiv“');
    await opt.click('[data-sug="sug-ki"] [data-sug-bare]');
    await opt.waitForTimeout(1200);
    const ki = (await rulesNow()).rules.find((r) => r.name === 'KI & Tools');
    check(ki && ki.keywords.length === 0, '„Nur Kategorie“ aktiviert ohne Stichwörter');
    await opt.evaluate(() => window.scrollTo(0, 0));
    await opt.screenshot({ path: path.join(SHOTS, 'options-kategorien.png') });

    const relevant = errors.filter((e) => !/net::ERR|Failed to load resource|ERR_TUNNEL|ERR_CERT|favicon/i.test(e));
    if (relevant.length) console.log('Fehlermeldungen:\n  ' + relevant.join('\n  '));
    check(relevant.length === 0, 'keine JS-Fehler in Erweiterungsseiten');
    console.log(`     Screenshots: ${SHOTS}`);
  } catch (e) {
    console.error('FAIL Ausnahme:', e);
    ok = false;
  } finally {
    await ctx.close().catch(() => {});
    server.close();
  }
  process.exit(ok ? 0 : 1);
})();

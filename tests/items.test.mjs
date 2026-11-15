import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildItem, mergeResave, openUrl, exportData, exportBookmarksHtml, parseImportPayload, mergeImport, dateGroupLabel,
} from '../extension/lib/items.js';
import { extractMetaFromHtml, decodeEntities } from '../extension/lib/meta.js';
import { normalizeRules, DEFAULT_RULES, categorize } from '../extension/lib/categorize.js';

const rules = normalizeRules(DEFAULT_RULES);

test('buildItem: YouTube mit Thumbnail und Zeitmarke, keine data:-Favicons', () => {
  const it = buildItem({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=95&si=x', title: '(2) Song - YouTube', favIconUrl: 'data:image/png;base64,AAA' }, 1000);
  assert.equal(it.type, 'youtube');
  assert.equal(it.title, 'Song');
  assert.equal(it.thumbnail, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  assert.equal(it.t, 95);
  assert.equal(it.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=95s');
  assert.equal(it.favIconUrl, '');
  assert.equal(it.savedAt, 1000);
  assert.equal(openUrl({ ...it, t: 200 }), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=200s');
  assert.equal(buildItem({ url: 'chrome://newtab' }), null);
  assert.equal(buildItem({ url: 'opera://startpage' }), null);
});

test('buildItem: Web-Eintrag ohne Tracking', () => {
  const it = buildItem({ url: 'https://www.heise.de/news/x.html?utm_source=rss&wt_mc=1', title: 'News', favIconUrl: 'https://www.heise.de/favicon.ico' });
  assert.equal(it.url, 'https://www.heise.de/news/x.html');
  assert.equal(it.domain, 'heise.de');
  assert.equal(it.type, 'web');
  assert.equal(it.favIconUrl, 'https://www.heise.de/favicon.ico');
});

test('mergeResave reaktiviert und übernimmt neue Zeitmarke', () => {
  const a = buildItem({ url: 'https://youtu.be/dQw4w9WgXcQ', title: '' }, 1);
  a.status = 'archived';
  const b = buildItem({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=300', title: 'Titel' }, 2);
  mergeResave(a, b, 5);
  assert.equal(a.status, 'active');
  assert.equal(a.t, 300);
  assert.equal(a.title, 'Titel');
  assert.equal(a.savedAt, 5);
});

test('extractMetaFromHtml liest og:image, Beschreibung, Titel', () => {
  const html = `<!doctype html><html><head>
    <title>Seitentitel &amp; mehr</title>
    <meta name="description" content="Kurze &quot;Beschreibung&quot;">
    <meta content="/bilder/vorschau.jpg" property='og:image'>
    <meta property="og:site_name" content="Beispiel">
    </head><body><meta property="og:image" content="/falsch.jpg"></body></html>`;
  const m = extractMetaFromHtml(html, 'https://beispiel.de/artikel/1');
  assert.equal(m.image, 'https://beispiel.de/bilder/vorschau.jpg');
  assert.equal(m.description, 'Kurze "Beschreibung"');
  assert.equal(m.title, 'Seitentitel & mehr');
  assert.equal(m.siteName, 'Beispiel');
  const tw = extractMetaFromHtml('<meta name="twitter:image" content="https://cdn.x/y.png"><meta property="og:image" content="data:image/png;base64,AA">', 'https://a.de');
  assert.equal(tw.image, '');
  assert.equal(extractMetaFromHtml('<meta name="twitter:image" content="https://cdn.x/y.png">', 'https://a.de').image, 'https://cdn.x/y.png');
  assert.equal(decodeEntities('&#x41;&#66;&uuml;'), 'AB&uuml;');
});

test('Export/Import-Rundlauf: Kategorie aus Cowork wird übernommen und als manuell markiert', () => {
  const items = {};
  for (const [url, title] of [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30', 'Never Gonna Give You Up (Official Music Video)'],
    ['https://www.amazon.de/dp/B0001', 'Kopfhörer'],
  ]) {
    const it = buildItem({ url, title }, Date.UTC(2025, 0, 2));
    it.category = categorize(it, rules);
    items[it.id] = it;
  }
  const data = exportData(items, rules, Date.UTC(2025, 0, 3));
  assert.equal(data.format, 'tab-ablage');
  assert.equal(data.version, 1);
  assert.equal(data.items.length, 2);
  const ytExp = data.items.find((x) => x.type === 'youtube');
  assert.equal(ytExp.youtube.t, 30);
  assert.equal(ytExp.category, 'Musik');
  assert.equal(ytExp.savedAt, '2025-01-02T00:00:00.000Z');

  // Cowork ändert eine Kategorie, lässt die andere gleich, fügt einen neuen Eintrag hinzu
  const edited = JSON.parse(JSON.stringify(data));
  edited.items[0].category = 'Wochenende';
  edited.items.push({ url: 'https://github.com/foo/bar?utm_source=x', title: 'Repo', category: 'Entwicklung' });
  edited.items.push({ url: 'chrome://settings', title: 'ungültig' });
  const raw = parseImportPayload(JSON.stringify(edited));
  const res = mergeImport(items, raw, rules, Date.UTC(2025, 0, 4));
  assert.deepEqual(res, { added: 1, updated: 2, skipped: 1 });
  const changed = items[edited.items[0].id];
  assert.equal(changed.category, 'Wochenende');
  assert.equal(changed.manualCategory, true);
  const same = items[edited.items[1].id];
  assert.equal(same.manualCategory, false);
  const repo = Object.values(items).find((i) => i.domain === 'github.com');
  assert.equal(repo.category, 'Entwicklung');
  assert.equal(repo.manualCategory, false);
  assert.equal(repo.url, 'https://github.com/foo/bar');

  // Import über URL statt id (Duplikat in anderer Schreibweise)
  const r2 = mergeImport(items, [{ url: 'https://youtu.be/dQw4w9WgXcQ', category: 'Lieblinge', status: 'archived' }], rules);
  assert.equal(r2.updated, 1);
  const v = Object.values(items).find((i) => i.yt && i.yt.videoId === 'dQw4w9WgXcQ');
  assert.equal(v.category, 'Lieblinge');
  assert.equal(v.status, 'archived');
});

test('parseImportPayload: Array, Objekt nach id, Lesezeichen-HTML, URL-Liste', () => {
  assert.equal(parseImportPayload('[{"url":"https://a.de"}]').length, 1);
  assert.equal(parseImportPayload('{"items":{"x":{"url":"https://a.de"},"y":{"url":"https://b.de"}}}').length, 2);
  const html = exportBookmarksHtml({ a: { ...buildItem({ url: 'https://a.de/?x=1&y=2', title: 'A & B' }), category: 'Test' } });
  assert.match(html, /<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.match(html, /<H3[^>]*>Test<\/H3>/);
  assert.match(html, /HREF="https:\/\/a\.de\/\?x=1&amp;y=2"/);
  const back = parseImportPayload(html);
  assert.deepEqual(back, [{ url: 'https://a.de/?x=1&y=2', title: 'A & B' }]);
  assert.deepEqual(parseImportPayload('https://a.de Titel hier\nkeine url\nhttps://b.de'),
    [{ url: 'https://a.de', title: 'Titel hier' }, { url: 'https://b.de', title: '' }]);
  assert.throws(() => parseImportPayload('{"foo":1}'));
});

test('dateGroupLabel', () => {
  const now = new Date(2025, 5, 15, 12).getTime();
  assert.equal(dateGroupLabel(new Date(2025, 5, 15, 8).getTime(), now), 'Heute');
  assert.equal(dateGroupLabel(new Date(2025, 5, 14, 23).getTime(), now), 'Gestern');
  assert.equal(dateGroupLabel(new Date(2025, 5, 10).getTime(), now), 'Letzte 7 Tage');
  assert.equal(dateGroupLabel(new Date(2025, 4, 20).getTime(), now), 'Letzte 30 Tage');
  assert.equal(dateGroupLabel(new Date(2024, 11, 1).getTime(), now), 'Dezember 2024');
});

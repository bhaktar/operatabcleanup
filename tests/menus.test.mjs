import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesPattern, matchesAny, YT_LINK_PATTERNS, YT_PAGE_PATTERNS, buildCategoryMenus, menuItemId, parseMenuItemId,
  menuCategories, MENU, isFileableYouTubeUrl,
} from '../extension/lib/menus.js';
import { normalizeRules, DEFAULT_RULES } from '../extension/lib/categorize.js';

test('matchesPattern: Chrome-Match-Patterns', () => {
  assert.ok(matchesPattern('https://www.youtube.com/watch?v=x', '*://*.youtube.com/watch*'));
  assert.ok(matchesPattern('https://youtube.com/watch?v=x', '*://*.youtube.com/watch*'));
  assert.ok(matchesPattern('http://youtu.be/abc', '*://youtu.be/*'));
  assert.equal(matchesPattern('https://notyoutube.com/watch', '*://*.youtube.com/watch*'), false);
  assert.equal(matchesPattern('ftp://youtu.be/abc', '*://youtu.be/*'), false);
  assert.equal(matchesPattern('kein url', '*://*/*'), false);
});

test('Link-Muster: nur Videos, Shorts, Live, Playlists, youtu.be', () => {
  const yes = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/shorts/abcdefghijk',
    'https://www.youtube.com/playlist?list=PLx', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ',
  ];
  const no = ['https://www.youtube.com/@kanal', 'https://www.youtube.com/', 'https://www.youtube.com/feed/subscriptions',
    'https://example.com/watch?v=dQw4w9WgXcQ'];
  for (const u of yes) assert.ok(matchesAny(u, YT_LINK_PATTERNS), u);
  for (const u of no) assert.equal(matchesAny(u, YT_LINK_PATTERNS), false, u);
  assert.ok(matchesAny('https://www.youtube.com/watch?v=dQw4w9WgXcQ', YT_PAGE_PATTERNS));
  assert.ok(matchesAny('https://www.youtube.com/shorts/abcdefghijk', YT_PAGE_PATTERNS));
  assert.equal(matchesAny('https://www.youtube.com/playlist?list=PLx', YT_PAGE_PATTERNS), false);
  assert.ok(isFileableYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'));
  assert.equal(isFileableYouTubeUrl('https://www.youtube.com/watch?v=kaputt'), false);
});

test('Menü-IDs sind stabil und umkehrbar', () => {
  for (const [variant, cat] of [['yt-link', null], ['yt-page', 'Musik'], ['yt-link', 'A|B & C']]) {
    const id = menuItemId(variant, cat);
    assert.deepEqual(parseMenuItemId(id), { variant: variant === 'yt-link' ? 'link' : 'page', category: cat });
  }
  assert.equal(parseMenuItemId('save-link'), null);
  assert.equal(parseMenuItemId(MENU.closeToggle), null);
  assert.equal(menuItemId('yt-link', 'Musik'), 'yt-link|cat|Musik');
});

test('Menüaufbau aus den Regeln: Automatisch oben, Trenner, Kategorien in Regel-Reihenfolge', () => {
  const rules = normalizeRules([...DEFAULT_RULES, { name: 'Später', fallback: false, enabled: false }]);
  const menus = buildCategoryMenus(rules, { closeAfterFile: false });
  const ids = menus.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'keine doppelten IDs');
  for (const parent of [MENU.linkParent, MENU.pageParent]) {
    const kids = menus.filter((m) => m.parentId === parent);
    assert.equal(kids[0].title, 'Automatisch (Regeln)');
    assert.equal(kids[1].type, 'separator');
    const cats = kids.filter((m) => parseMenuItemId(m.id)?.category).map((m) => parseMenuItemId(m.id).category);
    assert.deepEqual(cats, menuCategories(rules));
    assert.equal(cats.at(-1), 'Später', 'Kategorie ohne Regeln erscheint trotzdem');
  }
  const link = menus.find((m) => m.id === MENU.linkParent);
  assert.deepEqual(link.contexts, ['link']);
  assert.deepEqual(link.targetUrlPatterns, YT_LINK_PATTERNS);
  const page = menus.find((m) => m.id === MENU.pageParent);
  assert.deepEqual(page.contexts, ['page', 'video']);
  assert.deepEqual(page.documentUrlPatterns, YT_PAGE_PATTERNS);
  const toggle = menus.find((m) => m.id === MENU.closeToggle);
  assert.equal(toggle.type, 'checkbox');
  assert.equal(toggle.checked, false);
  assert.equal(toggle.parentId, MENU.pageParent);
  assert.equal(menus.find((m) => m.title === 'Astrologie und Zukunftsforschung').parentId, MENU.linkParent, '& wird im Menü als „und“ angezeigt');
});

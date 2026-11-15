// Kontextmenü "An Tab-Ablage senden" / "Dieses Video ablegen in": Aufbau aus den Regeln
// und Auswertung der Menü-IDs (rein, ohne chrome.*, in Node testbar).

import { parseYouTube } from './url.js';

/** Links auf Videos, Shorts, Live, Playlists und youtu.be (www., m., music. und ohne Subdomain). */
export const YT_LINK_PATTERNS = [
  '*://*.youtube.com/watch*',
  '*://*.youtube.com/shorts/*',
  '*://*.youtube.com/live/*',
  '*://*.youtube.com/playlist*',
  '*://youtu.be/*',
];

/** Seiten, auf denen "Dieses Video ablegen in" erscheint: Video- und Shorts-Seiten. */
export const YT_PAGE_PATTERNS = [
  '*://*.youtube.com/watch*',
  '*://*.youtube.com/shorts/*',
  '*://*.youtube.com/live/*',
];

export const MENU = {
  linkParent: 'yt-link',
  pageParent: 'yt-page',
  closeToggle: 'yt-page|close',
};

/**
 * Prüft eine URL gegen ein Chrome-Match-Pattern (<scheme>://<host><path>), wie es
 * contextMenus.targetUrlPatterns/documentUrlPatterns verwendet.
 */
export function matchesPattern(url, pattern) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const m = /^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/.exec(pattern);
  if (!m) return false;
  const [, scheme, host, path] = m;
  const proto = u.protocol.replace(/:$/, '');
  if (scheme === '*' ? !['http', 'https'].includes(proto) : scheme !== proto) return false;
  const h = u.hostname.toLowerCase();
  if (host !== '*') {
    if (host.startsWith('*.')) {
      const base = host.slice(2).toLowerCase();
      if (h !== base && !h.endsWith('.' + base)) return false;
    } else if (h !== host.toLowerCase()) return false;
  }
  const re = new RegExp('^' + path.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(u.pathname + u.search);
}

export function matchesAny(url, patterns) {
  return patterns.some((p) => matchesPattern(url, p));
}

/** YouTube-Link, der sich ablegen lässt (Video, Short oder Playlist)? */
export function isFileableYouTubeUrl(url) {
  return !!parseYouTube(url);
}

/**
 * Kategorienamen für das Menü: alle Kategorien in Prioritätsreihenfolge, ohne Duplikate –
 * auch solche ohne automatische Zuordnung (enabled = false bzw. ohne Stichwörter).
 */
export function menuCategories(rules) {
  const out = [];
  for (const r of rules || []) {
    if (!r) continue;
    const n = String(r.name || '').trim();
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Stabile Menü-ID je Variante und Kategorie (null = automatisch nach Regeln). */
export function menuItemId(variant, category) {
  return category == null ? `${variant}|auto` : `${variant}|cat|${category}`;
}

/** Gegenstück zu menuItemId. Rückgabe null für fremde IDs. */
export function parseMenuItemId(id) {
  const m = /^(yt-link|yt-page)\|(auto|cat\|(.+))$/s.exec(String(id || ''));
  if (!m) return null;
  return {
    variant: m[1] === 'yt-link' ? 'link' : 'page',
    category: m[2] === 'auto' ? null : m[3],
  };
}

/**
 * Liefert die createProperties für beide Untermenüs (Reihenfolge = Erstellreihenfolge).
 * @param {Array} rules  normalisierte Regeln
 * @param {{closeAfterFile?: boolean}} opts
 */
export function buildCategoryMenus(rules, { closeAfterFile = true } = {}) {
  const cats = menuCategories(rules);
  const out = [];
  const variants = [
    { parent: MENU.linkParent, title: 'An Tab-Ablage senden', contexts: ['link'], targetUrlPatterns: YT_LINK_PATTERNS },
    { parent: MENU.pageParent, title: 'Dieses Video ablegen in', contexts: ['page', 'video'], documentUrlPatterns: YT_PAGE_PATTERNS },
  ];
  for (const v of variants) {
    const scope = {};
    if (v.targetUrlPatterns) scope.targetUrlPatterns = v.targetUrlPatterns;
    if (v.documentUrlPatterns) scope.documentUrlPatterns = v.documentUrlPatterns;
    out.push({ id: v.parent, title: v.title, contexts: v.contexts, ...scope });
    const child = (o) => out.push({ parentId: v.parent, contexts: v.contexts, ...scope, ...o });
    child({ id: menuItemId(v.parent, null), title: 'Automatisch (Regeln)' });
    child({ id: `${v.parent}|sep1`, type: 'separator' });
    for (const c of cats) child({ id: menuItemId(v.parent, c), title: c.replace(/\s*&\s*/g, ' und ') });
    if (v.parent === MENU.pageParent) {
      child({ id: `${v.parent}|sep2`, type: 'separator' });
      child({ id: MENU.closeToggle, type: 'checkbox', title: 'Tab danach schließen', checked: !!closeAfterFile });
    }
  }
  return out;
}

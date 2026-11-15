// Datenmodell der abgelegten Einträge, Import/Export (rein, ohne chrome.*).

import {
  isSaveableUrl, parseYouTube, unwrapUrl, itemKey, buildYouTubeUrl, cleanUrl, cleanTitle, getDomain,
  hashId, youtubeThumb, sanitizeImageUrl, parseTimestamp,
} from './url.js';
import { categorize, ruleCategoryNames } from './categorize.js';

export const EXPORT_FORMAT = 'tab-ablage';
export const EXPORT_VERSION = 1;
export const STATUSES = ['active', 'archived'];

/**
 * Erzeugt einen neuen Eintrag aus Tab- oder Link-Daten. Gibt null zurück, wenn die URL
 * nicht abgelegt werden kann (z. B. chrome://, opera://, about:).
 */
export function buildItem(input, now = Date.now()) {
  const raw = unwrapUrl(String((input && input.url) || '').trim());
  if (!isSaveableUrl(raw)) return null;
  const yt = parseYouTube(raw);
  const key = itemKey(raw);
  const url = yt ? buildYouTubeUrl(yt) : cleanUrl(raw);
  let fav = String(input.favIconUrl || '');
  if (!/^https?:\/\//i.test(fav) || fav.length > 1024) fav = ''; // keine data:-URLs speichern
  let title = cleanTitle(input.title);
  if (title === raw || title === url) title = '';
  return {
    id: hashId(key),
    key,
    url,
    title: title.slice(0, 500),
    type: yt ? 'youtube' : 'web',
    domain: getDomain(raw),
    favIconUrl: fav,
    thumbnail: yt && yt.videoId ? youtubeThumb(yt.videoId) : '',
    channel: '',
    description: '',
    siteName: '',
    yt: yt ? { kind: yt.kind, videoId: yt.videoId, playlistId: yt.playlistId } : null,
    t: yt ? yt.t || 0 : 0,
    category: '',
    manualCategory: false,
    status: 'active',
    savedAt: now,
    updatedAt: now,
    archivedAt: 0,
    source: input.source || 'tab',
    enriched: false,
    enrichTries: 0,
    unavailable: false,
  };
}

/** Ein bereits vorhandener Eintrag wird erneut abgelegt (Duplikat). */
export function mergeResave(existing, incoming, now = Date.now()) {
  existing.status = 'active';
  existing.archivedAt = 0;
  existing.savedAt = now;
  existing.updatedAt = now;
  if (incoming.t > 0) existing.t = incoming.t;
  if (incoming.type === 'web' && incoming.url) existing.url = incoming.url;
  if (existing.yt && incoming.yt && incoming.yt.playlistId && !existing.yt.playlistId) {
    existing.yt.playlistId = incoming.yt.playlistId;
  }
  if (!existing.title && incoming.title) existing.title = incoming.title;
  if (!existing.favIconUrl && incoming.favIconUrl) existing.favIconUrl = incoming.favIconUrl;
  return existing;
}

/** URL zum Öffnen – bei YouTube mit Zeitmarke zum Weiterschauen. */
export function openUrl(item) {
  if (item.yt) return buildYouTubeUrl({ ...item.yt, t: item.t });
  return item.url;
}

export function displayTitle(item) {
  return item.title || item.url;
}

/** Datumsgruppe für "Gruppieren nach Datum". */
export function dateGroupLabel(ts, now = Date.now()) {
  const d = new Date(ts);
  const n = new Date(now);
  const startToday = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const day = 86400000;
  if (ts >= startToday) return 'Heute';
  if (ts >= startToday - day) return 'Gestern';
  if (ts >= startToday - 6 * day) return 'Letzte 7 Tage';
  if (ts >= startToday - 29 * day) return 'Letzte 30 Tage';
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
    'September', 'Oktober', 'November', 'Dezember'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------- Export

function iso(ts) {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null;
}

export function toExportItem(it) {
  const out = {
    id: it.id,
    url: openUrl(it),
    title: it.title || '',
    type: it.type,
    domain: it.domain,
    channel: it.channel || '',
    category: it.category || '',
    categoryManual: !!it.manualCategory,
    status: it.status,
    savedAt: iso(it.savedAt),
    thumbnail: it.thumbnail || '',
    description: it.description || '',
  };
  if (it.yt) {
    out.youtube = { kind: it.yt.kind, videoId: it.yt.videoId, playlistId: it.yt.playlistId, t: it.t || 0 };
  }
  return out;
}

/** Vollständiger JSON-Export (siehe README, Abschnitt "Datenschema"). */
export function exportData(itemsById, rules, now = Date.now()) {
  const list = Object.values(itemsById || {}).sort((a, b) => b.savedAt - a.savedAt);
  const cats = ruleCategoryNames(rules);
  for (const it of list) if (it.category && !cats.includes(it.category)) cats.push(it.category);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    hinweis: 'Beim Re-Import werden Einträge über "id" bzw. die normalisierte URL zusammengeführt. ' +
      'Ein geändertes Feld "category" wird als manuelle Kategorie übernommen.',
    categories: cats,
    count: list.length,
    items: list.map(toExportItem),
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Lesezeichen-Datei im Netscape-Format (importierbar in jeden Browser), Ordner je Kategorie. */
export function exportBookmarksHtml(itemsById, now = Date.now()) {
  const list = Object.values(itemsById || {}).sort((a, b) => b.savedAt - a.savedAt);
  const sec = (ts) => Math.floor((Number(ts) || now) / 1000);
  const groups = new Map();
  for (const it of list) {
    const top = it.status === 'archived' ? 'Gesehen' : 'Tab-Ablage';
    const k = `${top}\u0000${it.category || 'Ohne Kategorie'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const top of ['Tab-Ablage', 'Gesehen']) {
    const keys = [...groups.keys()].filter((k) => k.startsWith(top + '\u0000'));
    if (!keys.length) continue;
    lines.push(`    <DT><H3 ADD_DATE="${sec(now)}">${escapeHtml(top)}</H3>`, '    <DL><p>');
    for (const k of keys.sort()) {
      lines.push(`        <DT><H3 ADD_DATE="${sec(now)}">${escapeHtml(k.split('\u0000')[1])}</H3>`, '        <DL><p>');
      for (const it of groups.get(k)) {
        const icon = it.favIconUrl ? ` ICON_URI="${escapeHtml(it.favIconUrl)}"` : '';
        lines.push(`            <DT><A HREF="${escapeHtml(openUrl(it))}" ADD_DATE="${sec(it.savedAt)}"${icon}>${escapeHtml(displayTitle(it))}</A>`);
      }
      lines.push('        </DL><p>');
    }
    lines.push('    </DL><p>');
  }
  lines.push('</DL><p>', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------- Import

/**
 * Liest Import-Daten: JSON-Export (auch nur ein Array von Einträgen oder ein Objekt nach id),
 * Netscape-Lesezeichen-HTML oder einfache Textliste mit einer URL pro Zeile.
 * @returns {Array<object>} rohe Einträge
 */
export function parseImportPayload(text) {
  const src = String(text || '').replace(/^﻿/, '').trim();
  if (!src) return [];
  if (src[0] === '{' || src[0] === '[') {
    const data = JSON.parse(src);
    let items = Array.isArray(data) ? data : data.items;
    if (items && !Array.isArray(items) && typeof items === 'object') items = Object.values(items);
    if (!Array.isArray(items)) throw new Error('Keine "items" in der JSON-Datei gefunden.');
    return items.filter((x) => x && typeof x === 'object');
  }
  if (/^<!DOCTYPE NETSCAPE/i.test(src) || /<a\s[^>]*href=/i.test(src)) {
    const out = [];
    const re = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(src))) {
      const dec = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      out.push({ url: dec(m[1]), title: dec(m[2].replace(/<[^>]+>/g, '')).trim() });
    }
    return out;
  }
  return src.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l))
    .map((l) => {
      const [url, ...rest] = l.split(/\s+/);
      return { url, title: rest.join(' ') };
    });
}

function parseDate(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Führt importierte Einträge mit dem Bestand zusammen (verändert `items`).
 * Zuordnung über id, sonst über die normalisierte URL (gleiche Berechnung wie beim Ablegen).
 * Ein vorhandenes Feld `category` wird übernommen; weicht es von der Regel-Kategorie ab
 * (oder ist `categoryManual: true`), gilt es als manuelle Zuordnung.
 */
export function mergeImport(items, rawList, rules, now = Date.now()) {
  const res = { added: 0, updated: 0, skipped: 0 };
  for (const raw of rawList || []) {
    const url = raw.url || raw.href || raw.link;
    const savedAt = parseDate(raw.savedAt) || now;
    const built = buildItem({ url, title: raw.title, favIconUrl: raw.favIconUrl, source: 'import' }, savedAt);
    if (!built) { res.skipped++; continue; }
    let target = (raw.id && items[raw.id]) || items[built.id];
    const isNew = !target;
    if (isNew) target = built;

    if (raw.youtube && target.yt && raw.youtube.t != null) target.t = parseTimestamp(raw.youtube.t);
    if (typeof raw.title === 'string' && raw.title.trim()) target.title = cleanTitle(raw.title).slice(0, 500);
    if (typeof raw.channel === 'string' && raw.channel.trim()) target.channel = raw.channel.trim().slice(0, 200);
    if (typeof raw.description === 'string' && raw.description.trim() && (isNew || !target.description)) {
      target.description = raw.description.trim().slice(0, 300);
    }
    const thumb = sanitizeImageUrl(raw.thumbnail);
    if (thumb && (isNew || !target.thumbnail)) target.thumbnail = thumb;
    if (STATUSES.includes(raw.status)) {
      if (raw.status === 'archived' && target.status !== 'archived') target.archivedAt = now;
      if (raw.status === 'active') target.archivedAt = 0;
      target.status = raw.status;
    }
    const cat = typeof raw.category === 'string' ? raw.category.trim().slice(0, 60) : '';
    if (cat) {
      const auto = categorize(target, rules);
      target.category = cat;
      target.manualCategory = raw.categoryManual === true || cat !== auto;
    } else if (!target.category || !target.manualCategory) {
      target.category = categorize(target, rules);
    }
    target.updatedAt = now;
    if (isNew) {
      target.enriched = target.type === 'youtube' ? !!target.channel : !!(target.thumbnail || target.description);
      items[target.id] = target;
      res.added++;
    } else {
      res.updated++;
    }
  }
  return res;
}

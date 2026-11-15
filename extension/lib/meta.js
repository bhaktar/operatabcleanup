// Extraktion von Vorschau-Metadaten (og:image, Beschreibung, Titel) aus HTML-Text.
// Rein und ohne DOM, damit es im Service Worker (kein DOMParser) und in Node läuft.

import { sanitizeImageUrl } from './url.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*|#39);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') {
      const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return ENTITIES[k] ?? m;
  });
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([^\s=/<>"']+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return attrs;
}

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

/**
 * @param {string} html  HTML-Quelltext (Anfang reicht, <head> genügt)
 * @param {string} baseUrl  zum Auflösen relativer Bild-URLs
 * @returns {{image:string, description:string, title:string, siteName:string}}
 */
export function extractMetaFromHtml(html, baseUrl) {
  const src = String(html || '');
  const headEnd = src.search(/<\/head\s*>/i);
  const head = headEnd > 0 ? src.slice(0, headEnd) : src.slice(0, 300000);
  const meta = {};
  const metaRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = metaRe.exec(head))) {
    const a = parseAttrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !(key in meta)) meta[key] = a.content;
  }
  let linkImage = '';
  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(head))) {
    const a = parseAttrs(m[0]);
    if ((a.rel || '').toLowerCase() === 'image_src' && a.href) { linkImage = a.href; break; }
  }
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const image = sanitizeImageUrl(
    meta['og:image'] || meta['og:image:url'] || meta['og:image:secure_url'] ||
    meta['twitter:image'] || meta['twitter:image:src'] || meta.image || linkImage,
    baseUrl,
  );
  return {
    image,
    description: clip(meta['og:description'] || meta.description || meta['twitter:description'], 300),
    title: clip(meta['og:title'] || decodeEntities(titleMatch ? titleMatch[1] : ''), 300),
    siteName: clip(meta['og:site_name'], 80),
  };
}

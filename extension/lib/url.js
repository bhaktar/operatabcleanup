// Reine Hilfsfunktionen rund um URLs und YouTube (ohne chrome.*-Abhängigkeit, in Node testbar).

/** Query-Parameter, die nur dem Tracking dienen und beim Speichern entfernt werden. */
export const TRACKING_PARAMS = new Set([
  'si', 'feature', 'pp', 'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid',
  'yclid', 'igshid', 'igsh', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'ref_src', 'ref_url',
  'spm', 'ab_channel', 'embeds_referring_euri', 'embeds_referring_origin',
  'source_ve_path', 'vero_id', 'oly_anon_id', 'oly_enc_id', 'rb_clickid', 's_cid',
  'wt_mc', 'wt_zmc', 'cmpid', 'ncid', 'ocid', 'sr_share', 'trk', 'trkcampaign',
  '_ga', '_gl', 'guccounter', 'guce_referrer', 'guce_referrer_sig', 'twclid', 'ttclid',
  'li_fat_id', 'srsltid',
]);
const TRACKING_PREFIXES = ['utm_', 'pk_', 'mtm_', 'hsa_'];

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST_RE = /^[A-Za-z0-9_-]{2,64}$/;

export function isTrackingParam(name) {
  const n = String(name).toLowerCase();
  return TRACKING_PARAMS.has(n) || TRACKING_PREFIXES.some((p) => n.startsWith(p));
}

function safeUrl(url) {
  try {
    return new URL(String(url).trim());
  } catch {
    return null;
  }
}

/** true für http(s)-URLs – nur solche werden abgelegt. */
export function isSaveableUrl(url) {
  return /^https?:\/\//i.test(String(url || '')) && !!safeUrl(url);
}

/** Hostname ohne führendes "www.". */
export function getDomain(url) {
  const u = safeUrl(url);
  if (!u) return '';
  return u.hostname.toLowerCase().replace(/^www\./, '');
}

/** Entfernt Tracking-Parameter, lässt die URL sonst unverändert (zum Speichern/Öffnen). */
export function cleanUrl(url) {
  const u = safeUrl(url);
  if (!u || !/^https?:$/.test(u.protocol)) return String(url || '').trim();
  const keep = [];
  for (const [k, v] of u.searchParams) if (!isTrackingParam(k)) keep.push([k, v]);
  u.search = keep.length ? new URLSearchParams(keep).toString() : '';
  return u.toString();
}

/**
 * Normalisierte Form für die Duplikaterkennung: ohne Tracking-Parameter, ohne "www.",
 * Parameter sortiert, ohne Fragment (außer SPA-Routen "#/" bzw. "#!"), ohne abschließenden "/".
 */
export function normalizeUrl(url) {
  const u = safeUrl(url);
  if (!u || !/^https?:$/.test(u.protocol)) return String(url || '').trim();
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const params = [];
  for (const [k, v] of u.searchParams) if (!isTrackingParam(k)) params.push([k, v]);
  params.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0] < b[0] ? -1 : 1));
  const search = params.length ? '?' + new URLSearchParams(params).toString() : '';
  let path = u.pathname || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  const hash = /^#[/!]/.test(u.hash) ? u.hash : '';
  const port = u.port ? ':' + u.port : '';
  return `${u.protocol}//${host}${port}${path}${search}${hash}`;
}

export function isYouTubeHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'youtu.be' || h === 'youtube.com' || h.endsWith('.youtube.com') ||
    h === 'youtube-nocookie.com' || h.endsWith('.youtube-nocookie.com');
}

export function isYouTubeUrl(url) {
  const u = safeUrl(url);
  return !!u && isYouTubeHost(u.hostname);
}

/**
 * Zeitangabe aus YouTube-Links in Sekunden: "90", "90s", "1m30s", "1h2m3s", "1:02:03".
 * Ungültige Werte ergeben 0.
 */
export function parseTimestamp(value) {
  if (value == null) return 0;
  const s = String(value).trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(Number(s));
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  }
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

/** Sekunden -> "m:ss" bzw. "h:mm:ss". */
export function formatTimestamp(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Erkennt YouTube-Videos, Shorts, Live-Links und Playlists.
 * Rückgabe: null oder { kind: 'video'|'short'|'playlist', videoId, playlistId, t }.
 */
export function parseYouTube(url) {
  const u = safeUrl(url);
  if (!u || !isYouTubeHost(u.hostname)) return null;
  const host = u.hostname.toLowerCase();
  const p = u.searchParams;
  const hashParams = new URLSearchParams(u.hash.replace(/^#/, ''));
  const t = parseTimestamp(p.get('t') ?? p.get('start') ?? hashParams.get('t'));
  const listRaw = p.get('list');
  const playlistId = listRaw && YT_LIST_RE.test(listRaw) ? listRaw : null;
  const parts = u.pathname.split('/').filter(Boolean);

  let videoId = null;
  let kind = 'video';
  if (host === 'youtu.be') {
    videoId = parts[0] || null;
  } else if (parts[0] === 'watch') {
    videoId = p.get('v');
  } else if (parts[0] === 'shorts') {
    videoId = parts[1] || null;
    kind = 'short';
  } else if (['embed', 'live', 'v', 'e'].includes(parts[0])) {
    videoId = parts[1] || null;
  } else if (parts[0] === 'playlist' && playlistId) {
    return { kind: 'playlist', videoId: null, playlistId, t: 0 };
  }

  if (videoId && YT_ID_RE.test(videoId)) {
    return { kind, videoId, playlistId: kind === 'short' ? null : playlistId, t: kind === 'short' ? 0 : t };
  }
  if (parts[0] === 'watch' && playlistId) {
    return { kind: 'playlist', videoId: null, playlistId, t: 0 };
  }
  return null;
}

/** Kanonische URL zum Öffnen, inkl. Zeitmarke zum Weiterschauen. */
export function buildYouTubeUrl({ kind, videoId, playlistId, t }) {
  if (kind === 'playlist' || (!videoId && playlistId)) {
    return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  }
  if (kind === 'short') return `https://www.youtube.com/shorts/${videoId}`;
  let url = `https://www.youtube.com/watch?v=${videoId}`;
  if (playlistId) url += `&list=${encodeURIComponent(playlistId)}`;
  const sec = Math.floor(Number(t) || 0);
  if (sec > 0) url += `&t=${sec}s`;
  return url;
}

export function youtubeThumb(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
}

/** Schlüssel zur Duplikaterkennung: YouTube nach Video-/Playlist-ID, sonst normalisierte URL ohne Schema. */
export function itemKey(url) {
  const yt = parseYouTube(url);
  if (yt) return yt.videoId ? `yt:${yt.videoId}` : `ytpl:${yt.playlistId}`;
  return normalizeUrl(url).replace(/^https?:\/\//i, '');
}

/** Stabile, kurze ID aus einem String (2× FNV-1a 32 Bit). */
export function hashId(str) {
  const s = String(str);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  return (h1 >>> 0).toString(36).padStart(7, '0') + (h2 >>> 0).toString(36).padStart(7, '0');
}

/** Entfernt Benachrichtigungszähler "(3) " und das Suffix " - YouTube". */
export function cleanTitle(title) {
  return String(title || '')
    .replace(/^\(\d+\+?\)\s*/, '')
    .replace(/\s*[-–—]\s*YouTube( Music)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nur echte http(s)-Bild-URLs (keine data:-URLs), relativ -> absolut. */
export function sanitizeImageUrl(src, base) {
  if (!src) return '';
  try {
    const u = new URL(String(src).trim(), base || undefined);
    if (!/^https?:$/.test(u.protocol)) return '';
    const s = u.toString();
    return s.length > 2048 ? '' : s;
  } catch {
    return '';
  }
}

/** Prüft, ob eine Domain auf einer Liste steht (Subdomains eingeschlossen). */
export function domainInList(domain, list) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return false;
  return (list || []).some((entry) => {
    const e = String(entry || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    return !!e && (d === e || d.endsWith('.' + e));
  });
}

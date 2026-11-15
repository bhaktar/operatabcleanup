// Regel-Engine für die automatische Kategorisierung (rein, ohne chrome.*).
//
// Eine Kategorie (= Regel):
//   { id, name, color, scope: 'youtube'|'web'|'alle', domains: [], keywords: [], enabled, fallback }
//   enabled  – automatische Zuordnung aktiv (die Kategorie existiert auch ohne)
//   fallback – Auffang-Kategorie: bekommt alles Übrige aus ihrem Bereich (scope)
// Eine Kategorie ohne Domains/Stichwörter und ohne fallback wird nie automatisch vergeben,
// steht aber in der Übersicht und im Kontextmenü zur Auswahl.
// Die Reihenfolge im Array ist die Priorität (erste passende Regel gewinnt).
//
// Ablauf von categorize():
//   1. Domains aller Regeln (in Prioritätsreihenfolge) – Domain ist das stärkste Signal
//   2. Stichwörter gegen Titel, Kanal und Seitenname
//   3. Stichwörter gegen die Beschreibung
//   4. Auffang-Kategorien (fallback) in Prioritätsreihenfolge
//   5. Fallback: "Sonstiges-Video" (YouTube) bzw. "Sonstiges" (Web)

export const FALLBACK_VIDEO = 'Sonstiges-Video';
export const FALLBACK_WEB = 'Sonstiges';

export const DEFAULT_RULES = [
  {
    id: 'cat-spirit', name: 'Spirituelles', color: '#a78bfa', scope: 'alle', domains: [],
    keywords: ['spirituell', 'spiritualität', 'spirituality', 'meditation', 'meditieren', 'bewusstsein',
      'erwachen', 'erleuchtung', 'chakra', 'seele', 'achtsamkeit', 'mindfulness', 'channeling', 'karma',
      'reiki', 'energiearbeit', 'aura', 'manifestieren', 'höheres selbst'],
  },
  {
    id: 'yt-finanzen', name: 'Finanzen', color: '#22c55e', scope: 'alle',
    domains: ['finanzen.net', 'onvista.de', 'ariva.de', 'boerse.de', 'boerse-frankfurt.de', 'justetf.com',
      'tradingview.com', 'investing.com', 'finanzfluss.de', 'coinmarketcap.com', 'coingecko.com',
      'comdirect.de', 'consorsbank.de', 'traderepublic.com', 'scalable.capital'],
    keywords: ['aktie', 'etf', 'börse', 'stock', 'dividende', 'dividend', 'invest', 'trading', 'trader',
      'krypto', 'crypto', 'bitcoin', 'finanz', 'finance', 'geld', 'depot', 'dax', 'nasdaq', 's&p 500',
      'zinsen', 'inflation', 'immobilie', 'rente', 'vermögen', 'chartanalyse', 'charttechnik', 'elliott',
      'wirtschaft', 'economy'],
  },
  {
    id: 'cat-astro', name: 'Astrologie & Zukunftsforschung', color: '#f59e0b', scope: 'alle', domains: [],
    keywords: ['astrologie', 'astrology', 'horoskop', 'horoscope', 'sternzeichen', 'aszendent', 'mondknoten',
      'transit', 'prognose', 'zukunftsforschung', 'trendforschung', 'prophezeiung', 'numerologie', 'tarot'],
  },
  {
    id: 'yt-musik', name: 'Musik', color: '#ec4899', scope: 'youtube',
    domains: ['music.youtube.com'],
    keywords: ['musik', 'music', 'song', 'lyrics', 'lyric video', 'official video', 'official audio',
      'musikvideo', 'remix', 'album', 'konzert', 'concert', 'cover', 'feat.', 'ft.', 'dj', 'beat',
      'lofi', 'lo-fi', 'hip hop', 'hiphop', 'rap', 'techno', 'house mix', 'karaoke', 'acoustic',
      'unplugged', 'soundtrack', 'vevo', 'playlist', 'mix'],
  },
  {
    id: 'yt-lernen', name: 'Tutorial/Lernen', color: '#3b82f6', scope: 'youtube', domains: [],
    keywords: ['tutorial', 'how to', 'howto', 'anleitung', 'erklärt', 'erklärung', 'explained',
      'lernen', 'learn', 'kurs', 'course', 'crash course', 'guide', 'tipps', 'tips', 'lektion',
      'lesson', 'für anfänger', 'beginner', 'schritt für schritt', 'step by step', 'doku',
      'dokumentation', 'documentary', 'workshop', 'masterclass', 'vorlesung', 'lecture', 'diy'],
  },
  {
    id: 'yt-gaming', name: 'Gaming', color: '#8b5cf6', scope: 'youtube', domains: [],
    keywords: ['gameplay', "let's play", 'lets play', 'gaming', 'gamer', 'zocken', 'walkthrough',
      'playthrough', 'speedrun', 'minecraft', 'fortnite', 'gta', 'elden ring', 'league of legends',
      'valorant', 'counter-strike', 'cs2', 'ps5', 'xbox', 'nintendo', 'switch 2', 'steam deck',
      'esports', 'e-sports', 'boss fight', 'pokémon', 'pokemon', 'zelda', 'call of duty'],
  },
  {
    id: 'yt-podcast', name: 'Podcast/Interview', color: '#14b8a6', scope: 'youtube', domains: [],
    keywords: ['podcast', 'interview', 'im gespräch', 'gespräch', 'talk', 'talkshow', 'episode',
      'folge', 'ep.', 'q&a', 'panel', 'diskussion', 'debatte', 'lanz', 'joe rogan'],
  },
  {
    id: 'yt-technik', name: 'Technik', color: '#06b6d4', scope: 'youtube', domains: [],
    keywords: ['technik', 'tech', 'review', 'unboxing', 'test', 'smartphone', 'iphone', 'android',
      'laptop', 'notebook', 'pc build', 'gpu', 'grafikkarte', 'nvidia', 'amd', 'intel', 'apple',
      'samsung', 'programmier', 'coding', 'programming', 'linux', 'windows', 'ki', 'ai',
      'künstliche intelligenz', 'chatgpt', 'claude', 'gadget', 'hardware', 'software', 'setup'],
  },
  {
    id: 'web-news', name: 'Nachrichten', color: '#ef4444', scope: 'alle',
    domains: ['spiegel.de', 'zeit.de', 'tagesschau.de', 'zdf.de', 'faz.net', 'sueddeutsche.de',
      'welt.de', 'n-tv.de', 't-online.de', 'focus.de', 'stern.de', 'handelsblatt.com', 'bild.de',
      'tagesspiegel.de', 'taz.de', 'br.de', 'ndr.de', 'wdr.de', 'deutschlandfunk.de', 'dw.com',
      'bbc.com', 'bbc.co.uk', 'cnn.com', 'nytimes.com', 'theguardian.com', 'reuters.com',
      'apnews.com', 'washingtonpost.com', 'bloomberg.com', 'heise.de', 'golem.de', 'netzpolitik.org',
      'news.google.com', 'orf.at', 'srf.ch', 'nzz.ch'],
    keywords: ['nachrichten', 'news', 'tagesschau', 'tagesthemen', 'heute journal', 'breaking',
      'eilmeldung', 'politik', 'bundestag', 'regierung', 'wahl', 'krieg', 'pressekonferenz',
      'zdf', 'ard', 'ntv', 'n-tv', 'welt nachrichten', 'spiegel tv', 'phoenix', 'dw news'],
  },
  { id: 'yt-sonstiges', name: FALLBACK_VIDEO, color: '#9ca3af', scope: 'youtube', domains: [], keywords: [], fallback: true },
  {
    id: 'web-shopping', name: 'Shopping', color: '#f97316', scope: 'web',
    domains: ['amazon.de', 'amazon.com', 'amazon.co.uk', 'ebay.de', 'ebay.com', 'kleinanzeigen.de',
      'otto.de', 'zalando.de', 'idealo.de', 'geizhals.de', 'aliexpress.com', 'temu.com', 'etsy.com',
      'mediamarkt.de', 'saturn.de', 'alternate.de', 'mindfactory.de', 'cyberport.de', 'notebooksbilliger.de',
      'ikea.com', 'lidl.de', 'kaufland.de', 'galaxus.de', 'check24.de', 'mydealz.de', 'shein.com'],
    keywords: ['in den warenkorb', 'jetzt kaufen', 'angebot', 'preisvergleich'],
  },
  {
    id: 'web-social', name: 'Social Media', color: '#0ea5e9', scope: 'web',
    domains: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com',
      'linkedin.com', 'xing.com', 'threads.net', 'bsky.app', 'mastodon.social', 'pinterest.com',
      'tumblr.com', 'discord.com', 'twitch.tv', 't.me', 'web.whatsapp.com', 'news.ycombinator.com'],
    keywords: [],
  },
  {
    id: 'web-dev', name: 'Entwicklung', color: '#10b981', scope: 'web',
    domains: ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
      'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'docs.python.org', 'dev.to', 'codepen.io',
      'jsfiddle.net', 'vercel.com', 'netlify.com', 'docker.com', 'hub.docker.com', 'huggingface.co',
      'developer.chrome.com', 'learn.microsoft.com', 'docs.anthropic.com', 'claude.ai',
      'chatgpt.com', 'localhost'],
    keywords: ['api reference', 'documentation', 'changelog', 'release notes'],
  },
  {
    id: 'web-wissen', name: 'Dokumente/Wissen', color: '#6366f1', scope: 'web',
    domains: ['wikipedia.org', 'wikimedia.org', 'docs.google.com', 'drive.google.com', 'notion.so',
      'notion.site', 'medium.com', 'substack.com', 'arxiv.org', 'scholar.google.com', 'dropbox.com',
      'onedrive.live.com', 'sharepoint.com', 'archive.org', 'duden.de', 'dict.cc', 'leo.org',
      'deepl.com', 'britannica.com', 'researchgate.net'],
    keywords: ['.pdf', 'wiki', 'handbuch', 'anleitung', 'dokumentation'],
  },
  { id: 'web-sonstiges', name: FALLBACK_WEB, color: '#9ca3af', scope: 'web', domains: [], keywords: [], fallback: true },
];

/** Text aus Textarea/Eingabe -> Liste (Trennung durch Komma, Semikolon oder Zeilenumbruch). */
export function parseList(text) {
  if (Array.isArray(text)) return text.map((s) => String(s).trim()).filter(Boolean);
  return String(text || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

export const COLOR_RE = /^#[0-9a-f]{6}$/i;

/**
 * Bereinigt Regeln: Pflichtfelder, eindeutige IDs, gleichnamige Kategorien werden zusammengeführt
 * (Domains/Stichwörter vereinigt, Bereich wird "alle", wenn er sich unterscheidet).
 * Ältere Regeln ohne Feld `fallback` gelten als Auffang-Kategorie, wenn sie leer sind.
 */
export function normalizeRules(rules) {
  const src = Array.isArray(rules) ? rules : DEFAULT_RULES;
  const seen = new Set();
  const byName = new Map();
  const out = [];
  src.forEach((r, i) => {
    if (!r || !String(r.name || '').trim()) return;
    const name = String(r.name).trim().slice(0, 60);
    const domains = parseList(r.domains).map((d) => d.toLowerCase());
    const keywords = parseList(r.keywords).map((k) => normText(k));
    const scope = ['youtube', 'web', 'alle'].includes(r.scope) ? r.scope : 'alle';
    const fallback = typeof r.fallback === 'boolean' ? r.fallback : (!domains.length && !keywords.length);
    const prev = byName.get(name.toLowerCase());
    if (prev) {
      for (const d of domains) if (!prev.domains.includes(d)) prev.domains.push(d);
      for (const k of keywords) if (!prev.keywords.includes(k)) prev.keywords.push(k);
      if (prev.scope !== scope) prev.scope = 'alle';
      prev.fallback = prev.fallback || fallback;
      if (!prev.color && COLOR_RE.test(r.color || '')) prev.color = r.color.toLowerCase();
      return;
    }
    let id = String(r.id || `r${i}-${Date.now().toString(36)}`);
    while (seen.has(id)) id += '_';
    seen.add(id);
    const rule = {
      id,
      name,
      color: COLOR_RE.test(r.color || '') ? r.color.toLowerCase() : '',
      scope,
      domains,
      keywords,
      enabled: r.enabled !== false,
      fallback,
    };
    byName.set(name.toLowerCase(), rule);
    out.push(rule);
  });
  return out;
}

function normText(s) {
  return String(s || '').toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();
}

const reCache = new Map();
function keywordRegex(kw) {
  let re = reCache.get(kw);
  if (!re) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const end = kw.length <= 3 ? '(?=$|[^\\p{L}\\p{N}])' : '';
    const start = /^[\p{L}\p{N}]/u.test(kw) ? '(?:^|(?<=[^\\p{L}\\p{N}]))' : '';
    re = new RegExp(start + esc + end, 'u');
    if (reCache.size > 2000) reCache.clear();
    reCache.set(kw, re);
  }
  return re;
}

/**
 * Stichwort-Suche: am Wortanfang ("aktie" findet "Aktien"), Stichwörter mit ≤ 3 Zeichen
 * nur als ganzes Wort ("ki" findet nicht "Kiosk").
 */
export function matchKeyword(text, keyword) {
  const kw = normText(keyword);
  if (!kw) return false;
  return keywordRegex(kw).test(normText(text));
}

/** Domain-Regel: "example.com" passt auch auf Subdomains, "example.com/pfad" auf Pfad-Präfix. */
export function domainMatches(item, ruleDomain) {
  let rd = String(ruleDomain || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (!rd) return false;
  const domain = String(item.domain || '').toLowerCase().replace(/^www\./, '');
  if (rd.includes('/')) {
    let path = '';
    try { path = new URL(item.url).pathname; } catch { /* ignorieren */ }
    const [rHost, ...rest] = rd.split('/');
    const rPath = '/' + rest.join('/');
    return (domain === rHost || domain.endsWith('.' + rHost)) && path.toLowerCase().startsWith(rPath);
  }
  return domain === rd || domain.endsWith('.' + rd);
}

function scopeFits(rule, item) {
  if (rule.scope === 'alle') return true;
  return rule.scope === (item.type === 'youtube' ? 'youtube' : 'web');
}

/** Liefert den Kategorienamen für ein Element. */
export function categorize(item, rules) {
  const list = (rules && rules.length ? rules : normalizeRules(DEFAULT_RULES))
    .filter((r) => r.enabled !== false && scopeFits(r, item));
  const main = normText([item.title, item.channel, item.siteName].filter(Boolean).join(' · '));
  const desc = normText(item.description || '');

  for (const r of list) {
    if ((r.domains || []).some((d) => domainMatches(item, d))) return r.name;
  }
  for (const r of list) {
    if ((r.keywords || []).some((k) => matchKeyword(main, k))) return r.name;
  }
  if (desc) {
    for (const r of list) {
      if ((r.keywords || []).some((k) => matchKeyword(desc, k))) return r.name;
    }
  }
  const catchAll = list.find((r) => r.fallback === true ||
    (r.fallback === undefined && !(r.domains && r.domains.length) && !(r.keywords && r.keywords.length)));
  if (catchAll) return catchAll.name;
  return item.type === 'youtube' ? FALLBACK_VIDEO : FALLBACK_WEB;
}

/** Alle Kategorienamen aus Regeln (in Prioritätsreihenfolge, ohne Duplikate). */
export function ruleCategoryNames(rules) {
  const out = [];
  for (const r of rules || []) if (r && r.name && !out.includes(r.name)) out.push(r.name);
  return out;
}

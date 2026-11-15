// Regel-Engine für die automatische Kategorisierung (rein, ohne chrome.*).
//
// Eine Regel: { id, name, scope: 'youtube'|'web'|'alle', domains: [], keywords: [], enabled }
// Die Reihenfolge im Array ist die Priorität (erste passende Regel gewinnt).
//
// Ablauf von categorize():
//   1. Regeln mit Domains/Stichwörtern, geprüft gegen Domain, Titel und Kanal
//   2. dieselben Regeln, Stichwörter zusätzlich gegen die Beschreibung
//   3. "Auffang"-Regeln (keine Domains und keine Stichwörter) in Prioritätsreihenfolge
//   4. Fallback: "Sonstiges-Video" (YouTube) bzw. "Sonstiges" (Web)

export const FALLBACK_VIDEO = 'Sonstiges-Video';
export const FALLBACK_WEB = 'Sonstiges';

export const DEFAULT_RULES = [
  {
    id: 'yt-musik', name: 'Musik', scope: 'youtube',
    domains: ['music.youtube.com'],
    keywords: ['musik', 'music', 'song', 'lyrics', 'lyric video', 'official video', 'official audio',
      'musikvideo', 'remix', 'album', 'konzert', 'concert', 'cover', 'feat.', 'ft.', 'dj', 'beat',
      'lofi', 'lo-fi', 'hip hop', 'hiphop', 'rap', 'techno', 'house mix', 'karaoke', 'acoustic',
      'unplugged', 'soundtrack', 'vevo', 'playlist', 'mix'],
  },
  {
    id: 'yt-lernen', name: 'Tutorial/Lernen', scope: 'youtube', domains: [],
    keywords: ['tutorial', 'how to', 'howto', 'anleitung', 'erklärt', 'erklärung', 'explained',
      'lernen', 'learn', 'kurs', 'course', 'crash course', 'guide', 'tipps', 'tips', 'lektion',
      'lesson', 'für anfänger', 'beginner', 'schritt für schritt', 'step by step', 'doku',
      'dokumentation', 'documentary', 'workshop', 'masterclass', 'vorlesung', 'lecture', 'diy'],
  },
  {
    id: 'yt-gaming', name: 'Gaming', scope: 'youtube', domains: [],
    keywords: ['gameplay', "let's play", 'lets play', 'gaming', 'gamer', 'zocken', 'walkthrough',
      'playthrough', 'speedrun', 'minecraft', 'fortnite', 'gta', 'elden ring', 'league of legends',
      'valorant', 'counter-strike', 'cs2', 'ps5', 'xbox', 'nintendo', 'switch 2', 'steam deck',
      'esports', 'e-sports', 'boss fight', 'pokémon', 'pokemon', 'zelda', 'call of duty'],
  },
  {
    id: 'yt-news', name: 'Nachrichten', scope: 'youtube', domains: [],
    keywords: ['nachrichten', 'news', 'tagesschau', 'tagesthemen', 'heute journal', 'breaking',
      'eilmeldung', 'politik', 'bundestag', 'regierung', 'wahl', 'krieg', 'pressekonferenz',
      'zdf', 'ard', 'ntv', 'n-tv', 'welt nachrichten', 'spiegel tv', 'phoenix', 'dw news'],
  },
  {
    id: 'yt-podcast', name: 'Podcast/Interview', scope: 'youtube', domains: [],
    keywords: ['podcast', 'interview', 'im gespräch', 'gespräch', 'talk', 'talkshow', 'episode',
      'folge', 'ep.', 'q&a', 'panel', 'diskussion', 'debatte', 'lanz', 'joe rogan'],
  },
  {
    id: 'yt-finanzen', name: 'Finanzen/Börse', scope: 'youtube', domains: [],
    keywords: ['aktie', 'börse', 'stock', 'etf', 'dividende', 'dividend', 'invest', 'trading',
      'trader', 'krypto', 'crypto', 'bitcoin', 'finanz', 'finance', 'geld', 'depot', 'dax',
      'nasdaq', 's&p 500', 'zinsen', 'inflation', 'immobilie', 'rente', 'vermögen', 'chartanalyse',
      'elliott', 'wirtschaft', 'economy'],
  },
  {
    id: 'yt-technik', name: 'Technik', scope: 'youtube', domains: [],
    keywords: ['technik', 'tech', 'review', 'unboxing', 'test', 'smartphone', 'iphone', 'android',
      'laptop', 'notebook', 'pc build', 'gpu', 'grafikkarte', 'nvidia', 'amd', 'intel', 'apple',
      'samsung', 'programmier', 'coding', 'programming', 'linux', 'windows', 'ki', 'ai',
      'künstliche intelligenz', 'chatgpt', 'claude', 'gadget', 'hardware', 'software', 'setup'],
  },
  { id: 'yt-sonstiges', name: FALLBACK_VIDEO, scope: 'youtube', domains: [], keywords: [] },
  {
    id: 'web-shopping', name: 'Shopping', scope: 'web',
    domains: ['amazon.de', 'amazon.com', 'amazon.co.uk', 'ebay.de', 'ebay.com', 'kleinanzeigen.de',
      'otto.de', 'zalando.de', 'idealo.de', 'geizhals.de', 'aliexpress.com', 'temu.com', 'etsy.com',
      'mediamarkt.de', 'saturn.de', 'alternate.de', 'mindfactory.de', 'cyberport.de', 'notebooksbilliger.de',
      'ikea.com', 'lidl.de', 'kaufland.de', 'galaxus.de', 'check24.de', 'mydealz.de', 'shein.com'],
    keywords: ['in den warenkorb', 'jetzt kaufen', 'angebot', 'preisvergleich'],
  },
  {
    id: 'web-news', name: 'Nachrichten', scope: 'web',
    domains: ['spiegel.de', 'zeit.de', 'tagesschau.de', 'zdf.de', 'faz.net', 'sueddeutsche.de',
      'welt.de', 'n-tv.de', 't-online.de', 'focus.de', 'stern.de', 'handelsblatt.com', 'bild.de',
      'tagesspiegel.de', 'taz.de', 'br.de', 'ndr.de', 'wdr.de', 'deutschlandfunk.de', 'dw.com',
      'bbc.com', 'bbc.co.uk', 'cnn.com', 'nytimes.com', 'theguardian.com', 'reuters.com',
      'apnews.com', 'washingtonpost.com', 'bloomberg.com', 'heise.de', 'golem.de', 'netzpolitik.org',
      'news.google.com', 'orf.at', 'srf.ch', 'nzz.ch'],
    keywords: [],
  },
  {
    id: 'web-social', name: 'Social Media', scope: 'web',
    domains: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com',
      'linkedin.com', 'xing.com', 'threads.net', 'bsky.app', 'mastodon.social', 'pinterest.com',
      'tumblr.com', 'discord.com', 'twitch.tv', 't.me', 'web.whatsapp.com', 'news.ycombinator.com'],
    keywords: [],
  },
  {
    id: 'web-dev', name: 'Entwicklung', scope: 'web',
    domains: ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
      'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'docs.python.org', 'dev.to', 'codepen.io',
      'jsfiddle.net', 'vercel.com', 'netlify.com', 'docker.com', 'hub.docker.com', 'huggingface.co',
      'developer.chrome.com', 'learn.microsoft.com', 'docs.anthropic.com', 'claude.ai',
      'chatgpt.com', 'localhost'],
    keywords: ['api reference', 'documentation', 'changelog', 'release notes'],
  },
  {
    id: 'web-wissen', name: 'Dokumente/Wissen', scope: 'web',
    domains: ['wikipedia.org', 'wikimedia.org', 'docs.google.com', 'drive.google.com', 'notion.so',
      'notion.site', 'medium.com', 'substack.com', 'arxiv.org', 'scholar.google.com', 'dropbox.com',
      'onedrive.live.com', 'sharepoint.com', 'archive.org', 'duden.de', 'dict.cc', 'leo.org',
      'deepl.com', 'britannica.com', 'researchgate.net'],
    keywords: ['.pdf', 'wiki', 'handbuch', 'anleitung', 'dokumentation'],
  },
  { id: 'web-sonstiges', name: FALLBACK_WEB, scope: 'web', domains: [], keywords: [] },
];

/** Text aus Textarea/Eingabe -> Liste (Trennung durch Komma, Semikolon oder Zeilenumbruch). */
export function parseList(text) {
  if (Array.isArray(text)) return text.map((s) => String(s).trim()).filter(Boolean);
  return String(text || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

export function normalizeRules(rules) {
  const src = Array.isArray(rules) ? rules : DEFAULT_RULES;
  const seen = new Set();
  return src
    .filter((r) => r && String(r.name || '').trim())
    .map((r, i) => {
      let id = String(r.id || `r${i}-${Date.now().toString(36)}`);
      while (seen.has(id)) id += '_';
      seen.add(id);
      return {
        id,
        name: String(r.name).trim().slice(0, 60),
        scope: ['youtube', 'web', 'alle'].includes(r.scope) ? r.scope : 'alle',
        domains: parseList(r.domains).map((d) => d.toLowerCase()),
        keywords: parseList(r.keywords).map((k) => normText(k)),
        enabled: r.enabled !== false,
      };
    });
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
  const list = (rules && rules.length ? rules : DEFAULT_RULES).filter((r) => r.enabled !== false && scopeFits(r, item));
  const main = normText([item.title, item.channel, item.siteName].filter(Boolean).join(' · '));
  const desc = normText(item.description || '');
  const specific = list.filter((r) => (r.domains && r.domains.length) || (r.keywords && r.keywords.length));

  for (const r of specific) {
    if ((r.domains || []).some((d) => domainMatches(item, d))) return r.name;
    if ((r.keywords || []).some((k) => matchKeyword(main, k))) return r.name;
  }
  if (desc) {
    for (const r of specific) {
      if ((r.keywords || []).some((k) => matchKeyword(desc, k))) return r.name;
    }
  }
  const catchAll = list.find((r) => !(r.domains && r.domains.length) && !(r.keywords && r.keywords.length));
  if (catchAll) return catchAll.name;
  return item.type === 'youtube' ? FALLBACK_VIDEO : FALLBACK_WEB;
}

/** Alle Kategorienamen aus Regeln (in Prioritätsreihenfolge, ohne Duplikate). */
export function ruleCategoryNames(rules) {
  const out = [];
  for (const r of rules || []) if (r && r.name && !out.includes(r.name)) out.push(r.name);
  return out;
}

// Katalog optionaler Kategorien ("Weitere Kategorien (Vorschläge)").
// Nicht aktiv, bis der Nutzer sie in den Einstellungen aktiviert. Erst dann werden sie zu einer
// normalen, editierbaren Kategorie in der Regel-Liste – vorher beeinflussen sie nichts.

import { findCategory, nextColor } from './categories.js';

export const SUGGESTIONS = [
  { id: 'sug-gesundheit', name: 'Gesundheit & Ernährung', color: '#4ade80',
    keywords: ['gesundheit', 'ernährung', 'fasten', 'vitamin', 'darm', 'immunsystem', 'heilkräuter', 'naturheilkunde', 'rezept'] },
  { id: 'sug-sport', name: 'Sport & Fitness', color: '#fb923c',
    keywords: ['training', 'workout', 'yoga', 'krafttraining', 'laufen', 'mobility', 'stretching'] },
  { id: 'sug-psycho', name: 'Psychologie & Persönlichkeitsentwicklung', color: '#c084fc',
    keywords: ['psychologie', 'mindset', 'motivation', 'gewohnheiten', 'selbstwert', 'coaching', 'stoizismus'] },
  { id: 'sug-philo', name: 'Philosophie & Wissen', color: '#818cf8',
    keywords: ['philosophie', 'geschichte', 'dokumentation', 'doku', 'wissenschaft', 'physik', 'kosmos'] },
  { id: 'sug-geopolitik', name: 'Geopolitik & Gesellschaft', color: '#f87171',
    keywords: ['geopolitik', 'politik', 'wahl', 'krieg', 'gesellschaft', 'interview', 'analyse'] },
  { id: 'sug-makro', name: 'Wirtschaft & Makro', color: '#facc15',
    keywords: ['inflation', 'zinsen', 'notenbank', 'ezb', 'fed', 'rezession', 'konjunktur', 'gold', 'silber', 'rohstoffe'] },
  { id: 'sug-krypto', name: 'Krypto', color: '#f59e0b',
    keywords: ['bitcoin', 'ethereum', 'krypto', 'altcoin', 'blockchain', 'defi', 'nft'] },
  { id: 'sug-immo', name: 'Immobilien & Wohnen', color: '#a3e635',
    keywords: ['immobilie', 'haus', 'wohnung', 'miete', 'tiny house', 'grundstück', 'hausbau', 'renovierung'] },
  { id: 'sug-garten', name: 'Selbstversorgung & Garten', color: '#22c55e',
    keywords: ['garten', 'permakultur', 'selbstversorgung', 'hochbeet', 'pflanzen', 'hühner', 'vorrat', 'prepper'] },
  { id: 'sug-ki', name: 'KI & Tools', color: '#22d3ee',
    keywords: ['ki', 'ai', 'chatgpt', 'claude', 'automatisierung', 'prompt', 'agent', 'tool'] },
  { id: 'sug-business', name: 'Business & Online-Geld', color: '#eab308',
    keywords: ['business', 'selbstständig', 'marketing', 'verkaufen', 'passives einkommen', 'steuern', 'gründung'] },
  { id: 'sug-kochen', name: 'Kochen & Rezepte', color: '#fb7185',
    keywords: ['rezept', 'kochen', 'backen', 'vegan', 'küche'] },
  { id: 'sug-reisen', name: 'Reisen & Auswandern', color: '#38bdf8',
    keywords: ['reise', 'urlaub', 'auswandern', 'vanlife', 'camping', 'roadtrip'] },
  { id: 'sug-entspannung', name: 'Musik zum Entspannen', color: '#93c5fd',
    keywords: ['frequenz', 'hz', 'solfeggio', 'binaural', 'meditationsmusik', 'entspannung', 'schlaf', 'ambient'] },
  { id: 'sug-diy', name: 'Heimwerken & DIY', color: '#d97706',
    keywords: ['diy', 'heimwerken', 'reparatur', 'werkzeug', 'elektrik', 'holz', 'anleitung'] },
  { id: 'sug-sprachen', name: 'Lernen & Sprachen', color: '#60a5fa',
    keywords: ['lernen', 'sprachkurs', 'englisch', 'kurs', 'lektion', 'erklärt'] },
  { id: 'sug-comedy', name: 'Unterhaltung & Comedy', color: '#f472b6',
    keywords: ['comedy', 'kabarett', 'satire', 'film', 'serie', 'trailer', 'reaktion'] },
  { id: 'sug-grenzwissen', name: 'Grenzwissen', color: '#8b5cf6', hint: 'Unterkategorie zu „Spirituelles“',
    keywords: ['grenzwissenschaft', 'ufo', 'mystery', 'rätsel', 'alte kulturen', 'pyramiden'] },
];

/** Ist der Vorschlag bereits als Kategorie vorhanden (gleiche id oder gleicher Name)? */
export function isSuggestionActive(rules, sug) {
  return (rules || []).some((r) => r.id === sug.id) || !!findCategory(rules, sug.name);
}

/**
 * Aktiviert einen Vorschlag: fügt ihn als normale Kategorie oben (höchste Priorität) ein.
 * @param {{withKeywords?: boolean}} opts  false = nur Kategorie, ohne Stichwörter
 * @returns {Array} neue Regel-Liste (unverändert, wenn schon aktiv)
 */
export function activateSuggestion(rules, sugId, { withKeywords = true } = {}) {
  const sug = SUGGESTIONS.find((s) => s.id === sugId);
  if (!sug) throw new Error('Unbekannter Vorschlag.');
  if (isSuggestionActive(rules, sug)) return rules;
  const used = new Set((rules || []).map((r) => r.color));
  const rule = {
    id: sug.id,
    name: sug.name,
    color: used.has(sug.color) ? nextColor(rules) : sug.color,
    scope: 'alle',
    domains: [],
    keywords: withKeywords ? [...sug.keywords] : [],
    enabled: true,
    fallback: false,
  };
  return [rule, ...(rules || [])];
}

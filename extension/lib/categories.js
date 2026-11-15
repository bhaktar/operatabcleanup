// Kategorienverwaltung: Umbenennen, Löschen, Ergänzen und Migration der Regeln
// (rein, ohne chrome.*, in Node testbar). Kategorien sind die Einträge der Regel-Liste.

import { normalizeRules, DEFAULT_RULES, categorize } from './categorize.js';

/** Aktuelle Version des Regel-Formats (gespeichert unter `rulesVersion`). */
export const RULES_VERSION = 2;

const PALETTE = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c', '#93c5fd', '#c084fc'];

export function nextColor(rules) {
  const used = new Set((rules || []).map((r) => r.color));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[(rules || []).length % PALETTE.length];
}

function sameName(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function findCategory(rules, name) {
  return (rules || []).find((r) => sameName(r.name, name)) || null;
}

/** Freier Name: "Neue Kategorie", "Neue Kategorie 2", … */
export function uniqueName(rules, base = 'Neue Kategorie') {
  if (!findCategory(rules, base)) return base;
  for (let i = 2; ; i++) if (!findCategory(rules, `${base} ${i}`)) return `${base} ${i}`;
}

/** Leere Kategorie (ohne automatische Zuordnung). */
export function newCategory(rules, name, extra = {}) {
  return {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    color: nextColor(rules),
    scope: 'alle',
    domains: [],
    keywords: [],
    enabled: true,
    fallback: false,
    ...extra,
  };
}

/**
 * Benennt eine Kategorie um (per id). Wirft einen Fehler bei leerem oder bereits vergebenem Namen.
 * @returns {{rules: Array, oldName: string, newName: string}}
 */
export function renameCategoryInRules(rules, id, newName) {
  const name = String(newName || '').trim().slice(0, 60);
  if (!name) throw new Error('Der Kategoriename darf nicht leer sein.');
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error('Kategorie nicht gefunden.');
  const clash = findCategory(rules, name);
  if (clash && clash.id !== id) throw new Error(`Es gibt bereits eine Kategorie „${clash.name}“.`);
  const oldName = rule.name;
  return { rules: rules.map((r) => (r.id === id ? { ...r, name } : r)), oldName, newName: name };
}

/**
 * Überträgt Umbenennungen auf gespeicherte Einträge (verändert `items`).
 * @param {Object<string,string>} renames  alter Name -> neuer Name
 * @returns {number} Anzahl geänderter Einträge
 */
export function applyRenames(items, renames, now = Date.now()) {
  let n = 0;
  const map = new Map(Object.entries(renames || {}).filter(([a, b]) => a && b && a !== b));
  if (!map.size) return 0;
  for (const it of Object.values(items || {})) {
    if (map.has(it.category)) {
      it.category = map.get(it.category);
      it.updatedAt = now;
      n++;
    }
  }
  return n;
}

/** Entfernt eine Kategorie (per id) aus den Regeln. */
export function deleteCategoryFromRules(rules, id) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error('Kategorie nicht gefunden.');
  return { rules: rules.filter((r) => r.id !== id), name: rule.name };
}

/**
 * Verschiebt alle Einträge einer gelöschten Kategorie (verändert `items`).
 * target = Kategoriename (gilt als manuelle Zuordnung) oder null = neu nach Regeln bestimmen.
 */
export function reassignItems(items, fromName, target, rules, now = Date.now()) {
  let n = 0;
  for (const it of Object.values(items || {})) {
    if (it.category !== fromName) continue;
    if (target) {
      it.category = target;
      it.manualCategory = true;
    } else {
      it.manualCategory = false;
      it.category = categorize(it, rules);
    }
    it.updatedAt = now;
    n++;
  }
  return n;
}

/** Ergänzt fehlende Kategorien (z. B. aus Import oder Übersicht) als leere Kategorien am Ende. */
export function ensureCategories(rules, names) {
  const out = [...rules];
  let added = 0;
  for (const raw of names || []) {
    const name = String(raw || '').trim().slice(0, 60);
    if (!name || findCategory(out, name)) continue;
    out.push(newCategory(out, name));
    added++;
  }
  return { rules: out, added };
}

/** Verschiebt eine Kategorie um `delta` Plätze (Priorität). */
export function moveCategory(rules, id, delta) {
  const i = rules.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= rules.length) return rules;
  const out = [...rules];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const FINANCE_ADD = ['aktie', 'etf', 'börse', 'krypto', 'bitcoin', 'dividende', 'elliott', 'charttechnik', 'trading'];

/**
 * Einmalige Migration gespeicherter Regeln auf RULES_VERSION, ohne Nutzeränderungen zu überschreiben:
 *  v1 -> v2: "Finanzen/Börse" heißt jetzt "Finanzen" (Stichwörter bleiben, neue kommen hinzu),
 *            neue Kategorien "Spirituelles" und "Astrologie & Zukunftsforschung" (falls nicht vorhanden),
 *            Farben für Kategorien ohne Farbe, explizites `fallback`-Feld.
 * @param {Array|null} stored  gespeicherte Regeln (null = Neuinstallation)
 * @param {number} version     gespeicherte Version (0/undefined = v1)
 * @returns {{rules: Array, version: number, renames: Object, changed: boolean}}
 */
export function migrateRules(stored, version) {
  const defaults = normalizeRules(DEFAULT_RULES);
  if (!Array.isArray(stored) || !stored.length) {
    return { rules: defaults, version: RULES_VERSION, renames: {}, changed: true };
  }
  let rules = normalizeRules(stored);
  const renames = {};
  if ((Number(version) || 1) >= RULES_VERSION) return { rules, version: RULES_VERSION, renames, changed: false };

  const def = (id) => defaults.find((r) => r.id === id);

  // Finanzen
  let fin = findCategory(rules, 'Finanzen');
  const old = findCategory(rules, 'Finanzen/Börse');
  if (!fin && old) {
    renames[old.name] = 'Finanzen';
    old.name = 'Finanzen';
    fin = old;
  } else if (fin && old) {
    for (const k of old.keywords) if (!fin.keywords.includes(k)) fin.keywords.push(k);
    renames[old.name] = fin.name;
    rules = rules.filter((r) => r !== old);
  }
  if (!fin) {
    fin = { ...def('yt-finanzen') };
    const firstYt = rules.findIndex((r) => r.scope !== 'web');
    rules.splice(firstYt < 0 ? 0 : firstYt, 0, fin);
  }
  for (const k of FINANCE_ADD) if (!fin.keywords.includes(k)) fin.keywords.push(k);

  // Neue Kategorien: Spirituelles direkt vor, Astrologie direkt nach Finanzen
  // (so gewinnt bei "DAX Prognose" weiterhin Finanzen).
  if (!findCategory(rules, 'Spirituelles')) {
    rules.splice(rules.indexOf(fin), 0, { ...def('cat-spirit') });
  }
  if (!findCategory(rules, 'Astrologie & Zukunftsforschung')) {
    rules.splice(rules.indexOf(fin) + 1, 0, { ...def('cat-astro') });
  }

  // Farben ergänzen (Standardfarbe, wenn es die Kategorie in den Standards gibt)
  for (const r of rules) {
    if (r.color) continue;
    const d = defaults.find((x) => sameName(x.name, r.name));
    r.color = d ? d.color : nextColor(rules);
  }
  return { rules: normalizeRules(rules), version: RULES_VERSION, renames, changed: true };
}

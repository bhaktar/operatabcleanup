import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateRules, RULES_VERSION, renameCategoryInRules, applyRenames, deleteCategoryFromRules, reassignItems,
  ensureCategories, moveCategory, uniqueName, newCategory,
} from '../extension/lib/categories.js';
import { SUGGESTIONS, activateSuggestion, isSuggestionActive } from '../extension/lib/suggestions.js';
import { normalizeRules, DEFAULT_RULES, categorize } from '../extension/lib/categorize.js';
import { buildItem } from '../extension/lib/items.js';

const defaults = () => normalizeRules(DEFAULT_RULES);
const item = (url, title, category, manual = false) => ({ ...buildItem({ url, title }), category, manualCategory: manual });

// Regeln, wie sie eine Installation der Version 1 gespeichert hat (ohne fallback/color)
const V1 = [
  { id: 'yt-musik', name: 'Musik', scope: 'youtube', domains: ['music.youtube.com'], keywords: ['musik'], enabled: true },
  { id: 'eigene', name: 'Meine Kanäle', scope: 'youtube', domains: [], keywords: ['kurzgesagt'], enabled: true },
  { id: 'yt-finanzen', name: 'Finanzen/Börse', scope: 'youtube', domains: [], keywords: ['aktie', 'gold'], enabled: true },
  { id: 'yt-sonstiges', name: 'Sonstiges-Video', scope: 'youtube', domains: [], keywords: [], enabled: true },
  { id: 'web-sonstiges', name: 'Sonstiges', scope: 'web', domains: [], keywords: [], enabled: true },
];

test('Migration: Neuinstallation bekommt die Standardkategorien', () => {
  const r = migrateRules(undefined, undefined);
  assert.equal(r.version, RULES_VERSION);
  assert.ok(r.changed);
  const names = r.rules.map((x) => x.name);
  for (const n of ['Spirituelles', 'Astrologie & Zukunftsforschung', 'Finanzen']) assert.ok(names.includes(n), n);
  assert.ok(names.indexOf('Spirituelles') < names.indexOf('Musik'));
  assert.ok(names.indexOf('Finanzen') < names.indexOf('Astrologie & Zukunftsforschung'));
});

test('Migration v1 -> v2: Finanzen/Börse wird Finanzen, Nutzerregeln bleiben, neue Kategorien kommen dazu', () => {
  const r = migrateRules(V1, 1);
  assert.deepEqual(r.renames, { 'Finanzen/Börse': 'Finanzen' });
  const names = r.rules.map((x) => x.name);
  assert.deepEqual(names, ['Musik', 'Meine Kanäle', 'Spirituelles', 'Finanzen', 'Astrologie & Zukunftsforschung', 'Sonstiges-Video', 'Sonstiges']);
  const fin = r.rules.find((x) => x.name === 'Finanzen');
  assert.equal(fin.id, 'yt-finanzen');
  assert.ok(fin.keywords.includes('gold'), 'eigene Stichwörter bleiben');
  for (const k of ['etf', 'krypto', 'bitcoin', 'elliott', 'charttechnik', 'trading', 'börse', 'dividende']) assert.ok(fin.keywords.includes(k), k);
  assert.ok(r.rules.find((x) => x.name === 'Meine Kanäle').keywords.includes('kurzgesagt'));
  assert.equal(r.rules.find((x) => x.name === 'Sonstiges-Video').fallback, true, 'leere v1-Regeln bleiben Auffang');
  assert.ok(r.rules.every((x) => /^#[0-9a-f]{6}$/.test(x.color)));

  // Einträge umbenennen
  const items = { a: item('https://youtu.be/dQw4w9WgXcQ', 'x', 'Finanzen/Börse', true), b: item('https://a.de', 'y', 'Sonstiges') };
  assert.equal(applyRenames(items, r.renames), 1);
  assert.equal(items.a.category, 'Finanzen');
  assert.equal(items.a.manualCategory, true);
});

test('Migration läuft nur einmal und überschreibt keine späteren Änderungen', () => {
  const once = migrateRules(V1, 1);
  const edited = once.rules.filter((x) => x.name !== 'Spirituelles'); // Nutzer löscht Spirituelles
  const again = migrateRules(edited, RULES_VERSION);
  assert.equal(again.changed, false);
  assert.equal(again.rules.some((x) => x.name === 'Spirituelles'), false);
});

test('Migration: vorhandene "Finanzen" + "Finanzen/Börse" werden zusammengeführt', () => {
  const r = migrateRules([...V1, { name: 'Finanzen', keywords: ['steuer'], fallback: false }], 1);
  const fins = r.rules.filter((x) => /^Finanzen/.test(x.name));
  assert.equal(fins.length, 1);
  assert.ok(fins[0].keywords.includes('steuer') && fins[0].keywords.includes('gold'));
  assert.deepEqual(r.renames, { 'Finanzen/Börse': 'Finanzen' });
});

test('Umbenennen: Regeln und Einträge, Namenskonflikte werden abgelehnt', () => {
  const rules = defaults();
  const musik = rules.find((x) => x.name === 'Musik');
  const res = renameCategoryInRules(rules, musik.id, '  Lieder ');
  assert.equal(res.oldName, 'Musik');
  assert.equal(res.newName, 'Lieder');
  assert.ok(res.rules.some((x) => x.name === 'Lieder'));
  assert.equal(rules.find((x) => x.id === musik.id).name, 'Musik', 'Eingabe unverändert');
  assert.throws(() => renameCategoryInRules(rules, musik.id, 'gaming'), /bereits/);
  assert.throws(() => renameCategoryInRules(rules, musik.id, '   '), /leer/);
  assert.doesNotThrow(() => renameCategoryInRules(rules, musik.id, 'MUSIK'));
  const items = { a: item('https://youtu.be/dQw4w9WgXcQ', 's', 'Musik'), b: item('https://youtu.be/abcdefghijk', 't', 'Gaming') };
  assert.equal(applyRenames(items, { Musik: 'Lieder' }), 1);
  assert.equal(items.a.category, 'Lieder');
  assert.equal(items.b.category, 'Gaming');
});

test('Löschen: Einträge wandern nach Sonstiges (manuell) oder werden neu zugeordnet', () => {
  const rules = defaults();
  const gaming = rules.find((x) => x.name === 'Gaming');
  const { rules: rest, name } = deleteCategoryFromRules(rules, gaming.id);
  assert.equal(name, 'Gaming');
  assert.equal(rest.some((x) => x.name === 'Gaming'), false);
  const items = {
    a: item('https://youtu.be/dQw4w9WgXcQ', "Let's Play X", 'Gaming'),
    b: item('https://youtu.be/abcdefghijk', 'Python Tutorial', 'Gaming', true),
    c: item('https://a.de', 'Seite', 'Sonstiges'),
  };
  assert.equal(reassignItems(items, 'Gaming', 'Sonstiges', rest), 2);
  assert.equal(items.a.category, 'Sonstiges');
  assert.equal(items.a.manualCategory, true);
  items.a.category = 'Gaming';
  items.b.category = 'Gaming';
  assert.equal(reassignItems(items, 'Gaming', null, rest), 2);
  assert.equal(items.a.category, categorize(items.a, rest));
  assert.equal(items.b.category, 'Tutorial/Lernen');
  assert.equal(items.b.manualCategory, false);
  assert.throws(() => deleteCategoryFromRules(rules, 'gibtsnicht'));
});

test('Hinzufügen, Ergänzen fehlender Kategorien, Reihenfolge', () => {
  const rules = defaults();
  assert.equal(uniqueName(rules, 'Musik'), 'Musik 2');
  assert.equal(uniqueName(rules), 'Neue Kategorie');
  const c = newCategory(rules, 'Später');
  assert.equal(c.fallback, false);
  assert.deepEqual(c.keywords, []);
  const { rules: more, added } = ensureCategories(rules, ['Später', 'musik', '', 'Später']);
  assert.equal(added, 1);
  assert.equal(more.at(-1).name, 'Später');
  // leere Kategorie ändert die automatische Zuordnung nicht
  const it = item('https://zufall.example/x', 'Irgendwas');
  assert.equal(categorize(it, normalizeRules(more)), categorize(it, rules));
  const first = rules[0].id;
  assert.equal(moveCategory(rules, first, 1)[1].id, first);
  assert.equal(moveCategory(rules, first, -1), rules);
});

test('Vorschläge: standardmäßig nicht aktiv, Aktivierung fügt Kategorie oben ein', () => {
  const rules = defaults();
  assert.ok(SUGGESTIONS.length >= 18);
  assert.equal(new Set(SUGGESTIONS.map((s) => s.id)).size, SUGGESTIONS.length);
  for (const s of SUGGESTIONS) {
    assert.equal(isSuggestionActive(rules, s), false, `${s.name} ist nicht standardmäßig aktiv`);
    assert.ok(s.keywords.length > 0);
  }
  // inaktiv -> keine Wirkung auf die Kategorisierung
  const garten = item('https://youtu.be/abcdefghijk', 'Hochbeet anlegen im Frühling');
  assert.equal(categorize(garten, rules), 'Sonstiges-Video');

  const withGarden = normalizeRules(activateSuggestion(rules, 'sug-garten'));
  assert.equal(withGarden[0].name, 'Selbstversorgung & Garten');
  assert.ok(withGarden[0].keywords.includes('hochbeet'));
  assert.equal(categorize(garten, withGarden), 'Selbstversorgung & Garten');
  assert.ok(isSuggestionActive(withGarden, SUGGESTIONS.find((s) => s.id === 'sug-garten')));
  assert.equal(activateSuggestion(withGarden, 'sug-garten'), withGarden, 'doppelt aktivieren ändert nichts');

  const bare = normalizeRules(activateSuggestion(rules, 'sug-krypto', { withKeywords: false }));
  assert.equal(bare[0].name, 'Krypto');
  assert.deepEqual(bare[0].keywords, []);
  assert.equal(bare[0].fallback, false);
  assert.equal(categorize(item('https://youtu.be/abcdefghijk', 'Bitcoin News'), bare), 'Finanzen');
  assert.throws(() => activateSuggestion(rules, 'gibtsnicht'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categorize, DEFAULT_RULES, normalizeRules, matchKeyword, domainMatches, parseList, ruleCategoryNames,
} from '../extension/lib/categorize.js';
import { buildItem } from '../extension/lib/items.js';

const rules = normalizeRules(DEFAULT_RULES);
const yt = (title, channel = '') => ({ ...buildItem({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title }), channel });
const web = (url, title = '', description = '') => ({ ...buildItem({ url, title }), description });

test('matchKeyword: Wortanfang, kurze Wörter nur ganz', () => {
  assert.ok(matchKeyword('Aktien kaufen 2025', 'aktie'));
  assert.ok(matchKeyword('Die beste KI für alle', 'ki'));
  assert.equal(matchKeyword('Kiosk am Eck', 'ki'), false);
  assert.equal(matchKeyword('Therapie', 'rap'), false);
  assert.ok(matchKeyword('Deutscher Rap 2024', 'rap'));
  assert.ok(matchKeyword("Let’s Play Minecraft", "let's play"));
  assert.ok(matchKeyword('Song feat. Künstler', 'feat.'));
  assert.equal(matchKeyword('irgendwas', ''), false);
});

test('domainMatches mit Subdomain und Pfad', () => {
  const it = { domain: 'smile.amazon.de', url: 'https://smile.amazon.de/dp/1' };
  assert.ok(domainMatches(it, 'amazon.de'));
  assert.equal(domainMatches(it, 'mazon.de'), false);
  const maps = { domain: 'google.com', url: 'https://www.google.com/maps/place/x' };
  assert.ok(domainMatches(maps, 'google.com/maps'));
  assert.equal(domainMatches({ domain: 'google.com', url: 'https://google.com/search?q=1' }, 'google.com/maps'), false);
});

test('YouTube-Unterkategorien nach Titel/Kanal', () => {
  assert.equal(categorize(yt('Rick Astley - Never Gonna Give You Up (Official Music Video)'), rules), 'Musik');
  assert.equal(categorize(yt('Python Tutorial für Anfänger'), rules), 'Tutorial/Lernen');
  assert.equal(categorize(yt("Let's Play Elden Ring #12"), rules), 'Gaming');
  assert.equal(categorize(yt('tagesschau 20:00 Uhr'), rules), 'Nachrichten');
  assert.equal(categorize(yt('Folge 112 mit Gast X', 'Mein Podcast'), rules), 'Podcast/Interview');
  assert.equal(categorize(yt('Diese 3 Aktien kaufe ich jetzt'), rules), 'Finanzen/Börse');
  assert.equal(categorize(yt('iPhone 17 Review'), rules), 'Technik');
  assert.equal(categorize(yt('Mein Urlaub in Italien'), rules), 'Sonstiges-Video');
  assert.equal(categorize(yt('Irgendein Titel', 'Finanzfluss'), rules), 'Finanzen/Börse');
});

test('Domain-Kategorien für Web', () => {
  assert.equal(categorize(web('https://www.amazon.de/dp/B000'), rules), 'Shopping');
  assert.equal(categorize(web('https://www.spiegel.de/politik/x'), rules), 'Nachrichten');
  assert.equal(categorize(web('https://old.reddit.com/r/de'), rules), 'Social Media');
  assert.equal(categorize(web('https://github.com/user/repo'), rules), 'Entwicklung');
  assert.equal(categorize(web('https://de.wikipedia.org/wiki/Opera'), rules), 'Dokumente/Wissen');
  assert.equal(categorize(web('https://zufall-blog.example/'), rules), 'Sonstiges');
});

test('Beschreibung wird nachrangig geprüft', () => {
  const it = web('https://unbekannt.example/x', 'Seite', 'Ein ausführliches Handbuch zur Installation');
  assert.equal(categorize(it, rules), 'Dokumente/Wissen');
});

test('Priorität: erste passende Regel gewinnt, deaktivierte Regeln werden übersprungen', () => {
  const custom = normalizeRules([
    { name: 'Lieblingskanal', scope: 'youtube', domains: '', keywords: 'Kurzgesagt' },
    ...DEFAULT_RULES,
  ]);
  assert.equal(categorize(yt('Musik erklärt', 'Kurzgesagt'), custom), 'Lieblingskanal');
  custom[0].enabled = false;
  assert.equal(categorize(yt('Musik erklärt', 'Kurzgesagt'), custom), 'Musik');
});

test('Scope "alle" und Fallback ohne Auffangregel', () => {
  const r = normalizeRules([{ name: 'KI', scope: 'alle', keywords: ['chatgpt'] }]);
  assert.equal(categorize(web('https://x.de', 'ChatGPT Tricks'), r), 'KI');
  assert.equal(categorize(yt('ChatGPT erklärt'), r), 'KI');
  assert.equal(categorize(yt('Anderes'), r), 'Sonstiges-Video');
  assert.equal(categorize(web('https://x.de', 'Anderes'), r), 'Sonstiges');
});

test('normalizeRules / parseList', () => {
  assert.deepEqual(parseList('a, b\nc; d ,,'), ['a', 'b', 'c', 'd']);
  const n = normalizeRules([{ name: ' X ', domains: 'A.de, b.de', keywords: 'Foo\nBar', scope: 'quatsch' }, { name: '' }]);
  assert.equal(n.length, 1);
  assert.deepEqual(n[0].domains, ['a.de', 'b.de']);
  assert.deepEqual(n[0].keywords, ['foo', 'bar']);
  assert.equal(n[0].scope, 'alle');
  assert.equal(n[0].name, 'X');
  assert.ok(ruleCategoryNames(rules).includes('Sonstiges-Video'));
  assert.equal(new Set(rules.map((r) => r.id)).size, rules.length);
});

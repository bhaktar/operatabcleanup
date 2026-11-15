import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl, cleanUrl, parseYouTube, parseTimestamp, formatTimestamp, buildYouTubeUrl,
  itemKey, getDomain, isSaveableUrl, cleanTitle, sanitizeImageUrl, domainInList, hashId, youtubeThumb,
} from '../extension/lib/url.js';

test('normalizeUrl entfernt Tracking-Parameter, www, Fragment und sortiert', () => {
  assert.equal(
    normalizeUrl('https://www.Example.com/path/?utm_source=x&b=2&a=1&fbclid=abc#section'),
    'https://example.com/path?a=1&b=2',
  );
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com/app#/route/1'), 'https://example.com/app#/route/1');
  assert.equal(normalizeUrl('https://example.com/a?UTM_Medium=x&gclid=1&si=foo'), 'https://example.com/a');
  assert.equal(normalizeUrl('http://example.com:8080/x/'), 'http://example.com:8080/x');
});

test('cleanUrl lässt sinnvolle Parameter und Fragment stehen', () => {
  assert.equal(cleanUrl('https://shop.de/p?id=5&utm_campaign=x#info'), 'https://shop.de/p?id=5#info');
  assert.equal(cleanUrl('chrome://settings'), 'chrome://settings');
});

test('isSaveableUrl / getDomain', () => {
  assert.ok(isSaveableUrl('https://a.de'));
  assert.ok(isSaveableUrl('http://a.de/x'));
  for (const u of ['chrome://extensions', 'opera://settings', 'about:blank', 'chrome-extension://abc/x.html', 'file:///tmp/a', '', 'kein url']) {
    assert.equal(isSaveableUrl(u), false, u);
  }
  assert.equal(getDomain('https://www.heise.de/news'), 'heise.de');
  assert.equal(getDomain('https://m.youtube.com/watch?v=x'), 'm.youtube.com');
});

test('parseTimestamp versteht alle YouTube-Formate', () => {
  assert.equal(parseTimestamp('90'), 90);
  assert.equal(parseTimestamp('90s'), 90);
  assert.equal(parseTimestamp('1m30s'), 90);
  assert.equal(parseTimestamp('1h2m3s'), 3723);
  assert.equal(parseTimestamp('2h'), 7200);
  assert.equal(parseTimestamp('1:02:03'), 3723);
  assert.equal(parseTimestamp('4:05'), 245);
  assert.equal(parseTimestamp('abc'), 0);
  assert.equal(parseTimestamp(null), 0);
  assert.equal(parseTimestamp(''), 0);
});

test('formatTimestamp', () => {
  assert.equal(formatTimestamp(5), '0:05');
  assert.equal(formatTimestamp(245), '4:05');
  assert.equal(formatTimestamp(3723), '1:02:03');
});

test('parseYouTube: watch, youtu.be, shorts, embed, live, playlist, mobile, music', () => {
  assert.deepEqual(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s&si=abc'),
    { kind: 'video', videoId: 'dQw4w9WgXcQ', playlistId: null, t: 65 });
  assert.deepEqual(parseYouTube('https://youtu.be/dQw4w9WgXcQ?t=42'),
    { kind: 'video', videoId: 'dQw4w9WgXcQ', playlistId: null, t: 42 });
  assert.deepEqual(parseYouTube('https://www.youtube.com/shorts/abcdefghijk?feature=share'),
    { kind: 'short', videoId: 'abcdefghijk', playlistId: null, t: 0 });
  assert.equal(parseYouTube('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30').t, 30);
  assert.equal(parseYouTube('https://www.youtube.com/live/dQw4w9WgXcQ').videoId, 'dQw4w9WgXcQ');
  assert.equal(parseYouTube('https://m.youtube.com/watch?v=dQw4w9WgXcQ').videoId, 'dQw4w9WgXcQ');
  assert.equal(parseYouTube('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM').playlistId, 'RDAMVM');
  assert.deepEqual(parseYouTube('https://www.youtube.com/playlist?list=PLabc123_-'),
    { kind: 'playlist', videoId: null, playlistId: 'PLabc123_-', t: 0 });
  assert.deepEqual(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx1&index=3'),
    { kind: 'video', videoId: 'dQw4w9WgXcQ', playlistId: 'PLx1', t: 0 });
  assert.equal(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=2m').t, 120);
  assert.equal(parseYouTube('https://www.youtube.com/@kanal'), null);
  assert.equal(parseYouTube('https://www.youtube.com/'), null);
  assert.equal(parseYouTube('https://www.youtube.com/watch?v=zukurz'), null);
  assert.equal(parseYouTube('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYouTube('https://notyoutube.com/watch?v=dQw4w9WgXcQ'), null);
});

test('buildYouTubeUrl behält Zeitmarke und Playlist', () => {
  assert.equal(buildYouTubeUrl({ kind: 'video', videoId: 'dQw4w9WgXcQ', playlistId: null, t: 65 }),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=65s');
  assert.equal(buildYouTubeUrl({ kind: 'video', videoId: 'dQw4w9WgXcQ', playlistId: 'PLx', t: 0 }),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx');
  assert.equal(buildYouTubeUrl({ kind: 'short', videoId: 'abcdefghijk', t: 10 }), 'https://www.youtube.com/shorts/abcdefghijk');
  assert.equal(buildYouTubeUrl({ kind: 'playlist', playlistId: 'PLabc' }), 'https://www.youtube.com/playlist?list=PLabc');
  assert.equal(youtubeThumb('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
});

test('itemKey: YouTube nach Video-ID, Web nach normalisierter URL', () => {
  const a = itemKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10');
  const b = itemKey('https://youtu.be/dQw4w9WgXcQ?si=xyz');
  const c = itemKey('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&pp=abc');
  assert.equal(a, 'yt:dQw4w9WgXcQ');
  assert.equal(a, b);
  assert.equal(a, c);
  assert.equal(itemKey('https://www.youtube.com/playlist?list=PLabc'), 'ytpl:PLabc');
  assert.equal(itemKey('http://www.spiegel.de/artikel/?utm_source=tw'), itemKey('https://spiegel.de/artikel'));
  assert.notEqual(itemKey('https://a.de/x?id=1'), itemKey('https://a.de/x?id=2'));
  assert.equal(hashId(a), hashId(b));
  assert.match(hashId('x'), /^[0-9a-z]{14}$/);
});

test('cleanTitle entfernt Zähler und YouTube-Suffix', () => {
  assert.equal(cleanTitle('(3) Toller Song - YouTube'), 'Toller Song');
  assert.equal(cleanTitle('(12+) Mein   Video – YouTube'), 'Mein Video');
  assert.equal(cleanTitle('Normale Seite - Blog'), 'Normale Seite - Blog');
});

test('sanitizeImageUrl verwirft data:-URLs und löst relative URLs auf', () => {
  assert.equal(sanitizeImageUrl('data:image/png;base64,AAAA'), '');
  assert.equal(sanitizeImageUrl('/img/a.jpg', 'https://site.de/blog/post'), 'https://site.de/img/a.jpg');
  assert.equal(sanitizeImageUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeImageUrl(''), '');
});

test('domainInList (Ausnahmeliste) mit Subdomains', () => {
  assert.ok(domainInList('mail.google.com', ['google.com']));
  assert.ok(domainInList('google.com', ['https://www.google.com/']));
  assert.equal(domainInList('notgoogle.com', ['google.com']), false);
  assert.equal(domainInList('', ['google.com']), false);
});

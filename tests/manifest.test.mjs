import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const manifest = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));

test('manifest.json ist gültiges MV3 mit den nötigen Berechtigungen', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Tab-Ablage');
  assert.ok(manifest.description.length <= 132, 'Beschreibung max. 132 Zeichen');
  for (const p of ['tabs', 'storage', 'unlimitedStorage', 'scripting', 'alarms', 'contextMenus']) {
    assert.ok(manifest.permissions.includes(p), p);
  }
  assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
  assert.equal(manifest.background.type, 'module');
});

test('alle im Manifest referenzierten Dateien existieren', () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const f of files) assert.ok(existsSync(join(EXT, f)), f);
});

test('Icons sind PNGs in der angegebenen Größe', () => {
  for (const [size, f] of Object.entries(manifest.icons)) {
    const buf = readFileSync(join(EXT, f));
    assert.equal(buf.subarray(1, 4).toString(), 'PNG', f);
    assert.equal(buf.readUInt32BE(16), Number(size), `${f} Breite`);
    assert.equal(buf.readUInt32BE(20), Number(size), `${f} Höhe`);
  }
});

test('HTML-Seiten: Skripte und Stylesheets existieren, keine Inline-Skripte (CSP)', () => {
  for (const page of readdirSync(EXT).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(join(EXT, page), 'utf8');
    for (const m of html.matchAll(/<(?:script|img|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|#)/.test(m[1])) continue;
      if (m[1].endsWith('.html')) continue;
      assert.ok(existsSync(join(EXT, m[1])), `${page}: ${m[1]}`);
    }
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(html), false, `${page}: Inline-Skript`);
    assert.equal(/\son[a-z]+="/i.test(html), false, `${page}: Inline-Event-Handler`);
  }
});

test('alle JS-Imports lassen sich auflösen', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : []);
  for (const file of walk(EXT)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
      assert.ok(existsSync(resolve(dirname(file), m[1])), `${file}: ${m[1]}`);
    }
  }
});

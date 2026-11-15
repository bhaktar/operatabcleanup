import { applyTheme, toast, exportJson, exportBookmarks, importFile, formatDateTime } from './lib/ui.js';
import { send, escapeHtml as esc } from './lib/ui.js';
import { getSettings, saveSettings, getRules } from './lib/settings.js';
import { normalizeRules, parseList, categorize } from './lib/categorize.js';
import { uniqueName, newCategory, moveCategory } from './lib/categories.js';
import { SUGGESTIONS, activateSuggestion, isSuggestionActive } from './lib/suggestions.js';
import { buildItem } from './lib/items.js';

const $ = (id) => document.getElementById(id);
let rules = [];
let counts = new Map();

function showError(e) {
  toast(`Fehler: ${e && e.message ? e.message : e}`, { error: true, ms: 8000 });
}

// ------------------------------------------------------------------ Allgemein & Automatik

async function loadSettings() {
  const s = await getSettings();
  applyTheme(s.theme);
  $('keepActiveTab').checked = s.keepActiveTab;
  $('openOverviewAfterSave').checked = s.openOverviewAfterSave;
  $('fetchPreviews').checked = s.fetchPreviews;
  $('closeAfterFile').checked = s.closeAfterFile;
  $('afterOpen').value = s.afterOpen;
  $('theme').value = s.theme;
  $('pageSize').value = String(s.pageSize);
  $('autoEnabled').checked = s.autoArchive.enabled;
  $('autoHours').value = s.autoArchive.hours;
  $('limitEnabled').checked = s.tabLimit.enabled;
  $('limitMax').value = s.tabLimit.max;
  $('whitelist').value = s.whitelist.join('\n');
  syncDisabled();
}

function syncDisabled() {
  $('autoHours').disabled = !$('autoEnabled').checked;
  $('limitMax').disabled = !$('limitEnabled').checked;
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveGeneral, 300);
}

async function saveGeneral() {
  const hours = Math.min(720, Math.max(0.25, Number($('autoHours').value) || 6));
  const max = Math.min(5000, Math.max(1, Math.round(Number($('limitMax').value) || 50)));
  try {
    const s = await saveSettings({
      keepActiveTab: $('keepActiveTab').checked,
      openOverviewAfterSave: $('openOverviewAfterSave').checked,
      fetchPreviews: $('fetchPreviews').checked,
      closeAfterFile: $('closeAfterFile').checked,
      afterOpen: $('afterOpen').value,
      theme: $('theme').value,
      pageSize: Number($('pageSize').value) || 200,
      autoArchive: { enabled: $('autoEnabled').checked, hours },
      tabLimit: { enabled: $('limitEnabled').checked, max },
      whitelist: parseList($('whitelist').value).map((d) => d.toLowerCase()),
    });
    applyTheme(s.theme);
    syncDisabled();
    send('settingsChanged').catch(() => {});
    toast('Gespeichert.', { ms: 1500 });
  } catch (e) { showError(e); }
}

for (const id of ['keepActiveTab', 'openOverviewAfterSave', 'fetchPreviews', 'closeAfterFile', 'afterOpen', 'theme', 'pageSize',
  'autoEnabled', 'limitEnabled']) {
  $(id).addEventListener('change', scheduleSave);
}
for (const id of ['autoHours', 'limitMax', 'whitelist']) $(id).addEventListener('change', scheduleSave);

async function showAutoLog() {
  const { autoLog } = await chrome.storage.local.get('autoLog');
  $('autoLog').textContent = autoLog && autoLog.at
    ? `Zuletzt automatisch abgelegt: ${autoLog.count} Tabs am ${formatDateTime(autoLog.at)}.` : '';
}

// ------------------------------------------------------------------ Kategorien
// Alle Änderungen laufen über den Hintergrunddienst (er schreibt `rules` und passt `items` an).
// Das Kontextmenü und die Übersicht reagieren auf die Speicheränderung sofort.

let opChain = Promise.resolve();
/** Führt Änderungen nacheinander aus (z. B. Stichwort-Speichern vor dem Umbenennen). */
function op(fn) {
  const run = opChain.then(fn);
  opChain = run.catch(() => {});
  return run.catch(showError);
}

let saveTimer2 = null;
function setState(text) { $('cats-state').textContent = text; }

/** Regeln (debounced) speichern; der Hintergrunddienst ordnet danach neu zu. */
function queueRulesSave(delay = 600) {
  setState('Wird gespeichert …');
  clearTimeout(saveTimer2);
  saveTimer2 = setTimeout(() => { saveTimer2 = null; op(saveRulesNow); }, delay);
}

async function saveRulesNow() {
  const r = await send('saveRules', { rules });
  setState(r.changed ? `Gespeichert – ${r.changed} Einträge neu zugeordnet.` : 'Gespeichert.');
}

/** Ausstehendes Speichern sofort ausführen (vor Umbenennen/Löschen). */
async function flushRulesSave() {
  if (saveTimer2) { clearTimeout(saveTimer2); saveTimer2 = null; await saveRulesNow(); }
}

function autoSummary(r) {
  const parts = [];
  if (r.fallback) parts.push('Auffang-Kategorie');
  if (r.domains.length) parts.push(`${r.domains.length} Domain${r.domains.length === 1 ? '' : 's'}`);
  if (r.keywords.length) parts.push(r.keywords.length === 1 ? '1 Stichwort' : `${r.keywords.length} Stichwörter`);
  if (!parts.length) return '(keine – nur manuelle Zuordnung)';
  return `(${parts.join(', ')}${r.enabled ? '' : ', pausiert'})`;
}

function renderCats() {
  const list = $('cat-list');
  const open = new Set([...list.querySelectorAll('.cat')].filter((el) => el.querySelector('.c-rules').open).map((el) => el.dataset.id));
  const tpl = $('cat-tpl');
  list.replaceChildren();
  rules.forEach((r, i) => {
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.dataset.id = r.id;
    el.style.setProperty('--c', r.color || 'var(--border)');
    el.querySelector('.prio').textContent = `${i + 1}.`;
    el.querySelector('.c-color').value = r.color || '#888888';
    el.querySelector('.c-name').value = r.name;
    const n = counts.get(r.name) || 0;
    el.querySelector('.c-count').textContent = `${n} Eintr${n === 1 ? 'ag' : 'äge'}`;
    el.querySelector('.c-auto').textContent = autoSummary(r);
    el.querySelector('.c-scope').value = r.scope;
    el.querySelector('.c-enabled').checked = r.enabled;
    el.querySelector('.c-fallback').checked = r.fallback;
    el.querySelector('.c-domains').value = r.domains.join(', ');
    el.querySelector('.c-keywords').value = r.keywords.join(', ');
    el.querySelector('.c-up').disabled = i === 0;
    el.querySelector('.c-down').disabled = i === rules.length - 1;
    if (open.has(r.id)) el.querySelector('.c-rules').open = true;
    list.appendChild(el);
  });
  renderSuggestions();
  updateTest();
}

function renderSuggestions() {
  $('sug-list').innerHTML = SUGGESTIONS.map((sg) => {
    const active = isSuggestionActive(rules, sg);
    return `<div class="sug${active ? ' active' : ''}" data-sug="${esc(sg.id)}">` +
      `<strong><i class="dot" style="--c:${esc(sg.color)}"></i>${esc(sg.name)}</strong>` +
      (sg.hint ? `<span class="muted small">${esc(sg.hint)}</span>` : '') +
      `<span class="kw muted">${esc(sg.keywords.join(', '))}</span>` +
      `<div class="buttons">` +
      (active
        ? `<button class="btn small" type="button" disabled>Aktiv</button><button class="btn small danger" type="button" data-sug-off>Deaktivieren …</button>`
        : `<button class="btn small primary" type="button" data-sug-on>Aktivieren</button><button class="btn small" type="button" data-sug-bare title="Nur die Kategorie anlegen, ohne Stichwörter">Nur Kategorie</button>`) +
      `</div></div>`;
  }).join('');
}

function ruleOf(el) {
  const id = el.closest('.cat')?.dataset.id;
  return rules.find((r) => r.id === id) || null;
}

const catList = $('cat-list');

catList.addEventListener('input', (e) => {
  const r = ruleOf(e.target);
  if (!r) return;
  const t = e.target;
  if (t.classList.contains('c-name')) return; // Umbenennen erst beim Verlassen des Feldes
  if (t.classList.contains('c-color')) {
    r.color = t.value;
    t.closest('.cat').style.setProperty('--c', t.value);
  } else if (t.classList.contains('c-domains')) r.domains = parseList(t.value);
  else if (t.classList.contains('c-keywords')) r.keywords = parseList(t.value);
  else return;
  t.closest('.cat').querySelector('.c-auto').textContent = autoSummary(r);
  updateTest();
  queueRulesSave();
});

catList.addEventListener('change', (e) => {
  const r = ruleOf(e.target);
  if (!r) return;
  const t = e.target;
  if (t.classList.contains('c-name')) {
    const name = t.value.trim();
    if (name === r.name) return;
    op(async () => {
      await flushRulesSave();
      try {
        const res = await send('renameCategory', { id: r.id, name });
        r.name = res.newName;
        t.value = res.newName;
        toast(`Umbenannt in „${res.newName}“${res.renamed ? ` – ${res.renamed} Einträge angepasst` : ''}.`);
      } catch (err) {
        t.value = r.name;
        throw err;
      }
    });
    return;
  }
  if (t.classList.contains('c-scope')) r.scope = t.value;
  else if (t.classList.contains('c-enabled')) r.enabled = t.checked;
  else if (t.classList.contains('c-fallback')) r.fallback = t.checked;
  else if (t.classList.contains('c-color')) { queueRulesSave(0); return; }
  else return;
  t.closest('.cat').querySelector('.c-auto').textContent = autoSummary(r);
  updateTest();
  queueRulesSave(0);
});

catList.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('c-name')) e.target.blur();
});

catList.addEventListener('click', (e) => {
  const r = ruleOf(e.target);
  if (!r) return;
  if (e.target.closest('.c-up') || e.target.closest('.c-down')) {
    rules = moveCategory(rules, r.id, e.target.closest('.c-up') ? -1 : 1);
    renderCats();
    queueRulesSave(0);
  } else if (e.target.closest('.c-del')) {
    askDelete(r);
  }
});

/** Löschen mit Rückfrage und Wahl der Zielkategorie für vorhandene Einträge. */
function askDelete(r) {
  const n = counts.get(r.name) || 0;
  $('del-title').textContent = `Kategorie „${r.name}“ löschen?`;
  $('del-text').textContent = n
    ? `${n} Eintr${n === 1 ? 'ag ist' : 'äge sind'} in dieser Kategorie. Wohin sollen sie?`
    : 'Diese Kategorie enthält keine Einträge.';
  const others = rules.filter((x) => x.id !== r.id).map((x) => x.name);
  const def = others.includes('Sonstiges') ? 'Sonstiges' : '';
  $('del-target').innerHTML =
    `<option value="__auto">Automatisch neu zuordnen (Regeln)</option>` +
    (others.includes('Sonstiges') ? '' : '<option value="Sonstiges">Sonstiges</option>') +
    others.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('del-target').value = def || 'Sonstiges';
  $('del-target').closest('label').hidden = n === 0;
  const dlg = $('del-dialog');
  dlg.returnValue = '';
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const v = $('del-target').value;
    op(async () => {
      await flushRulesSave();
      const res = await send('deleteCategory', { id: r.id, target: v === '__auto' ? null : v });
      toast(`„${res.name}“ gelöscht${res.moved ? ` – ${res.moved} Einträge verschoben` : ''}.`);
    });
  };
  dlg.showModal();
}

$('cat-add').addEventListener('click', () => {
  const c = newCategory(rules, uniqueName(rules));
  rules = [c, ...rules];
  renderCats();
  const input = catList.querySelector(`.cat[data-id="${CSS.escape(c.id)}"] .c-name`);
  input.focus();
  input.select();
  op(async () => { clearTimeout(saveTimer2); saveTimer2 = null; await saveRulesNow(); });
});

$('sug-list').addEventListener('click', (e) => {
  const box = e.target.closest('[data-sug]');
  if (!box) return;
  const sg = SUGGESTIONS.find((x) => x.id === box.dataset.sug);
  if (e.target.closest('[data-sug-on]') || e.target.closest('[data-sug-bare]')) {
    const withKeywords = !!e.target.closest('[data-sug-on]');
    op(async () => {
      await flushRulesSave();
      rules = normalizeRules(activateSuggestion(rules, sg.id, { withKeywords }));
      renderCats();
      await saveRulesNow();
      toast(`„${sg.name}“ aktiviert${withKeywords ? '' : ' (ohne Stichwörter)'}.`);
    });
  } else if (e.target.closest('[data-sug-off]')) {
    const r = rules.find((x) => x.id === sg.id) || rules.find((x) => x.name.toLowerCase() === sg.name.toLowerCase());
    if (r) askDelete(r);
  }
});

$('cats-recat').addEventListener('click', () => op(async () => {
  await flushRulesSave();
  const r = await send('recategorize');
  toast(`Neu kategorisiert: ${r.changed} Einträge geändert (manuelle Zuordnungen bleiben).`);
}));

$('cats-reset').addEventListener('click', () => {
  if (!confirm('Alle Kategorien durch die Standardkategorien ersetzen? Eigene Kategorien und Stichwörter gehen verloren; '
    + 'Einträge behalten ihre Kategorie.')) return;
  op(async () => {
    clearTimeout(saveTimer2); saveTimer2 = null;
    const r = await send('resetRules');
    toast(`Standardkategorien wiederhergestellt. ${r.changed} Einträge neu zugeordnet.`);
  });
});

function updateTest() {
  const url = $('test-url').value.trim();
  const title = $('test-title').value.trim();
  if (!url && !title) { $('test-result').textContent = ''; return; }
  const item = buildItem({ url: url || 'https://example.com/', title }) ||
    buildItem({ url: 'https://example.com/', title });
  $('test-result').textContent = `→ ${categorize(item, normalizeRules(rules))}`;
}
$('test-url').addEventListener('input', updateTest);
$('test-title').addEventListener('input', updateTest);

/** Regeln von außen geändert (Übersicht, Import, Hintergrund) -> übernehmen, ohne Eingaben zu stören. */
async function onRulesChanged() {
  if (saveTimer2) return; // eigene Änderung steht noch aus
  const fresh = await getRules();
  const editing = catList.contains(document.activeElement);
  const sameShape = fresh.length === rules.length && fresh.every((r, i) => r.id === rules[i].id && r.name === rules[i].name);
  if (editing && sameShape) return;
  rules = fresh;
  renderCats();
}

async function loadCounts() {
  const { items } = await chrome.storage.local.get('items');
  counts = new Map();
  for (const it of Object.values(items || {})) counts.set(it.category, (counts.get(it.category) || 0) + 1);
  for (const el of catList.querySelectorAll('.cat')) {
    const r = rules.find((x) => x.id === el.dataset.id);
    const n = r ? counts.get(r.name) || 0 : 0;
    el.querySelector('.c-count').textContent = `${n} Eintr${n === 1 ? 'ag' : 'äge'}`;
  }
}

// ------------------------------------------------------------------ Daten

async function showStats() {
  const { items } = await chrome.storage.local.get('items');
  const list = Object.values(items || {});
  const yt = list.filter((i) => i.type === 'youtube').length;
  const archived = list.filter((i) => i.status === 'archived').length;
  let bytes = 0;
  try { bytes = await chrome.storage.local.getBytesInUse(null); } catch { /* egal */ }
  $('data-stats').textContent = `${list.length} Einträge (${yt} YouTube, ${list.length - yt} Web, ${archived} gesehen)` +
    (bytes ? ` · Speicher: ${(bytes / 1024 / 1024).toFixed(2)} MB` : '');
}

$('export-json').addEventListener('click', async () => {
  try { const n = await exportJson(); toast(`${n} Einträge exportiert.`); } catch (e) { showError(e); }
});
$('export-html').addEventListener('click', async () => {
  try { await exportBookmarks(); toast('Lesezeichen-Datei erstellt.'); } catch (e) { showError(e); }
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const r = await importFile(file);
    toast(`Import: ${r.added} neu, ${r.updated} aktualisiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, { ms: 8000 });
    showStats();
  } catch (err) { showError(err); }
});
$('clear').addEventListener('click', async () => {
  if (!confirm('Wirklich ALLE abgelegten Einträge löschen? Tipp: vorher als JSON exportieren.')) return;
  if (!confirm('Letzte Rückfrage: alles löschen?')) return;
  try { await send('clearAll'); toast('Alle Einträge gelöscht.'); showStats(); } catch (e) { showError(e); }
});
$('link-overview').addEventListener('click', (e) => {
  e.preventDefault();
  send('openOverview', {}).catch(showError);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.items) { showStats(); loadCounts(); }
  if (changes.rules) onRulesChanged();
  if (changes.autoLog) showAutoLog();
});

// ------------------------------------------------------------------ Start

(async () => {
  try {
    await loadSettings();
    rules = await getRules();
    await loadCounts();
    renderCats();
    if (location.hash === '#kategorien') $('sec-cats').scrollIntoView();
    showStats();
    showAutoLog();
  } catch (e) { showError(e); }
})();

// Ungespeicherte Stichwort-Änderungen beim Schließen der Seite noch abschicken.
window.addEventListener('pagehide', () => {
  if (!saveTimer2) return;
  clearTimeout(saveTimer2);
  saveTimer2 = null;
  try { chrome.runtime.sendMessage({ cmd: 'saveRules', rules }); } catch { /* egal */ }
});

import { send, applyTheme, toast, exportJson, exportBookmarks, importFile, formatDateTime } from './lib/ui.js';
import { getSettings, saveSettings, getRules, saveRules } from './lib/settings.js';
import { DEFAULT_RULES, normalizeRules, parseList, categorize } from './lib/categorize.js';
import { buildItem } from './lib/items.js';

const $ = (id) => document.getElementById(id);
let rules = [];
let rulesDirty = false;

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

for (const id of ['keepActiveTab', 'openOverviewAfterSave', 'fetchPreviews', 'afterOpen', 'theme', 'pageSize',
  'autoEnabled', 'limitEnabled']) {
  $(id).addEventListener('change', scheduleSave);
}
for (const id of ['autoHours', 'limitMax', 'whitelist']) $(id).addEventListener('change', scheduleSave);

async function showAutoLog() {
  const { autoLog } = await chrome.storage.local.get('autoLog');
  $('autoLog').textContent = autoLog && autoLog.at
    ? `Zuletzt automatisch abgelegt: ${autoLog.count} Tabs am ${formatDateTime(autoLog.at)}.` : '';
}

// ------------------------------------------------------------------ Regeln

function renderRules() {
  const box = $('rules');
  const tpl = $('rule-tpl');
  box.replaceChildren();
  rules.forEach((r, i) => {
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.dataset.index = i;
    el.classList.toggle('disabled', !r.enabled);
    el.querySelector('.prio').textContent = `${i + 1}.`;
    el.querySelector('.r-name').value = r.name;
    el.querySelector('.r-scope').value = r.scope;
    el.querySelector('.r-enabled').checked = r.enabled;
    el.querySelector('.r-domains').value = r.domains.join(', ');
    el.querySelector('.r-keywords').value = r.keywords.join(', ');
    el.querySelector('.r-up').disabled = i === 0;
    el.querySelector('.r-down').disabled = i === rules.length - 1;
    box.appendChild(el);
  });
  updateTest();
}

/** Formularinhalt -> rules-Array (ohne zu speichern). */
function readRules() {
  rules = [...$('rules').querySelectorAll('.rule')].map((el, i) => ({
    id: rules[i] ? rules[i].id : `r${Date.now().toString(36)}${i}`,
    name: el.querySelector('.r-name').value.trim(),
    scope: el.querySelector('.r-scope').value,
    enabled: el.querySelector('.r-enabled').checked,
    domains: parseList(el.querySelector('.r-domains').value),
    keywords: parseList(el.querySelector('.r-keywords').value),
  }));
  return rules;
}

function markDirty() {
  rulesDirty = true;
  $('rules-state').textContent = 'Nicht gespeicherte Änderungen';
}

$('rules').addEventListener('input', () => { markDirty(); readRules(); updateTest(); });
$('rules').addEventListener('change', (e) => {
  if (e.target.classList.contains('r-enabled')) e.target.closest('.rule').classList.toggle('disabled', !e.target.checked);
});
$('rules').addEventListener('click', (e) => {
  const el = e.target.closest('.rule');
  if (!el) return;
  readRules();
  const i = Number(el.dataset.index);
  if (e.target.closest('.r-up') && i > 0) [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]];
  else if (e.target.closest('.r-down') && i < rules.length - 1) [rules[i + 1], rules[i]] = [rules[i], rules[i + 1]];
  else if (e.target.closest('.r-del')) {
    if (!confirm(`Regel „${rules[i].name || 'ohne Namen'}“ löschen?`)) return;
    rules.splice(i, 1);
  } else return;
  markDirty();
  renderRules();
});

$('rule-add').addEventListener('click', () => {
  readRules();
  rules.unshift({ id: `r${Date.now().toString(36)}`, name: 'Neue Kategorie', scope: 'alle', enabled: true, domains: [], keywords: [] });
  markDirty();
  renderRules();
  $('rules').querySelector('.r-name').select();
});

$('rules-save').addEventListener('click', async () => {
  readRules();
  const empty = rules.filter((r) => !r.name);
  if (empty.length) { toast('Jede Regel braucht einen Kategorienamen.', { error: true }); return; }
  try {
    rules = await saveRules(rules);
    rulesDirty = false;
    renderRules();
    const r = await send('recategorize');
    $('rules-state').textContent = '';
    toast(`Regeln gespeichert. ${r.changed} Einträge neu zugeordnet.`);
  } catch (e) { showError(e); }
});

$('rules-reset').addEventListener('click', async () => {
  if (!confirm('Alle Regeln durch die Standardregeln ersetzen?')) return;
  rules = normalizeRules(DEFAULT_RULES);
  markDirty();
  renderRules();
  toast('Standardregeln geladen – zum Übernehmen „Regeln speichern“ klicken.');
});

window.addEventListener('beforeunload', (e) => {
  if (rulesDirty) { e.preventDefault(); e.returnValue = ''; }
});

function updateTest() {
  const url = $('test-url').value.trim();
  const title = $('test-title').value.trim();
  if (!url && !title) { $('test-result').textContent = ''; return; }
  const item = buildItem({ url: url || 'https://example.com/', title }) ||
    buildItem({ url: 'https://example.com/', title });
  item.channel = '';
  $('test-result').textContent = `→ ${categorize(item, normalizeRules(rules))}`;
}
$('test-url').addEventListener('input', updateTest);
$('test-title').addEventListener('input', updateTest);

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
  if (changes.items) showStats();
  if (changes.autoLog) showAutoLog();
});

// ------------------------------------------------------------------ Start

(async () => {
  try {
    await loadSettings();
    rules = await getRules();
    renderRules();
    showStats();
    showAutoLog();
  } catch (e) { showError(e); }
})();

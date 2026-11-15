import {
  send, escapeHtml as esc, formatDate, formatDateTime, applyTheme, toast, faviconFor,
  exportJson, exportBookmarks, importFile, icon,
} from './lib/ui.js';
import { getSettings, saveSettings, getRules } from './lib/settings.js';
import { ruleCategoryNames } from './lib/categorize.js';
import { openUrl, displayTitle, dateGroupLabel } from './lib/items.js';
import { formatTimestamp, hashId } from './lib/url.js';

const $ = (id) => document.getElementById(id);
const UI_KEY = 'tabablage.ui';
const OPEN_WARN = 10;

const state = {
  items: [],
  byId: new Map(),
  haystack: new Map(),
  settings: null,
  rules: [],
  selected: new Set(),
  flat: [],          // aktuell gefilterte, sortierte Liste [{ g, it }]
  groupSizes: new Map(),
  lastClickedIndex: -1,
  ui: { view: 'active', type: 'all', category: null, group: 'category', sort: 'newest', search: '', page: 1 },
};
const cardCache = new Map(); // id -> { sig, el }

// ------------------------------------------------------------------ Laden

function loadUi() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    Object.assign(state.ui, saved, { search: '', page: 1 });
  } catch { /* egal */ }
}

function saveUi() {
  try {
    const { view, type, category, group, sort } = state.ui;
    localStorage.setItem(UI_KEY, JSON.stringify({ view, type, category, group, sort }));
  } catch { /* egal */ }
}

function setItems(obj) {
  state.items = Object.values(obj || {});
  state.byId = new Map(state.items.map((it) => [it.id, it]));
  for (const id of [...state.selected]) if (!state.byId.has(id)) state.selected.delete(id);
  for (const id of [...cardCache.keys()]) if (!state.byId.has(id)) cardCache.delete(id);
  state.haystack.clear();
}

function hay(it) {
  let h = state.haystack.get(it.id);
  if (h === undefined) {
    h = [it.title, it.channel, it.domain, it.category, it.description, it.url].join(' ').toLowerCase();
    state.haystack.set(it.id, h);
  }
  return h;
}

// ------------------------------------------------------------------ Filtern, sortieren, gruppieren

function groupKey(it) {
  switch (state.ui.group) {
    case 'category': return it.category || 'Ohne Kategorie';
    case 'channel': return it.channel || (it.type === 'youtube' ? 'Unbekannter Kanal' : it.domain || '–');
    case 'domain': return it.domain || '–';
    case 'date': return dateGroupLabel(it.savedAt);
    default: return '';
  }
}

function compute() {
  const { view, type, category, sort, search } = state.ui;
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  const counts = { active: 0, archived: 0 };
  const catCounts = new Map();
  const base = [];
  for (const it of state.items) {
    if (type !== 'all' && it.type !== type) continue;
    if (tokens.length && !tokens.every((t) => hay(it).includes(t))) continue;
    counts[it.status === 'archived' ? 'archived' : 'active']++;
    if ((it.status === 'archived' ? 'archived' : 'active') !== view) continue;
    const c = it.category || 'Ohne Kategorie';
    catCounts.set(c, (catCounts.get(c) || 0) + 1);
    base.push(it);
  }
  let list = category ? base.filter((it) => (it.category || 'Ohne Kategorie') === category) : base;

  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
  if (sort === 'title') list.sort((a, b) => collator.compare(displayTitle(a), displayTitle(b)));
  else if (sort === 'oldest') list.sort((a, b) => a.savedAt - b.savedAt);
  else list.sort((a, b) => b.savedAt - a.savedAt);

  const groups = new Map();
  for (const it of list) {
    const g = groupKey(it);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  let order = [...groups.keys()];
  if (state.ui.group === 'category') {
    const ruleOrder = ruleCategoryNames(state.rules);
    const idx = (n) => { const i = ruleOrder.indexOf(n); return i < 0 ? 1e6 : i; };
    order.sort((a, b) => idx(a) - idx(b) || collator.compare(a, b));
  } else if (state.ui.group === 'channel' || state.ui.group === 'domain') {
    order.sort((a, b) => groups.get(b).length - groups.get(a).length || collator.compare(a, b));
  } // Datum: Reihenfolge ergibt sich aus der Sortierung
  state.flat = [];
  state.groupSizes = new Map();
  for (const g of order) {
    state.groupSizes.set(g, groups.get(g).length);
    for (const it of groups.get(g)) state.flat.push({ g, it });
  }
  return { counts, catCounts, baseCount: base.length };
}

// ------------------------------------------------------------------ Karten

function hue(str) {
  return parseInt(hashId(str).slice(0, 4), 36) % 360;
}

function fallbackHtml(it) {
  const dom = it.domain || '';
  const letter = esc((dom.replace(/^m\./, '')[0] || '?').toUpperCase());
  const fav = faviconFor(it, 64);
  return `<div class="fallback" style="--h:${hue(dom)}">` +
    (fav ? `<img class="fav-big" src="${esc(fav)}" data-alt="${esc(it.favIconUrl || '')}" alt="" loading="lazy">` : `<div class="letter">${letter}</div>`) +
    `<span class="dom">${esc(dom)}</span></div>`;
}

function catColor(name) {
  const r = state.rules.find((x) => x.name === name);
  return r && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '';
}

function colorStyle(name) {
  const c = catColor(name);
  return c ? ` style="--c:${c}"` : '';
}

function cardSig(it) {
  return `${it.updatedAt}|${it.savedAt}|${it.status}|${catColor(it.category)}`;
}

function buildCard(it) {
  const url = openUrl(it);
  const title = displayTitle(it);
  const thumb = it.thumbnail
    ? `<img class="cover" src="${esc(it.thumbnail)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : fallbackHtml(it);
  const chips = [];
  if (it.t > 0) chips.push(`<span class="chip ts" title="Weiterschauen ab ${formatTimestamp(it.t)}">▶ ${formatTimestamp(it.t)}</span>`);
  if (it.yt && it.yt.kind === 'short') chips.push('<span class="chip kind">Short</span>');
  if (it.yt && it.yt.kind === 'playlist') chips.push('<span class="chip kind">Playlist</span>');
  if (it.unavailable) chips.push('<span class="chip warn">Nicht verfügbar</span>');
  const src = it.type === 'youtube'
    ? `<span class="src" title="Kanal: ${esc(it.channel || 'unbekannt')}">Kanal: ${esc(it.channel || '…')}</span>`
    : `<span class="src" title="${esc(it.domain)}">${esc(it.siteName && it.siteName.length < 40 ? `${it.siteName} · ${it.domain}` : it.domain)}</span>`;
  const archived = it.status === 'archived';
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.id = it.id;
  el.innerHTML =
    `<label class="sel" title="Auswählen"><input type="checkbox" aria-label="Auswählen"></label>` +
    `<a class="thumb" href="${esc(url)}" data-act="open" tabindex="-1" aria-hidden="true">${thumb}${chips.join('')}</a>` +
    `<div class="body">` +
      `<a class="title" href="${esc(url)}" data-act="open" title="${esc(title)}">${esc(title)}</a>` +
      `<div class="meta"><img class="fav" src="${esc(faviconFor(it, 32))}" data-alt="${esc(it.favIconUrl || '')}" alt="" loading="lazy">${src}` +
        `<span class="date" title="Abgelegt am ${esc(formatDateTime(it.savedAt))}">${esc(formatDate(it.savedAt))}</span></div>` +
      `<div class="row">` +
        `<button class="badge${it.manualCategory ? ' manual' : ''}"${colorStyle(it.category)} type="button" data-act="cat" title="Kategorie ändern${it.manualCategory ? ' (manuell gesetzt)' : ''}">${esc(it.category || 'Ohne Kategorie')}</button>` +
        `<span class="acts">` +
          `<button class="icon-btn" type="button" data-act="open" title="Öffnen (Strg+Klick: im Hintergrund)">${icon('open')}</button>` +
          (archived
            ? `<button class="icon-btn" type="button" data-act="restore" title="Zurück in die Ablage">${icon('undo')}</button>`
            : `<button class="icon-btn" type="button" data-act="seen" title="Als gesehen markieren">${icon('check')}</button>`) +
          `<button class="icon-btn del" type="button" data-act="delete" title="Löschen">${icon('trash')}</button>` +
        `</span>` +
      `</div>` +
    `</div>`;
  return el;
}

function cardFor(it) {
  const sig = cardSig(it);
  let c = cardCache.get(it.id);
  if (!c || c.sig !== sig) {
    c = { sig, el: buildCard(it) };
    cardCache.set(it.id, c);
  }
  const sel = state.selected.has(it.id);
  c.el.classList.toggle('selected', sel);
  c.el.querySelector('.sel input').checked = sel;
  return c.el;
}

// ------------------------------------------------------------------ Rendern

let renderTimer = null;
function scheduleRender(delay = 150) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, delay);
}

function pageSize() {
  return Math.max(50, Number(state.settings?.pageSize) || 200);
}

function render() {
  const { counts, catCounts, baseCount } = compute();
  const { ui } = state;

  $('count-active').textContent = counts.active;
  $('count-archived').textContent = counts.archived;
  $('total').textContent = `${state.items.length} Einträge`;
  document.title = `Tab-Ablage (${counts.active})`;
  for (const b of document.querySelectorAll('[data-view]')) b.classList.toggle('on', b.dataset.view === ui.view);
  for (const b of document.querySelectorAll('[data-type]')) {
    b.classList.toggle('on', b.dataset.type === ui.type);
    b.setAttribute('aria-checked', String(b.dataset.type === ui.type));
  }

  // Kategorien
  const ruleOrder = ruleCategoryNames(state.rules);
  const cats = [...catCounts.keys()];
  if (ui.category && !cats.includes(ui.category)) cats.push(ui.category);
  const idx = (n) => { const i = ruleOrder.indexOf(n); return i < 0 ? 1e6 : i; };
  cats.sort((a, b) => idx(a) - idx(b) || a.localeCompare(b, 'de'));
  const catHtml = [`<button class="side-item${ui.category ? '' : ' on'}" type="button" data-cat=""><span>Alle Kategorien</span><b>${baseCount}</b></button>`];
  for (const c of cats) {
    catHtml.push(`<button class="side-item${ui.category === c ? ' on' : ''}" type="button" data-cat="${esc(c)}" title="${esc(c)}"><span><i class="dot"${colorStyle(c)}></i>${esc(c)}</span><b>${catCounts.get(c) || 0}</b></button>`);
  }
  $('cats').innerHTML = catHtml.join('');

  // Seiten
  const size = pageSize();
  const pages = Math.max(1, Math.ceil(state.flat.length / size));
  if (ui.page > pages) ui.page = pages;
  if (ui.page < 1) ui.page = 1;
  const start = (ui.page - 1) * size;
  const slice = state.flat.slice(start, start + size);

  const frag = document.createDocumentFragment();
  let last = null;
  for (const { g, it } of slice) {
    if (ui.group !== 'none' && g !== last) {
      const head = document.createElement('div');
      head.className = 'group-head';
      const cont = last === null && start > 0 && state.flat[start - 1] && state.flat[start - 1].g === g;
      head.innerHTML = `<h3>${esc(g)}${cont ? ' <span class="muted">(Fortsetzung)</span>' : ''}</h3>` +
        `<span class="muted">${state.groupSizes.get(g)}</span>` +
        `<button class="btn small" type="button" data-group-select="${esc(g)}">Gruppe auswählen</button>`;
      frag.appendChild(head);
      last = g;
    }
    frag.appendChild(cardFor(it));
  }
  $('grid').replaceChildren(frag);
  $('grid').classList.toggle('selecting', state.selected.size > 0);

  const empty = slice.length === 0;
  $('empty').hidden = !empty;
  if (empty) {
    $('empty-text').textContent = state.items.length === 0
      ? 'Noch nichts abgelegt. Klicke auf das Tab-Ablage-Symbol in der Symbolleiste und wähle „Alle Tabs ablegen & schließen“.'
      : ui.view === 'archived' ? 'Keine gesehenen Einträge für diese Auswahl.' : 'Keine Treffer für die aktuelle Auswahl.';
  }

  renderPager(pages);
  renderBulk();
}

function renderPager(pages) {
  const html = pages <= 1 ? '' : [
    `<button class="btn small" type="button" data-page="1" ${state.ui.page === 1 ? 'disabled' : ''}>«</button>`,
    `<button class="btn small" type="button" data-page="${state.ui.page - 1}" ${state.ui.page === 1 ? 'disabled' : ''}>‹ Zurück</button>`,
    `<span class="muted">Seite ${state.ui.page} von ${pages} · ${state.flat.length} Einträge</span>`,
    `<button class="btn small" type="button" data-page="${state.ui.page + 1}" ${state.ui.page === pages ? 'disabled' : ''}>Weiter ›</button>`,
    `<button class="btn small" type="button" data-page="${pages}" ${state.ui.page === pages ? 'disabled' : ''}>»</button>`,
  ].join('');
  $('pager-top').innerHTML = html;
  $('pager-bottom').innerHTML = html;
}

function renderBulk() {
  const n = state.selected.size;
  $('bulk').hidden = n === 0;
  if (!n) return;
  $('bulk-count').textContent = `${n} ausgewählt`;
  $('bulk-archive').textContent = state.ui.view === 'archived' ? 'Zurück in die Ablage' : 'Als gesehen';
}

// ------------------------------------------------------------------ Aktionen

async function openIds(ids, { background }) {
  if (!ids.length) return;
  if (ids.length > OPEN_WARN && !confirm(`Wirklich ${ids.length} Tabs öffnen? Viele gleichzeitig geöffnete Tabs können den Browser verlangsamen.`)) return;
  let windowId = null;
  let index = null;
  try {
    const me = await chrome.tabs.getCurrent();
    if (me) { windowId = me.windowId; index = me.index + 1; }
  } catch { /* egal */ }
  try {
    const res = await send('openItems', { ids, active: !background, windowId, index });
    for (const id of ids) state.selected.delete(id);
    if (res.afterOpen === 'remove' && res.items.length) {
      toast(`${res.opened} geöffnet und aus der Liste entfernt.`, { undo: () => send('restoreItems', { items: res.items }).catch(showError) });
    } else if (background || ids.length > 1) {
      toast(`${res.opened} im Hintergrund geöffnet.`);
    }
  } catch (e) {
    showError(e);
  }
}

async function setStatus(ids, status) {
  const prev = ids.map((id) => state.byId.get(id)).filter(Boolean).map((it) => ({ id: it.id, status: it.status }));
  try {
    await send('updateItems', { ids, patch: { status } });
    for (const id of ids) state.selected.delete(id);
    const msg = status === 'archived' ? `${ids.length} als gesehen markiert.` : `${ids.length} zurück in die Ablage.`;
    toast(msg, {
      undo: async () => {
        const back = prev.filter((p) => p.status !== status).map((p) => p.id);
        if (back.length) await send('updateItems', { ids: back, patch: { status: status === 'archived' ? 'active' : 'archived' } }).catch(showError);
      },
    });
  } catch (e) { showError(e); }
}

async function deleteIds(ids) {
  try {
    const res = await send('deleteItems', { ids });
    for (const id of ids) state.selected.delete(id);
    toast(`${res.items.length} gelöscht.`, { undo: () => send('restoreItems', { items: res.items }).catch(showError) });
  } catch (e) { showError(e); }
}

function showError(e) {
  toast(`Fehler: ${e && e.message ? e.message : e}`, { error: true, ms: 8000 });
}

// ------------------------------------------------------------------ Kategorie-Menü

let catmenuIds = [];

function allCategoryNames() {
  const names = ruleCategoryNames(state.rules);
  for (const it of state.items) if (it.category && !names.includes(it.category)) names.push(it.category);
  return names;
}

function openCatmenu(ids, anchor) {
  catmenuIds = ids;
  const current = ids.length === 1 ? state.byId.get(ids[0])?.category : null;
  $('catmenu-list').innerHTML = allCategoryNames()
    .map((n) => `<button type="button" data-catpick="${esc(n)}" class="${n === current ? 'on' : ''}"><i class="dot"${colorStyle(n)}></i>${esc(n)}</button>`).join('');
  const m = $('catmenu');
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth;
  const h = m.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - w - 8);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  m.style.left = `${Math.max(8, left)}px`;
  m.style.top = `${top}px`;
  $('catmenu-input').value = '';
  ($('catmenu-list').querySelector('.on') || $('catmenu-list').firstElementChild || $('catmenu-input')).focus();
}

function closeCatmenu() {
  $('catmenu').hidden = true;
  catmenuIds = [];
}

async function applyCategory(patch) {
  const ids = catmenuIds;
  closeCatmenu();
  if (!ids.length) return;
  try {
    await send('updateItems', { ids, patch });
    toast(patch.resetCategory ? 'Kategorie wird wieder automatisch bestimmt.' : `Kategorie „${patch.category}“ gesetzt (${ids.length}).`);
  } catch (e) { showError(e); }
}

$('catmenu-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-catpick]');
  if (b) applyCategory({ category: b.dataset.catpick });
});
$('catmenu-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('catmenu-input').value.trim();
  if (v) applyCategory({ category: v });
});
$('catmenu-auto').addEventListener('click', () => applyCategory({ resetCategory: true }));
function manageCategories() {
  closeCatmenu();
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html#kategorien') });
}
$('catmenu-manage').addEventListener('click', manageCategories);
$('cats-manage').addEventListener('click', manageCategories);
document.addEventListener('mousedown', (e) => {
  if (!$('catmenu').hidden && !e.target.closest('#catmenu') && !e.target.closest('[data-act="cat"]') && !e.target.closest('#bulk-category')) closeCatmenu();
});

// ------------------------------------------------------------------ Ereignisse: Karten

const grid = $('grid');

function idOf(el) {
  const card = el.closest('.card');
  return card ? card.dataset.id : null;
}

function pageIds() {
  const size = pageSize();
  const start = (state.ui.page - 1) * size;
  return state.flat.slice(start, start + size).map((x) => x.it.id);
}

grid.addEventListener('click', (e) => {
  const groupBtn = e.target.closest('[data-group-select]');
  if (groupBtn) {
    const g = groupBtn.dataset.groupSelect;
    for (const { g: gg, it } of state.flat) if (gg === g) state.selected.add(it.id);
    render();
    return;
  }
  const box = e.target.closest('.sel input');
  if (box) {
    const id = idOf(box);
    const ids = pageIds();
    const i = ids.indexOf(id);
    if (e.shiftKey && state.lastClickedIndex >= 0 && i >= 0) {
      const [a, b] = [Math.min(i, state.lastClickedIndex), Math.max(i, state.lastClickedIndex)];
      for (const x of ids.slice(a, b + 1)) { if (box.checked) state.selected.add(x); else state.selected.delete(x); }
    } else if (box.checked) state.selected.add(id);
    else state.selected.delete(id);
    state.lastClickedIndex = i;
    render();
    return;
  }
  const actEl = e.target.closest('[data-act]');
  if (!actEl) return;
  const id = idOf(actEl);
  if (!id) return;
  const act = actEl.dataset.act;
  if (act === 'open') {
    e.preventDefault();
    openIds([id], { background: e.ctrlKey || e.metaKey || e.shiftKey });
  } else if (act === 'cat') {
    openCatmenu([id], actEl);
  } else if (act === 'seen') {
    setStatus([id], 'archived');
  } else if (act === 'restore') {
    setStatus([id], 'active');
  } else if (act === 'delete') {
    deleteIds([id]);
  }
});

grid.addEventListener('auxclick', (e) => {
  if (e.button !== 1) return;
  const a = e.target.closest('[data-act="open"]');
  if (!a) return;
  e.preventDefault();
  const id = idOf(a);
  if (id) openIds([id], { background: true });
});

// Kaputte Bilder: Vorschaubild -> Ersatzkarte, Favicon -> gespeicherte URL -> ausblenden
grid.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.classList.contains('cover')) {
    const it = state.byId.get(idOf(img));
    if (it) img.outerHTML = fallbackHtml(it);
    return;
  }
  const alt = img.dataset.alt;
  if (alt && img.src !== alt) { img.dataset.alt = ''; img.src = alt; return; }
  if (img.classList.contains('fav-big')) {
    const letter = document.createElement('div');
    letter.className = 'letter';
    const it = state.byId.get(idOf(img));
    letter.textContent = ((it && it.domain) || '?')[0].toUpperCase();
    img.replaceWith(letter);
  } else {
    img.style.visibility = 'hidden';
  }
}, true);

// ------------------------------------------------------------------ Ereignisse: Filter & Werkzeuge

function setUi(patch, { resetPage = true, clearSel = true } = {}) {
  Object.assign(state.ui, patch);
  if (resetPage) state.ui.page = 1;
  if (clearSel) { state.selected.clear(); state.lastClickedIndex = -1; }
  saveUi();
  render();
  window.scrollTo({ top: 0 });
}

document.querySelector('.views').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (b) setUi({ view: b.dataset.view });
});
document.querySelector('.seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-type]');
  if (b) setUi({ type: b.dataset.type });
});
$('cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (b) setUi({ category: b.dataset.cat || null });
});
$('sort').addEventListener('change', (e) => setUi({ sort: e.target.value }, { clearSel: false }));
$('group').addEventListener('change', (e) => setUi({ group: e.target.value }, { clearSel: false }));
let searchTimer = null;
$('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => setUi({ search: e.target.value }, { clearSel: false }), 150);
});
for (const id of ['pager-top', 'pager-bottom']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    setUi({ page: Number(b.dataset.page) }, { resetPage: false, clearSel: false });
  });
}
$('after-open').addEventListener('change', async (e) => {
  state.settings = await saveSettings({ afterOpen: e.target.value });
  toast('Einstellung gespeichert.');
});

$('btn-recat').addEventListener('click', async () => {
  try {
    const r = await send('recategorize');
    toast(`Neu kategorisiert: ${r.changed} Einträge geändert (manuelle Zuordnungen bleiben erhalten).`);
  } catch (e) { showError(e); }
});
$('btn-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
const menu = document.querySelector('.menu');
function closeMenu() { menu.open = false; }
$('btn-export-json').addEventListener('click', async () => {
  closeMenu();
  try { const n = await exportJson(); toast(`${n} Einträge exportiert.`); } catch (e) { showError(e); }
});
$('btn-export-html').addEventListener('click', async () => {
  closeMenu();
  try { await exportBookmarks(); toast('Lesezeichen-Datei erstellt.'); } catch (e) { showError(e); }
});
$('btn-import').addEventListener('click', () => { closeMenu(); $('file-import').click(); });
$('btn-retry').addEventListener('click', async () => {
  closeMenu();
  try { await send('retryEnrich'); toast('Vorschauen werden im Hintergrund nachgeladen.'); } catch (e) { showError(e); }
});
$('file-import').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const r = await importFile(file);
    toast(`Import: ${r.added} neu, ${r.updated} aktualisiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, { ms: 8000 });
  } catch (err) { showError(err); }
});
document.addEventListener('click', (e) => { if (menu.open && !e.target.closest('.menu')) closeMenu(); });

// Sammelaktionen
const selectedIds = () => [...state.selected].filter((id) => state.byId.has(id));
$('bulk-open').addEventListener('click', () => openIds(selectedIds(), { background: true }));
$('bulk-archive').addEventListener('click', () => setStatus(selectedIds(), state.ui.view === 'archived' ? 'active' : 'archived'));
$('bulk-delete').addEventListener('click', () => {
  const ids = selectedIds();
  if (ids.length > 1 && !confirm(`${ids.length} Einträge löschen?`)) return;
  deleteIds(ids);
});
$('bulk-category').addEventListener('click', (e) => openCatmenu(selectedIds(), e.currentTarget));
$('bulk-page').addEventListener('click', () => { for (const id of pageIds()) state.selected.add(id); render(); });
$('bulk-all').addEventListener('click', () => { for (const { it } of state.flat) state.selected.add(it.id); render(); });
$('bulk-none').addEventListener('click', () => { state.selected.clear(); render(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('catmenu').hidden) { closeCatmenu(); return; }
    if (state.selected.size) { state.selected.clear(); render(); }
  } else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
    e.preventDefault();
    $('search').focus();
  }
});

// ------------------------------------------------------------------ Live-Aktualisierung

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.items) {
    setItems(changes.items.newValue || {});
    scheduleRender();
  }
  if (changes.settings) {
    getSettings().then((s) => {
      state.settings = s;
      applyTheme(s.theme);
      $('after-open').value = s.afterOpen;
      scheduleRender();
    });
  }
  if (changes.rules) getRules().then((r) => { state.rules = r; scheduleRender(0); });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'job') return;
  const job = msg.job;
  const box = $('job');
  box.hidden = false;
  const pct = job.total ? Math.round((job.done / job.total) * 100) : (job.phase === 'fertig' ? 100 : 5);
  $('job-bar').style.width = `${Math.min(100, pct)}%`;
  $('job-text').textContent = job.phase === 'fertig' ? (job.message || 'Fertig.')
    : job.phase === 'fehler' ? `Fehler: ${job.message}`
      : job.phase === 'schließen' ? `Schließe Tabs: ${job.closed} / ${job.total}` : 'Tabs werden abgelegt …';
  if (job.phase === 'fertig' || job.phase === 'fehler') setTimeout(() => { box.hidden = true; }, 5000);
});

// ------------------------------------------------------------------ Start

async function init() {
  loadUi();
  const [settings, rules, store] = await Promise.all([getSettings(), getRules(), chrome.storage.local.get('items')]);
  state.settings = settings;
  state.rules = rules;
  applyTheme(settings.theme);
  setItems(store.items);
  $('sort').value = state.ui.sort;
  $('group').value = state.ui.group;
  $('after-open').value = settings.afterOpen;
  render();
}

init().catch(showError);

// Service Worker: Ablegen, Schließen, Anreichern, Automatik, Kontextmenü.
// Alle Änderungen an `items` laufen über diesen Worker (ein Schreiber, gebündelte Writes).

import { buildItem, mergeResave, openUrl, mergeImport } from './lib/items.js';
import { categorize } from './lib/categorize.js';
import { isSaveableUrl, isYouTubeUrl, getDomain, domainInList, sanitizeImageUrl, cleanTitle } from './lib/url.js';
import { extractMetaFromHtml } from './lib/meta.js';
import { getSettings, getRules, saveSettings } from './lib/settings.js';
import { normalizeRules, DEFAULT_RULES } from './lib/categorize.js';
import {
  migrateRules, applyRenames, renameCategoryInRules, deleteCategoryFromRules, reassignItems, ensureCategories,
} from './lib/categories.js';
import { buildCategoryMenus, parseMenuItemId, MENU } from './lib/menus.js';

const OWN_PREFIX = chrome.runtime.getURL('');
const OVERVIEW_URL = chrome.runtime.getURL('overview.html');
const PROBE_TIMEOUT = 1500;
const PROBE_CONCURRENCY = 6;
const PROBE_BUDGET_MS = 20000;   // danach werden restliche Tabs ohne Vorschau geschlossen
const OEMBED_TIMEOUT = 5000;
const FETCH_TIMEOUT = 6000;
const FETCH_MAX_BYTES = 400 * 1024;
const MAX_ENRICH_TRIES = 3;

// ------------------------------------------------------------------ Speicher (gebündelt)

const store = { items: null, loading: null, dirty: false, timer: null, chain: Promise.resolve() };

function ensureLoaded() {
  if (!store.loading) {
    store.loading = chrome.storage.local.get('items').then((r) => {
      store.items = r.items && typeof r.items === 'object' ? r.items : {};
    });
  }
  return store.loading;
}

function scheduleFlush(delay = 800) {
  store.dirty = true;
  if (store.timer) return;
  store.timer = setTimeout(() => { store.timer = null; flush(); }, delay);
}

function flush() {
  if (store.timer) { clearTimeout(store.timer); store.timer = null; }
  store.chain = store.chain.then(async () => {
    if (!store.dirty || !store.items) return;
    store.dirty = false;
    try {
      await chrome.storage.local.set({ items: store.items });
    } catch (e) {
      store.dirty = true;
      throw e;
    }
  });
  return store.chain;
}

// ------------------------------------------------------------------ Hilfen

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms) {
  return Promise.race([promise, sleep(ms).then(() => { throw new Error('timeout'); })]);
}

async function pool(list, limit, worker, shouldStop) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) {
      if (shouldStop && shouldStop()) return;
      const idx = i++;
      try { await worker(list[idx], idx); } catch { /* einzelne Fehler tolerieren */ }
    }
  });
  await Promise.all(runners);
}

function isOwnUrl(url) {
  return String(url || '').startsWith(OWN_PREFIX);
}

function tabUrl(tab) {
  return tab.url || tab.pendingUrl || '';
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => { /* niemand hört zu */ });
}

// ------------------------------------------------------------------ Job-Status / Fortschritt

let job = null;          // aktueller Ablege-Vorgang
let jobQueue = Promise.resolve();
let lastBroadcast = 0;

function updateJob(patch, force = false) {
  if (!job) return;
  Object.assign(job, patch);
  const now = Date.now();
  if (force || now - lastBroadcast > 120) {
    lastBroadcast = now;
    broadcast({ type: 'job', job: { ...job } });
  }
}

function enqueueJob(fn) {
  const run = jobQueue.then(fn, fn);
  jobQueue = run.catch(() => {});
  return run;
}

// ------------------------------------------------------------------ Übersicht

async function findOverviewTab() {
  const tabs = await chrome.tabs.query({ url: OVERVIEW_URL + '*' });
  return tabs[0] || null;
}

async function ensureOverview({ windowId, active }) {
  let tab = await findOverviewTab();
  if (!tab) {
    const props = { url: OVERVIEW_URL, active: !!active };
    if (windowId != null) props.windowId = windowId;
    try {
      tab = await chrome.tabs.create(props);
    } catch {
      tab = await chrome.tabs.create({ url: OVERVIEW_URL, active: !!active });
    }
  } else if (active) {
    await chrome.tabs.update(tab.id, { active: true });
  }
  if (active && tab) {
    try { await chrome.windows.update(tab.windowId, { focused: true }); } catch { /* egal */ }
  }
  return tab;
}

// ------------------------------------------------------------------ Seiten-Vorschau (im offenen Tab)

/** Läuft im Tab. Muss eigenständig sein (keine Closures). */
function pageProbe() {
  const pick = (sel, attr) => {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute(attr) || '').trim() : '';
  };
  const img = pick('meta[property="og:image"]', 'content') || pick('meta[property="og:image:url"]', 'content') ||
    pick('meta[name="twitter:image"]', 'content') || pick('meta[name="twitter:image:src"]', 'content') ||
    pick('meta[property="twitter:image"]', 'content') || pick('link[rel="image_src"]', 'href');
  let image = '';
  try { image = img ? new URL(img, location.href).href : ''; } catch { image = ''; }
  const out = {
    image,
    description: (pick('meta[property="og:description"]', 'content') || pick('meta[name="description"]', 'content')).slice(0, 400),
    ogTitle: pick('meta[property="og:title"]', 'content').slice(0, 400),
    siteName: pick('meta[property="og:site_name"]', 'content').slice(0, 100),
    t: 0,
    channel: '',
  };
  if (/(^|\.)youtube\.com$/.test(location.hostname)) {
    const v = document.querySelector('video');
    if (v && Number.isFinite(v.currentTime)) {
      const ct = Math.floor(v.currentTime);
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (ct >= 10 && (!dur || dur - ct > 15)) out.t = ct;
    }
    const ch = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner #channel-name a, ytd-video-owner-renderer #channel-name a');
    out.channel = ch ? ch.textContent.trim().slice(0, 200) : '';
  }
  return out;
}

async function probeTab(tabId) {
  const res = await withTimeout(chrome.scripting.executeScript({ target: { tabId }, func: pageProbe }), PROBE_TIMEOUT);
  return res && res[0] ? res[0].result : null;
}

function applyProbe(item, data) {
  if (!item || !data) return;
  if (item.type === 'youtube') {
    if (data.t > 0 && item.yt && item.yt.kind === 'video') item.t = data.t;
    if (data.channel && !item.channel) item.channel = data.channel;
    return; // Titel/Kanal kommen zuverlässig über oEmbed
  }
  const img = sanitizeImageUrl(data.image);
  if (img) item.thumbnail = img;
  if (data.description) item.description = data.description.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (data.siteName) item.siteName = data.siteName;
  if (!item.title && data.ogTitle) item.title = cleanTitle(data.ogTitle);
  item.enriched = true;
}

// ------------------------------------------------------------------ Ablegen & Schließen

async function closeTabs(ids) {
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    try {
      await chrome.tabs.remove(chunk);
    } catch {
      for (const id of chunk) {
        try { await chrome.tabs.remove(id); } catch { /* schon zu */ }
      }
    }
  }
}

/**
 * Legt Tabs ab und schließt sie.
 * 1. Einträge bauen + sofort speichern  2. Vorschau aus offenen Tabs lesen (kurz, begrenzt) und
 * Tab direkt danach schließen  3. Anreicherung (oEmbed, Seitenabruf) läuft im Hintergrund weiter.
 */
async function saveTabs(tabs, opts = {}) {
  const { source = 'tab', openOverview = false, overviewWindowId = null, scope = 'tab' } = opts;
  job = { id: Date.now(), scope, phase: 'sammeln', total: tabs.length, done: 0, saved: 0, added: 0, closed: 0, message: '' };
  updateJob({}, true);
  try {
    await ensureLoaded();
    const rules = await getRules();
    const now = Date.now();
    const tabToItem = new Map();
    let added = 0;
    const ids = new Set();
    for (const tab of tabs) {
      const rec = buildItem({ url: tabUrl(tab), title: tab.title, favIconUrl: tab.favIconUrl, source }, now);
      if (!rec) continue;
      const ex = store.items[rec.id];
      if (ex) {
        mergeResave(ex, rec, now);
        if (!ex.manualCategory) ex.category = categorize(ex, rules);
      } else {
        rec.category = categorize(rec, rules);
        store.items[rec.id] = rec;
        added++;
      }
      ids.add(rec.id);
      tabToItem.set(tab.id, rec.id);
    }
    updateJob({ phase: 'speichern', saved: ids.size, added });
    store.dirty = true;
    await flush(); // erst speichern, dann schließen

    const closable = tabs.filter((t) => tabToItem.has(t.id));
    if (openOverview || (await wouldCloseEverything(closable))) {
      await ensureOverview({ windowId: overviewWindowId, active: false });
    }

    updateJob({ phase: 'schließen', total: closable.length, done: 0 }, true);
    const quick = [];
    const live = [];
    for (const t of closable) {
      if (!t.discarded && t.status !== 'unloaded' && /^https?:/i.test(tabUrl(t))) live.push(t); else quick.push(t);
    }
    let closed = 0;
    await closeTabs(quick.map((t) => t.id));
    closed += quick.length;
    updateJob({ closed, done: closed });

    const started = Date.now();
    const overBudget = () => Date.now() - started > PROBE_BUDGET_MS;
    const probed = new Set();
    await pool(live, PROBE_CONCURRENCY, async (t) => {
      let data = null;
      try { data = await probeTab(t.id); } catch { data = null; }
      probed.add(t.id);
      const item = store.items[tabToItem.get(t.id)];
      if (data) applyProbe(item, data);
      await closeTabs([t.id]);
      closed++;
      updateJob({ closed, done: closed });
    }, overBudget);
    const rest = live.filter((t) => !probed.has(t.id));
    if (rest.length) {
      await closeTabs(rest.map((t) => t.id));
      closed += rest.length;
    }
    scheduleFlush(0);
    await flush();
    updateJob({ phase: 'fertig', closed, done: closed, message: `${ids.size} abgelegt, ${closed} Tabs geschlossen` }, true);

    if (openOverview) await ensureOverview({ windowId: overviewWindowId, active: true });
    enrichPending(); // nicht abwarten
    return { saved: ids.size, added, closed };
  } catch (e) {
    updateJob({ phase: 'fehler', message: String(e && e.message || e) }, true);
    throw e;
  } finally {
    setTimeout(() => { if (job && (job.phase === 'fertig' || job.phase === 'fehler')) job = null; }, 4000);
  }
}

/** Würden nach dem Schließen keine Tabs mehr offen sein (Browser würde sich beenden)? */
async function wouldCloseEverything(closable) {
  const all = await chrome.tabs.query({});
  const closing = new Set(closable.map((t) => t.id));
  return all.every((t) => closing.has(t.id));
}

function isCandidate(tab, settings, opts = {}) {
  const url = tabUrl(tab);
  if (tab.pinned) return false;
  if (!isSaveableUrl(url) || isOwnUrl(url)) return false;
  if (opts.excludeTabId != null && tab.id === opts.excludeTabId) return false;
  return true;
}

async function collectTabs(scope, { windowId, tabId } = {}) {
  const settings = await getSettings();
  let tabs;
  if (scope === 'tab') {
    const t = tabId != null ? await chrome.tabs.get(tabId) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    tabs = t ? [t] : [];
    return tabs.filter((t) => isSaveableUrl(tabUrl(t)) && !isOwnUrl(tabUrl(t)));
  }
  if (scope === 'right') {
    const t = await chrome.tabs.get(tabId);
    tabs = (await chrome.tabs.query({ windowId: t.windowId })).filter((x) => x.index > t.index);
    return tabs.filter((x) => isCandidate(x, settings));
  }
  tabs = scope === 'window' ? await chrome.tabs.query({ windowId }) : await chrome.tabs.query({ windowType: 'normal' });
  let excludeTabId = null;
  if (settings.keepActiveTab) {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active) excludeTabId = active.id;
  }
  tabs = tabs.filter((t) => isCandidate(t, settings, { excludeTabId }));
  if (scope === 'youtube') tabs = tabs.filter((t) => isYouTubeUrl(tabUrl(t)));
  return tabs;
}

async function runSave(scope, params = {}) {
  return enqueueJob(async () => {
    const settings = await getSettings();
    const tabs = await collectTabs(scope, params);
    const bulk = scope === 'all' || scope === 'window' || scope === 'youtube';
    let overviewWindowId = params.windowId ?? null;
    if (overviewWindowId == null) {
      try { overviewWindowId = (await chrome.windows.getLastFocused({ windowTypes: ['normal'] })).id; } catch { /* egal */ }
    }
    if (!tabs.length) {
      job = { id: Date.now(), scope, phase: 'fertig', total: 0, done: 0, saved: 0, added: 0, closed: 0, message: 'Keine passenden Tabs gefunden.' };
      updateJob({}, true);
      job = null;
      return { saved: 0, added: 0, closed: 0 };
    }
    return saveTabs(tabs, {
      scope,
      source: params.source || 'tab',
      openOverview: bulk && settings.openOverviewAfterSave,
      overviewWindowId,
    });
  });
}

async function saveLink(url, title) {
  await ensureLoaded();
  const rules = await getRules();
  const rec = buildItem({ url, title, source: 'link' });
  if (!rec) return null;
  const ex = store.items[rec.id];
  if (ex) mergeResave(ex, rec);
  else {
    rec.category = categorize(rec, rules);
    store.items[rec.id] = rec;
  }
  store.dirty = true;
  await flush();
  enrichPending();
  return rec.id;
}

// ------------------------------------------------------------------ Anreicherung (nach dem Schließen)

let enriching = false;

async function fetchJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    return { status: r.status, data: r.ok ? await r.json() : null };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlHead(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, credentials: 'omit', redirect: 'follow' });
    if (!r.ok) return { status: r.status, html: '' };
    const type = r.headers.get('content-type') || '';
    if (!/html/i.test(type)) { try { await r.body?.cancel(); } catch { /* egal */ } return { status: r.status, html: '' }; }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let html = '';
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += dec.decode(value, { stream: true });
      if (bytes > FETCH_MAX_BYTES || /<\/head\s*>/i.test(html)) { try { await reader.cancel(); } catch { /* egal */ } break; }
    }
    return { status: r.status, html, finalUrl: r.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function enrichYouTube(item) {
  const target = item.yt.videoId
    ? `https://www.youtube.com/watch?v=${item.yt.videoId}`
    : `https://www.youtube.com/playlist?list=${item.yt.playlistId}`;
  const { status, data } = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`, OEMBED_TIMEOUT);
  if (data) {
    if (data.title) item.title = cleanTitle(data.title).slice(0, 500);
    if (data.author_name) item.channel = String(data.author_name).slice(0, 200);
    if (!item.thumbnail && data.thumbnail_url) item.thumbnail = sanitizeImageUrl(data.thumbnail_url);
    item.enriched = true;
  } else if (status === 404) {
    item.unavailable = true;
    item.enriched = true;
  } else if (status >= 400 && status < 500) {
    item.enriched = true; // z. B. Einbetten deaktiviert – Video existiert, Daten aber nicht abrufbar
  }
}

async function enrichWeb(item) {
  const { status, html, finalUrl } = await fetchHtmlHead(item.url, FETCH_TIMEOUT);
  if (html) {
    const meta = extractMetaFromHtml(html, finalUrl || item.url);
    if (!item.thumbnail && meta.image) item.thumbnail = meta.image;
    if (!item.description && meta.description) item.description = meta.description;
    if (!item.siteName && meta.siteName) item.siteName = meta.siteName;
    if (!item.title && meta.title) item.title = cleanTitle(meta.title);
    item.enriched = true;
  } else if (status && status !== 429 && status < 500) {
    item.enriched = true;
  }
}

async function enrichPending() {
  if (enriching) return;
  enriching = true;
  try {
    await ensureLoaded();
    const settings = await getSettings();
    const rules = await getRules();
    const pending = Object.values(store.items).filter((it) =>
      !it.enriched && (it.enrichTries || 0) < MAX_ENRICH_TRIES && (it.type === 'youtube' || settings.fetchPreviews));
    if (!pending.length) return;
    pending.sort((a, b) => b.savedAt - a.savedAt);
    let changed = 0;
    await pool(pending, 6, async (it) => {
      it.enrichTries = (it.enrichTries || 0) + 1;
      try {
        if (it.type === 'youtube' && it.yt) await enrichYouTube(it);
        else await enrichWeb(it);
      } catch { /* Netzwerkfehler: später erneut */ }
      const cur = store.items[it.id];
      if (cur !== it) return; // inzwischen gelöscht
      if (!it.manualCategory) it.category = categorize(it, rules);
      it.updatedAt = Date.now();
      changed++;
      scheduleFlush(changed % 25 === 0 ? 0 : 1500);
    });
    await flush();
  } finally {
    enriching = false;
  }
}

// ------------------------------------------------------------------ Bearbeitung durch Übersicht/Optionen

async function updateItems(ids, patch) {
  if (typeof patch.category === 'string' && patch.category.trim()) {
    await addMissingCategories([patch.category.trim().slice(0, 60)]); // neue Kategorie aus der Übersicht
  }
  await ensureLoaded();
  const rules = await getRules();
  const now = Date.now();
  let n = 0;
  for (const id of ids || []) {
    const it = store.items[id];
    if (!it) continue;
    if ('status' in patch && ['active', 'archived'].includes(patch.status)) {
      it.status = patch.status;
      it.archivedAt = patch.status === 'archived' ? now : 0;
    }
    if (patch.resetCategory) {
      it.manualCategory = false;
      it.category = categorize(it, rules);
    } else if (typeof patch.category === 'string' && patch.category.trim()) {
      it.category = patch.category.trim().slice(0, 60);
      it.manualCategory = true;
    }
    it.updatedAt = now;
    n++;
  }
  store.dirty = true;
  await flush();
  return n;
}

async function deleteItems(ids) {
  await ensureLoaded();
  const removed = [];
  for (const id of ids || []) {
    if (store.items[id]) { removed.push(store.items[id]); delete store.items[id]; }
  }
  store.dirty = true;
  await flush();
  return removed;
}

async function restoreItems(list) {
  await ensureLoaded();
  for (const it of list || []) if (it && it.id && it.url) store.items[it.id] = it;
  store.dirty = true;
  await flush();
  return (list || []).length;
}

async function recategorizeAll() {
  await ensureLoaded();
  const rules = await getRules();
  let changed = 0;
  for (const it of Object.values(store.items)) {
    if (it.manualCategory) continue;
    const c = categorize(it, rules);
    if (c !== it.category) { it.category = c; changed++; }
  }
  store.dirty = true;
  await flush();
  return changed;
}

async function openItems(ids, { active = false, windowId = null, index = null } = {}) {
  await ensureLoaded();
  const settings = await getSettings();
  const list = (ids || []).map((id) => store.items[id]).filter(Boolean);
  let first = true;
  let idx = index;
  for (const it of list) {
    const props = { url: openUrl(it), active: active && first };
    if (windowId != null) props.windowId = windowId;
    if (idx != null) props.index = idx++;
    try { await chrome.tabs.create(props); } catch {
      try { await chrome.tabs.create({ url: openUrl(it), active: active && first }); } catch { continue; }
    }
    first = false;
  }
  const now = Date.now();
  if (settings.afterOpen === 'remove') {
    for (const it of list) delete store.items[it.id];
  } else if (settings.afterOpen === 'archive') {
    for (const it of list) { it.status = 'archived'; it.archivedAt = now; it.updatedAt = now; }
  }
  if (settings.afterOpen !== 'keep') { store.dirty = true; await flush(); }
  return { opened: list.length, afterOpen: settings.afterOpen, items: settings.afterOpen === 'remove' ? list : [] };
}

async function importData(rawList) {
  await addMissingCategories((rawList || []).map((r) => (typeof r.category === 'string' ? r.category.trim().slice(0, 60) : '')));
  await ensureLoaded();
  const rules = await getRules();
  const res = mergeImport(store.items, rawList, rules);
  store.dirty = true;
  await flush();
  enrichPending();
  return res;
}

async function clearAll() {
  await ensureLoaded();
  store.items = {};
  store.dirty = true;
  await flush();
}

async function retryEnrich() {
  await ensureLoaded();
  for (const it of Object.values(store.items)) if (!it.enriched) it.enrichTries = 0;
  enrichPending();
}

// ------------------------------------------------------------------ Automatik

async function getLastActiveMap() {
  try {
    const r = await chrome.storage.session.get('lastActive');
    return r.lastActive || {};
  } catch {
    return {};
  }
}

let lastActiveTimer = null;
const lastActivePending = {};
function noteActive(tabId) {
  lastActivePending[tabId] = Date.now();
  if (lastActiveTimer) return;
  lastActiveTimer = setTimeout(async () => {
    lastActiveTimer = null;
    const map = await getLastActiveMap();
    Object.assign(map, lastActivePending);
    for (const k of Object.keys(lastActivePending)) delete lastActivePending[k];
    try { await chrome.storage.session.set({ lastActive: map }); } catch { /* egal */ }
  }, 2000);
}

async function autoCheck() {
  const s = await getSettings();
  if (!s.autoArchive.enabled && !s.tabLimit.enabled) return;
  if (job) return; // gerade läuft schon ein Vorgang
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const map = await getLastActiveMap();
  let mapChanged = false;
  const lastUse = (t) => {
    if (t.lastAccessed) return t.lastAccessed;
    if (!map[t.id]) { map[t.id] = now; mapChanged = true; }
    return map[t.id];
  };
  const candidates = tabs.filter((t) => !t.pinned && !t.audible && !t.active &&
    isSaveableUrl(tabUrl(t)) && !isOwnUrl(tabUrl(t)) && !domainInList(getDomain(tabUrl(t)), s.whitelist));
  const chosen = new Map();
  if (s.autoArchive.enabled) {
    const limitMs = Math.max(0.25, Number(s.autoArchive.hours) || 6) * 3600000;
    for (const t of candidates) if (now - lastUse(t) >= limitMs) chosen.set(t.id, t);
  }
  if (s.tabLimit.enabled) {
    const max = Math.max(1, Number(s.tabLimit.max) || 50);
    const excess = tabs.length - chosen.size - max;
    if (excess > 0) {
      const rest = candidates.filter((t) => !chosen.has(t.id)).sort((a, b) => lastUse(a) - lastUse(b));
      for (const t of rest.slice(0, excess)) chosen.set(t.id, t);
    }
  }
  if (mapChanged) { try { await chrome.storage.session.set({ lastActive: map }); } catch { /* egal */ } }
  if (!chosen.size) return;
  const list = [...chosen.values()];
  await enqueueJob(() => saveTabs(list, { source: 'auto', scope: 'auto', openOverview: false }));
  try {
    await chrome.storage.local.set({ autoLog: { at: Date.now(), count: list.length } });
  } catch { /* egal */ }
}

function ensureAlarm() {
  chrome.alarms.get('auto', (a) => {
    if (!a) chrome.alarms.create('auto', { periodInMinutes: 15, delayInMinutes: 1 });
  });
}

// ------------------------------------------------------------------ Kategorien (Regeln)

let rulesChain = Promise.resolve();
/** Serialisiert alle Änderungen an `rules` (und zugehörige Änderungen an `items`). */
function withRules(fn) {
  const run = rulesChain.then(async () => {
    await ensureMigrated();
    return fn(await getRules());
  });
  rulesChain = run.catch(() => {});
  return run;
}

async function writeRules(rules) {
  const norm = normalizeRules(rules);
  await chrome.storage.local.set({ rules: norm });
  return norm;
}

let migrated = null;
/** Einmalige Migration der Regeln (neue Standardkategorien, "Finanzen/Börse" -> "Finanzen"). */
function ensureMigrated() {
  if (!migrated) {
    migrated = (async () => {
      const r = await chrome.storage.local.get(['rules', 'rulesVersion']);
      const res = migrateRules(r.rules, r.rulesVersion);
      if (!res.changed && r.rulesVersion === res.version) return;
      await chrome.storage.local.set({ rules: res.rules, rulesVersion: res.version });
      if (Object.keys(res.renames).length) {
        await ensureLoaded();
        if (applyRenames(store.items, res.renames)) { store.dirty = true; await flush(); }
      }
    })().catch(() => { migrated = null; });
  }
  return migrated;
}

/** Kategorien, die nur an Einträgen hängen (Übersicht, Import), als leere Kategorien ergänzen. */
async function addMissingCategories(names) {
  const wanted = [...new Set((names || []).filter(Boolean))];
  if (!wanted.length) return;
  await withRules(async (rules) => {
    const res = ensureCategories(rules, wanted);
    if (res.added) await writeRules(res.rules);
  });
}

async function saveRulesAndRecategorize(rules) {
  await withRules(async () => writeRules(rules));
  return recategorizeAll();
}

async function renameCategory(id, newName) {
  return withRules(async (rules) => {
    const res = renameCategoryInRules(rules, id, newName);
    await writeRules(res.rules);
    await ensureLoaded();
    const n = applyRenames(store.items, { [res.oldName]: res.newName });
    if (n) { store.dirty = true; await flush(); }
    return { renamed: n, oldName: res.oldName, newName: res.newName };
  });
}

async function deleteCategory(id, target) {
  return withRules(async (rules) => {
    const res = deleteCategoryFromRules(rules, id);
    let next = res.rules;
    if (target) next = ensureCategories(next, [target]).rules;
    next = await writeRules(next);
    await ensureLoaded();
    const n = reassignItems(store.items, res.name, target || null, next);
    if (n) { store.dirty = true; await flush(); }
    return { moved: n, name: res.name };
  });
}

// ------------------------------------------------------------------ Kontextmenü

const menuState = { chain: Promise.resolve(), lastBuilt: [] };

function createMenu(props) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(props, () => { void chrome.runtime.lastError; resolve(); });
  });
}

/** Baut alle Menüs neu auf (serialisiert: removeAll, dann create – keine doppelten IDs). */
function rebuildMenus() {
  menuState.chain = menuState.chain.then(async () => {
    await ensureMigrated();
    const [rules, settings] = await Promise.all([getRules(), getSettings()]);
    await new Promise((r) => chrome.contextMenus.removeAll(() => { void chrome.runtime.lastError; r(); }));
    const all = [
      { id: 'save-tab', title: 'Tab ablegen', contexts: ['page', 'frame', 'selection', 'image', 'video', 'audio'] },
      { id: 'save-right', title: 'Alle Tabs rechts davon ablegen', contexts: ['page', 'frame', 'selection'] },
      { id: 'save-link', title: 'Link für später ablegen', contexts: ['link'] },
      ...buildCategoryMenus(rules, { closeAfterFile: settings.closeAfterFile }),
      { id: 'action-overview', title: 'Übersicht öffnen', contexts: ['action'] },
      { id: 'action-save-all', title: 'Alle Tabs ablegen & schließen', contexts: ['action'] },
    ];
    for (const m of all) await createMenu(m);
    menuState.lastBuilt = all.map((m) => m.id);
  }).catch(() => {});
  return menuState.chain;
}

let badgeTimer = null;
/** Kurze Rückmeldung am Symbol (ohne zusätzliche Berechtigung wie "notifications"). */
function flashBadge(text, color, title) {
  clearTimeout(badgeTimer);
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => {});
  chrome.action.setBadgeText({ text }).catch(() => {});
  if (title) chrome.action.setTitle({ title: `Tab-Ablage – ${title}` }).catch(() => {});
  badgeTimer = setTimeout(() => {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
    chrome.action.setTitle({ title: 'Tab-Ablage' }).catch(() => {});
  }, title ? 4000 : 2000);
}

/**
 * Legt ein YouTube-Video in einer bestimmten Kategorie ab (manuelle Zuordnung) bzw. nach Regeln
 * (category = null). Vorhandene Einträge (gleiche Video-ID) werden aktualisiert statt verdoppelt.
 */
async function fileYouTube(url, category, { source = 'link', title = '', tab = null, closeTab = false } = {}) {
  const rec = buildItem({ url, title, source });
  if (!rec || rec.type !== 'youtube') {
    flashBadge('!', '#ef4444', 'Kein YouTube-Video erkannt');
    return { ok: false };
  }
  if (tab && closeTab) {
    try { applyProbe(rec, await probeTab(tab.id)); } catch { /* Position unbekannt */ }
  }
  if (category) await addMissingCategories([category]);
  await ensureLoaded();
  const rules = await getRules();
  const ex = store.items[rec.id];
  const target = ex ? mergeResave(ex, rec) : rec;
  if (category) {
    target.category = category;
    target.manualCategory = true;
  } else if (!target.manualCategory) {
    target.category = categorize(target, rules);
  }
  if (!ex) store.items[rec.id] = rec;
  store.dirty = true;
  await flush(); // erst speichern, dann schließen
  if (tab && closeTab) {
    if (await wouldCloseEverything([tab])) await ensureOverview({ windowId: tab.windowId, active: false });
    await closeTabs([tab.id]);
  }
  flashBadge(ex ? '↻' : '✓', ex ? '#f59e0b' : '#16a34a',
    ex ? `Schon abgelegt – Kategorie jetzt „${target.category}“` : `Abgelegt in „${target.category}“`);
  enrichPending();
  return { ok: true, id: target.id, existed: !!ex, category: target.category };
}

async function handleMenuClick(info, tab) {
  const id = info.menuItemId;
  if (id === 'save-tab' && tab) return runSave('tab', { tabId: tab.id });
  if (id === 'save-right' && tab) return runSave('right', { tabId: tab.id, windowId: tab.windowId });
  if (id === 'save-link' && info.linkUrl) return saveLink(info.linkUrl, info.selectionText || '');
  if (id === 'action-overview') return ensureOverview({ windowId: tab?.windowId, active: true });
  if (id === 'action-save-all') return runSave('all', { windowId: tab?.windowId });
  if (id === MENU.closeToggle) return saveSettings({ closeAfterFile: !!info.checked });
  const parsed = parseMenuItemId(id);
  if (!parsed) return null;
  if (parsed.variant === 'link') {
    // contextMenus liefert nur die Link-URL; den Titel holt die oEmbed-Anreicherung.
    return fileYouTube(info.linkUrl, parsed.category, { source: 'link' });
  }
  const pageUrl = (tab && tab.url) || info.pageUrl;
  const settings = await getSettings();
  return fileYouTube(pageUrl, parsed.category, {
    source: 'tab', title: tab ? tab.title : '', tab, closeTab: !!(tab && settings.closeAfterFile),
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleMenuClick(info, tab).catch(() => flashBadge('!', '#ef4444', 'Ablegen fehlgeschlagen'));
});

// Für die Fehlersuche in der Service-Worker-Konsole (und den Rauchtest): ruft dieselben Funktionen
// auf, die auch das Kontextmenü verwendet – kein abweichendes Verhalten.
globalThis.tabAblage = { handleMenuClick, rebuildMenus, menuState };

// ------------------------------------------------------------------ Nachrichten

const handlers = {
  async save(m) {
    runSave(m.scope, { windowId: m.windowId, tabId: m.tabId }).catch(() => {});
    return { started: true };
  },
  async getJob() { return { job }; },
  async updateItems(m) { return { count: await updateItems(m.ids, m.patch || {}) }; },
  async deleteItems(m) { return { items: await deleteItems(m.ids) }; },
  async restoreItems(m) { return { count: await restoreItems(m.items) }; },
  async recategorize() { return { changed: await recategorizeAll() }; },
  async openItems(m) { return openItems(m.ids, m); },
  async import(m) { return importData(m.items); },
  async clearAll() { await clearAll(); return {}; },
  async retryEnrich() { await retryEnrich(); return {}; },
  async openOverview(m) { await ensureOverview({ windowId: m.windowId, active: true }); return {}; },
  async settingsChanged() { ensureAlarm(); autoCheck().catch(() => {}); return {}; },
  async saveRules(m) { return { changed: await saveRulesAndRecategorize(m.rules) }; },
  async resetRules() { return { changed: await saveRulesAndRecategorize(DEFAULT_RULES) }; },
  async renameCategory(m) { return renameCategory(m.id, m.name); },
  async deleteCategory(m) { return deleteCategory(m.id, m.target || null); },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = msg && handlers[msg.cmd];
  if (!h) return false;
  h(msg, sender).then(
    (r) => sendResponse({ ok: true, ...r }),
    (e) => sendResponse({ ok: false, error: String(e && e.message || e) }),
  );
  return true;
});

// ------------------------------------------------------------------ Lebenszyklus

chrome.runtime.onInstalled.addListener(() => {
  ensureMigrated().then(rebuildMenus);
  ensureAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureMigrated().then(rebuildMenus);
  ensureAlarm();
  enrichPending();
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== 'auto') return;
  autoCheck().catch(() => {}).finally(() => enrichPending());
});

chrome.tabs.onActivated.addListener(({ tabId }) => noteActive(tabId));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    // Kategorien geändert (Optionen, Übersicht, Import) -> Kontextmenü sofort neu aufbauen
    const closeChanged = changes.settings &&
      (changes.settings.oldValue || {}).closeAfterFile !== (changes.settings.newValue || {}).closeAfterFile;
    if (changes.rules || closeChanged) rebuildMenus();
  }
  // Speicher wurde von außen geleert (z. B. über die Entwicklertools): Cache verwerfen.
  if (area === 'local' && changes.items && changes.items.newValue === undefined && store.items) {
    store.items = {};
  }
});

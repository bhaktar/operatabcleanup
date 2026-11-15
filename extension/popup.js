import { send, applyTheme } from './lib/ui.js';
import { isSaveableUrl, isYouTubeUrl } from './lib/url.js';
import { getSettings } from './lib/settings.js';

const $ = (id) => document.getElementById(id);
const OWN = chrome.runtime.getURL('');
let currentWindowId = null;
let currentTabId = null;

function saveable(t) {
  const url = t.url || t.pendingUrl || '';
  return isSaveableUrl(url) && !url.startsWith(OWN);
}

async function refresh() {
  const [tabs, store, settings, win] = await Promise.all([
    chrome.tabs.query({}),
    chrome.storage.local.get('items'),
    getSettings(),
    chrome.windows.getCurrent(),
  ]);
  applyTheme(settings.theme);
  currentWindowId = win.id;
  const active = tabs.find((t) => t.active && t.windowId === win.id);
  currentTabId = active ? active.id : null;

  const candidates = tabs.filter((t) => !t.pinned && saveable(t));
  const yt = candidates.filter((t) => isYouTubeUrl(t.url || t.pendingUrl));
  $('stat-open').textContent = tabs.length;
  $('stat-saveable').textContent = `${candidates.length} ablegbar, ${yt.length} YouTube`;
  const items = Object.values(store.items || {});
  const activeItems = items.filter((i) => i.status !== 'archived');
  $('stat-saved').textContent = activeItems.length;
  $('stat-youtube').textContent = items.length !== activeItems.length ? `+ ${items.length - activeItems.length} gesehen` : '';

  const inWindow = candidates.filter((t) => t.windowId === win.id).length;
  $('btn-all').disabled = !candidates.length;
  $('btn-window').disabled = !inWindow;
  $('btn-youtube').disabled = !yt.length;
  $('btn-tab').disabled = !(active && saveable(active));
  $('btn-youtube').textContent = `Nur YouTube-Tabs ablegen (${yt.length})`;
  $('btn-window').textContent = `Nur dieses Fenster ablegen (${inWindow})`;
  const pinned = tabs.filter((t) => t.pinned).length;
  $('hint').textContent = [
    pinned ? `${pinned} angeheftete Tabs bleiben offen.` : '',
    settings.keepActiveTab ? 'Der aktive Tab bleibt offen (Einstellung).' : '',
  ].filter(Boolean).join(' ');
}

function showJob(job) {
  if (!job) return;
  $('job').hidden = false;
  const pct = job.total ? Math.round((job.done / job.total) * 100) : (job.phase === 'fertig' ? 100 : 5);
  $('job-bar').style.width = `${Math.min(100, pct)}%`;
  const phase = {
    sammeln: 'Tabs werden gesammelt …',
    speichern: `${job.saved} Einträge gespeichert …`,
    'schließen': `Schließe Tabs: ${job.closed} / ${job.total}`,
    fertig: job.message || 'Fertig.',
    fehler: `Fehler: ${job.message}`,
  }[job.phase] || '';
  $('job-text').textContent = phase;
  const busy = job.phase !== 'fertig' && job.phase !== 'fehler';
  for (const id of ['btn-all', 'btn-window', 'btn-youtube', 'btn-tab']) $(id).disabled = busy || $(id).disabled;
  if (!busy) refresh().catch(() => {});
}

async function start(scope) {
  try {
    await send('save', { scope, windowId: currentWindowId, tabId: currentTabId });
    showJob({ phase: 'sammeln', total: 0, done: 0 });
  } catch (e) {
    $('job').hidden = false;
    $('job-text').textContent = `Fehler: ${e.message}`;
  }
}

$('btn-all').addEventListener('click', () => start('all'));
$('btn-window').addEventListener('click', () => start('window'));
$('btn-youtube').addEventListener('click', () => start('youtube'));
$('btn-tab').addEventListener('click', () => start('tab'));
$('btn-overview').addEventListener('click', async () => {
  try { await send('openOverview', { windowId: currentWindowId }); } catch { /* egal */ }
  window.close();
});
$('btn-options').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'job') showJob(msg.job);
});

refresh().catch(() => {});
send('getJob').then((r) => showJob(r.job)).catch(() => {});

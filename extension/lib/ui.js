// Gemeinsame Helfer für Popup, Übersicht und Optionen.

export function send(cmd, data = {}) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ cmd, ...data }, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        if (!res) return reject(new Error('Keine Antwort vom Hintergrunddienst.'));
        if (!res.ok) return reject(new Error(res.error || 'Unbekannter Fehler'));
        resolve(res);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay) return `heute, ${timeFmt.format(d)}`;
  if (d.toDateString() === y.toDateString()) return `gestern, ${timeFmt.format(d)}`;
  return dateFmt.format(d);
}

export function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

let toastTimer = null;
/** Kurze Meldung unten; optional mit "Rückgängig". */
export function toast(message, { undo = null, error = false, ms = 5000 } = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = 'toast show' + (error ? ' error' : '');
  el.textContent = message;
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Rückgängig';
    b.addEventListener('click', () => { el.classList.remove('show'); undo(); }, { once: true });
    el.appendChild(b);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Favicon über die Chromium-Favicon-API (Berechtigung "favicon"), sonst gespeicherte URL. */
export function faviconFor(item, size = 32) {
  if (chrome.runtime && chrome.runtime.getManifest().permissions.includes('favicon')) {
    return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(item.url)}&size=${size}`;
  }
  return item.favIconUrl || '';
}

/** Gemeinsamer Export/Import für Übersicht und Optionen. */
export async function exportJson() {
  const { exportData } = await import('./items.js');
  const { getRules } = await import('./settings.js');
  const { items } = await chrome.storage.local.get('items');
  const data = exportData(items || {}, await getRules());
  download(`tab-ablage_${stamp()}.json`, JSON.stringify(data, null, 2));
  return data.count;
}

export async function exportBookmarks() {
  const { exportBookmarksHtml } = await import('./items.js');
  const { items } = await chrome.storage.local.get('items');
  download(`tab-ablage-lesezeichen_${stamp()}.html`, exportBookmarksHtml(items || {}), 'text/html');
}

export async function importFile(file) {
  const { parseImportPayload } = await import('./items.js');
  const text = await file.text();
  let list;
  try {
    list = parseImportPayload(text);
  } catch (e) {
    throw new Error('Datei konnte nicht gelesen werden: ' + e.message);
  }
  if (!list.length) throw new Error('Keine Einträge in der Datei gefunden.');
  const res = await send('import', { items: list });
  return res;
}

export function icon(name) {
  const paths = {
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>',
    tag: '<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

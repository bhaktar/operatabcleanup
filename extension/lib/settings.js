// Einstellungen und Regeln in chrome.storage.local.

import { DEFAULT_RULES, normalizeRules } from './categorize.js';

export const DEFAULT_SETTINGS = {
  keepActiveTab: false,        // aktiven Tab beim "Alle ablegen" offen lassen
  openOverviewAfterSave: true, // Übersicht nach dem Sammel-Ablegen öffnen/fokussieren
  afterOpen: 'remove',         // 'remove' | 'archive' | 'keep' – was nach dem Öffnen passiert
  fetchPreviews: true,         // Vorschaubilder für verworfene/geschlossene Tabs nachladen
  theme: 'auto',               // 'auto' | 'dark' | 'light'
  pageSize: 200,
  autoArchive: { enabled: false, hours: 6 },
  tabLimit: { enabled: false, max: 50 },
  whitelist: [],               // Domains, die nie automatisch abgelegt werden
};

export function mergeSettings(stored) {
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    autoArchive: { ...DEFAULT_SETTINGS.autoArchive, ...(s.autoArchive || {}) },
    tabLimit: { ...DEFAULT_SETTINGS.tabLimit, ...(s.tabLimit || {}) },
    whitelist: Array.isArray(s.whitelist) ? s.whitelist : [],
  };
}

export async function getSettings() {
  const r = await chrome.storage.local.get('settings');
  return mergeSettings(r.settings);
}

export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = mergeSettings({ ...cur, ...patch });
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getRules() {
  const r = await chrome.storage.local.get('rules');
  return normalizeRules(Array.isArray(r.rules) && r.rules.length ? r.rules : DEFAULT_RULES);
}

export async function saveRules(rules) {
  const norm = normalizeRules(rules);
  await chrome.storage.local.set({ rules: norm });
  return norm;
}

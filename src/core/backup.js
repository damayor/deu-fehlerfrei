// Backup: export, import and reset. build/parse are pure; the rest takes the store as an argument.
import { validateEvent } from './events.js';

const APP = 'fehlerfrei';
const FORMAT = 1;
const META_KEY = 'meta'; // settings-store record holding { lastExport }; not part of a backup
const isState = (rec) => typeof rec?.key === 'string' && rec.key.startsWith('state:');

export function buildBackup({ events, settings, state }, now, version) {
  return { app: APP, format: FORMAT, version, exportedAt: new Date(now).toISOString(), events, settings, state };
}

/** @returns {{ok:true, data:object}|{ok:false, error:string}} */
export function parseBackup(text) {
  let d;
  try { d = JSON.parse(text); } catch { return { ok: false, error: 'Die Datei ist kein gültiges JSON.' }; }
  if (d?.app !== APP) return { ok: false, error: 'Das ist keine Fehlerfrei-Sicherung.' };
  if (d.format !== FORMAT) return { ok: false, error: `Unbekanntes Format (${d.format}).` };
  if (![d.events, d.settings, d.state].every(Array.isArray)) return { ok: false, error: 'Die Sicherung ist unvollständig.' };
  const badIdx = d.events.findIndex((e) => validateEvent(e) !== null);
  if (badIdx !== -1) return { ok: false, error: `Ereignis ${badIdx + 1} ist ungültig: ${validateEvent(d.events[badIdx])}.` };
  if (d.settings.some((r) => typeof r?.key !== 'string' || r.key === META_KEY)) return { ok: false, error: 'Einstellungen sind ungültig.' };
  if (!d.state.every(isState)) return { ok: false, error: 'Zustandsdaten sind ungültig.' };
  return { ok: true, data: d };
}

export async function exportAll(store, now, version) {
  const [events, settings, cache] = await Promise.all([store.getAll('events'), store.getAll('settings'), store.getAll('cache')]);
  const backup = buildBackup({
    events, settings: settings.filter((r) => r.key === 'global' || r.key.startsWith('module:')), state: cache.filter(isState),
  }, now, version);
  await store.put('settings', { key: META_KEY, lastExport: now });
  return backup;
}

export async function lastExport(store) {
  return (await store.get('settings', META_KEY))?.lastExport ?? null;
}

/** Replace events, settings and module state with the given data. Other cache entries and meta stay. */
export async function restoreAll(store, { events, settings, state }) {
  const [meta, cache] = await Promise.all([store.get('settings', META_KEY), store.getAll('cache')]);
  await store.replaceAll('events', events);
  await store.replaceAll('settings', meta ? [...settings, meta] : settings);
  await store.replaceAll('cache', [...cache.filter((r) => !isState(r)), ...state]);
}

export const resetAll = (store) => restoreAll(store, { events: [], settings: [], state: [] });

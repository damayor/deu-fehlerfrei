import { ENABLED_MODULES } from './config.js';
import { h, errorScreen, applyTheme } from './core/ui.js';
import { GLOBAL_SCHEMA, loadSettings } from './core/settings.js';
import * as store from './core/store.js';
import * as shell from './views/shell.js';
import { createCtx } from './core/ctx.js';
import * as push from './core/push.js';

const view = document.getElementById('view');
const banner = document.getElementById('update-banner');
const storageBanner = document.getElementById('storage-banner');
/** @type {Map<string, any>} */
const registry = new Map();
let active = null; // currently mounted module
let persisted = false;
let swReg = null;

async function registerModules() {
  for (const id of ENABLED_MODULES) {
    try {
      const mod = (await import(`./modules/${id}/index.js`)).default;
      registry.set(mod.id, mod);
    } catch (err) {
      await store.logError(`module-load:${id}`, err);
    }
  }
}

async function mountModule(id) {
  const mod = registry.get(id);
  if (!mod) return view.append(errorScreen('Modul nicht gefunden', id));
  const box = h('div');
  view.append(box);
  try {
    const ctx = await createCtx(mod, { h });
    await mod.load(ctx);
    mod.mount(box, ctx);
    active = mod;
  } catch (err) {
    active = null;
    await store.logError(`module-mount:${id}`, err);
    box.replaceChildren(errorScreen(`${mod.title} ist abgestürzt`, err));
  }
}

function unmountActive() {
  try { active?.unmount(); } catch (err) { store.logError('module-unmount', err); }
  active = null;
}

async function render() {
  unmountActive();
  const [tab = 'heute', sub] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('#tabs a').forEach((a) =>
    a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  view.replaceChildren();
  try {
    if (tab === 'ueben' && sub) await mountModule(sub);
    else if (tab === 'ueben') view.append(shell.ueben([...registry.values()]));
    else if (tab === 'fortschritt') view.append(await shell.fortschritt([...registry.values()]));
    else if (tab === 'einstellungen') view.append(await shell.einstellungen({ persisted, checkUpdate, modules: [...registry.values()], rerender: render }));
    else view.append(await shell.heute([...registry.values()]));
  } catch (err) {
    await store.logError(`view:${tab}`, err);
    view.replaceChildren(errorScreen('Fehler beim Laden', err));
  }
  view.scrollTop = 0;
}

function showUpdateBanner(worker) {
  banner.replaceChildren(
    h('span', null, 'Neue Version verfügbar'),
    h('button', { onclick: () => worker.postMessage('SKIP_WAITING') }, 'Jetzt aktualisieren'));
  banner.hidden = false;
}

function showStorageBanner(err) {
  storageBanner.textContent = `Speicher nicht verfügbar: Fortschritt wird NICHT gespeichert. ${err?.message ?? err}`;
  storageBanner.hidden = false;
}

async function checkUpdate() {
  if (!swReg) return 'Kein Service Worker aktiv (Offline-Modus nicht verfügbar).';
  try {
    await swReg.update();
    if (swReg.waiting) { showUpdateBanner(swReg.waiting); return 'Neue Version verfügbar.'; }
    return 'Du hast die neueste Version.';
  } catch {
    return 'Update-Prüfung fehlgeschlagen (kein Netz?).';
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    if (swReg.waiting && navigator.serviceWorker.controller) showUpdateBanner(swReg.waiting);
    swReg.addEventListener('updatefound', () => {
      const w = swReg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(w);
      });
    });
    // Look for a new version whenever the app comes back to the foreground (no background work).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') swReg.update().catch(() => {}); });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) { reloading = true; location.reload(); }
    });
  } catch (err) {
    await store.logError('sw-register', err);
  }
}

window.addEventListener('error', (e) => store.logError('window', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => store.logError('promise', e.reason));
window.addEventListener('hashchange', render);

/** Tell the reminder Worker whether today's goal is met. Never blocks or shows errors: it retries on the next call. */
async function syncReminder() {
  try {
    const [rs, gs, events] = await Promise.all([
      loadSettings(store, 'reminder', push.REMINDER_SCHEMA), loadSettings(store, 'global', GLOBAL_SCHEMA), store.getAll('events')]);
    await store.put('cache', { key: 'streak-info', value: push.streakInfo(events, gs.dailyGoal, Date.now()) }); // read by sw.js
    await push.syncState(store, rs, events, gs.dailyGoal);
  } catch { /* offline or not set up */ }
}
window.addEventListener('fehlerfrei:activity', syncReminder);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncReminder(); });

(async function boot() {
  store.requestPersistence().then((ok) => { persisted = ok; }); // never blocks startup
  try { await store.probe(); } catch (err) { showStorageBanner(err); store.logError('storage-probe', err); }
  try { applyTheme((await loadSettings(store, 'global', GLOBAL_SCHEMA)).theme); } catch (err) { store.logError('theme', err); }
  await registerModules();
  await render();
  registerServiceWorker();
  syncReminder();
})();

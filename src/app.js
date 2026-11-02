import { ENABLED_MODULES } from './config.js';
import { h, errorScreen } from './core/ui.js';
import * as store from './core/store.js';
import * as shell from './views/shell.js';
import { createCtx } from './core/ctx.js';

const view = document.getElementById('view');
const banner = document.getElementById('update-banner');
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
    else if (tab === 'fortschritt') view.append(shell.fortschritt());
    else if (tab === 'einstellungen') view.append(await shell.einstellungen({ persisted, checkUpdate }));
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

(async function boot() {
  persisted = await store.requestPersistence();
  await registerModules();
  await render();
  registerServiceWorker();
})();

import { h, placeholder } from '../core/ui.js';
import { VERSION } from '../config.js';
import * as store from '../core/store.js';

export { heute } from './heute.js';
export const fortschritt = () => placeholder('Fortschritt', 'Statistiken kommen in Phase 5.');

export function ueben(modules) {
  return h('div', null, h('h1', null, 'Üben'),
    ...modules.map((m) => h('a', { class: 'card btn', href: `#/ueben/${m.id}`, style: 'display:block' }, m.title)));
}

/** Phase 1: shows the version and a stored value that must survive force close and reboot. */
export async function einstellungen({ persisted, checkUpdate }) {
  const rec = (await store.get('settings', 'phase1-test')) ?? { key: 'phase1-test', opens: 0, first: Date.now() };
  rec.opens += 1;
  await store.put('settings', rec);
  const status = h('p', { class: 'muted' });
  return h('div', null, h('h1', null, 'Einstellungen'),
    h('div', { class: 'card' },
      h('p', null, `Version: ${VERSION}`),
      h('p', null, `Gespeicherter Testwert: ${rec.opens} Mal geöffnet, seit ${new Date(rec.first).toLocaleString('de-DE')}`),
      h('p', null, `Dauerhafter Speicher: ${persisted ? 'ja' : 'nicht bestätigt'}`),
      h('button', { onclick: async () => { status.textContent = await checkUpdate(); } }, 'Update prüfen'),
      status));
}

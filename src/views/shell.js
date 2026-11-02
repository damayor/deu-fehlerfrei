import { h, placeholder } from '../core/ui.js';

export { heute } from './heute.js';
export const fortschritt = () => placeholder('Fortschritt', 'Statistiken kommen in Phase 5.');

export function ueben(modules) {
  return h('div', null, h('h1', null, 'Üben'),
    ...modules.map((m) => h('a', { class: 'card btn', href: `#/ueben/${m.id}`, style: 'display:block' }, m.title)));
}

export { einstellungen } from './settings.js';

import { h } from '../core/ui.js';

export { heute } from './heute.js';
export { fortschritt } from './fortschritt.js';

export function ueben(modules) {
  return h('div', null, h('h1', null, 'Üben'),
    ...modules.map((m) => h('a', { class: 'card btn', href: `#/ueben/${m.id}`, style: 'display:block' }, m.title)));
}

export { einstellungen } from './settings.js';

// "Verinnerlicht" sub-tab: items that reached the graduation threshold.
import { h } from '../../../core/ui.js';
import { graduatedItems } from '../engine.js';

const CAT = { V: 'Verb', N: 'Nomen', A: 'Adjektiv' };

/** @param {HTMLElement} el @param {{items:any[], progress:Record<string,any>}} init */
export function renderMastered(el, { items, progress }) {
  const list = graduatedItems(items, progress);
  el.replaceChildren(
    h('h1', null, 'Endlich verinnerlicht'),
    h('p', { class: 'muted' }, `${list.length} von ${items.length} Einträgen`),
    list.length ? null : h('div', { class: 'card' }, h('p', null, 'Noch nichts verinnerlicht. Beantworte einen Eintrag mehrmals hintereinander richtig.')),
    ...list.map((it) => h('div', { class: 'card' },
      h('p', { class: 'phrase-sm', lang: 'de' }, it.word),
      h('p', { class: 'muted' }, [CAT[it.cat], it.case ? `+ ${it.case}` : null].filter(Boolean).join(' · ')),
      it.example_de ? h('p', { lang: 'de' }, it.example_de) : null,
      it.example_es ? h('p', { class: 'muted' }, it.example_es) : null)));
}

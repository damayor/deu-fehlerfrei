import { h } from '../core/ui.js';
import * as store from '../core/store.js';
import { summarizeActivity } from '../core/activity.js';
import { GLOBAL_SCHEMA, loadSettings } from '../core/settings.js';

export async function heute(modules) {
  const [events, global] = await Promise.all([store.getAll('events'), loadSettings(store, 'global', GLOBAL_SCHEMA)]);
  const { today, current, best } = summarizeActivity(events, global.dailyGoal, Date.now());
  const pct = Math.min(100, Math.round((today.count / today.goal) * 100));
  return h('div', null, h('h1', null, 'Heute'),
    h('div', { class: 'card' },
      h('p', { class: 'big' }, `${today.count} / ${today.goal}`),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': today.goal, 'aria-valuenow': today.count },
        h('span', { style: `width:${pct}%` })),
      h('p', null, today.met ? 'Tagesziel erreicht ✓' : `Noch ${today.goal - today.count} Übung${today.goal - today.count === 1 ? '' : 'en'} bis zum Tagesziel.`)),
    h('div', { class: 'card' },
      h('p', { class: 'big' }, `🔥 ${current}`),
      h('p', null, current === 1 ? 'Tag in Folge' : 'Tage in Folge'),
      h('p', { class: 'muted' }, `Beste Serie: ${best}${today.met ? '' : ' · Heute noch offen, die Serie bleibt bis Mitternacht erhalten.'}`)),
    ...modules.map((m) => h('a', { class: 'card btn', href: `#/ueben/${m.id}`, style: 'display:block' }, `${m.title} üben`)));
}

// Fortschritt tab: global streak and 14-day history, then one section per module from its stats().
import { h } from '../core/ui.js';
import * as store from '../core/store.js';
import { summarizeActivity, recentDays } from '../core/activity.js';
import { GLOBAL_SCHEMA, loadSettings } from '../core/settings.js';
import { createCtx } from '../core/ctx.js';

const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function history(days) {
  return h('div', { class: 'history', role: 'list', 'aria-label': 'Letzte 14 Tage' },
    ...days.map((d) => {
      const wd = WEEKDAY[new Date(`${d.day}T12:00:00`).getDay()];
      return h('div', { class: `day${d.met ? ' met' : ''}`, role: 'listitem', title: d.day, 'aria-label': `${d.day}: ${d.count} Übungen${d.met ? ', Ziel erreicht' : ''}` },
        h('span', null, String(d.count)), h('small', null, wd));
    }));
}

/** @param {{metrics?:{label:string,value:string}[], lists?:{title:string,rows:string[][],empty?:string}[]}} st */
function statsBlock(st) {
  return h('div', null,
    st.metrics?.length ? h('div', { class: 'metrics' }, ...st.metrics.map((m) =>
      h('div', null, h('p', { class: 'big' }, m.value), h('p', { class: 'muted' }, m.label)))) : null,
    ...(st.lists ?? []).map((l) => h('div', null,
      h('h3', null, l.title),
      l.rows.length ? h('ul', { class: 'rows' }, ...l.rows.map(([a, b]) => h('li', null, h('span', { lang: 'de' }, a), h('span', { class: 'muted' }, b))))
        : h('p', { class: 'muted' }, l.empty ?? '–'))));
}

export async function fortschritt(modules) {
  const [events, global] = await Promise.all([store.getAll('events'), loadSettings(store, 'global', GLOBAL_SCHEMA)]);
  const now = Date.now();
  const { current, best } = summarizeActivity(events, global.dailyGoal, now);
  const total = events.filter((e) => e.type === 'activity').length;

  // Each module is isolated: a crashing stats() only affects its own card.
  const sections = [];
  for (const m of modules) {
    try {
      const ctx = await createCtx(m, { h });
      await m.load(ctx);
      const st = await m.stats(await ctx.getEvents({ module: m.id }));
      if (st && (st.metrics?.length || st.lists?.length)) sections.push(h('div', { class: 'card' }, h('h2', null, m.title), statsBlock(st)));
    } catch (err) {
      await store.logError(`stats:${m.id}`, err);
      sections.push(h('div', { class: 'card' }, h('h2', null, m.title), h('p', { class: 'error' }, `Statistik nicht verfügbar: ${err?.message ?? err}`)));
    }
  }

  return h('div', null, h('h1', null, 'Fortschritt'),
    h('div', { class: 'card' },
      h('div', { class: 'metrics' },
        h('div', null, h('p', { class: 'big' }, `🔥 ${current}`), h('p', { class: 'muted' }, 'Aktuelle Serie')),
        h('div', null, h('p', { class: 'big' }, String(best)), h('p', { class: 'muted' }, 'Beste Serie')),
        h('div', null, h('p', { class: 'big' }, String(total)), h('p', { class: 'muted' }, 'Übungen gesamt'))),
      h('h3', null, `Letzte 14 Tage (Ziel: ${global.dailyGoal} pro Tag)`),
      history(recentDays(events, global.dailyGoal, now, 14))),
    ...sections);
}

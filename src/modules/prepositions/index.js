import { SETTINGS_SCHEMA, crossCheck } from './settings.js';
import { defaultsOf } from '../../core/settings.js';
import { loadItems } from './data.js';
import { deriveProgress, fillQueue, answersInCurrentRound, summarize } from './engine.js';
import { startPractice } from './views/practice.js';
import { renderMastered } from './views/mastered.js';
import { h } from '../../core/ui.js';

let items = [];
let events = [];
let saved = null;
let view = null;
let current = null; // settings from the last load(), used by stats()

const CAT_LABEL = { V: 'Verben', N: 'Nomen', A: 'Adjektive' };
const pct = (x) => `${Math.round(x * 100)} %`;

export default {
  id: 'prepositions',
  title: 'Präpositionen',
  defaultSettings: defaultsOf(SETTINGS_SCHEMA),
  settingsSchema: SETTINGS_SCHEMA,
  crossCheck,
  async load(ctx) {
    items = await loadItems();
    events = await ctx.getEvents({ module: 'prepositions' });
    saved = await ctx.state.get();
    current = ctx.settings;
  },
  mount(el, ctx) {
    // Progress and round count are always rebuilt from events; only the queue is persisted.
    const progress = deriveProgress(events, ctx.settings);
    const queue = fillQueue(items, progress, saved?.queue ?? [], ctx.settings, Math.random);
    const practiceBox = h('div');
    const masteredBox = h('div', { hidden: true });
    const tabs = [['ueben', 'Üben', practiceBox], ['mastered', 'Verinnerlicht', masteredBox]];
    const buttons = tabs.map(([id, label]) => h('button', { class: 'chip', onclick: () => select(id) }, label));
    function select(id) {
      tabs.forEach(([tid, , box], i) => {
        box.hidden = tid !== id;
        buttons[i].setAttribute('aria-pressed', String(tid === id));
      });
      if (id === 'mastered') renderMastered(masteredBox, { items, progress }); // progress is mutated live by practice
    }
    el.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Präpositionen' }, ...buttons), practiceBox, masteredBox);
    select('ueben');
    view = startPractice(practiceBox, {
      items, ctx, progress, queue,
      lastId: saved?.lastId ?? null,
      roundCount: answersInCurrentRound(events),
    });
  },
  unmount() { view?.destroy(); view = null; },
  /** Generic summary for the Fortschritt tab (see views/fortschritt.js for the shape). */
  stats(evts) {
    const sum = summarize(items, deriveProgress(evts, current ?? undefined));
    return {
      metrics: [
        { label: 'Verinnerlicht', value: `${sum.graduated} / ${sum.total}` },
        { label: 'Genauigkeit', value: sum.accuracy == null ? '–' : pct(sum.accuracy) },
        { label: 'Antworten', value: String(sum.answers) },
      ],
      lists: [
        { title: 'Nach Kategorie', rows: Object.entries(sum.byCat).map(([cat, c]) => {
          const n = c.correct + c.wrong;
          return [CAT_LABEL[cat] ?? cat, `${c.graduated} / ${c.total} · ${n ? pct(c.correct / n) : '–'}`];
        }) },
        { title: 'Schwierigste Einträge', empty: 'Noch keine Fehler.', rows: sum.hardest.map((x) => [x.word, `${x.wrong}× falsch · ${x.correct}× richtig`]) },
      ],
    };
  },
};

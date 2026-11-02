import { SETTINGS_SCHEMA, crossCheck } from './settings.js';
import { defaultsOf } from '../../core/settings.js';
import { loadItems } from './data.js';
import { deriveProgress, fillQueue, answersInCurrentRound } from './engine.js';
import { startPractice } from './views/practice.js';

let items = [];
let events = [];
let saved = null;
let view = null;

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
  },
  mount(el, ctx) {
    // Progress and round count are always rebuilt from events; only the queue is persisted.
    const progress = deriveProgress(events, ctx.settings);
    const queue = fillQueue(items, progress, saved?.queue ?? [], ctx.settings, Math.random);
    view = startPractice(el, {
      items, ctx, progress, queue,
      lastId: saved?.lastId ?? null,
      roundCount: answersInCurrentRound(events),
    });
  },
  unmount() { view?.destroy(); view = null; },
  stats(events) { return {}; },
};

import { SETTINGS_SCHEMA } from './settings.js';
import { defaultsOf } from '../../core/settings.js';
import { startList } from './views/list.js';

let saved = null;
let view = null;

// Shows the words the Telegram alerts will send today (German only). Viewing does not count as an activity.
export default {
  id: 'vocab_GAS',
  title: 'Wörter des Tages',
  cardLabel: 'Wörter des Tages ansehen',
  defaultSettings: defaultsOf(SETTINGS_SCHEMA),
  settingsSchema: SETTINGS_SCHEMA,
  async load(ctx) { saved = await ctx.state.get(); },
  mount(el, ctx) { view = startList(el, { ctx, cached: saved }); },
  unmount() { view?.destroy(); view = null; },
  stats() { return {}; },
};

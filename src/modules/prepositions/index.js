import { h } from '../../core/ui.js';

// Phase 1 placeholder: proves registry, mounting and the error boundary.
export default {
  id: 'prepositions',
  title: 'Präpositionen',
  defaultSettings: {},
  settingsSchema: [],
  async load(ctx) {},
  mount(el, ctx) {
    el.append(h('h1', null, 'Präpositionen'), h('p', { class: 'muted' }, 'Kommt in Phase 3.'));
  },
  unmount() {},
  stats(events) { return {}; },
};

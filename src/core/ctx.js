// Builds the `ctx` a module receives. The only door from a module to storage and the rest of the app.
import * as store from './store.js';
import { createEvent, filterEvents } from './events.js';
import { loadSettings } from './settings.js';

/** @param {{id:string, settingsSchema:any[]}} mod @param {object} ui */
export async function createCtx(mod, ui) {
  const settings = await loadSettings(store, mod.id, mod.settingsSchema);
  const log = (fields) => store.put('events', createEvent(mod.id, fields, { id: store.newId(), now: Date.now() }));
  return {
    ui,
    settings,
    logEvent: log,
    getEvents: async (filter) => filterEvents(await store.getAll('events'), filter),
    /** One completed exercise; counts toward the shared daily goal. */
    completeActivity: (info = {}) => log({ type: 'activity', kind: info.kind ?? 'round', meta: info.meta ?? {} }),
    /** Small private state blob for the module (for example its queue). */
    state: {
      get: async () => (await store.get('cache', `state:${mod.id}`))?.value ?? null,
      set: (value) => store.put('cache', { key: `state:${mod.id}`, value }),
    },
  };
}

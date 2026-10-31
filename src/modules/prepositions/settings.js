import { DEFAULTS } from './engine.js';

export const AUTO_ADVANCE = [
  { value: 0, label: 'Aus' }, { value: 2, label: '2 s' }, { value: 4, label: '4 s' },
];

export const SETTINGS_SCHEMA = [
  { key: 'gradThreshold', label: 'Verinnerlicht nach … richtigen Antworten', type: 'stepper', min: 3, max: 5, default: DEFAULTS.gradThreshold },
  { key: 'queueSize', label: 'Aktive Warteschlange', type: 'stepper', min: 4, max: 12, default: DEFAULTS.queueSize },
  { key: 'optionCount', label: 'Anzahl Antwortoptionen', type: 'stepper', min: 3, max: 6, default: DEFAULTS.optionCount },
  { key: 'prepPool', label: 'Präpositionen als Optionen', type: 'multi', options: DEFAULTS.prepPool, allowCustom: true, min: 1, default: DEFAULTS.prepPool },
  { key: 'categories', label: 'Kategorien (V Verb, N Nomen, A Adjektiv)', type: 'multi', options: ['V', 'N', 'A'], min: 1, default: DEFAULTS.categories },
  { key: 'priorityFirst', label: 'Wichtige zuerst', type: 'toggle', default: DEFAULTS.priorityFirst },
  { key: 'roundSize', label: 'Karten pro Runde', type: 'stepper', min: 5, max: 30, default: DEFAULTS.roundSize },
  { key: 'showExample', label: 'Beispielsatz zeigen', type: 'toggle', default: true },
  { key: 'autoAdvance', label: 'Automatisch weiter', type: 'choice', options: AUTO_ADVANCE, default: 0 },
];

/** The correct answer is always added to the options, so the pool needs at least `optionCount` entries. */
export function crossCheck(values) {
  if (values.prepPool.length < values.optionCount) {
    return `Zu wenige Präpositionen: für ${values.optionCount} Optionen braucht der Pool mindestens ${values.optionCount} Einträge (aktuell ${values.prepPool.length}).`;
  }
  return null;
}

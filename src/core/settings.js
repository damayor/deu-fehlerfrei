// Settings: schema-driven validation for the global section and for each module's namespace.
// A schema is a list of fields; the settings window is generated from it.
//
// field: { key, label, type, default, hint? }
//   stepper: integer, min, max
//   toggle:  boolean
//   choice:  options [{value,label}]
//   text:    string, optional max (default 500), pattern (RegExp) + patternMessage, secret (hidden input, kept out of backups)
//   multi:   array of strings; options (list), allowCustom, min (minimum number selected)

export const GLOBAL_SCHEMA = [
  { key: 'dailyGoal', label: 'Tagesziel (Übungen pro Tag)', type: 'stepper', min: 1, max: 10, default: 2 },
  { key: 'theme', label: 'Design', type: 'choice', default: 'auto',
    options: [{ value: 'auto', label: 'Automatisch' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }] },
];

export function defaultsOf(schema) {
  return Object.fromEntries(schema.map((f) => [f.key, structuredClone(f.default)]));
}

/** @returns {string|null} German error message, or null when the value is valid */
export function validateField(field, value) {
  switch (field.type) {
    case 'stepper':
      if (!Number.isInteger(value)) return `${field.label}: ganze Zahl erwartet.`;
      if (value < field.min || value > field.max) return `${field.label}: Wert zwischen ${field.min} und ${field.max} wählen.`;
      return null;
    case 'toggle':
      return typeof value === 'boolean' ? null : `${field.label}: Ein oder Aus erwartet.`;
    case 'choice':
      return field.options.some((o) => o.value === value) ? null : `${field.label}: ungültige Auswahl.`;
    case 'text': {
      if (typeof value !== 'string') return `${field.label}: Text erwartet.`;
      if (value.length > (field.max ?? 500)) return `${field.label}: höchstens ${field.max ?? 500} Zeichen.`;
      if (value !== '' && field.pattern && !field.pattern.test(value)) return field.patternMessage ?? `${field.label}: ungültiges Format.`;
      return null;
    }
    case 'multi': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) return `${field.label}: ungültige Liste.`;
      if (new Set(value).size !== value.length) return `${field.label}: doppelte Einträge.`;
      if (!field.allowCustom && value.some((v) => !field.options.includes(v))) return `${field.label}: unbekannter Eintrag.`;
      if (value.some((v) => v.length > 20)) return `${field.label}: Einträge dürfen höchstens 20 Zeichen haben.`;
      if (value.length < (field.min ?? 0)) return `${field.label}: mindestens ${field.min} auswählen.`;
      return null;
    }
    default:
      return `${field.label}: unbekannter Typ.`;
  }
}

/**
 * Validate a full set of values. `cross` is an optional module rule over all values
 * (for example "the preposition pool must be big enough") returning an error message or null.
 * @returns {Record<string,string>} errors by key ('_' for cross-field errors); empty when valid
 */
export function validate(schema, values, cross) {
  const errors = {};
  for (const f of schema) {
    const err = validateField(f, values[f.key]);
    if (err) errors[f.key] = err;
  }
  if (!Object.keys(errors).length && cross) {
    const err = cross(values);
    if (err) errors._ = err;
  }
  return errors;
}

/** Load persisted values: unknown keys are dropped, invalid or missing ones fall back to the default. */
export function sanitize(schema, saved) {
  const out = defaultsOf(schema);
  for (const f of schema) {
    if (saved && f.key in saved && validateField(f, saved[f.key]) === null) out[f.key] = saved[f.key];
  }
  return out;
}

/**
 * Try a change. Nothing is applied when invalid, so the caller keeps the old values and shows the message.
 * @returns {{ok:boolean, values:object, errors:Record<string,string>}}
 */
export function applyChange(schema, current, patch, cross) {
  const next = { ...current, ...patch };
  const errors = validate(schema, next, cross);
  return Object.keys(errors).length ? { ok: false, values: current, errors } : { ok: true, values: next, errors };
}

const key = (ns) => (ns === 'global' ? 'global' : `module:${ns}`);

/** Persist one namespace. `store` is core/store.js (or a fake in tests). Never touches events. */
export const saveSettings = (store, ns, values) => store.put('settings', { key: key(ns), values });

export async function loadSettings(store, ns, schema) {
  const rec = await store.get('settings', key(ns));
  return sanitize(schema, rec?.values);
}

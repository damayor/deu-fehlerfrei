// Generic settings form generated from a schema (see core/settings.js). Every change is validated,
// then saved; an invalid change is rejected, the old value stays and the reason is shown.
import { h } from './ui.js';
import { applyChange } from './settings.js';

/**
 * @param {{schema:any[], values:object, cross?:Function, onSave:(values:object)=>Promise<void>, onSaved?:(values:object)=>void}} opts
 * @returns {HTMLElement}
 */
export function schemaForm({ schema, values, cross, onSave, onSaved }) {
  let current = values;
  const root = h('div', { class: 'form' });
  const msg = h('p', { class: 'error', role: 'alert' });

  async function change(patch) {
    const r = applyChange(schema, current, patch, cross);
    if (!r.ok) { msg.textContent = Object.values(r.errors)[0]; draw(); return; }
    current = r.values;
    msg.textContent = '';
    draw();
    try { await onSave(current); onSaved?.(current); } catch (err) { msg.textContent = `Speichern fehlgeschlagen: ${err.message}`; }
  }

  const control = {
    stepper: (f, v) => h('div', { class: 'stepper' },
      h('button', { class: 'secondary', 'aria-label': `${f.label}: weniger`, disabled: v <= f.min, onclick: () => change({ [f.key]: v - 1 }) }, '−'),
      h('output', { 'aria-live': 'polite' }, String(v)),
      h('button', { class: 'secondary', 'aria-label': `${f.label}: mehr`, disabled: v >= f.max, onclick: () => change({ [f.key]: v + 1 }) }, '+')),
    toggle: (f, v) => h('button', { class: 'switch', role: 'switch', 'aria-checked': String(v), 'aria-label': f.label, onclick: () => change({ [f.key]: !v }) }, v ? 'An' : 'Aus'),
    choice: (f, v) => h('div', { class: 'chips', role: 'group', 'aria-label': f.label },
      ...f.options.map((o) => h('button', { class: 'chip', 'aria-pressed': String(o.value === v), onclick: () => change({ [f.key]: o.value }) }, o.label))),
    multi: (f, v) => multi(f, v),
  };

  function multi(f, v) {
    const all = [...new Set([...f.options, ...v])]; // custom entries are only in the value
    const list = h('div', { class: 'checks' }, ...all.map((o) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: v.includes(o), onchange: (e) => change({ [f.key]: all.filter((x) => (x === o ? e.target.checked : v.includes(x))) }) }),
      h('span', null, o))));
    if (!f.allowCustom) return list;
    const input = h('input', { type: 'text', maxlength: 20, placeholder: 'Eigene hinzufügen', 'aria-label': `${f.label}: eigenen Eintrag hinzufügen`, autocapitalize: 'none' });
    const add = () => {
      const word = input.value.trim().toLowerCase();
      if (!word) return;
      change({ [f.key]: v.includes(word) ? v : [...all.filter((x) => v.includes(x)), word] });
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return h('div', null, list, h('div', { class: 'add-row' }, input, h('button', { onclick: add }, 'Hinzufügen')));
  }

  function draw() {
    root.replaceChildren(...schema.map((f) => h('div', { class: 'field' },
      h('div', { class: 'field-label' }, f.label), control[f.type](f, current[f.key]))), msg);
  }

  draw();
  return root;
}

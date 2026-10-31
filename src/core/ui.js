// Shared UI helpers.

/**
 * Tiny element builder: h('div', {class: 'card'}, 'text', childEl)
 * @param {string} tag @param {Record<string, any>|null} [attrs] @param {...(Node|string|null)} kids
 */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}

export function errorScreen(title, err) {
  return h('div', { class: 'card' },
    h('h1', null, title),
    h('p', { class: 'error' }, String(err?.message ?? err)),
    h('p', { class: 'muted' }, 'Der Fehler wurde gespeichert. Die anderen Bereiche funktionieren weiter.'));
}

export function placeholder(title, text) {
  return h('div', null, h('h1', null, title), h('p', { class: 'muted' }, text));
}

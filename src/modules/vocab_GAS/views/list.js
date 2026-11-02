import { h } from '../../../core/ui.js';
import { dayKey } from '../../../core/activity.js';
import { isConfigured } from '../settings.js';
import { fetchToday } from '../sync.js';
import { slotLabel, slotStatus, totalWords } from '../engine.js';

const fmtTime = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** @param {HTMLElement} el @param {{ctx:any, cached:{data:any, syncedAt:number}|null, fetchFn?:typeof fetch}} init */
export function startList(el, { ctx, cached, fetchFn }) {
  const root = h('div');
  el.append(root);
  let alive = true;
  let state = cached; // { data, syncedAt }
  let error = null;
  let busy = false;

  const today = () => dayKey(Date.now());
  const fresh = () => state?.data?.date === today();

  async function sync() {
    if (busy) return;
    busy = true; error = null; draw();
    try {
      const data = await fetchToday(ctx.settings, fetchFn);
      state = { data, syncedAt: Date.now() };
      await ctx.state.set(state);
    } catch (err) { error = err.message; }
    busy = false;
    if (alive) draw();
  }

  function word(w) {
    const btn = h('button', { class: 'word', 'aria-expanded': 'false', onclick: () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      trad.hidden = open;
    } },
      h('span', { class: 'orig', lang: 'de' }, w.orig),
      w.frase ? h('span', { class: 'frase', lang: 'de' }, w.frase) : null);
    const trad = h('span', { class: 'trad' }, w.trad || '–');
    trad.hidden = true;
    btn.append(trad);
    return btn;
  }

  function slot(s, now) {
    const status = slotStatus(s, now);
    return h('section', { class: 'card slot' },
      h('h2', null, `${s.hour != null ? `${String(s.hour).padStart(2, '0')}:23 · ` : ''}${slotLabel(s)}`),
      h('p', { class: 'muted' }, status === 'sent' ? 'Schon gesendet' : status === 'upcoming' ? 'Kommt noch' : ''),
      ...s.words.map(word),
      s.englishCount ? h('p', { class: 'muted hint' }, 'Hay datos, ¡pero ve a la app de inglés!') : null);
  }

  function draw() {
    const out = [h('h1', null, 'Wörter des Tages')];
    if (!isConfigured(ctx.settings)) {
      out.push(h('div', { class: 'card' }, h('p', null, 'Noch nicht eingerichtet.'),
        h('p', { class: 'muted' }, 'Trage die Web-App-URL und das Token unter Einstellungen ein.'),
        h('a', { class: 'btn', href: '#/einstellungen' }, 'Zu den Einstellungen')));
    } else {
      if (fresh()) {
        const total = totalWords(state.data);
        out.push(h('p', { class: 'muted' }, `${total} Wörter in ${state.data.slots.length} Wiederholungen · Stand ${fmtTime(state.syncedAt)}`));
        if (!state.data.slots.length) out.push(h('div', { class: 'card' }, h('p', null, 'Heute gibt es keine Wörter zu wiederholen.')));
        const now = new Date();
        out.push(...state.data.slots.map((s) => slot(s, now)));
      } else if (!busy) {
        out.push(h('div', { class: 'card' }, h('p', null, state ? 'Die gespeicherte Liste ist von einem anderen Tag.' : 'Noch keine Liste geladen.')));
      }
      if (error) out.push(h('p', { class: 'error', role: 'alert' }, error + (fresh() ? ' Es wird die zuletzt geladene Liste gezeigt.' : '')));
      out.push(h('button', { class: 'next', disabled: busy, onclick: sync }, busy ? 'Lädt …' : 'Aktualisieren'));
    }
    root.replaceChildren(...out);
  }

  draw();
  if (isConfigured(ctx.settings) && !fresh()) sync();
  return { destroy() { alive = false; } };
}

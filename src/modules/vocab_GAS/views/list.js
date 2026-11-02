import { h } from '../../../core/ui.js';
import { dayKey } from '../../../core/activity.js';
import { isConfigured } from '../settings.js';
import { fetchToday } from '../sync.js';
import { slotLabel, totalWords, countStates, originDate, highlightParts, STATE_LABEL } from '../engine.js';

const fmtTime = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const ICON = { known: '✓', recalled: '◐', open: '○', new: '' };
const cap = (t) => t[0].toUpperCase() + t.slice(1);

/** @param {HTMLElement} el @param {{ctx:any, cached:{data:any, syncedAt:number}|null, fetchFn?:typeof fetch}} init */
export function startList(el, { ctx, cached, fetchFn }) {
  const root = h('div', { class: 'vocab' });
  el.append(root);
  let alive = true;
  let state = cached; // { data, syncedAt }
  let error = null;
  let busy = false;
  let filter = 'all'; // 'all' | 'todo'

  const fresh = () => state?.data?.date === dayKey(Date.now());

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

  function sentence(w) {
    const parts = highlightParts(w.frase, w.orig);
    return h('span', { class: 'frase', lang: 'de' },
      ...(parts ? [parts.before, h('mark', null, parts.match), parts.after] : [w.frase]));
  }

  function word(w0) {
    const w = { state: 'new', badPhrase: false, ...w0 }; // lists cached by older versions have no state
    const btn = h('button', { class: `word st-${w.state}`, 'aria-expanded': 'false', onclick: () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      trad.hidden = open;
    } },
      h('span', { class: 'word-top' },
        h('span', { class: 'orig', lang: 'de' }, w.orig),
        w.state === 'new' ? null : h('span', { class: `tag st-${w.state}` }, `${ICON[w.state]} ${STATE_LABEL[w.state]}`)),
      w.frase ? sentence(w) : null,
      w.badPhrase ? h('span', { class: 'bad' }, 'Satz passt nicht zum Wort') : null);
    const trad = h('span', { class: 'trad' }, `🇪🇸 ${w.trad || '–'}`);
    trad.hidden = true;
    btn.append(trad);
    return btn;
  }

  function slot(s, date) {
    const words = filter === 'todo' ? s.words.filter((w) => !w.state || w.state === 'open' || w.state === 'new') : s.words;
    if (!words.length && !s.englishCount) return null;
    const origin = fmtDay(originDate(date, s));
    return h('section', { class: 'card slot' },
      h('div', { class: 'slot-head' },
        h('h2', null, cap(slotLabel(s))),
        h('span', { class: 'muted' }, `${origin} · ${s.words.length} ${s.words.length === 1 ? 'Wort' : 'Wörter'}`)),
      ...words.map(word),
      s.englishCount ? h('p', { class: 'muted hint' }, 'Hay datos, ¡pero ve a la app de inglés!') : null);
  }

  function summary(data) {
    const c = countStates(data);
    const chip = (key, label) => c[key] ? h('span', { class: `count st-${key}` }, h('b', null, String(c[key])), ` ${label}`) : null;
    const filters = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' },
      ...[['all', 'Alle'], ['todo', 'Noch üben']].map(([v, label]) => h('button', {
        class: 'chip', 'aria-pressed': String(filter === v), onclick: () => { filter = v; draw(); } }, label)));
    return h('div', { class: 'card' },
      h('p', { class: 'big' }, `${totalWords(data)} Wörter`),
      h('p', { class: 'muted' }, `${data.slots.length} Wiederholungen · Stand ${fmtTime(state.syncedAt)}`),
      h('div', { class: 'counts' }, chip('known', 'sicher'), chip('recalled', 'mit Satz'), chip('open', 'offen'), chip('new', 'neu')),
      filters,
      h('p', { class: 'muted hint' }, 'Tippe ein Wort, um die Übersetzung zu sehen.'));
  }

  function draw() {
    const out = [h('h1', null, 'Wörter des Tages')];
    if (!isConfigured(ctx.settings)) {
      out.push(h('div', { class: 'card' }, h('p', null, 'Noch nicht eingerichtet.'),
        h('p', { class: 'muted' }, 'Trage die Web-App-URL und das Token unter Einstellungen ein.'),
        h('a', { class: 'btn', href: '#/einstellungen' }, 'Zu den Einstellungen')));
    } else {
      if (fresh()) {
        if (!state.data.slots.length) out.push(h('div', { class: 'card' }, h('p', null, 'Heute gibt es keine Wörter zu wiederholen.')));
        else out.push(summary(state.data), ...state.data.slots.map((s) => slot(s, state.data.date)).filter(Boolean));
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

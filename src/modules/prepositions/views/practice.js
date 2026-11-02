// Flashcard UI for Prepositions. All learning rules live in ../engine.js.
import { h } from '../../../core/ui.js';
import * as E from '../engine.js';

const CATS = [['all', 'Alle'], ['V', 'Verben'], ['N', 'Nomen'], ['A', 'Adjektive']];
const BLANK = '＿＿＿';

/** Replace the last occurrence of the preposition in the phrase with a blank. */
export function withBlank(word, prep) {
  const parts = word.split(' ');
  const i = parts.lastIndexOf(prep);
  if (i === -1) return `${word} ${BLANK}`;
  parts[i] = BLANK;
  return parts.join(' ');
}

/**
 * @param {HTMLElement} el
 * @param {{items:any[], ctx:any, progress:Record<string,any>, queue:string[], lastId:string|null, roundCount:number, rng?:()=>number}} init
 */
export function startPractice(el, init) {
  const { items, ctx, rng = Math.random } = init;
  const settings = ctx.settings;
  const s = { progress: init.progress, queue: init.queue, lastId: init.lastId, roundCount: init.roundCount, roundCorrect: 0, cat: 'all', timer: null, alive: true };
  const root = h('div', { class: 'practice' });
  el.append(root);

  const persist = () => ctx.state.set({ queue: s.queue, lastId: s.lastId }).catch((err) => notice(err.message));
  const notice = (msg) => { if (s.alive) root.append(h('p', { class: 'error', role: 'alert' }, msg)); };
  const graduatedCount = () => items.filter((it) => s.progress[it.id]?.graduated).length;

  function header() {
    return h('div', { class: 'card-head' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Kategorie' },
        ...CATS.map(([v, label]) => h('button', {
          class: 'chip', 'aria-pressed': String(s.cat === v), disabled: v !== 'all' && !settings.categories.includes(v),
          onclick: () => { s.cat = v; next(); },
        }, label))),
      h('p', { class: 'muted' }, `Runde: ${s.roundCount} / ${settings.roundSize} · Verinnerlicht: ${graduatedCount()} / ${items.length}`));
  }

  function show(...kids) {
    if (!s.alive) return;
    clearTimeout(s.timer);
    root.replaceChildren(header(), ...kids);
  }

  function next() {
    const card = E.pickCard(s.queue, items, s.lastId, settings, rng, s.cat);
    if (card) return showCard(card);
    if (!s.queue.length) {
      const all = graduatedCount() >= items.filter((it) => settings.categories.includes(it.cat)).length;
      return show(h('div', { class: 'card' },
        h('h1', null, all ? 'Alles verinnerlicht 🎉' : 'Keine Karten verfügbar'),
        h('p', null, all ? 'Du hast alle Einträge dieser Kategorien gemeistert.' : 'Prüfe die Kategorien in den Einstellungen.')));
    }
    show(h('div', { class: 'card' }, h('p', null, 'Keine aktive Karte in dieser Kategorie. Wähle „Alle“ oder starte eine neue Runde.')));
  }

  function showCard(card) {
    const options = E.buildOptions(card, settings, rng);
    const shownAt = performance.now();
    show(h('div', { class: 'card flash' },
      h('p', { class: 'muted' }, { V: 'Verb', N: 'Nomen', A: 'Adjektiv' }[card.cat]),
      h('p', { class: 'phrase', lang: 'de' }, withBlank(card.word, card.prep))),
      h('div', { class: 'options' }, ...options.map((o) =>
        h('button', { class: 'opt', onclick: (ev) => answer(card, o, Math.round(performance.now() - shownAt), ev.currentTarget.parentNode) }, o))));
  }

  async function answer(card, choice, ms, box) {
    box.querySelectorAll('button').forEach((b) => {
      b.disabled = true;
      if (b.textContent === card.prep) b.classList.add('ok');
      else if (b.textContent === choice) b.classList.add('no');
    });
    const correct = choice === card.prep;
    s.progress[card.id] = E.applyAnswer(s.progress[card.id] ?? { streak: 0, correct: 0, wrong: 0, graduated: false }, correct, settings);
    s.roundCount += 1;
    if (correct) s.roundCorrect += 1;
    s.lastId = card.id;
    let roundDone = false;
    try {
      await ctx.logEvent({ type: 'answer', itemId: card.id, correct, ms });
      if (s.roundCount >= settings.roundSize) {
        await ctx.completeActivity({ kind: 'round', meta: { answered: s.roundCount, correct: s.roundCorrect } });
        roundDone = true;
      }
    } catch (err) { notice(`Speichern fehlgeschlagen: ${err.message}`); }
    if (s.progress[card.id].graduated) s.queue = E.fillQueue(items, s.progress, s.queue, settings, rng, [card.id]);
    const summary = roundDone ? { answered: s.roundCount, correct: s.roundCorrect, graduated: graduatedCount() } : null;
    if (roundDone) {
      s.queue = E.rotateQueue(items, s.progress, s.queue, settings, rng);
      s.roundCount = 0; s.roundCorrect = 0;
    }
    persist();
    feedback(card, choice, correct, box, summary);
  }

  function feedback(card, choice, correct, box, summary) {
    if (!s.alive) return;
    const phrase = card.case ? `${card.word} + ${card.case}` : card.word;
    const go = () => (summary ? roundScreen(summary) : next());
    const fb = h('div', { class: `card feedback ${correct ? 'ok' : 'no'}`, role: 'status' },
      h('p', { class: 'verdict' }, correct ? '✓ Richtig' : `✗ Falsch – richtig ist „${card.prep}“`),
      h('p', { class: 'phrase-sm' }, phrase),
      settings.showExample && card.example_de ? h('p', { lang: 'de' }, card.example_de) : null,
      settings.showExample && card.example_es ? h('p', { class: 'muted' }, card.example_es) : null,
      h('button', { class: 'next', onclick: go }, summary ? 'Runde abschließen' : 'Weiter'));
    box.after(fb);
    fb.scrollIntoView?.({ block: 'nearest' });
    if (settings.autoAdvance > 0 && !summary) s.timer = setTimeout(go, settings.autoAdvance * 1000);
  }

  function roundScreen({ answered, correct, graduated }) {
    show(h('div', { class: 'card' },
      h('h1', null, 'Runde geschafft 🎉'),
      h('p', null, `${correct} von ${answered} richtig.`),
      h('p', null, `Verinnerlicht insgesamt: ${graduated} / ${items.length}`),
      h('button', { class: 'next', onclick: next }, 'Neue Runde')));
  }

  next();
  return { destroy() { s.alive = false; clearTimeout(s.timer); } };
}

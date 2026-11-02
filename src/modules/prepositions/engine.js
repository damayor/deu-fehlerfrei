// Pure learning logic for Prepositions. No DOM, no storage, no clock: everything comes in as arguments.
// `rng` is a function returning a float in [0, 1) (Math.random in the app, a seeded one in tests).

/** @typedef {{id:string,cat:'V'|'N'|'A',word:string,prep:string,case:string|null,priorityTier:'top'|'normal'|'none',family:string|null,example_de:string|null,example_es:string|null}} Item */
/** @typedef {{streak:number,correct:number,wrong:number,graduated:boolean}} Rec */
/** @typedef {{queue:string[],lastId:string|null}} QueueState */

export const BASE_PREPS = ['an', 'auf', 'in', 'über', 'vor', 'bei', 'mit', 'nach', 'von', 'zu', 'für', 'um'];
const TIERS = ['top', 'normal', 'none'];

export const DEFAULTS = {
  gradThreshold: 4,
  queueSize: 6,
  optionCount: 4,
  prepPool: BASE_PREPS,
  categories: ['V', 'N', 'A'],
  priorityFirst: true,
  roundSize: 10,
};

const emptyRec = () => ({ streak: 0, correct: 0, wrong: 0, graduated: false });

/** Rebuild per-item progress by replaying answer events in time order. */
export function deriveProgress(events, settings = DEFAULTS) {
  /** @type {Record<string, Rec>} */
  const progress = {};
  const answers = events.filter((e) => e.module === 'prepositions' && e.type === 'answer')
    .sort((a, b) => a.ts - b.ts);
  for (const e of answers) progress[e.itemId] = applyAnswer(progress[e.itemId] ?? emptyRec(), e.correct, settings);
  return progress;
}

/** One answer: correct = streak +1; wrong = streak -1 (min 0). Graduated items stay graduated. */
export function applyAnswer(rec, correct, settings = DEFAULTS) {
  const next = { ...rec };
  if (correct) { next.correct += 1; next.streak += 1; }
  else { next.wrong += 1; next.streak = Math.max(0, next.streak - 1); }
  if (next.streak >= settings.gradThreshold) next.graduated = true;
  return next;
}

function pickRandom(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Items that may enter the queue now: enabled category, not graduated, not already queued. */
function candidates(items, progress, queue, settings, exclude = []) {
  const queued = new Set(queue);
  const skip = new Set(exclude);
  return items.filter((it) => settings.categories.includes(it.cat)
    && !progress[it.id]?.graduated && !queued.has(it.id) && !skip.has(it.id));
}

/** Pool for the next pick: lowest tier that still has candidates, or everything when priorityFirst is off. */
function nextPool(cands, settings) {
  if (!settings.priorityFirst) return cands;
  for (const tier of TIERS) {
    const inTier = cands.filter((it) => it.priorityTier === tier);
    if (inTier.length) return inTier;
  }
  return [];
}

/** Fill the queue up to queueSize. Drops graduated and disabled-category items first. */
export function fillQueue(items, progress, queue, settings, rng, exclude = []) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const q = queue.filter((id) => byId.has(id) && !progress[id]?.graduated
    && settings.categories.includes(byId.get(id).cat));
  if (q.length > settings.queueSize) { // queue size was lowered: keep the items with the most progress
    const keep = new Set([...q].sort((a, b) => (progress[b]?.streak ?? 0) - (progress[a]?.streak ?? 0)).slice(0, settings.queueSize));
    q.splice(0, q.length, ...q.filter((id) => keep.has(id)));
  }
  while (q.length < settings.queueSize) {
    let pool = nextPool(candidates(items, progress, q, settings, exclude), settings);
    if (!pool.length) pool = nextPool(candidates(items, progress, q, settings), settings); // fall back to excluded
    if (!pool.length) break;
    q.push(pickRandom(pool, rng).id);
  }
  return q;
}

/** "Neue Runde": items still at streak 0 are swapped for fresh pool items, started streaks stay. */
export function rotateQueue(items, progress, queue, settings, rng) {
  const keep = queue.filter((id) => (progress[id]?.streak ?? 0) > 0);
  const dropped = queue.filter((id) => !keep.includes(id));
  return fillQueue(items, progress, keep, settings, rng, dropped);
}

/** Random card from the queue, never the same twice in a row (unless it is the only one). */
export function pickCard(queue, items, lastId, settings, rng, catFilter = 'all') {
  const byId = new Map(items.map((it) => [it.id, it]));
  let pool = queue.filter((id) => catFilter === 'all' || byId.get(id)?.cat === catFilter);
  if (pool.length > 1) pool = pool.filter((id) => id !== lastId);
  return pool.length ? byId.get(pickRandom(pool, rng)) : null;
}

/** Answer options: always contains the correct preposition, no duplicates, shuffled. */
export function buildOptions(item, settings, rng) {
  const n = settings.optionCount;
  const others = (list) => list.filter((p) => p !== item.prep);
  let distractors = shuffle(others([...new Set(settings.prepPool)]), rng).slice(0, n - 1);
  if (distractors.length < n - 1) { // pool too small: pad from the base list instead of showing fewer options
    const extra = others(BASE_PREPS).filter((p) => !distractors.includes(p));
    distractors = distractors.concat(shuffle(extra, rng).slice(0, n - 1 - distractors.length));
  }
  return shuffle([item.prep, ...distractors], rng);
}

/** Answers logged since the module's last completed round (activity event). */
export function answersInCurrentRound(events) {
  const mine = events.filter((e) => e.module === 'prepositions').sort((a, b) => a.ts - b.ts);
  let count = 0;
  for (const e of mine) {
    if (e.type === 'activity') count = 0;
    else if (e.type === 'answer') count += 1;
  }
  return count;
}

export const isRoundComplete = (events, settings) => answersInCurrentRound(events) >= settings.roundSize;

/** Summary for the Fortschritt tab. */
export function summarize(items, progress) {
  let correct = 0; let wrong = 0; let graduated = 0;
  const hardest = [];
  for (const it of items) {
    const r = progress[it.id];
    if (!r) continue;
    correct += r.correct; wrong += r.wrong;
    if (r.graduated) graduated += 1;
    if (r.wrong > 0) hardest.push({ id: it.id, word: it.word, wrong: r.wrong, correct: r.correct });
  }
  hardest.sort((a, b) => b.wrong - a.wrong);
  const total = correct + wrong;
  return { graduated, total: items.length, accuracy: total ? correct / total : null, hardest: hardest.slice(0, 8) };
}

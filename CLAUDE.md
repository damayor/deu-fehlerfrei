# German Trainer (telc B2)

One installable phone app (PWA) with several German exercise modules that share a daily goal and streak.
Owner: David (Berlin). Chat with him in Colombian Spanish. Code, comments and commit messages in English. App UI in German, with Spanish hints where they help learning.

## Priorities (strict order)

1. **Prepositions** (`modules/prepositions`): must work reliably on David's real phone, with menu and a configurable settings window. **Only this is built now.**
2. **Mistakes Test** (`modules/mistakes`): generates tests from David's own past German mistakes, stored in Cloudflare D1 by his feedback agent. Second objective. Do not start until Prepositions passes its final phone check.
3. **Vocab GAS** (`modules/vocab_GAS`): built (v0.5.0). Shows today's words from David's Telegram schedule. Pull only, see "Module: Vocab GAS" below.
4. **Vocab B2** (`modules/vocab_B2`): last, and optional. It already works today through Google Sheets and Telegram, so skipping the rebuild loses nothing. Placeholder only. Never touch `legacy/vocab_B2/`, the Apps Script project or the Telegram reminders.

If a choice trades phone reliability for features, choose reliability.

## Architecture: one app, strictly isolated modules

Shared on purpose (thin `core/`): storage, event log, daily goal and streak, settings shell, UI shell.
Not shared: anything specific to an exercise.

Rules:

- A module **never imports another module**. Modules talk to the rest only through `ctx` from `core/`.
- The app must boot and work with **any subset of modules**. A config list `ENABLED_MODULES` decides which are registered. Right now it is `['prepositions']`, and that build must be complete on its own.
- A crashing module must not break the shell or other modules (error boundary around every module mount, friendly error screen, error written to an `errors` store).
- Each module has its own settings namespace (`settings.modules.<id>`), its own data, its own unit tests.
- Do not extract shared learning logic out of Prepositions until it is stable and tested. If the Mistakes module can reuse it, extract to `core/` afterwards without changing Prepositions behavior.

## Principles

- Vanilla JavaScript, ES modules, JSDoc types. No framework, no build step, no runtime dependencies. Dev tooling only with David's approval.
- **Offline first.** Everything needed to practice is on the device. Network is only for optional pulls (Mistakes module) and never blocks practice.
- Mobile first: design at 360 px width, tap targets at least 44 px, safe areas, portrait and landscape.
- No background work in the app. The only push is the optional **streak reminder** (Android, one notification per day when the goal is still open, `worker/push`): the Worker sends it, the app runs nothing while closed. It asks the notification permission once, only when David taps "Aktivieren". Nothing else may push or prompt.
- Relative URLs only (the app is served from a sub-path on GitHub Pages).
- Parity first: reproduce legacy behavior before adding anything.
- Small files, one responsibility each. No secrets in the repo or in deployed code.

## Repo layout

```
index.html  manifest.webmanifest  sw.js  icons/
src/
  app.js                 bootstrap, hash router, bottom tab bar, module registry
  config.js              ENABLED_MODULES, version
  core/
    store.js             IndexedDB wrapper: stores events, settings, cache, errors
    events.js            create/validate events
    activity.js          daily goal + streak, derived from events (pure functions)
    settings.js          global settings + per-module namespaces, validation
    ui.js                shared components
  modules/
    prepositions/        index.js engine.js data.json views/ tests/
    mistakes/            (phase 2)
    vocab_GAS/           today's words from the Google Apps Script (built)
    vocab_B2/            README placeholder (last)
worker/                  Cloudflare Worker for the Mistakes module (phase 2)
legacy/                  original code, read-only
docs/                    legacy-notes.md, german-feedback-agent.md
```

IndexedDB database name: `german-trainer`. One service worker, versioned cache.

## Module contract

```js
export default {
  id: 'prepositions',
  title: 'Präpositionen',
  defaultSettings: {},
  settingsSchema: [],          // drives that module's section in the settings window
  async load(ctx) {},
  mount(el, ctx) {},
  unmount() {},
  stats(events) {}             // summary for the progress tab
}
```

`ctx`: `logEvent()`, `getEvents(filter)`, `settings`, `ui`, `completeActivity(info)`.

## Event log, activities, daily goal and streak

Append-only events in IndexedDB. State is derived from events, never the other way around.

```js
// answer event
{ id, ts, module: 'prepositions', type: 'answer', itemId, correct, ms }
// activity event (written when a module completes one "exercise")
{ id, ts, module: 'prepositions', type: 'activity', kind: 'round', meta: {} }
```

- An **activity** is one completed exercise: Prepositions = one completed round ("Neue Runde"), Mistakes = one completed test (default 10 questions). Each module decides when to call `completeActivity()`.
- **Daily goal**: default 2 activities per day, counting any module. David's rule: at least 2 exercises per day done in at least one module. Configurable (1 to 10).
- **Streak**: consecutive days (device local date) where the goal was met. Today is "pending" until met and does not break the streak until the day ends.
- `core/activity.js` is pure and unit tested (day boundaries, streak across midnight, DST days, empty history).
- This must already work with Prepositions alone (2 rounds a day).
- Open assumption: confirm with David that "exercise = one completed round or test" is what he means. If he prefers another unit (for example N answered cards), change `kind` and the goal logic only.

## Navigation

Bottom tab bar, always visible: **Heute** (daily goal, streak, module cards), **Üben** (module list, then the module's screens), **Fortschritt** (global + per module stats), **Einstellungen**. Hash routing. Inside Prepositions a top sub-nav: Üben, Verinnerlicht.

## Settings window

Global section: daily goal, theme (auto, light, dark), backup (export, import, reset with confirmation, last export date), version, "Update prüfen", restore defaults.
Then one section per module, generated from `settingsSchema`.

### Prepositions settings

| Setting | Control | Default | Range or notes |
|---|---|---|---|
| Graduation threshold | stepper | 4 | 3 to 5 |
| Active queue size | stepper | 6 | 4 to 12 |
| Number of answer options | stepper | 4 | 3 to 6 |
| Preposition option pool | checkbox list | an, auf, in, über, vor, bei, mit, nach, von, zu, für, um | enable, disable, add custom. The correct answer is always included. |
| Distractor strategy | choice | random from pool | random, or "confusable" if cheap |
| Categories | checkboxes | V, N, A | at least one |
| Priority first | toggle | on | off means the whole pool from the start |
| Round size (for activity) | stepper | 10 | how many answered cards complete a round (independent of queue size) |
| Show example sentence | toggle | on | |
| Auto advance after answer | choice | off | off, 2 s, 4 s |

Validate every change (for example the option pool needs at least `options - 1` prepositions besides the correct one, otherwise block and say why). Settings apply immediately, persist in IndexedDB and never delete progress.

## Module 1: Prepositions (legacy: `legacy/prepositions.html`)

About 90 to 101 items. Source of truth for words and colors: `legacy/prepositions_items.json` (from the sheet DEU25 > "Präpositionen"). Example sentences, translations and cases are not in the sheet, they come from `legacy/prepositions.html`. Highlight colors: yellow, orange, green and red = `top` priority (ultra important, not yet learned); pink, magenta, yellow_light and yellow_bright = `normal` priority; blue = family (same preposition for verb, noun and adjective). Order: top, normal, rest. Keep the `highlight` field.

```json
{ "id": "V-sich-aergern-ueber", "cat": "V", "word": "sich ärgern über",
  "prep": "über", "case": "Akk", "priorityTier": "normal", "family": null,
  "example_de": "…", "example_es": "…" }
```

`cat` V, N or A. `word` includes the preposition and the card shows a blank in its place. `priorityTier` = `top` | `normal` | `none` from the highlight color (see above). `family` links noun, adjective and verb sharing a preposition (blue cells). Validate on load and show a friendly error screen on failure.

Behavior to reproduce:

- One flashcard at a time, multiple choice.
- Active queue (default 6), top items first, then normal, then the rest; the pool expands to the next tier when the previous one is exhausted.
- Streak per item. Correct: +1. Wrong: streak minus 1 (never below 0), item stays in the queue.
- Graduation at N consecutive correct (default 4) moves the item to "Endlich verinnerlicht", never asked again. A graduate is replaced by a pending item.
- At each "Neue Runde", items at streak 0 are swapped for random pool items, items with a started streak stay.
- After each answer show the example sentence, Spanish translation and case if known (for example "sich freuen auf + Akk").
- Category filter (V, N, A). Progress: graduated count, historical accuracy, hardest items.
- `engine.js` is pure (items, events, settings, now in; next card or state out) and unit tested with `node --test`.
- Write the exact legacy rules (especially the wrong answer rule) into `docs/legacy-notes.md`. If the spec and legacy code conflict, ask David.

## Module 2: Mistakes Test (phase 2, do not start early)

Generates practice from David's real mistakes. The data is written by his separate "German Feedback Agent" (a Claude Project). Its full instructions are in `docs/german-feedback-agent.md`, which is the source of truth for the data. The app is **read-only** against that database.

Data source (fixed, never any other database): Cloudflare D1 `de-berichtigung-db`, table `mistakes_de`:

```sql
id INTEGER PRIMARY KEY, chat_id TEXT, category TEXT, original TEXT,
corrected TEXT, explanation TEXT, created_at TEXT
```

Categories are exactly these five strings: `Grammatik & Zeichensetzung`, `Präpositionen und Verbvalenz`, `Vokabeln`, `Kollokationen & Satzbau`, `Orthographie`. Only `chat_id = 'david'`. Note that `original` and `corrected` are **fragments**, not full sentences, and `explanation` may be empty. Its style depends on category (German tags for Grammatik and Präpositionen, empty for Orthographie, short Spanish for Vokabeln and Kollokationen).

Access: a PWA cannot query D1 directly. Build a small Cloudflare Worker (`worker/`) with a D1 binding that exposes **read-only** `GET /mistakes?since=<iso>&limit=<n>`. No write endpoints. Handle CORS and preflight for the app origin only. The auth token is **not** in the repo or in deployed code: David types the Worker URL and token once in the module's settings and they are stored in IndexedDB. The Worker stores the token as a secret (`wrangler secret`). Never log tokens.

Offline: pull new rows when online, cache them in IndexedDB, and generate tests from the cache. Tests must work in airplane mode.

Test generation (no LLM in phase 2, deterministic):

- Dedupe by (original, corrected).
- **Orthographie, Vokabeln, Kollokationen & Satzbau**: show the wrong `original`, ask David to type the correct version, compare after normalizing case and punctuation, show the diff and the `corrected` fragment. A "choose" mode (original vs corrected, shuffled) is available as a setting.
- **Präpositionen und Verbvalenz**: if the corrected fragment contains a preposition from the known pool, make a fill-the-blank multiple choice with plausible prepositions. Otherwise use the type or choose mode.
- **Grammatik & Zeichensetzung**: choose mode (original vs corrected) or type mode, with the German tag explanation shown as feedback.
- Feedback always shows the explanation when present. Do not invent explanations.
- Selection: weight toward mistakes failed recently and toward the most frequent categories. Per-mistake correct streak graduates a mistake out of rotation after N correct (setting, default 3), derived from local events keyed by the D1 `id`. Nothing is ever written back to D1.
- Settings: questions per test (default 10), categories included, mode per category, graduation threshold, date range, Worker URL and token, "Sync now" with last sync time.
- One completed test = one activity for the daily goal.
- Later and optional: LLM-generated distractors or full-sentence contexts through the Worker. This needs a cost and key decision from David first.

## Module 3: Vocab B2 (last, optional)

Placeholder README only. Context for later: Google Sheet `TELC B2 Vokabeln SRS`, Apps Script web app, Telegram reminders already working, about 130 to 147 B1/B2 words in blocks by exam section. If David drops this, nothing else depends on it.

## Module: Vocab GAS (built)

Preview of the words the Telegram alerts send today (German only), read from David's Google Apps Script web app (`docs/vocab-gas-endpoint.gs`, read-only `doGet`). The 7 activators (months 8, 7, 6, 1, then days 15, 7, 5) at 09 to 21 h. The state of each word comes from the cell colors that the Telegram reactions write. Web-app URL and token live in IndexedDB (module settings) and are left out of backup files. Viewing does not count as an activity. Not the same as `vocab_B2`; never touch `legacy/vocab_B2/`, the Apps Script project or the Telegram reminders.

## Reliability requirements (what "it works" means)

1. Installs from the home screen and opens full screen on Android Chrome and iOS Safari.
2. After the first load it works in airplane mode, including after a force close and reopen.
3. Progress, streaks and settings survive closing the app, rebooting the phone and app updates.
4. Call `navigator.storage.persist()` at startup. Settings show the date of the last backup export.
5. Service worker with a versioned cache and an update flow that cannot leave David on an old version ("Neue Version verfügbar" plus a manual "Update prüfen").
6. IndexedDB or network failures show a clear message, never fail silently.
7. The version is visible in settings.

## Testing

- `node --test` unit tests for `engine.js`, `activity.js`, `settings.js` (and the Mistakes generator in phase 2): queue refill, graduation, wrong answer rules, round rotation, options always contain the correct answer without duplicates, streak across midnight and DST.
- Real phone testing needs HTTPS: deploy a preview early to GitHub Pages and use the checklist in `TASKS.md` at the end of every phase.

## Conventions

- Commits: small, imperative, English, one logical change each.
- Update `TASKS.md` as you go: tick boxes, add discovered tasks, log decisions in one line.
- Say what you could not test.
# TASKS

Read `CLAUDE.md` first. Priority order: **1) Prepositions, 2) Mistakes Test, 3) Vocab B2 (last, optional)**.
Work phase by phase. Do not start a phase until the previous one passes its phone check. Tick boxes as you go and add tasks you discover.

Legend: `[ ]` todo, `[x]` done, `(David)` means David does it by hand.

# PART 1: Prepositions (now)

## Phase 0: Repo and legacy import

- [x] (David) Create the repo with `CLAUDE.md` and `TASKS.md` at the root.
- [x] (David) Save the prepositions artifact HTML as `legacy/prepositions.html`.
- [x] Prepositions data already extracted from the sheet (DEU25 > "Präpositionen", A59:Q93) into `legacy/prepositions_items.json`, `legacy/prepositions_items.csv` and `legacy/prepositions_cells_raw.json` (cell by cell with colors). (David) Put these three files in `legacy/`. Open questions about the data are in `docs/legacy-notes.md` once written.
- [x] (David) Save the German Feedback Agent instructions as `docs/german-feedback-agent.md` (needed for Part 2, harmless now).
- [ ] (David, optional) Put the old vocab code in `legacy/vocab_B2/`. Nobody touches it.
- [x] Read `legacy/prepositions.html` and write `docs/legacy-notes.md`: item schema, exact queue, streak and graduation rules, how distractors and rounds work, and what counted as a "round". Ask David about conflicts and confirm the "activity = completed round" assumption.
- [ ] Create `.gitignore` and the folder skeleton from `CLAUDE.md`.

Done when: David confirms `docs/legacy-notes.md`.

## Phase 1: Skeleton on the phone (prove the pipeline first)

- [x] `index.html`, `manifest.webmanifest`, icons, `sw.js` with versioned cache, relative URLs only.
- [x] `config.js` with `ENABLED_MODULES = ['prepositions']`, module registry and error boundary.
- [x] Bottom tab bar (Heute, Üben, Fortschritt, Einstellungen) with hash routing. Placeholder views.
- [x] `core/store.js` (`german-trainer` database): write a test value, read it back, show it with the app version in settings.
- Decision: `VERSION` in `src/config.js` and `CACHE_VERSION` in `sw.js` are bumped together by hand; every new file must also be added to `ASSETS` in `sw.js`.
- [x] Deploy a preview to GitHub Pages: https://damayor.github.io/deu-fehlerfrei/ (repo `damayor/deu-fehlerfrei`, Pages from `main` /).
- [ ] (David) Install on the phone, switch tabs, airplane mode, force close, reopen.

Phone check 1: installs, full screen, tabs work, stored value survives force close and reboot, works offline.

## Phase 2: Data, engine, activity logic (no UI yet)

- [x] Build `modules/prepositions/data.json` from `legacy/prepositions_items.json` (about 101 raw items; the legacy artifact showed 90, so find out which ones it dropped or merged) and merge the example sentences, translations and cases from `legacy/prepositions.html`. Show David the full list (about 90 items: category, word, preposition, case, priority) for review.
- [x] Data validation with a friendly error screen.
- [x] `engine.js` pure functions: queue fill, next card, answer handling, streak, graduation, round rotation, option generation.
- [x] `core/settings.js` with validation and per-module namespaces.
- [x] `core/activity.js`: daily goal and streak, pure.
- [x] Unit tests (`node --test`) for engine, settings and activity, covering the cases in `CLAUDE.md`. All green.

Done when: tests pass and a scripted simulation of 200 random answers never gives a duplicate option, a missing correct answer or a stuck queue.

## Phase 3: Practice view and daily goal

- [x] Flashcard UI: word with blank, answer buttons, category filter.
- [x] Feedback with example sentence, translation, case. Respect "show example" and "auto advance".
- [x] Log answer events. Rebuild state from events on startup.
- [x] "Neue Runde" flow writes an `activity` event. Empty state when everything is mastered.
- [x] Heute tab: today's progress toward the daily goal, current streak, module card.

Phone check 2: answer 20 cards, force close, reopen: same state. Complete 2 rounds: the daily goal shows met and the streak counts. No tap lag, safe areas fine in portrait and landscape.

## Phase 4: Settings window

- [x] Global settings: daily goal, theme, restore defaults, version, "Update prüfen".
- [x] Prepositions settings: every row of the table in `CLAUDE.md`, generated from `settingsSchema`, applied immediately and persisted.
- [x] Validation with clear messages (for example not enough distractors).
- [x] Preposition option pool editor: enable, disable, add custom.
- [x] Backup: export JSON, import JSON, reset with confirmation, last export date.

Phone check 3: change graduation threshold, queue size, number of options, the option pool and the daily goal, and confirm the next cards and the Heute tab reflect it. Export, reset, import: progress comes back identical.

## Phase 5: Progress and mastered views

- [x] Fortschritt: global streak and activity history, plus Prepositions stats (graduated count, accuracy, hardest items, per category).
- [x] Verinnerlicht sub-tab: graduated items with preposition, case and example.
- [x] Verify numbers against a hand count on a small sample.

Phone check 4: numbers match what David actually answered.

## Phase 6: Hardening and release of Part 1

- [x] `navigator.storage.persist()`, visible errors on storage failure.
- [x] Update flow: ship a version bump and confirm the phone shows "Neue Version verfügbar" without losing progress.
- [x] Accessibility pass: contrast, font scaling, labels.
- [ ] Run the full checklist below.

### Full phone checklist

- [x] Installs from the home screen, opens full screen
- [x] Works in airplane mode after first load
- [x] Force close and reopen keeps progress and settings
- [ ] Reboot keeps progress and settings
- [x] App update keeps progress and settings
- [x] All tabs work, back button behaves
- [ ] Every setting changes behavior as described
- [x] Daily goal and streak behave correctly, including across midnight
- [ ] Export and import round trip works
- [x] Portrait and landscape fine
- [ ] No battery use when the app is closed

Done when: every box passes on the real phone. **Stop here and let David use it for a few days before Part 2.**

# PART 1b: vocab_GAS, Tagesvorschau (HIGH priority, after Prepositions)

Do not confuse with `vocab_B2` (PART 3, lowest priority). `vocab_GAS` is David's **whole vocabulary of the last year**, stored in the Google Apps Script project (GAS) with the sheet `TELC B2 Vokabeln SRS`, which sends one reminder every 2 hours. Module id: `vocab_GAS`. Spec only, not built. Starts only after Prepositions passes its final phone check.

Goal: at the start of the day, David opens the app and sees **all words the 2-hour alerts will send that day**, each with its **context sentence** and **without the Spanish meaning**.

Decisions (David, 2026-10-31):
- **Pull, not push.** David opens the app and it pulls today's list. No notifications, no background work, no change to the Telegram reminders for now.
- The day's list is known in advance: the script goes to fixed rows that hold the dates "x, y, z days ago". Details are asked when this phase starts. Changes in the GAS repository may be needed then (David does or approves them).
- `vocab_B2` is not moved forward.

- [x] (David) Share the GAS repository (read-only for analysis) when this phase starts.
- [x] Analyze how the script picks the rows per alert and where the context sentence lives. Do not edit anything in `legacy/vocab_B2/` or the Apps Script without David's explicit approval.
- [x] Data contract: one read-only list "words for today" (word, context sentence, no meaning), through a read-only endpoint. Never write to the sheet.
- [x] Module with its own settings, own tests and error boundary, registered via `ENABLED_MODULES`. Never imports another module.
- [x] Offline: cache today's list in IndexedDB at the first sync of the day, so it opens in airplane mode.
- [x] UI: list of today's words with context sentence, optional tap to reveal the meaning.
- [x] Decide if viewing the list counts as an `activity` for the daily goal (default: no).
- [ ] Phone check: the list matches the alerts that arrive during the day.

## Streak reminder (David)

- [ ] (David) Deploy `worker/push` (README), then in the app: URL, token, Aktivieren, Test senden.
- [ ] Phone check: the reminder arrives at the chosen hour only on days the goal is open; tapping it opens the app.

# PART 2: Mistakes Test (second objective, starts only when David says so)

## Phase 7: Worker and data access

- [ ] Confirm with David the Worker approach and the Cloudflare account setup (his Cloudflare MCP connector can help).
- [ ] `worker/`: read-only `GET /mistakes?since=&limit=` against `de-berichtigung-db`, table `mistakes_de`, filtered to `chat_id = 'david'`. Token via `wrangler secret`. CORS and preflight for the app origin only. No write endpoints.
- [ ] Verify the Worker cannot read or write any other database or table.
- [ ] (David) Deploy the Worker, set the secret.
- [ ] Module settings: Worker URL and token typed by David, stored in IndexedDB only. "Sync now" with last sync time.
- [ ] Cache pulled rows in IndexedDB with incremental pulls by `created_at` or `id`.

Done when: the phone pulls mistakes, and they are readable offline afterwards.

## Phase 8: Test generator and UI

- [ ] `generator.js` pure and unit tested: dedupe, mode per category, blank-fill for prepositions, normalized comparison with diff, weighted selection, per-mistake graduation from local events.
- [ ] Test UI: type mode and choose mode, feedback with the explanation when present.
- [ ] A completed test writes an `activity` event, so it counts toward the same daily goal and streak.
- [ ] Settings: questions per test, categories, mode per category, graduation threshold, date range.
- [ ] Add the module to `ENABLED_MODULES`. Verify the app still works with the module disabled.
- [ ] Error handling: sync failure, empty database, categories with no rows.

Phone check 5: sync, then go offline and complete a test. Completing one Prepositions round plus one test meets the daily goal of 2.

## Phase 9: Later, optional

- [ ] LLM-generated distractors or full-sentence contexts through the Worker (needs David's decision on cost and key handling).
- [ ] Sync progress between devices (export and import covers it for now).

# PART 3: vocab_B2 (last, optional, lowest priority)

Vocab already works through Google Sheets and Telegram. Only do this if David asks.

- [ ] Placeholder `modules/vocab_B2/README.md`.
- [ ] If reactivated: specify from `legacy/vocab_B2/` and the sheet, as an isolated module that registers an `activity` per completed block.

## Open question: framework

- [ ] Revisit the "no framework" rule in `CLAUDE.md` only if vanilla JS causes a strong, concrete tradeoff (for example the Phase 4 settings window or the Mistakes module needing lots of shared UI state and duplicated DOM code). Candidates: Preact + htm (about 4 KB, no build step) or Vue (no-build mode). Needs David's approval; until then stay vanilla. Avoid Angular (heavy, needs a build).

## Decisions log

- 2026-11-05: v0.7.0. Wörter des Tages: coaching line per state (`STATE_HINT`). Streak reminder (David's request, Android): `worker/push` (Cloudflare Worker, KV, hourly cron, empty Web Push signed with VAPID), client `core/push.js`, card "Erinnerung (Serie)" in Einstellungen, `push` handler in `sw.js`. The app tells the Worker only "goal met on <date>" so no reminder arrives after the goal. Public VAPID key is served by the Worker. CLAUDE.md rule on push changed. NOT deployed or tested on a phone: David runs `worker/push/README.md`, then Aktivieren and Test senden.

- 2026-11-05: Phase 6 code done (v0.6.1): persist() no longer blocks startup, storage probe at boot shows a red banner if IndexedDB does not really work, update check on return to foreground, `sw.test.js` guards precache list and version match, contrast fixes for state tags and danger button in dark mode, rem-based font size, focus outline, 14-day history as 2 rows of 7. Open: update flow and the full checklist on the phone (David).

- 2026-11-05: Phase 5 built (v0.6.0). `stats()` returns `{metrics, lists}` and Fortschritt renders it generically per module (loads each module, error-isolated). Verinnerlicht is a sub-tab inside Prepositions. Hand-count unit test covers the numbers; phone check 4 still open (David). Push reminders for the streak requested by David (Android only): not planned yet, needs a Worker with cron + Web Push and a change to the no-push rule in CLAUDE.md.

- 2026-11-02: vocab_GAS UI v0.5.0: state per word from the cell colors the Telegram reactions write (word green = sicher, word yellow + phrase green = mit Satz erkannt, both yellow/orange = offen, phrase red = Satz passt nicht, no color = neu). The endpoint sends `wordBg`/`fraseBg`, the app maps them (hue based, so manual orange works); without them every word is "neu". Slot header shows "Vor N Tagen/Monaten" plus the original date, no hour. Phone check passed for fetching (works on the phone after a few seconds).

- 2026-11-02: vocab_GAS built (v0.4.0), started before the final Prepositions phone check at David's request. Source: repo `damayor/ai-agent-with-gas-spreadsheets` (Sprachen). The day's list = the 7 activators (months 8,7,6,1 then days 15,7,5) at 09,11,...,21 h, rows by date in `WoerterDesTages`. Proposed read-only `doGet` in `docs/vocab-gas-endpoint.gs` (token in Script Properties `VOCAB_APP_TOKEN`), NOT deployed yet. German only; English words only produce the hint "Hay datos, ¡pero ve a la app de inglés!". Words without a context sentence show the word only; a tap reveals the translation. Viewing does not count as an activity. Web-app URL and token live in IndexedDB (module settings); the token is left out of backup files. Untested: real fetch against Apps Script (CORS/redirect) and the phone check.

- 2026-11-02: Cards show the example sentence with the preposition blanked before answering, full sentence (preposition highlighted) plus Spanish after. Both follow the "Beispielsatz zeigen" setting; with it off the card shows only the word with a blank.
- 2026-11-02: Phase 4 built (v0.3.0), not yet phone-tested. Settings form is generated from the schema (`core/settings-ui.js`); invalid changes are rejected and the reason shown. Backup file holds events, settings and module state; import replaces them; reset keeps the last export date. Lowering the queue size trims the queue, keeping the items with the most progress. Distractor strategy still missing from settings (no `confusable` yet).

- 2026-11-02: Phase 3 built (v0.2.0), not yet phone-tested. The activity event is written when the last card of a round is answered (not on the button), then the queue rotates. Module queue persisted via `ctx.state` (cache store). Verinnerlicht sub-nav deferred to Phase 5.

- 2026-10-13: One app with isolated modules and a shared daily goal and streak (default 2 activities per day). Order: Prepositions, Mistakes Test, Vocab B2 last. Local only and offline first. Mistakes data is read-only from D1 through a Worker. Early GitHub Pages preview for real phone testing.
- 2026-10-13: Round = 10 answered cards by default (own `roundSize` setting, not tied to queue size); one round = one activity. Highlight tiers: yellow/green/red = top, yellow_light/yellow_bright = high, both above pink. 12 exam-added items drafted in `docs/prepositions-additions.json`.

- 2026-10-13: Highlight tiers final: top = yellow/orange/green/red; normal priority = pink/magenta/yellow_light/yellow_bright. Wrong answer = streak -1 (min 0), no "reset to 0" and no setting for it.

- 2026-10-31: App renamed to Fehlerfrei. GitHub Pages preview live. New module `vocab_GAS` (morning word preview, pull) added as PART 1b after Prepositions. `vocab_B2` stays last.
- 2026-10-31: `data.json` has 101 items (89 legacy + 12 additions), all with example, translation and case. Engine takes `rng` as an argument; the queue is persisted by the module, progress and rounds are derived from events. Distractor strategy `confusable` not built yet (random only).
- 2026-10-31: Settings are schema-driven (`core/settings.js`); module-specific cross-field rules live in the module (`crossCheck`: option pool needs at least `optionCount` entries). Setting `autoAdvance` stores seconds (0, 2, 4). Distractor strategy setting left out until `confusable` exists.

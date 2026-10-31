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
- [ ] Deploy a preview to GitHub Pages (ask David for repo and Pages setup).
- [ ] (David) Install on the phone, switch tabs, airplane mode, force close, reopen.

Phone check 1: installs, full screen, tabs work, stored value survives force close and reboot, works offline.

## Phase 2: Data, engine, activity logic (no UI yet)

- [ ] Build `modules/prepositions/data.json` from `legacy/prepositions_items.json` (about 101 raw items; the legacy artifact showed 90, so find out which ones it dropped or merged) and merge the example sentences, translations and cases from `legacy/prepositions.html`. Show David the full list (about 90 items: category, word, preposition, case, priority) for review.
- [ ] Data validation with a friendly error screen.
- [ ] `engine.js` pure functions: queue fill, next card, answer handling, streak, graduation, round rotation, option generation.
- [ ] `core/settings.js` with validation and per-module namespaces.
- [ ] `core/activity.js`: daily goal and streak, pure.
- [ ] Unit tests (`node --test`) for engine, settings and activity, covering the cases in `CLAUDE.md`. All green.

Done when: tests pass and a scripted simulation of 200 random answers never gives a duplicate option, a missing correct answer or a stuck queue.

## Phase 3: Practice view and daily goal

- [ ] Flashcard UI: word with blank, answer buttons, category filter.
- [ ] Feedback with example sentence, translation, case. Respect "show example" and "auto advance".
- [ ] Log answer events. Rebuild state from events on startup.
- [ ] "Neue Runde" flow writes an `activity` event. Empty state when everything is mastered.
- [ ] Heute tab: today's progress toward the daily goal, current streak, module card.

Phone check 2: answer 20 cards, force close, reopen: same state. Complete 2 rounds: the daily goal shows met and the streak counts. No tap lag, safe areas fine in portrait and landscape.

## Phase 4: Settings window

- [ ] Global settings: daily goal, theme, restore defaults, version, "Update prüfen".
- [ ] Prepositions settings: every row of the table in `CLAUDE.md`, generated from `settingsSchema`, applied immediately and persisted.
- [ ] Validation with clear messages (for example not enough distractors).
- [ ] Preposition option pool editor: enable, disable, add custom.
- [ ] Backup: export JSON, import JSON, reset with confirmation, last export date.

Phone check 3: change graduation threshold, queue size, number of options, the option pool and the daily goal, and confirm the next cards and the Heute tab reflect it. Export, reset, import: progress comes back identical.

## Phase 5: Progress and mastered views

- [ ] Fortschritt: global streak and activity history, plus Prepositions stats (graduated count, accuracy, hardest items, per category).
- [ ] Verinnerlicht sub-tab: graduated items with preposition, case and example.
- [ ] Verify numbers against a hand count on a small sample.

Phone check 4: numbers match what David actually answered.

## Phase 6: Hardening and release of Part 1

- [ ] `navigator.storage.persist()`, visible errors on storage failure.
- [ ] Update flow: ship a version bump and confirm the phone shows "Neue Version verfügbar" without losing progress.
- [ ] Accessibility pass: contrast, font scaling, labels.
- [ ] Run the full checklist below.

### Full phone checklist

- [ ] Installs from the home screen, opens full screen
- [ ] Works in airplane mode after first load
- [ ] Force close and reopen keeps progress and settings
- [ ] Reboot keeps progress and settings
- [ ] App update keeps progress and settings
- [ ] All tabs work, back button behaves
- [ ] Every setting changes behavior as described
- [ ] Daily goal and streak behave correctly, including across midnight
- [ ] Export and import round trip works
- [ ] Portrait and landscape fine
- [ ] No battery use when the app is closed

Done when: every box passes on the real phone. **Stop here and let David use it for a few days before Part 2.**

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

# PART 3: Vocab B2 (last, optional)

Vocab already works through Google Sheets and Telegram. Only do this if David asks.

- [ ] Placeholder `modules/vocab_B2/README.md`.
- [ ] If reactivated: specify from `legacy/vocab_B2/` and the sheet, as an isolated module that registers an `activity` per completed block.

## Decisions log

- 2026-10-13: One app with isolated modules and a shared daily goal and streak (default 2 activities per day). Order: Prepositions, Mistakes Test, Vocab B2 last. Local only and offline first. Mistakes data is read-only from D1 through a Worker. Early GitHub Pages preview for real phone testing.
- 2026-10-13: Round = 10 answered cards by default (own `roundSize` setting, not tied to queue size); one round = one activity. Highlight tiers: yellow/green/red = top, yellow_light/yellow_bright = high, both above pink. 12 exam-added items drafted in `docs/prepositions-additions.json`.

- 2026-10-13: Highlight tiers final: top = yellow/orange/green/red; normal priority = pink/magenta/yellow_light/yellow_bright. Wrong answer = streak -1 (min 0), no "reset to 0" and no setting for it.

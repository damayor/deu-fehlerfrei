# Legacy notes: Prepositions

Source: `legacy/prepositions.html` (a Claude Artifact prototype, 89 hardcoded items,
persistence via `claude.use("db")`) compared against `legacy/prepositions_items.json`
(101 items extracted from the sheet DEU25 > "Präpositionen", A59:Q93). The sheet
extract is the source of truth for words per `CLAUDE.md`; the artifact is the source
of truth for example sentences, translations, case, and the exact training rules
below.

## Item count mismatch — needs David

- Sheet extract: **101** items (V 45, N 35, A 21).
- Legacy artifact: **89** hardcoded items.
- Not yet diffed word-by-word. Before building `modules/prepositions/data.json`,
  match by `(word, prep)` and list which ~12 sheet items have no artifact match
  (so they're missing example/translation/case) and vice versa. Ask David to fill
  gaps or confirm drops.
- The sheet's `priority` field already applies the pink/magenta/red = priority rule
  from `CLAUDE.md` (24 priority items), consistent with the artifact's own
  25-item `prio` flag (small difference likely from the same ~12 item mismatch).
- The sheet's `case` field is populated for only 1 of 101 items — case must come
  from the artifact (hardcoded per item, `"D"` or `"A"`) via the word match above.
- `family` linking: the sheet has an explicit `family` field on 28 items (richer
  than the artifact's hardcoded `FAM_MAP`, ~20 items across 10 groups). Use the
  sheet's `family` field as source of truth.
- Highlight colors `yellow`, `yellow_light`, `yellow_bright`, `orange`, `green`
  appear in the sheet (9 items total) with unknown meaning. Per `CLAUDE.md`,
  keep the `highlight` field and treat all of them as non-priority until David
  explains them.

## Queue and round logic (exact artifact behavior)

- **Active queue** (`state.queue`): list of item ids in circulation, refilled
  on every render by `ensureQueueFilled()` up to `queueSize` (default 6, legacy
  range 4–10; `CLAUDE.md` extends the range to 4–12).
  - Pulls priority items not yet queued first, in random order.
  - Only pulls non-priority ("secondary") items once no priority items remain
    eligible (`prioAll.length===0`) **or** the `forceSecondary` setting is on.
  - This is the "Priority first" toggle in `CLAUDE.md`, named `forceSecondary`
    in legacy (inverted: on = unlock secondary early).
  - Graduated items are filtered out of eligibility (`eligible()` excludes
    `isGraduated`).
- **Card pick** (`pickCard()`): random item from the current queue, excluding
  the immediately previous card (`lastWordId`), to avoid back-to-back repeats.
- **Answering** (`handleAnswer()`):
  - Correct: `streak += 1`, `correct += 1`.
  - Wrong: `streak = 0` (hard reset), `wrong += 1`. Legacy has **no** "minus 1"
    rule — that option in `CLAUDE.md`'s settings table has no legacy precedent;
    treat it as a new option to confirm with David, not a parity requirement.
  - Graduation check happens **immediately** on the triggering answer (not at
    round boundary): `streak >= gradThreshold` (default 4, legacy range 2–5;
    `CLAUDE.md` narrows to 3–5) marks the item graduated and removes it from
    the queue right away.
- **Round** (`startRound()` / "Neue Runde" / "Runde starten" button):
  - A round is a **fixed number of answered cards**, `sessionLength`
    (default 5, legacy range 5–30), tracked as `session.index` vs
    `session.length`. This is **decoupled from queue size** in legacy — they
    are two independent settings with different defaults (5 vs 6).
  - **Conflict with `CLAUDE.md`**: the spec's settings table says "Round size
    (for activity)" defaults to "queue size" (implying they're coupled). Ask
    David whether to keep legacy's independent `sessionLength` (default 5) or
    follow the spec's coupled default. This directly decides what counts as
    one `activity` event.
  - On starting a new round (`rotateQueueForNewRound()`): items with
    `streak > 0` stay in the queue; items at `streak === 0` are dropped, then
    `ensureQueueFilled()` pulls in replacements. This matches `CLAUDE.md`'s
    "items at streak 0 are swapped for random pool items" exactly.
- **Category filter** (`currentCat`): switching category resets `currentWordId`
  and ends the active session (`session.active = false`), returning to the
  round start screen — switching category mid-round discards round progress.

## Multiple choice options

- Legacy always shows **exactly 4** options: the correct preposition plus 3
  random distractors from `state.settings.activePreps` (user's enabled pool,
  default all 12 `BASE_PREPS`), shuffled together.
- Fallback: if the active pool has fewer than 3 other prepositions, it pads
  from the **full** `BASE_PREPS` list regardless of which ones the user
  disabled — a legacy edge case, not necessarily desired behavior for the
  rebuild (the rebuild should instead validate the pool has enough entries
  and block the setting change, per `CLAUDE.md`).
- No "number of options" setting and no "distractor strategy" setting exist
  in legacy — pure random selection. Both are new additions in the
  `CLAUDE.md` spec, not parity requirements.

## Feedback

- Always shown after every answer (no "show example sentence" toggle and no
  "auto advance" in legacy — advancing requires tapping "Weiter").
- Shows: correct/wrong verdict, the example sentence with the preposition
  highlighted, the Spanish translation, the word + case tag ("Akkusativ" /
  "Dativ"), and a family note listing shared-preposition siblings if any.

## Progress / stats

- Graduated count out of total item count.
- Overall accuracy: `correct / (correct + wrong)` across all items, as a
  running tally since the last reset (no timestamps, no history over time —
  this is a gap the event-log-based rebuild will close for free).
- "Problems" table: top 8 items with `wrong > 0`, sorted by wrong count
  descending, showing correct/wrong counts per item. No per-category
  breakdown in legacy (the spec adds one).

## Settings (legacy sheet, for comparison with `CLAUDE.md`'s fuller table)

| Legacy setting | Default | Range |
|---|---|---|
| Preposition pool (`activePreps`) | all 12 `BASE_PREPS` | min 4 active |
| Questions per round (`sessionLength`) | 5 | 5–30 |
| Active queue size (`queueSize`) | 6 | 4–10 |
| Graduation threshold (`gradThreshold`) | 4 | 2–5 |
| Unlock secondary words now (`forceSecondary`) | off | toggle |

Everything else in `CLAUDE.md`'s settings table (wrong-answer rule, number of
options, distractor strategy, show example toggle, auto-advance, round size
as its own setting) is a new addition with no legacy behavior to match.

## Reset

- Legacy reset requires a confirm-by-clicking-twice pattern (button text
  changes, 4s window), then wipes `progress` and `queue` entirely. No
  export/import existed (persistence was through the Claude Artifact's own
  `db` handle, not applicable to the PWA rebuild).

## Open questions for David

1. ~~Which sheet items have no match?~~ **Resolved.** 12 sheet items are new
   words David added from past exams (`zur Verfügung` = legacy `Verfügung zu`, so
   it is a match). Example/translation/case drafted in
   `docs/prepositions-additions.json`; David to review (esp. `jemanden bitten bei`).
2. ~~Round size~~ **Resolved (David):** independent `roundSize` setting, default **10**
   (legacy was 5). Not coupled to queue size.
3. ~~Activity unit~~ **Resolved (David):** one activity = one round = N answered
   cards (default 10). Daily goal counts these.
4. ~~Highlight colors~~ **Resolved (David):**
   - `top` tier: `yellow`, `orange`, `green`, `red` (ultra important, not yet learned).
   - `normal` tier (priority): `pink`, `magenta`, `yellow_light`, `yellow_bright`.
   - Order: top > normal > rest. `priority` boolean becomes `priorityTier`
     (`top` | `normal` | `none`); "Priority first" follows that order.
5. ~~Wrong answer rule~~ **Resolved (David):** a wrong answer is always **streak -1**
   (never below 0). "Reset to 0" is dropped (legacy behavior intentionally changed),
   so the setting disappears and the rule is fixed. Item stays in the queue.

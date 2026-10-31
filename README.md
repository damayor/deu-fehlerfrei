# Fehlerfrei (German Trainer, telc B2 → C1)

Installable phone app (PWA) with German exercise modules sharing a daily goal and streak. Full spec: [CLAUDE.md](CLAUDE.md). Task list: [TASKS.md](TASKS.md).

## Current status

Only the planning phase is done. `src/` has empty folders, there is no `index.html` yet, and no app code runs. Next step is Phase 1 in [TASKS.md](TASKS.md).

## Is it Node.js?

No. The app is vanilla JavaScript (ES modules) that runs in the browser, with no framework, no build step and no `package.json`. Node.js is used only to run unit tests (`node --test`, Node 20+), once those exist.

## Run it in VS Code (once `index.html` exists)

1. Install the **Live Server** extension (Ritwick Dey).
2. Right-click `index.html` > **Open with Live Server**.
3. Open the URL in Chrome. Service workers work on `localhost`.

Alternative from the terminal: `python3 -m http.server 8000`, then open `http://localhost:8000`.

Phone testing needs HTTPS, so use the GitHub Pages preview (see Phase 1 in [TASKS.md](TASKS.md)).

## Run the tests (once they exist)

```bash
node --test
```

## Folders

| Folder | Purpose |
|---|---|
| `src/` | App code: `core/` (shared) and `modules/` (prepositions, mistakes, vocab_B2) |
| `worker/` | Cloudflare Worker for the Mistakes module (phase 2) |
| `docs/` | `legacy-notes.md` (old rules), `german-feedback-agent.md` |
| `legacy/` | Original code and data. **Read-only reference**, not part of the app. |
| `icons/` | App icons |

## Is `legacy/` still used?

Not at runtime. It is the source for building `src/modules/prepositions/data.json` (items and colors from `prepositions_items.json`, example sentences from `prepositions.html`) and for reproducing the old behavior. Keep it, do not edit it.

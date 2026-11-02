// ============================================================
// PROPOSAL (not deployed): read-only endpoint for the Fehlerfrei app, module vocab_GAS.
// Goes into the Apps Script project "Sprachen" as a NEW file (for example Hoy.gs), plus one tiny additive
// change in Repaso.js (see "Change 2"). Nothing here writes to the sheet or sends Telegram messages.
//
// Contract: GET <web-app-url>?t=<token>[&d=yyyy-MM-dd]
//   d is optional and only for testing against a past day; default is today (Europe/Berlin).
// Success:
//   { "date": "2026-11-02",
//     "slots": [ { "pos": 1, "hour": 9, "kind": "meses"|"dias", "value": 8,
//                  "words": [ { "orig": "ertragen", "frase": "Ich kann den Lärm nicht ertragen.", "trad": "soportar",
//                              "wordBg": "#fff2cc", "fraseBg": "#d9ead3" } ],
//                  "englishCount": 0 } ] }
//   - Same 7 slots, same order and same filters as enviarRecordatorioHoy (German only in "words").
//   - "frase" is "" when the sheet has no real context sentence. "trad" is the Spanish meaning; the app hides it
//     until the user taps the word.
//   - wordBg / fraseBg are the cell background colors of the word (C/D/E) and the phrase (K/L/M), as set by the
//     Telegram reactions. The app turns them into a state (green = known, yellow = open, ...). Optional: without
//     them every word is shown as "new".
//   - English words are not sent, only counted (englishCount).
//   - Slots with no German and no English words are left out, like the Telegram alerts that are skipped.
// Error: { "error": "unauthorized" } (Apps Script cannot set HTTP status codes).
//
// Setup (David, by hand): Project settings > Script properties > add VOCAB_APP_TOKEN (a long random string).
// Deploy: Deploy > Manage deployments > edit the existing web app > New version. Access stays "Anyone",
// that is why the token is mandatory.
// ============================================================

// --- Change 1: new function ---
function doGet(e) {
  const p = (e && e.parameter) || {};
  const token = PropertiesService.getScriptProperties().getProperty("VOCAB_APP_TOKEN");
  if (!token || p.t !== token) return jsonOut({ error: "unauthorized" });

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.d || "");
  const ref = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  ref.setHours(0, 0, 0, 0);

  // One read for all colors (a getBackground() call per word would be slow).
  const fondos = SpreadsheetApp.openById(ID_HOJA).getSheetByName(NOMBRE_TAB).getDataRange().getBackgrounds();

  const slots = [];
  obtenerActivadoresDelDia().forEach((act, i) => {
    const r = act.tipo === "meses"
      ? obtenerPalabras(ref, null, restarMeses(ref, act.valor))
      : obtenerPalabras(ref, act.valor);
    if (!r.palabrasDE.length && !r.palabrasEN.length) return;
    slots.push({
      pos: i + 1,
      hour: HORAS_TRIGGER_REPASO[i] === undefined ? null : HORAS_TRIGGER_REPASO[i],
      kind: act.tipo,
      value: act.valor,
      words: r.palabrasDE.map(w => ({
        orig: w.orig, frase: w.frase || "", trad: w.trad,
        wordBg: fondos[w.fila - 1][w.col - 1], fraseBg: fondos[w.fila - 1][w.col + 7],   // C/D/E -> K/L/M
      })),
      englishCount: r.palabrasEN.length,
    });
  });

  return jsonOut({ date: Utilities.formatDate(ref, ZONA_HORARIA, "yyyy-MM-dd"), slots });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// --- Change 2: in Repaso.js, function obtenerPalabras ---
// obtenerPalabras only keeps `spoiler` (the phrase OR the translation), so the two cannot be told apart.
// Add the raw values to the pushed object. Existing callers ignore the extra fields, Telegram is unchanged.
//
//   before:  { orig, spoiler, fecha: fechaAnotacion, fila: i + 1, col: par.col }
//   after:   { orig, spoiler, trad, frase: tieneFrase(frase) ? frase : "", fecha: fechaAnotacion, fila: i + 1, col: par.col }

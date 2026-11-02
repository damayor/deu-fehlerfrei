import { h, applyTheme } from '../core/ui.js';
import { VERSION } from '../config.js';
import * as store from '../core/store.js';
import { GLOBAL_SCHEMA, loadSettings, saveSettings, defaultsOf } from '../core/settings.js';
import { schemaForm } from '../core/settings-ui.js';
import * as backup from '../core/backup.js';

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString('de-DE') : 'noch nie');

async function downloadBackup() {
  const data = await backup.exportAll(store, Date.now(), VERSION);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const day = new Date().toISOString().slice(0, 10);
  const a = h('a', { href: url, download: `fehlerfrei-sicherung-${day}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** @param {{persisted:boolean, checkUpdate:()=>Promise<string>, modules:any[], rerender:()=>void}} deps */
export async function einstellungen({ persisted, checkUpdate, modules, rerender }) {
  const global = await loadSettings(store, 'global', GLOBAL_SCHEMA);
  const last = await backup.lastExport(store);
  const status = h('p', { role: 'status' });
  const say = (text, bad = false) => { status.textContent = text; status.className = bad ? 'error' : 'muted'; };
  const guarded = (fn) => async () => { try { await fn(); } catch (err) { say(err.message, true); } };

  const globalForm = schemaForm({
    schema: GLOBAL_SCHEMA, values: global,
    onSave: (v) => saveSettings(store, 'global', v),
    onSaved: (v) => applyTheme(v.theme),
  });

  const moduleSections = [];
  for (const m of modules) {
    const values = await loadSettings(store, m.id, m.settingsSchema);
    moduleSections.push(h('section', { class: 'card' }, h('h2', null, m.title),
      schemaForm({ schema: m.settingsSchema, values, cross: m.crossCheck, onSave: (v) => saveSettings(store, m.id, v) })));
  }

  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', guarded(async () => {
    const f = file.files?.[0]; file.value = '';
    if (!f) return;
    const r = backup.parseBackup(await f.text());
    if (!r.ok) return say(r.error, true);
    if (!confirm(`Sicherung vom ${fmtDate(Date.parse(r.data.exportedAt))} laden? Der aktuelle Fortschritt und alle Einstellungen werden ersetzt.`)) return;
    await backup.restoreAll(store, r.data);
    applyTheme((await loadSettings(store, 'global', GLOBAL_SCHEMA)).theme);
    say('Sicherung geladen.'); rerender();
  }));

  return h('div', null, h('h1', null, 'Einstellungen'),
    h('section', { class: 'card' }, h('h2', null, 'Allgemein'), globalForm),
    ...moduleSections,
    h('section', { class: 'card' }, h('h2', null, 'Sicherung'),
      h('p', { class: 'muted' }, `Letzter Export: ${fmtDate(last)}`),
      h('div', { class: 'btn-row' },
        h('button', { onclick: guarded(async () => { await downloadBackup(); say('Sicherung exportiert.'); rerender(); }) }, 'Exportieren'),
        h('button', { class: 'secondary', onclick: () => file.click() }, 'Importieren'), file),
      h('div', { class: 'btn-row' },
        h('button', { class: 'secondary', onclick: guarded(async () => {
          if (!confirm('Alle Einstellungen auf Standard zurücksetzen? Dein Fortschritt bleibt erhalten.')) return;
          await saveSettings(store, 'global', defaultsOf(GLOBAL_SCHEMA));
          for (const m of modules) await saveSettings(store, m.id, defaultsOf(m.settingsSchema));
          applyTheme('auto'); say('Standard wiederhergestellt.'); rerender();
        }) }, 'Standard wiederherstellen'),
        h('button', { class: 'danger', onclick: guarded(async () => {
          if (!confirm('ALLES löschen: Fortschritt, Serie und Einstellungen? Das kann nicht rückgängig gemacht werden. Tipp: vorher exportieren.')) return;
          if (!confirm('Wirklich alles löschen?')) return;
          await backup.resetAll(store); applyTheme('auto'); say('Alles zurückgesetzt.'); rerender();
        }) }, 'Alles zurücksetzen'))),
    h('section', { class: 'card' }, h('h2', null, 'App'),
      h('p', null, `Version: ${VERSION}`),
      h('p', null, `Dauerhafter Speicher: ${persisted ? 'ja' : 'nicht bestätigt'}`),
      h('button', { onclick: async () => say(await checkUpdate()) }, 'Update prüfen')),
    status);
}

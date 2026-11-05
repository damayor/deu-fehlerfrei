import { h, applyTheme } from '../core/ui.js';
import { VERSION } from '../config.js';
import * as store from '../core/store.js';
import { GLOBAL_SCHEMA, loadSettings, saveSettings, defaultsOf } from '../core/settings.js';
import { schemaForm } from '../core/settings-ui.js';
import * as backup from '../core/backup.js';
import * as push from '../core/push.js';

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

  const reminder = await reminderCard(say);

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
    reminder,
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
          await saveSettings(store, 'reminder', defaultsOf(push.REMINDER_SCHEMA));
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

/** "Erinnerung" card: Worker URL, token and hour as a normal form, plus buttons that need a tap (permission). */
async function reminderCard(say) {
  const values = await loadSettings(store, 'reminder', push.REMINDER_SCHEMA);
  const state = h('p', { class: 'muted', role: 'status' });
  const refresh = async () => {
    const sub = await push.currentSubscription().catch(() => null);
    state.textContent = !push.supported() ? 'Dieses Gerät unterstützt keine Benachrichtigungen.'
      : `Status: ${sub ? 'aktiv' : 'aus'}${Notification.permission === 'denied' ? ' (im Browser blockiert)' : ''}`;
  };
  // Always read the latest saved values: the form saves on every change.
  const current = () => loadSettings(store, 'reminder', push.REMINDER_SCHEMA);
  const act = (fn, ok) => async () => {
    try {
      const [s, g, events] = await Promise.all([current(), loadSettings(store, 'global', GLOBAL_SCHEMA), store.getAll('events')]);
      await fn(s, events, g.dailyGoal); say(ok);
    } catch (err) { say(err.message, true); }
    refresh();
  };
  refresh();
  return h('section', { class: 'card' }, h('h2', null, 'Erinnerung (Serie)'),
    h('p', { class: 'muted' }, 'Eine Benachrichtigung ab der gewählten Uhrzeit, nur wenn das Tagesziel noch fehlt. Braucht den Worker aus worker/push.'),
    schemaForm({ schema: push.REMINDER_SCHEMA, values, onSave: (v) => saveSettings(store, 'reminder', v) }),
    h('div', { class: 'btn-row' },
      h('button', { onclick: act((s, ev, goal) => push.enable(s, ev, goal), 'Erinnerung ist aktiv.') }, 'Aktivieren / Aktualisieren'),
      h('button', { class: 'secondary', onclick: act((s) => push.sendTest(s), 'Test gesendet. Die Benachrichtigung kommt gleich.') }, 'Test senden'),
      h('button', { class: 'secondary', onclick: act((s) => push.disable(s), 'Erinnerung ausgeschaltet.') }, 'Ausschalten')),
    state);
}

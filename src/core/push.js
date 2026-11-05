// Streak reminder (Web Push) client. The only network use here is to David's own Worker (worker/push).
// Settings namespace `reminder`: Worker URL, token (kept out of backups) and the hour.
import { dayKey, summarizeActivity } from './activity.js';

export const REMINDER_SCHEMA = [
  { key: 'url', label: 'Worker-URL (Erinnerung)', type: 'text', default: '', max: 300,
    pattern: /^https:\/\/\S+$/, patternMessage: 'Die URL muss mit https:// beginnen.' },
  { key: 'token', label: 'Zugriffs-Token', type: 'text', secret: true, default: '', max: 200 },
  { key: 'hour', label: 'Erinnerung ab (Uhrzeit)', type: 'choice', default: 20,
    options: [17, 18, 19, 20, 21, 22].map((h) => ({ value: h, label: `${h}:00` })) },
];

export const isConfigured = (s) => !!s.url && !!s.token;
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;

/** base64url string to bytes (for applicationServerKey). */
export function b64urlToBytes(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}

/** What the Worker needs to know: the reminder time, the time zone and the day the goal was met (if today). */
export function buildPayload(subscription, settings, events, goal, now, tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const met = summarizeActivity(events, goal, now).today.met;
  return { subscription, hour: settings.hour, tz, metDay: met ? dayKey(now) : null };
}

async function call(settings, path, method, body, fetchFn = fetch) {
  let res;
  try {
    res = await fetchFn(new URL(path, settings.url.replace(/\/?$/, '/')), {
      method, headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Worker nicht erreichbar (kein Netz oder falsche URL).'); }
  if (res.status === 401) throw new Error('Token falsch.');
  if (!res.ok) throw new Error(`Worker-Fehler ${res.status}.`);
  return res;
}

const registration = () => navigator.serviceWorker.ready;
export const currentSubscription = async () => (supported() ? (await registration()).pushManager.getSubscription() : null);

/** Ask for permission (needs a tap), subscribe and register with the Worker. */
export async function enable(settings, events, goal, now = Date.now()) {
  if (!supported()) throw new Error('Dieses Gerät unterstützt keine Benachrichtigungen.');
  if (!isConfigured(settings)) throw new Error('Bitte zuerst Worker-URL und Token eintragen.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Benachrichtigungen sind nicht erlaubt. Erlaube sie in den Browser-Einstellungen.');
  const keyRes = await fetch(new URL('vapid-public-key', settings.url.replace(/\/?$/, '/'))).catch(() => null);
  if (!keyRes?.ok) throw new Error('Worker nicht erreichbar oder falsche URL.');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes((await keyRes.text()).trim()) });
  await call(settings, 'subscription', 'PUT', buildPayload(sub.toJSON(), settings, events, goal, now));
}

export async function disable(settings) {
  const sub = await currentSubscription();
  if (!sub) return;
  if (isConfigured(settings)) await call(settings, 'subscription', 'DELETE', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTest(settings) {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Erinnerung ist nicht aktiv.');
  await call(settings, 'test', 'POST', { endpoint: sub.endpoint });
}

/**
 * Keep the Worker's "goal met today" in step with the device. Cheap: only talks to the Worker when
 * something changed (new day, goal met, hour changed, subscription replaced). Silent when it cannot.
 * @param {{get:(s:string,k:string)=>Promise<any>, put:(s:string,v:any)=>Promise<any>}} store (core/store.js)
 */
export async function syncState(store, settings, events, goal, now = Date.now()) {
  if (!supported() || !isConfigured(settings) || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub) return;
  const payload = buildPayload(sub.toJSON(), settings, events, goal, now);
  const stamp = `${payload.metDay}|${dayKey(now)}|${payload.hour}|${payload.tz}|${sub.endpoint}`;
  if ((await store.get('cache', 'push-sync'))?.value === stamp) return;
  await call(settings, 'subscription', 'PUT', payload);
  await store.put('cache', { key: 'push-sync', value: stamp });
}

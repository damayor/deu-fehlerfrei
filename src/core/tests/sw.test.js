// Guards the offline promise: every shipped file is precached, versions match, nothing in ASSETS is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { VERSION } from '../../config.js';

const root = new URL('../../../', import.meta.url).pathname;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'tests' ? [] : walk(p)) : [relative(root, p)];
  });
}

test('CACHE_VERSION equals VERSION in config.js', () => {
  assert.equal(sw.match(/CACHE_VERSION = '([^']+)'/)[1], VERSION);
});

test('every precached asset exists', () => {
  for (const a of assets) assert.ok(a === './' || existsSync(join(root, a)), `missing: ${a}`);
});

test('every source file is precached (otherwise it breaks offline)', () => {
  const missing = walk(join(root, 'src')).filter((f) => !assets.includes(f));
  assert.deepEqual(missing, []);
});

test('streakBody: shows the streak while it is alive, resets the text once it broke', async () => {
  process.env.TZ = 'Europe/Berlin';
  const vm = await import('node:vm');
  const ctx = { self: { addEventListener() {} }, indexedDB: {} };
  vm.runInNewContext(sw, ctx);
  const at = (iso) => new Date(iso).getTime();
  const now = at('2026-11-05T20:00:00');
  assert.match(ctx.streakBody({ current: 5, endDay: '2026-11-04' }, now), /🔥 5 Tage in Folge/); // goal met yesterday
  assert.match(ctx.streakBody({ current: 1, endDay: '2026-11-05' }, now), /🔥 1 Tag in Folge/);
  assert.match(ctx.streakBody({ current: 5, endDay: '2026-11-03' }, now), /neue Serie/);           // missed yesterday: broke
  assert.match(ctx.streakBody(null, now), /neue Serie/);
  assert.match(ctx.streakBody({ current: 0, endDay: null }, now), /neue Serie/);
});

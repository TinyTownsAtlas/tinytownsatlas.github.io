import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRestAdapter, createSyntheticAdapter } from './adapter.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', '..', 'demo', 'my-ten4ten', 'data');
const BASE = pathToFileURL(`${DATA}${path.sep}`);

// Serves site/data from disk, and records every request so tests can check what was asked for.
function diskFetch(requests = [], override = null) {
  return async (url) => {
    requests.push(String(url));
    if (override) {
      const r = override(String(url));
      if (r) return r;
    }
    const rel = String(url).slice(BASE.href.length);
    try {
      const body = await readFile(path.join(DATA, rel), 'utf8');
      return { ok: true, json: async () => JSON.parse(body) };
    } catch {
      return { ok: false, status: 404 };
    }
  };
}

test('authenticate accepts a demo ID and code pair for the same person', async () => {
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch() });
  const who = await adapter.authenticate('t4t-5rvc-3xte', 'demo-03');
  assert.deepEqual(who, { ttid: 'T4T-5RVC-3XTE', label: 'Demo participant 03' });
});

test('authenticate refuses a mismatched ID and code', async () => {
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch() });
  assert.equal(await adapter.authenticate('T4T-5RVC-3XTE', 'DEMO-01'), null);
  assert.equal(await adapter.authenticate('T4T-9ZJD-6WPN', 'DEMO-03'), null);
});

test('authenticate refuses malformed input without making a request', async () => {
  const requests = [];
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch(requests) });
  assert.equal(await adapter.authenticate('', ''), null);
  assert.equal(await adapter.authenticate('../../etc', 'DEMO-01'), null);
  assert.equal(await adapter.authenticate('T4T-5RVC-3XTE', "x'; drop"), null);
  assert.equal(requests.length, 0);
});

test('getParticipantView refuses a malformed ID without making a request', async () => {
  const requests = [];
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch(requests) });
  assert.equal(await adapter.getParticipantView('../registry'), null);
  assert.equal(await adapter.getParticipantView('T4T-AAAA-BBBB/../../x'), null);
  assert.equal(requests.length, 0);
});

test('getParticipantView returns only the view for the requested person', async () => {
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch() });
  const view = await adapter.getParticipantView('T4T-K8NF-W2AG');
  assert.equal(view.ttid, 'T4T-K8NF-W2AG');
  assert.equal(JSON.stringify(view).includes('"value":189'), false);
});

test('getParticipantView refuses a file whose ttid does not match the request', async () => {
  const other = await readFile(path.join(DATA, 'participant_views', 'T4T-9ZJD-6WPN.json'), 'utf8');
  const adapter = createSyntheticAdapter({
    base: BASE,
    fetchImpl: diskFetch([], () => ({ ok: true, json: async () => JSON.parse(other) })),
  });
  assert.equal(await adapter.getParticipantView('T4T-5RVC-3XTE'), null);
});

test('an unknown but valid-format ID returns null', async () => {
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch() });
  assert.equal(await adapter.getParticipantView('T4T-ZZZZ-ZZZZ'), null);
});

test('getCatalogue returns domains and measures', async () => {
  const adapter = createSyntheticAdapter({ base: BASE, fetchImpl: diskFetch() });
  const cat = await adapter.getCatalogue();
  assert.ok(cat.measures.sbp);
  assert.ok(cat.domains.body_measures);
});

test('the placeholder production adapter refuses to run', async () => {
  const adapter = createRestAdapter();
  await assert.rejects(() => adapter.getParticipantView('T4T-5RVC-3XTE'), /not built/);
});

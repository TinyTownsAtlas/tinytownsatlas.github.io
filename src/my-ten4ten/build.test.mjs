import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll, canonicalSourceId, main, PATHS } from '../../demo/my-ten4ten/build_views.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const registry = JSON.parse(await readFile(PATHS.registry, 'utf8'));
const records = JSON.parse(await readFile(PATHS.records, 'utf8'));
const catalogue = JSON.parse(await readFile(PATHS.catalogue, 'utf8'));
const result = buildAll({ registry, records, catalogue });
const allText = JSON.stringify(result.views);

const byDemo = Object.fromEntries(result.accounts.map((a) => [a.code, a.ttid]));

test('the synthetic build has no problems', () => {
  assert.deepEqual(result.problems, []);
});

test('there are at least eight synthetic participants and every one has a view', () => {
  assert.ok(Object.keys(result.views).length >= 8);
  assert.equal(Object.keys(result.views).length, registry.persons.length);
});

test('the required scenario types are represented', () => {
  const v = result.views;
  const statuses = (ttid) => v[ttid].visits.map((x) => x.status);
  // Wave 1 only
  assert.deepEqual(statuses(byDemo['DEMO-01']), ['results_ready']);
  assert.equal(v[byDemo['DEMO-01']].visits[0].wave, 1);
  // Wave 2 only
  assert.deepEqual(statuses(byDemo['DEMO-02']), ['results_ready']);
  assert.equal(v[byDemo['DEMO-02']].visits[0].wave, 2);
  // Confirmed returner: both waves released
  assert.deepEqual(statuses(byDemo['DEMO-03']), ['results_ready', 'results_ready']);
  // Candidate not verified: only Wave 1 released
  assert.deepEqual(statuses(byDemo['DEMO-04']), ['results_ready']);
  // Multiple visits with a planned future wave
  assert.deepEqual(statuses(byDemo['DEMO-07']), ['results_ready', 'being_checked']);
  assert.equal(v[byDemo['DEMO-07']].planned.length, 1);
  // No approved results
  assert.deepEqual(statuses(byDemo['DEMO-08']), ['not_available']);
  // Missing or incomplete measurements
  const incomplete = v[byDemo['DEMO-06']].visits[0].measures;
  assert.ok(incomplete.some((m) => m.state === 'declined'));
  assert.ok(incomplete.some((m) => m.state === 'under_review'));
  assert.ok(incomplete.some((m) => m.state === 'not_recorded'));
  // Sensitive domain withheld
  assert.equal(v[byDemo['DEMO-09']].visits[0].measures.some((m) => m.id === 'phq2'), false);
  assert.equal(v[byDemo['DEMO-09']].visits[0].some_results_not_shown, true);
});

test('unconfirmed historical matches never appear in any participant view', () => {
  // Values, visit identifiers and dates of hidden links must not appear in the output.
  const hidden = [
    { ttid: byDemo['DEMO-04'], visit: 'W2-0204', date: '2026-09-10', values: [189, 47.6, 11.4, 27, 612] },
    { ttid: byDemo['DEMO-05'], visit: 'W2-0205', date: '2026-09-11', values: [152, 36.2, 8.3, 16, 390] },
  ];
  for (const h of hidden) {
    assert.equal(allText.includes(h.visit), false, `${h.visit} must not appear`);
    assert.equal(allText.includes(`"${h.date}"`), false, `${h.date} must not appear`);
    for (const v of h.values) {
      // Whole-token match: "value":27 must not match "value":27.8 (a visible value).
      const pattern = new RegExp(`"value":${String(v).replace('.', '\\.')}(?![\\d.])`);
      assert.equal(pattern.test(allText), false, `value ${v} must not appear`);
    }
    const own = JSON.stringify(result.views[h.ttid]);
    assert.equal(own.includes(h.date), false);
  }
});

test('the unlinked test entry never appears', () => {
  assert.equal(allText.includes('TEST-0001'), false);
  assert.equal(allText.includes('"value":999'), false);
  assert.equal(allText.includes('2026-09-22'), false);
});

test('no personal identifier keys or source identifiers appear in views', () => {
  const forbidden = ['visit_id', 'link_status', 'source_participant_id_raw', 'match_grade', 'method', 'name', 'dob', 'email', 'phone'];
  for (const view of Object.values(result.views)) {
    const text = JSON.stringify(view);
    for (const key of forbidden) assert.equal(text.includes(`"${key}"`), false, key);
  }
  // Raw source IDs must not appear for any person.
  for (const rec of records.visits) {
    assert.equal(allText.includes(`"${rec.source_participant_id_raw}"`), false, rec.source_participant_id_raw);
  }
});

test('demo accounts are unique, valid and point at existing views', () => {
  const codes = new Set();
  for (const a of result.accounts) {
    assert.equal(codes.has(a.code), false, `duplicate code ${a.code}`);
    codes.add(a.code);
    assert.ok(result.views[a.ttid], `missing view for ${a.code}`);
    assert.match(a.code, /^DEMO-\d{2}$/);
  }
  assert.ok(result.accounts.length >= 8);
});

test('canonical source IDs drop leading zeros and flag non-numeric entries', () => {
  assert.deepEqual(canonicalSourceId('00101'), { canonical: '101', flag: null });
  assert.deepEqual(canonicalSourceId('101'), { canonical: '101', flag: null });
  assert.deepEqual(canonicalSourceId(' 0101 '), { canonical: '101', flag: null });
  assert.deepEqual(canonicalSourceId('TEST-0001'), { canonical: null, flag: 'non_numeric' });
});

test('a canonical ID collision within a wave is refused', () => {
  const bad = structuredClone(records);
  bad.visits.push({ ...bad.visits[0], visit_id: 'W1-9999', date: '2026-03-30', source_participant_id_raw: '101' });
  const out = buildAll({ registry, records: bad, catalogue });
  assert.ok(out.problems.some((p) => p.includes('canonical ID collision')));
});

test('a visit linked to two people is refused', () => {
  const bad = structuredClone(registry);
  bad.persons[0].visits.push({ ...bad.persons[1].visits[0] });
  const out = buildAll({ registry: bad, records, catalogue });
  assert.ok(out.problems.some((p) => p.includes('linked to two people')));
});

test('a link to an unknown source record is refused', () => {
  const bad = structuredClone(registry);
  bad.persons[0].visits[0].visit_id = 'W9-0000';
  const out = buildAll({ registry: bad, records, catalogue });
  assert.ok(out.problems.some((p) => p.includes('unknown visit')));
});

test('the build writes nothing when write is false', async () => {
  const before = await readdir(path.join(ROOT, 'demo', 'my-ten4ten', 'data', 'participant_views'));
  await main({ write: false, log: () => {} });
  const after = await readdir(path.join(ROOT, 'demo', 'my-ten4ten', 'data', 'participant_views'));
  assert.deepEqual(after, before);
});

// Value present in a person's own view, matched as a whole token.
function viewHasValue(ttid, v) {
  const pattern = new RegExp(`"value":${String(v).replace('.', '\\.')}(?![\\d.])`);
  return pattern.test(JSON.stringify(result.views[ttid]));
}

test('pending and unavailable visits release no values', () => {
  // DEMO-07 Wave 2 is being checked. Its values must not appear.
  for (const v of [127, 25.3, 14]) assert.equal(viewHasValue(byDemo['DEMO-07'], v), false, `value ${v}`);
  // DEMO-08 has nothing approved. None of its values may appear.
  for (const v of [133, 29.7, 6.6, 7, 300]) assert.equal(viewHasValue(byDemo['DEMO-08'], v), false, `value ${v}`);
});

test('a flagged in-range entry is withheld, and the state is shown as being checked', () => {
  // DEMO-10 Wave 2 walk is 455 m with an entry-under-check flag. 455 is in range, so only the flag withholds it.
  assert.equal(viewHasValue(byDemo['DEMO-10'], 455), false);
  const w2 = result.views[byDemo['DEMO-10']].visits[1];
  assert.deepEqual(w2.measures.find((m) => m.id === 'walk_6mw'), { id: 'walk_6mw', state: 'under_review' });
  // DEMO-06 Wave 1 walk is 550 m with the same flag, and the BMI placeholder is 0.
  assert.equal(viewHasValue(byDemo['DEMO-06'], 550), false);
  assert.equal(viewHasValue(byDemo['DEMO-06'], 0), false);
});

test('a rejected link never releases its visit, even when approved', () => {
  const r = structuredClone(registry);
  const rec = structuredClone(records);
  rec.visits.push({
    visit_id: 'W2-0299', wave: 2, label: 'Wave 2 · September 2026', date: '2026-09-30',
    record_quality: 'ok', source_participant_id_raw: '0299',
    measures: { sbp: { state: 'recorded', value: 777 } },
  });
  r.persons[0].visits.push({
    visit_id: 'W2-0299', link_status: 'rejected', method: 'historical_match', match_grade: 'probable',
    return: { status: 'approved', domains: ['body_measures'] },
  });
  const out = buildAll({ registry: r, records: rec, catalogue });
  assert.deepEqual(out.problems, []);
  const text = JSON.stringify(out.views[r.persons[0].ttid]);
  assert.equal(text.includes('2026-09-30'), false);
  assert.equal(/"value":777(?![\d.])/.test(text), false);
});

test('a linked test entry is still never released', () => {
  const r = structuredClone(registry);
  r.persons[1].visits.push({
    visit_id: 'TEST-0001', link_status: 'identity_verified', method: 'enrolment', match_grade: null,
    return: { status: 'approved', domains: ['body_measures', 'blood_glucose'] },
  });
  const out = buildAll({ registry: r, records, catalogue });
  assert.deepEqual(out.problems, []);
  const text = JSON.stringify(out.views[r.persons[1].ttid]);
  assert.equal(text.includes('TEST-0001'), false);
  assert.equal(text.includes('2026-09-22'), false);
  assert.equal(/"value":999(?![\d.])/.test(text), false);
});

test('approval mistakes are refused at build time', () => {
  const emptyDomains = structuredClone(registry);
  emptyDomains.persons.find((p) => p.demo_code === 'DEMO-08').visits[0].return = { status: 'approved', domains: [] };
  assert.ok(buildAll({ registry: emptyDomains, records, catalogue }).problems.some((p) => p.includes('approved with no domains')));

  const typo = structuredClone(registry);
  typo.persons.find((p) => p.demo_code === 'DEMO-08').visits[0].return = { status: 'aproved', domains: [] };
  assert.ok(buildAll({ registry: typo, records, catalogue }).problems.some((p) => p.includes('unknown approval status')));

  const badDomain = structuredClone(registry);
  badDomain.persons.find((p) => p.demo_code === 'DEMO-08').visits[0].return = { status: 'approved', domains: ['made_up'] };
  assert.ok(buildAll({ registry: badDomain, records, catalogue }).problems.some((p) => p.includes('unknown domain')));
});

test('shipped demo files hold no research files or hidden records', async () => {
  // What a demo build ships: the data folder, the page, and the app modules.
  const shipped = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else shipped.push(full);
    }
  }
  await walk(path.join(ROOT, 'demo', 'my-ten4ten', 'data'));
  await walk(path.join(ROOT, 'src', 'my-ten4ten'));
  shipped.push(path.join(ROOT, 'my-ten4ten', 'index.html'));
  for (const f of shipped) {
    if (/\.test\.mjs$/.test(f)) continue; // tests name the hidden records on purpose
    assert.equal(/registry\.json|source_records\.json/.test(f), false, f);
    const text = await readFile(f, 'utf8');
    assert.equal(text.includes('TEST-0001'), false, `test record in ${f}`);
    assert.equal(text.includes('demo/my-ten4ten/research'), false, `research path referenced in ${f}`);
  }
});

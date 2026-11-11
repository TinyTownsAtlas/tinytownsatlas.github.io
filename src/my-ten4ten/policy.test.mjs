import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildComparisons,
  isRealIsoDate,
  isValidTtid,
  releaseMeasure,
  releaseVisit,
  sanitiseView,
} from './policy.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(await readFile(path.join(HERE, '..', '..', 'demo', 'my-ten4ten', 'data', 'measure_catalogue.json'), 'utf8'));
const M = cat.measures;
const D_ALL = ['body_measures', 'blood_glucose', 'fitness', 'lifestyle_pain'];

const visit = {
  wave: 2,
  label: 'Wave 2 · September 2026',
  date: '2026-09-10',
  record_quality: 'ok',
  measures: {
    sbp: { state: 'recorded', value: 189 },
    phq2: { state: 'recorded', value: 'positive' },
    walk_6mw: { state: 'recorded', value: 55, flags: ['entry_under_check'] },
    bmi: { state: 'recorded', value: 0, flags: ['placeholder_value'] },
    chair_stands: { state: 'declined' },
  },
};
const approved = { status: 'approved', domains: D_ALL };

test('only identity_verified links can release a visit', () => {
  for (const link_status of ['candidate', 'case_reviewed', 'rejected']) {
    assert.equal(releaseVisit({ visit, link: { link_status }, approval: approved, catalogue: M }), null, link_status);
  }
  const ok = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: approved, catalogue: M });
  assert.equal(ok.status, 'results_ready');
});

test('test entries never release, even if verified and approved', () => {
  const testRecord = { ...visit, record_quality: 'test_entry' };
  assert.equal(releaseVisit({ visit: testRecord, link: { link_status: 'identity_verified' }, approval: approved, catalogue: M }), null);
});

test('pending approval gives being_checked with no measures', () => {
  const out = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: { status: 'pending', domains: [] }, catalogue: M });
  assert.equal(out.status, 'being_checked');
  assert.deepEqual(out.measures, []);
});

test('not approved gives not_available with no measures', () => {
  const out = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: { status: 'not_approved', domains: [] }, catalogue: M });
  assert.equal(out.status, 'not_available');
  assert.deepEqual(out.measures, []);
});

test('measures outside approved domains are omitted and flagged, not shown', () => {
  const out = releaseVisit({
    visit,
    link: { link_status: 'identity_verified' },
    approval: { status: 'approved', domains: ['body_measures', 'blood_glucose', 'fitness', 'lifestyle_pain'] },
    catalogue: M,
  });
  assert.equal(out.measures.some((m) => m.id === 'phq2'), false);
  assert.equal(out.some_results_not_shown, true);
});

test('unknown measure ids are omitted', () => {
  const v = { ...visit, measures: { made_up: { state: 'recorded', value: 1 } } };
  const out = releaseVisit({ visit: v, link: { link_status: 'identity_verified' }, approval: approved, catalogue: M });
  assert.deepEqual(out.measures, []);
  assert.equal(out.some_results_not_shown, true);
});

test('entry_under_check and placeholder values are withheld', () => {
  assert.deepEqual(releaseMeasure(visit.measures.walk_6mw, M.walk_6mw), { state: 'under_review' });
  assert.deepEqual(releaseMeasure(visit.measures.bmi, M.bmi), { state: 'not_recorded' });
});

test('values outside the plausible range are withheld as under review', () => {
  assert.deepEqual(releaseMeasure({ state: 'recorded', value: 40 }, M.walk_6mw), { state: 'under_review' });
  assert.deepEqual(releaseMeasure({ state: 'recorded', value: 999 }, M.sbp), { state: 'under_review' });
});

test('declined and unable are statuses, not values; unknown categories are not released', () => {
  assert.deepEqual(releaseMeasure({ state: 'declined' }, M.chair_stands), { state: 'declined' });
  assert.deepEqual(releaseMeasure({ state: 'unable' }, M.chair_stands), { state: 'unable' });
  assert.deepEqual(releaseMeasure({ state: 'recorded', value: 'maybe' }, M.smoking), { state: 'not_recorded' });
});

test('sanitiseView drops injected candidate visits, identifiers and unknown keys', () => {
  const injected = {
    ttid: 'T4T-K8NF-W2AG',
    visits: [
      { visit_key: 'v1', wave: 1, label: 'Wave 1', date: '2026-03-12', status: 'results_ready',
        measures: [{ id: 'sbp', state: 'recorded', value: 126, source_id: 'W1-0103' }], link_status: 'identity_verified' },
      { visit_key: 'v2', wave: 2, label: 'Wave 2', date: '2026-09-10', status: 'candidate',
        measures: [{ id: 'sbp', state: 'recorded', value: 189 }] },
      { visit_key: 'v3', wave: 2, label: 'Wave 2', date: '2026-09-11', status: 'results_ready',
        measures: [{ id: 'sbp', state: 'recorded', value: 'not-a-number' }] },
    ],
    visit_id: 'W2-0204',
  };
  const clean = sanitiseView(injected, M);
  assert.equal(clean.visits.length, 2);
  assert.equal(clean.visits.some((v) => v.status === 'candidate'), false);
  const text = JSON.stringify(clean);
  assert.equal(text.includes('W2-0204'), false);
  assert.equal(text.includes('W1-0103'), false);
  assert.equal(text.includes('189'), false);
  assert.equal(text.includes('link_status'), false);
  assert.equal(clean.visits[1].measures.length, 0, 'invalid value dropped');
});

test('sanitiseView rejects a view with an invalid ttid', () => {
  assert.equal(sanitiseView({ ttid: 'T4T-BAD', visits: [] }, M), null);
  assert.equal(sanitiseView(null, M), null);
});

test('isValidTtid accepts Crockford-style IDs only', () => {
  assert.equal(isValidTtid('T4T-2H7M-KQ4R'), true);
  assert.equal(isValidTtid('T4T-2I7M-KQ4R'), false, 'I is excluded');
  assert.equal(isValidTtid('T4T-2H7M-KQ4'), false);
  assert.equal(isValidTtid('t4t-2h7m-kq4r'), false);
});

test('buildComparisons only compares consecutive results_ready screenings with recorded values', () => {
  const visits = [
    { visit_key: 'v1', label: 'Wave 1 · March 2026', date: '2026-03-10', status: 'results_ready',
      measures: [{ id: 'sbp', state: 'recorded', value: 138 }, { id: 'walk_6mw', state: 'recorded', value: 340 }] },
    { visit_key: 'v2', label: 'Wave 2 · September 2026', date: '2026-09-09', status: 'results_ready',
      measures: [{ id: 'sbp', state: 'recorded', value: 129 }, { id: 'walk_6mw', state: 'under_review' }] },
    { visit_key: 'v3', label: 'Wave 2 · September 2026', date: '2026-09-20', status: 'being_checked', measures: [] },
  ];
  const out = buildComparisons(visits, M);
  const sbp = out.find((c) => c.id === 'sbp');
  assert.ok(sbp);
  assert.equal(sbp.changes.length, 1);
  assert.equal(sbp.changes[0].delta, -9);
  assert.equal(sbp.changes[0].direction, 'lower');
  assert.equal(out.some((c) => c.id === 'walk_6mw'), false, 'no walk comparison when one side is under review');
});

test('buildComparisons carries category labels so the page can show readable changes', () => {
  const visits = [
    { visit_key: 'v1', label: 'Wave 1 · March 2026', date: '2026-03-11', status: 'results_ready',
      measures: [{ id: 'smoking', state: 'recorded', value: 'current' }] },
    { visit_key: 'v2', label: 'Wave 2 · September 2026', date: '2026-09-09', status: 'results_ready',
      measures: [{ id: 'smoking', state: 'recorded', value: 'former' }] },
  ];
  const [smoking] = buildComparisons(visits, M);
  assert.equal(smoking.categories.former, 'Former smoker');
  assert.equal(smoking.categories.current, 'Current smoker');
});

test('an in-range value with an entry-under-check flag is withheld, not released', () => {
  assert.deepEqual(
    releaseMeasure({ state: 'recorded', value: 550, flags: ['entry_under_check'] }, M.walk_6mw),
    { state: 'under_review' },
  );
});

test('an unknown flag withholds the value (fail closed)', () => {
  assert.deepEqual(
    releaseMeasure({ state: 'recorded', value: 400, flags: ['something_new'] }, M.walk_6mw),
    { state: 'under_review' },
  );
});

test('an approved visit with no matching domain is not_available, never an empty results_ready', () => {
  const out = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: { status: 'approved', domains: ['made_up_domain'] }, catalogue: M });
  assert.equal(out.status, 'not_available');
  assert.deepEqual(out.measures, []);
});

test('an approved visit with an empty domain list is not_available', () => {
  const out = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: { status: 'approved', domains: [] }, catalogue: M });
  assert.equal(out.status, 'not_available');
});

test('an unknown or missing approval status is treated as not approved', () => {
  const typo = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: { status: 'aproved', domains: D_ALL }, catalogue: M });
  assert.equal(typo.status, 'not_available');
  assert.deepEqual(typo.measures, []);
  const missing = releaseVisit({ visit, link: { link_status: 'identity_verified' }, approval: undefined, catalogue: M });
  assert.equal(missing.status, 'not_available');
});

test('a visit with an unrecognised record_quality is not released', () => {
  const v = { ...visit, record_quality: 'unchecked' };
  assert.equal(releaseVisit({ visit: v, link: { link_status: 'identity_verified' }, approval: approved, catalogue: M }), null);
});

test('isRealIsoDate rejects impossible dates', () => {
  assert.equal(isRealIsoDate('2026-02-28'), true);
  assert.equal(isRealIsoDate('2026-13-45'), false);
  assert.equal(isRealIsoDate('2026-02-30'), false);
  assert.equal(isRealIsoDate('2026-3-1'), false);
});

test('sanitiseView drops visits with impossible dates and requires a catalogue', () => {
  const base = {
    ttid: 'T4T-2H7M-KQ4R',
    visits: [{ visit_key: 'v1', status: 'results_ready', date: '2026-13-45', measures: [{ id: 'sbp', state: 'recorded', value: 120 }] }],
  };
  assert.equal(sanitiseView(base, M).visits.length, 0);
  const ok = structuredClone(base);
  ok.visits[0].date = '2026-02-28';
  assert.equal(sanitiseView(ok, M).visits.length, 1);
  assert.equal(sanitiseView(ok, null), null);
});

test('sanitiseView ignores inherited property names as measure ids', () => {
  const v = {
    ttid: 'T4T-2H7M-KQ4R',
    visits: [{
      visit_key: 'v1', status: 'results_ready', date: '2026-03-10',
      measures: [
        { id: 'constructor', state: 'recorded', value: 1 },
        { id: '__proto__', state: 'recorded', value: 2 },
        { id: 'toString', state: 'recorded', value: 3 },
      ],
    }],
  };
  const out = sanitiseView(v, M);
  assert.equal(out.visits[0].measures.length, 0);
});

test('buildComparisons describes category changes without a numeric delta', () => {
  const visits = [
    { visit_key: 'v1', label: 'Wave 1 · March 2026', date: '2026-03-11', status: 'results_ready',
      measures: [{ id: 'smoking', state: 'recorded', value: 'current' }] },
    { visit_key: 'v2', label: 'Wave 2 · September 2026', date: '2026-09-09', status: 'results_ready',
      measures: [{ id: 'smoking', state: 'recorded', value: 'former' }] },
  ];
  const out = buildComparisons(visits, M);
  assert.equal(out[0].changes[0].direction, 'changed');
  assert.equal(out[0].changes[0].delta, null);
});

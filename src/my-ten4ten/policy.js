// My TEN4TEN release rules.
// Pure functions only: no DOM, no network, no storage.
// The synthetic build (Node) applies releaseVisit() to research records.
// The browser re-applies sanitiseView() as a second, defensive filter.
// Every check fails closed: unknown statuses, flags, fields and values are withheld.

export const VISIBLE_LINK_STATUS = 'identity_verified';
export const LINK_STATUSES = ['candidate', 'case_reviewed', 'identity_verified', 'rejected'];
export const APPROVAL_STATUSES = ['approved', 'pending', 'not_approved'];
export const VISIT_STATUSES = ['results_ready', 'being_checked', 'not_available'];
export const RECORD_STATES = ['recorded', 'not_recorded', 'declined', 'unable', 'under_review'];
export const RECORD_QUALITY_RELEASABLE = 'ok';
export const WITHHOLDING_FLAGS = ['placeholder_value', 'entry_under_check'];

const TTID_PATTERN = /^T4T-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function hasOwn(obj, key) {
  return obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

export function isValidTtid(value) {
  return typeof value === 'string' && TTID_PATTERN.test(value);
}

// A real calendar date in YYYY-MM-DD form (rejects 2026-13-45 and 2026-02-30).
export function isRealIsoDate(value) {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE_PATTERN.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// Measurement-level release. A raw value is released only when it is a plainly recorded,
// plausible value with no withholding flag and no unknown flag.
export function releaseMeasure(raw, entry) {
  if (!raw || typeof raw !== 'object' || !entry) return { state: 'not_recorded' };
  const flags = Array.isArray(raw.flags) ? raw.flags : [];
  const unknownFlag = flags.some((f) => !WITHHOLDING_FLAGS.includes(f));
  switch (raw.state) {
    case 'recorded': {
      if (flags.includes('placeholder_value')) return { state: 'not_recorded' };
      if (flags.includes('entry_under_check') || unknownFlag) return { state: 'under_review' };
      if (entry.kind === 'category') {
        return typeof raw.value === 'string' && hasOwn(entry.categories, raw.value)
          ? { state: 'recorded', value: raw.value }
          : { state: 'not_recorded' };
      }
      if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return { state: 'not_recorded' };
      const [lo, hi] = entry.range || [-Infinity, Infinity];
      if (raw.value < lo || raw.value > hi) return { state: 'under_review' };
      return { state: 'recorded', value: raw.value };
    }
    case 'declined': return { state: 'declined' };
    case 'unable': return { state: 'unable' };
    case 'under_review': return { state: 'under_review' };
    default: return { state: 'not_recorded' };
  }
}

// Visit-level release. Returns null when the visit must not appear in any form.
// `catalogue` is the measure map (id -> definition).
export function releaseVisit({ visit, link, approval, catalogue }) {
  if (!visit || !link || !catalogue) return null;
  if (visit.record_quality !== RECORD_QUALITY_RELEASABLE) return null;
  if (link.link_status !== VISIBLE_LINK_STATUS) return null;
  const base = { wave: visit.wave, label: visit.label, date: visit.date };
  // An unknown or missing approval status is treated as not approved (fail closed).
  const status = approval && APPROVAL_STATUSES.includes(approval.status) ? approval.status : 'not_approved';
  if (status === 'not_approved') {
    return { ...base, status: 'not_available', measures: [], some_results_not_shown: false };
  }
  if (status === 'pending') {
    return { ...base, status: 'being_checked', measures: [], some_results_not_shown: false };
  }
  const allowed = new Set((Array.isArray(approval.domains) ? approval.domains : []).filter((d) => typeof d === 'string'));
  const measures = [];
  let omitted = false;
  for (const [id, raw] of Object.entries(visit.measures || {})) {
    if (!hasOwn(catalogue, id) || !allowed.has(catalogue[id].domain)) {
      omitted = true;
      continue;
    }
    measures.push({ id, ...releaseMeasure(raw, catalogue[id]) });
  }
  // Approved, but nothing in the approved domains: there is nothing to show.
  if (measures.length === 0) {
    return { ...base, status: 'not_available', measures: [], some_results_not_shown: omitted };
  }
  return { ...base, status: 'results_ready', measures, some_results_not_shown: omitted };
}

function isAllowedValue(value, entry) {
  if (entry.kind === 'category') {
    return typeof value === 'string' && hasOwn(entry.categories, value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const [lo, hi] = entry.range || [-Infinity, Infinity];
  return value >= lo && value <= hi;
}

// Defensive re-check of a participant view, applied in the browser before rendering.
// `measures` is the measure map from the public catalogue and is required.
// Anything that is not a released visit or released measure is dropped, as are unknown keys.
export function sanitiseView(view, measures) {
  if (!view || typeof view !== 'object' || !isValidTtid(view.ttid)) return null;
  if (!measures || typeof measures !== 'object') return null;
  const visits = [];
  for (const v of Array.isArray(view.visits) ? view.visits : []) {
    if (!v || typeof v !== 'object') continue;
    if (!VISIT_STATUSES.includes(v.status)) continue;
    if (typeof v.visit_key !== 'string' || !isRealIsoDate(v.date)) continue;
    const list = [];
    if (v.status === 'results_ready' && Array.isArray(v.measures)) {
      for (const m of v.measures) {
        if (!m || typeof m !== 'object' || typeof m.id !== 'string') continue;
        if (!hasOwn(measures, m.id)) continue;
        if (!RECORD_STATES.includes(m.state)) continue;
        const out = { id: m.id, state: m.state };
        if (m.state === 'recorded') {
          if (!isAllowedValue(m.value, measures[m.id])) continue;
          out.value = m.value;
        }
        list.push(out);
      }
    }
    visits.push({
      visit_key: v.visit_key,
      wave: Number(v.wave) || null,
      label: String(v.label || ''),
      date: v.date,
      status: v.status,
      measures: list,
      some_results_not_shown: v.some_results_not_shown === true,
    });
  }
  visits.sort((a, b) => a.date.localeCompare(b.date));
  const planned = (Array.isArray(view.planned) ? view.planned : [])
    .filter((p) => p && typeof p.label === 'string')
    .map((p) => ({ label: p.label, wave: Number(p.wave) || null }));
  return {
    ttid: view.ttid,
    demo_notice: typeof view.demo_notice === 'string' ? view.demo_notice : '',
    visits,
    planned,
  };
}

function roundTo(x, decimals) {
  const f = 10 ** decimals;
  const r = Math.round(x * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

// Build the change list for each measure. A change is only described between two
// consecutive screenings that both have a recorded value and both are results_ready.
export function buildComparisons(visits, measures) {
  const shown = visits.filter((v) => v.status === 'results_ready');
  const out = [];
  for (const [id, entry] of Object.entries(measures)) {
    const series = shown.map((v) => {
      const m = v.measures.find((x) => x.id === id);
      return {
        visit_key: v.visit_key,
        waveText: v.label.split('·')[0].trim(),
        date: v.date,
        state: m ? m.state : 'absent',
        value: m && m.state === 'recorded' ? m.value : null,
      };
    });
    if (series.filter((p) => p.state === 'recorded').length < 2) continue;
    const changes = [];
    for (let i = 1; i < series.length; i += 1) {
      const a = series[i - 1];
      const b = series[i];
      if (a.state !== 'recorded' || b.state !== 'recorded') continue;
      if (entry.kind === 'category') {
        changes.push({ from: a, to: b, direction: a.value === b.value ? 'unchanged' : 'changed', delta: null });
      } else {
        const delta = roundTo(b.value - a.value, entry.decimals ?? 0);
        let direction = 'same';
        if (delta > 0) direction = 'higher';
        if (delta < 0) direction = 'lower';
        changes.push({ from: a, to: b, direction, delta });
      }
    }
    out.push({
      id,
      label: entry.label,
      kind: entry.kind,
      categories: entry.categories || null,
      unit: entry.unit || '',
      decimals: entry.decimals ?? 0,
      comparability: entry.comparability || 'same_protocol',
      series,
      changes,
    });
  }
  return out;
}

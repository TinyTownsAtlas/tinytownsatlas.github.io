// Builds participant-facing views from the SYNTHETIC research store.
// Reads demo/my-ten4ten/research/*.json (never shipped) and writes demo/my-ten4ten/data/ (shipped in demo builds only).
// Refuses to write anything if a validation, release or leakage check fails.

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  APPROVAL_STATUSES,
  LINK_STATUSES,
  RECORD_QUALITY_RELEASABLE,
  isValidTtid,
  releaseVisit,
  sanitiseView,
} from '../../src/my-ten4ten/policy.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PATHS = {
  registry: path.join(HERE, 'research', 'registry.json'),
  records: path.join(HERE, 'research', 'source_records.json'),
  catalogue: path.join(HERE, 'data', 'measure_catalogue.json'),
  outDir: path.join(HERE, 'data'),
};

const ALLOWED_RECORD_QUALITY = [RECORD_QUALITY_RELEASABLE, 'test_entry'];

const FORBIDDEN_KEYS = new Set([
  'name', 'dob', 'date_of_birth', 'email', 'phone', 'address', 'postcode',
  'visit_id', 'link_status', 'match_grade', 'method', 'source_participant_id_raw',
  'record_quality', 'return', 'planned_waves', 'demo_code', 'demo_label',
]);

// Canonical linkage ID for a source participant ID (see the fieldwork ID note):
// numeric IDs lose leading zeros; anything else is flagged, never silently altered.
export function canonicalSourceId(raw) {
  const text = String(raw ?? '').trim();
  if (/^\d+$/.test(text)) return { canonical: String(Number(text)), flag: null };
  return { canonical: null, flag: 'non_numeric' };
}

// True when `token` occurs in `text` as a whole token, so "value":27 does not match "value":27.8.
export function containsToken(text, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![\\d.])`).test(text);
}

function findKeys(node, found = []) {
  if (Array.isArray(node)) node.forEach((n) => findKeys(n, found));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (FORBIDDEN_KEYS.has(k)) found.push(k);
      findKeys(v, found);
    }
  }
  return found;
}

// Numeric values in a visit that did NOT reach the participant unchanged, as they would
// appear in JSON. Covers hidden visits, pending and unavailable visits, and withheld
// measures inside released visits (placeholder, entry under check, out of range, not approved).
function withheldNumericTokens(visit, releasedMeasures = []) {
  const kept = new Map(releasedMeasures.map((m) => [m.id, m]));
  const tokens = [];
  for (const [id, m] of Object.entries(visit.measures || {})) {
    if (!m || typeof m.value !== 'number') continue;
    const out = kept.get(id);
    const released = Boolean(out && out.state === 'recorded' && out.value === m.value);
    if (!released) tokens.push(`"value":${m.value}`);
  }
  return tokens;
}

export function buildAll({ registry, records, catalogue }) {
  const problems = [];
  const counts = { persons: 0, visits: 0, released: 0, hidden: 0, unlinked: 0 };
  const visitById = new Map();
  for (const v of records.visits) {
    if (visitById.has(v.visit_id)) problems.push(`duplicate source record ${v.visit_id}`);
    if (!ALLOWED_RECORD_QUALITY.includes(v.record_quality)) {
      problems.push(`${v.visit_id} has unknown record_quality ${v.record_quality}`);
    }
    visitById.set(v.visit_id, v);
  }
  counts.visits = visitById.size;

  // Within a wave, a numeric canonical ID must belong to exactly one source record.
  const seenCanonical = new Map();
  for (const v of records.visits) {
    const { canonical } = canonicalSourceId(v.source_participant_id_raw);
    if (!canonical) continue;
    const key = `${v.wave}:${canonical}`;
    if (seenCanonical.has(key) && seenCanonical.get(key) !== v.visit_id) {
      problems.push(`canonical ID collision ${key}: ${seenCanonical.get(key)} and ${v.visit_id}`);
    }
    seenCanonical.set(key, v.visit_id);
  }

  const linkOwner = new Map();
  const views = {};
  const accounts = [];
  const codes = new Set();
  const hiddenFromEveryone = []; // identifiers and values of visits no participant may see

  for (const person of registry.persons) {
    counts.persons += 1;
    if (!isValidTtid(person.ttid)) {
      problems.push(`invalid ttid ${person.ttid}`);
      continue;
    }
    if (views[person.ttid]) problems.push(`duplicate ttid ${person.ttid}`);

    const released = [];
    const hiddenTokens = [];
    for (const link of person.visits) {
      const visit = visitById.get(link.visit_id);
      if (!visit) {
        problems.push(`${person.ttid} links unknown visit ${link.visit_id}`);
        continue;
      }
      if (!LINK_STATUSES.includes(link.link_status)) {
        problems.push(`${link.visit_id} has unknown link_status ${link.link_status}`);
      }
      const approval = link.return;
      if (!approval || !APPROVAL_STATUSES.includes(approval.status)) {
        problems.push(`${link.visit_id} has unknown approval status ${approval ? approval.status : '(none)'}`);
      } else if (approval.status === 'approved') {
        const domains = approval.domains;
        if (!Array.isArray(domains) || domains.length === 0) {
          problems.push(`${link.visit_id} is approved with no domains`);
        } else {
          for (const d of domains) {
            if (!catalogue.domains || !Object.prototype.hasOwnProperty.call(catalogue.domains, d)) {
              problems.push(`${link.visit_id} approves unknown domain ${d}`);
            }
          }
        }
      }
      if (linkOwner.has(link.visit_id)) problems.push(`${link.visit_id} is linked to two people`);
      linkOwner.set(link.visit_id, person.ttid);

      const out = releaseVisit({ visit, link, approval, catalogue: catalogue.measures });
      if (out) {
        counts.released += 1;
        released.push({ ...out, _visit_id: link.visit_id });
        hiddenTokens.push(...withheldNumericTokens(visit, out.measures));
      } else {
        counts.hidden += 1;
        hiddenTokens.push(link.visit_id, visit.date, ...withheldNumericTokens(visit, []));
        hiddenFromEveryone.push(link.visit_id, visit.date, ...withheldNumericTokens(visit, []));
      }
    }

    released.sort((a, b) => a.date.localeCompare(b.date));
    const draft = {
      ttid: person.ttid,
      demo_notice: 'SYNTHETIC DEMO DATA. Not real results. Not medical advice.',
      visits: released.map(({ _visit_id, ...rest }, i) => ({ visit_key: `v${i + 1}`, ...rest })),
      planned: person.planned_waves || [],
    };
    const view = sanitiseView(draft, catalogue.measures);
    if (!view) {
      problems.push(`${person.ttid} produced an invalid view`);
      continue;
    }

    const text = JSON.stringify(view);
    for (const tok of hiddenTokens) {
      if (containsToken(text, tok)) problems.push(`${person.ttid} view leaks withheld item ${tok}`);
    }
    for (const key of findKeys(view)) problems.push(`${person.ttid} view contains forbidden key ${key}`);
    views[person.ttid] = view;

    if (person.demo_code) {
      if (codes.has(person.demo_code)) problems.push(`duplicate demo code ${person.demo_code}`);
      codes.add(person.demo_code);
      accounts.push({
        ttid: person.ttid,
        code: person.demo_code,
        label: person.demo_label || `Demo participant ${accounts.length + 1}`,
        profile: person.profile,
      });
    }
  }

  // Source records that no person is linked to (for example, test entries) never appear in any view.
  for (const v of records.visits) {
    if (linkOwner.has(v.visit_id)) continue;
    counts.unlinked += 1;
    hiddenFromEveryone.push(v.visit_id, v.date, ...withheldNumericTokens(v, []));
  }
  for (const [ttid, view] of Object.entries(views)) {
    const text = JSON.stringify(view);
    for (const tok of hiddenFromEveryone) {
      if (containsToken(text, tok)) problems.push(`${ttid} view leaks unlinked or hidden item ${tok}`);
    }
  }

  return { views, accounts, problems, counts };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function main({ paths = PATHS, write = true, log = console.log } = {}) {
  const [registry, records, catalogue] = await Promise.all([
    readJson(paths.registry),
    readJson(paths.records),
    readJson(paths.catalogue),
  ]);
  const result = buildAll({ registry, records, catalogue });
  if (result.problems.length > 0) {
    for (const p of result.problems) log(`PROBLEM: ${p}`);
    throw new Error(`Build refused: ${result.problems.length} problem(s)`);
  }
  if (write) {
    // Write to a temporary folder first, then swap it in, so a failure cannot leave partial output.
    const finalDir = path.join(paths.outDir, 'participant_views');
    const tmpDir = `${finalDir}.tmp`;
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
    for (const [ttid, view] of Object.entries(result.views)) {
      await writeFile(path.join(tmpDir, `${ttid}.json`), `${JSON.stringify(view, null, 2)}\n`, 'utf8');
    }
    await rm(finalDir, { recursive: true, force: true });
    await rename(tmpDir, finalDir);
    await writeFile(
      path.join(paths.outDir, 'demo_accounts.json'),
      `${JSON.stringify(result.accounts, null, 2)}\n`,
      'utf8',
    );
  }
  log(`Built ${Object.keys(result.views).length} participant views from synthetic records.`);
  log(`Counts: ${JSON.stringify(result.counts)}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

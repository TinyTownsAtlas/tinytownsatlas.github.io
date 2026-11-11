// My TEN4TEN synthetic demo. One page, two states: a compact sign-in, and the dashboard.
// Identity comes from the demo session only. Nothing is read from the URL.
// Demo sign-in is simulated and is not security. See docs/MY_TEN4TEN.md.
import '../style/main.css';
import './my-ten4ten.css';
import { createSyntheticAdapter } from './adapter.js';
import { CONFIG } from './config.js';
import { clearSession, getSession, startSession } from './session.js';
import { buildComparisons, sanitiseView } from './policy.js';
import { renderLineChart } from './chart.js';
import { h, replaceChildren } from './dom.js';
import {
  cautionText, changeSentence, formatDate, formatValue, pillFor, shortChange, shortDate, stateText, statusNote,
} from './format.js';

const root = document.getElementById('mt-root');
const who = document.getElementById('mt-who');
const signOutButton = document.getElementById('mt-signout');
const statusLine = document.getElementById('mt-status');
const adapter = createSyntheticAdapter();

// A meta Content-Security-Policy cannot forbid framing and static hosting sends no headers, so the
// page refuses to run inside a frame (clickjacking guard for the sign-in form).
if (window.top !== window.self) {
  document.documentElement.hidden = true;
  throw new Error('My TEN4TEN demo does not run inside a frame.');
}

const SESSION_CHECK_MS = 60 * 1000;
let current = 'entry';

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

// ---------- Sign-in (demo) ----------

function showEntry(notice = '') {
  current = 'entry';
  who.textContent = '';
  signOutButton.hidden = true;

  const ttid = h('input', {
    id: 'mt-ttid', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'T4T-XXXX-XXXX', required: true,
  });
  const code = h('input', {
    id: 'mt-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'DEMO-01', required: true,
  });
  const error = h('p', { class: 'mt-error', role: 'alert' });
  const accounts = h('ul', { class: 'mt-accounts' }, h('li', { text: 'Loading demo accounts…' }));

  const form = h('form', {
    class: 'mt-form',
    novalidate: true,
    onsubmit: async (event) => {
      event.preventDefault();
      error.textContent = '';
      let account = null;
      try {
        account = await adapter.authenticate(ttid.value, code.value);
      } catch {
        account = null;
      }
      if (!account) {
        error.textContent = "We couldn't sign you in with those details. Check the TEN4TEN ID and the activation code.";
        return;
      }
      if (!startSession(account)) {
        error.textContent = 'This browser would not keep the demo session. Try a normal browser window.';
        return;
      }
      showDashboard();
    },
  },
  h('div', { class: 'mt-field' }, h('label', { for: 'mt-ttid', text: 'TEN4TEN ID' }), ttid),
  h('div', { class: 'mt-field' }, h('label', { for: 'mt-code', text: 'Activation code' }), code),
  error,
  h('button', { class: 'mt-btn', type: 'submit', text: 'Open demo' }));

  replaceChildren(root, h('section', { class: 'mt-entry', 'aria-labelledby': 'mt-entry-h' },
    h('h2', { id: 'mt-entry-h', text: 'Your screening results' }),
    h('p', { class: 'mt-muted', text: 'See your own TEN4TEN results over time (demo).' }),
    notice ? h('p', { class: 'mt-note-line', role: 'status', text: notice }) : null,
    form,
    h('details', { class: 'mt-details' },
      h('summary', { text: 'Demo accounts for testers' }),
      h('p', { class: 'mt-muted mt-small', text: 'Each is a test scenario with invented data. Scenario names are for testers only.' }),
      accounts)));

  adapter.listDemoAccounts().then((list) => {
    replaceChildren(accounts, list.map((a) => h('li', { class: 'mt-account' },
      h('p', {}, h('strong', { text: a.label }), ' · ', a.profile),
      h('p', { class: 'mt-mono', text: `${a.ttid} · ${a.code}` }),
      h('button', {
        type: 'button', class: 'mt-btn mt-btn-outline mt-btn-small', text: 'Fill in',
        'aria-label': `Fill in the details for ${a.label}`,
        onclick: () => { ttid.value = a.ttid; code.value = a.code; ttid.focus(); },
      }))));
  }).catch(() => replaceChildren(accounts, h('li', { text: 'Demo accounts could not be loaded.' })));
}

// ---------- Dashboard ----------

function errorPanel(message) {
  replaceChildren(root, h('section', { class: 'mt-card', role: 'alert' },
    h('h2', { text: 'We could not load your results' }),
    h('p', { text: message }),
    h('button', { class: 'mt-btn', type: 'button', text: 'Try again', onclick: showDashboard })));
}

function summaryStrip(view, comparisons) {
  const ready = view.visits.filter((v) => v.status === 'results_ready');
  const latest = ready[ready.length - 1];
  const item = (value, label) => h('div', { class: 'mt-stat' }, h('p', { class: 'mt-stat-value', text: value }), h('p', { class: 'mt-stat-label', text: label }));
  return h('div', { class: 'mt-summary' },
    item(String(ready.length), ready.length === 1 ? 'screening with results' : 'screenings with results'),
    item(String(comparisons.length), comparisons.length === 1 ? 'measure with a trend' : 'measures with trends'),
    item(latest ? formatDate(latest.date) : 'None yet', 'latest results'));
}

function timeline(view) {
  const steps = view.visits.map((v) => ({
    title: v.label, date: formatDate(v.date), note: statusNote(v.status), pill: pillFor(v.status),
    cls: v.status === 'results_ready' ? 'ready' : v.status === 'being_checked' ? 'check' : 'none',
  }));
  for (const p of view.planned) {
    steps.push({ title: p.label, date: 'Date to be confirmed', note: 'Planned. No results yet.', pill: { text: 'Planned', cls: 'pill pill-none' }, cls: 'planned' });
  }
  if (steps.length === 0) return h('p', { class: 'mt-muted', text: 'No screenings are linked to this sign-in yet.' });
  return h('ol', { class: 'mt-timeline' }, steps.map((s) => h('li', { class: `mt-step mt-step-${s.cls}` },
    h('span', { class: 'mt-dot', 'aria-hidden': 'true' }),
    h('p', { class: 'mt-step-title', text: s.title }),
    h('p', { class: 'mt-step-date', text: s.date }),
    h('span', { class: s.pill.cls, text: s.pill.text }),
    h('p', { class: 'mt-step-note', text: s.note }))));
}

function seriesTable(comparison) {
  const rows = comparison.series.map((p) => h('tr', {},
    h('th', { scope: 'row', text: p.waveText }),
    h('td', { text: formatDate(p.date) }),
    h('td', { text: p.state === 'recorded' ? formatValue(comparison, p.value) : (p.state === 'absent' ? 'Not shown' : stateText(p.state)) })));
  return h('details', { class: 'mt-details mt-details-inline' },
    h('summary', { text: 'Show as a table' }),
    h('div', { class: 'mt-table-wrap' }, h('table', { class: 'mt-table' },
      h('caption', { class: 'sr-only', text: `${comparison.label} by screening` }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Screening' }), h('th', { scope: 'col', text: 'Date' }), h('th', { scope: 'col', text: 'Result' }))),
      h('tbody', {}, rows))));
}

function trendCard(comparison) {
  const isNumeric = comparison.kind === 'number';
  const chartHost = h('div', { class: 'mt-chart-host' });
  const latest = [...comparison.series].reverse().find((p) => p.state === 'recorded');
  const last = comparison.changes[comparison.changes.length - 1];
  const caution = cautionText(comparison.comparability);
  const gaps = comparison.series.filter((p) => p.state !== 'recorded').map((p) => {
    const label = p.state === 'absent' ? 'Not shown' : stateText(p.state);
    return h('li', { text: `${p.waveText} (${shortDate(p.date)}): ${label}.${isNumeric ? ' Not drawn on the chart.' : ''}` });
  });
  if (isNumeric) {
    renderLineChart(chartHost, {
      title: `${comparison.label} over time`,
      description: `Recorded values at each checked screening: ${comparison.series.filter((p) => p.state === 'recorded')
        .map((p) => `${p.waveText} ${shortDate(p.date)} ${formatValue(comparison, p.value)}`).join('; ')}.`,
      unit: comparison.unit, decimals: comparison.decimals, series: comparison.series,
    });
  }
  return h('article', { class: 'mt-card mt-trend' },
    h('h4', { text: comparison.label }),
    latest ? h('p', { class: 'mt-trend-value', text: formatValue(comparison, latest.value) }) : null,
    latest ? h('p', { class: 'mt-muted mt-small', text: `${latest.waveText} · ${formatDate(latest.date)}` }) : null,
    isNumeric ? chartHost : null,
    last ? h('p', { class: 'mt-trend-change', text: shortChange(comparison, last) }) : null,
    last ? h('p', { class: 'mt-muted mt-small', text: changeSentence(comparison, last) }) : null,
    caution ? h('p', { class: 'mt-note-line mt-small', text: caution }) : null,
    gaps.length ? h('ul', { class: 'mt-gaps mt-small' }, gaps) : null,
    seriesTable(comparison));
}

function trendsSection(view, catalogue, comparisons) {
  const ready = view.visits.filter((v) => v.status === 'results_ready').length;
  const children = [h('h3', { id: 'mt-trends-h', text: 'Trends' })];
  if (comparisons.length === 0) {
    children.push(h('p', { class: 'mt-muted', text: ready < 2
      ? 'Trends appear once two screenings have checked, approved results.'
      : 'No measure has a recorded result at two screenings yet.' }));
  } else {
    children.push(h('p', { class: 'mt-muted mt-small', text: 'Only screenings that have been checked and approved are compared. Single readings can vary from day to day.' }));
    children.push(h('p', { class: 'mt-note-line mt-small', text: 'Demo feature: individual trends are still under ethics review.' }));
    children.push(h('div', { class: 'mt-trend-grid' }, comparisons.map(trendCard)));
  }
  return h('section', { class: 'mt-section', 'aria-labelledby': 'mt-trends-h' }, children);
}

function visitCard(visit, catalogue) {
  const byDomain = new Map();
  for (const [id, entry] of Object.entries(catalogue.measures)) {
    const m = visit.measures.find((x) => x.id === id);
    if (!m) continue;
    if (!byDomain.has(entry.domain)) byDomain.set(entry.domain, []);
    byDomain.get(entry.domain).push({ entry, m });
  }
  const rows = [];
  for (const [domain, items] of byDomain) {
    rows.push(h('tr', { class: 'mt-domain-row' }, h('th', { colspan: '2', scope: 'colgroup', text: catalogue.domains[domain] || domain })));
    for (const { entry, m } of items) {
      rows.push(h('tr', {},
        h('th', { scope: 'row' }, h('span', { class: 'mt-measure', text: entry.label }), h('span', { class: 'mt-measure-note', text: entry.explain })),
        h('td', { class: m.state === 'recorded' ? 'mt-value' : 'mt-value mt-state', text: m.state === 'recorded' ? formatValue(entry, m.value) : stateText(m.state) })));
    }
  }
  return h('details', { class: 'mt-card mt-visit', open: true },
    h('summary', {}, h('span', { class: 'mt-visit-title', text: visit.label }), h('span', { class: 'mt-muted mt-small', text: formatDate(visit.date) })),
    rows.length === 0
      ? h('p', { text: 'No results from this screening are included in your view yet.' })
      : h('div', { class: 'mt-table-wrap' }, h('table', { class: 'mt-table' },
        h('caption', { class: 'sr-only', text: `Your results from ${visit.label}` }),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Measure' }), h('th', { scope: 'col', text: 'Your result' }))),
        h('tbody', {}, rows))),
    visit.some_results_not_shown ? h('p', { class: 'mt-note-line mt-small', text: 'Some results from this screening are not included in this view. Only results approved for return are shown.' }) : null);
}

function resultsSection(view, catalogue) {
  const ready = view.visits.filter((v) => v.status === 'results_ready');
  const children = [h('h3', { id: 'mt-results-h', text: 'Results by screening' })];
  if (ready.length === 0) {
    children.push(h('div', { class: 'mt-card mt-empty' },
      h('p', { class: 'mt-strong', text: 'No results are ready to view yet.' }),
      h('p', { class: 'mt-muted', text: 'Results appear here once the TEN4TEN team has checked them and the project has approved them for return.' })));
  } else {
    children.push(...ready.slice().reverse().map((v) => visitCard(v, catalogue)));
  }
  return h('section', { class: 'mt-section', 'aria-labelledby': 'mt-results-h' }, children);
}

function footnotes(view) {
  return h('footer', { class: 'mt-footnotes mt-small' },
    h('p', { text: 'In a real service, results from other screenings would appear only after the TEN4TEN team had checked they were yours and you had confirmed it. If one seemed missing, you would contact the TEN4TEN team (contact details to be confirmed).' }),
    view.visits.some((v) => v.some_results_not_shown) ? h('p', { text: 'Some results are not included because they are not yet approved for return.' }) : null,
    h('p', { text: 'Not a diagnosis and not medical advice. If you have questions or feel unwell, talk to your GP or local health service. In an emergency, call 000.' }));
}

async function showDashboard() {
  const session = getSession();
  if (!session) { showEntry('Your demo session has ended. Please sign in again.'); return; }
  current = 'dashboard';
  who.textContent = session.label;
  signOutButton.hidden = false;
  replaceChildren(root, h('p', { class: 'mt-muted', text: 'Loading your results…' }));

  let catalogue = null;
  let view = null;
  try {
    catalogue = await adapter.getCatalogue();
    view = sanitiseView(await adapter.getParticipantView(session.ttid), catalogue?.measures);
  } catch {
    view = null;
  }
  if (!catalogue || !view || view.ttid !== session.ttid) {
    errorPanel('Something went wrong while loading this page. Please try again later.');
    return;
  }
  try {
    const comparisons = CONFIG.showIndividualComparisons ? buildComparisons(view.visits, catalogue.measures) : [];
    replaceChildren(root,
      h('h2', { id: 'mt-title', class: 'mt-title', tabindex: '-1', text: 'Your results' }),
      summaryStrip(view, comparisons),
      h('section', { class: 'mt-section', 'aria-labelledby': 'mt-screenings-h' }, h('h3', { id: 'mt-screenings-h', text: 'Screenings' }), timeline(view)),
      CONFIG.showIndividualComparisons ? trendsSection(view, catalogue, comparisons) : null,
      resultsSection(view, catalogue),
      footnotes(view));
    announce('Your results have loaded.');
    document.getElementById('mt-title')?.focus();
  } catch (err) {
    console.error('Results could not be rendered', err);
    errorPanel('Something went wrong while showing your results. Please try again later.');
  }
}

signOutButton.addEventListener('click', () => {
  clearSession();
  showEntry('You have signed out of the demo.');
});

// Re-check the demo session while the dashboard is open and when restored from the back/forward cache.
setInterval(() => {
  if (current === 'dashboard' && !getSession()) showEntry('Your demo session has ended. Please sign in again.');
}, SESSION_CHECK_MS);
window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });

if (getSession()) showDashboard(); else showEntry();

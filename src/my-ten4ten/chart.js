// Accessible line chart. Axis labels, screening labels and points are real HTML text and
// elements, so they scale with the page font on small screens. Only the connecting lines
// use SVG. Only recorded values are plotted. A line joins two consecutive screenings only
// when both have a recorded value. Screenings without a recorded value are listed in text.

import { h } from './dom.js';
import { shortDate } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DAY_MS = 86400000;

function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

// Round tick values (1, 2, 2.5 or 5 times a power of ten) that fall inside [min, max].
function ticksForStep(min, max, step) {
  const out = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

function niceTicks(min, max, targetCount = 4) {
  const raw = (max - min) / targetCount;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  let ticks = ticksForStep(min, max, step);
  // Always show at least two clean gridlines: halve the step until there are two.
  while (ticks.length < 2 && step > 1e-9) {
    step /= 2;
    ticks = ticksForStep(min, max, step);
  }
  return ticks;
}

// series: [{ waveText, date, state, value }] in date order.
export function renderLineChart(container, { title, description, unit, decimals = 0, series }) {
  const recorded = series.filter((p) => p.state === 'recorded');
  const times = series.map((p) => dayNumber(p.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const span = Math.max(tMax - tMin, 1);

  let lo = Math.min(...recorded.map((p) => p.value));
  let hi = Math.max(...recorded.map((p) => p.value));
  // Keep the scale wide enough that small changes do not look dramatic: at least 20% of the
  // value, and at least one unit, is always on the axis.
  const mid = (lo + hi) / 2;
  const minSpan = Math.max(Math.abs(mid) * 0.2, 1);
  if (hi - lo < minSpan) {
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const headroom = (hi - lo) * 0.15;
  const yMin = lo - headroom;
  const yMax = hi + headroom;

  // Positions in percent of the plot box. Points sit inside 12%-88% so labels do not clip.
  const xPct = (p) => 12 + ((dayNumber(p.date) - tMin) / span) * 76;
  const yPct = (v) => 6 + (1 - (v - yMin) / (yMax - yMin)) * 88;

  const plot = h('div', { class: 'plot' });
  for (const t of niceTicks(yMin, yMax)) {
    const top = yPct(t);
    plot.append(
      h('div', { class: 'grid-line', style: `top:${top}%` }),
      h('span', { class: 'y-tick', style: `top:${top}%`, text: Number(t).toFixed(decimals) }),
    );
  }

  const lines = document.createElementNS(SVG_NS, 'svg');
  lines.setAttribute('class', 'lines');
  lines.setAttribute('viewBox', '0 0 100 100');
  lines.setAttribute('preserveAspectRatio', 'none');
  lines.setAttribute('aria-hidden', 'true');
  lines.setAttribute('focusable', 'false');
  for (let i = 1; i < series.length; i += 1) {
    const a = series[i - 1];
    const b = series[i];
    if (a.state !== 'recorded' || b.state !== 'recorded') continue;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(xPct(a)));
    line.setAttribute('y1', String(yPct(a.value)));
    line.setAttribute('x2', String(xPct(b)));
    line.setAttribute('y2', String(yPct(b.value)));
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    line.setAttribute('class', 'series-line');
    lines.append(line);
  }
  plot.append(lines, h('div', { class: 'axis-base' }));

  for (const p of recorded) {
    plot.append(h('span', {
      class: 'dot',
      style: `left:${xPct(p)}%;top:${yPct(p.value)}%`,
      title: `${p.waveText}, ${shortDate(p.date)}: ${Number(p.value).toFixed(decimals)}${unit ? ` ${unit}` : ''}`,
    }));
  }

  const axis = h('div', { class: 'x-axis' },
    series.map((p) => h('div', { class: 'x-label', style: `left:${xPct(p)}%` },
      h('span', { class: 'x-wave', text: p.waveText }),
      h('span', { class: 'x-date', text: shortDate(p.date) }))));

  const root = h('div', {
    class: 'chart',
    role: 'img',
    'aria-label': `${title}. ${description}`,
  },
  unit ? h('p', { class: 'chart-unit', 'aria-hidden': 'true', text: unit }) : null,
  plot,
  axis);

  container.replaceChildren(root);
  return root;
}

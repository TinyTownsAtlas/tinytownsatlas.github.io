import { formatPercent } from "./format";
import type { MapLayer } from "./layers";
import { FALLBACK_COLOR, NEUTRAL_COLOR, POPULATION_LEGEND_VALUES, populationRadius } from "./layers";

/**
 * Renders the legend for exactly the layer the map is painting. Colours come from the MapLayer
 * object that also builds the map's paint expression (layers.ts), never from a separate table.
 */
export function renderLegend(root: HTMLElement, layer: MapLayer): void {
  root.replaceChildren();
  root.dataset.layer = layer.key;
  root.hidden = false;
  const population = document.createElement("div");
  population.className = "population-legend";
  const heading = document.createElement("div"); heading.className = "legend-title";
  heading.textContent = "Point size · usual residents";
  const samples = document.createElement("div"); samples.className = "population-samples";
  for (const value of POPULATION_LEGEND_VALUES) {
    const sample = document.createElement("div"); sample.className = "population-sample";
    const dot = document.createElement("span"); dot.className = "population-dot";
    dot.style.width = dot.style.height = `${2 * populationRadius(value)}px`;
    dot.style.background = NEUTRAL_COLOR;
    const label = document.createElement("span"); label.textContent = value.toLocaleString("en-AU");
    sample.append(dot, label); samples.appendChild(sample);
  }
  population.append(heading, samples); root.appendChild(population);
  if (layer.kind === "neutral") return;

  const title = document.createElement("div");
  title.className = "legend-title";
  title.textContent = layer.title;
  root.appendChild(title);

  if (layer.kind === "hospital") {
    const benchmark = document.createElement("div");
    benchmark.textContent = "Age-standardised ratio · Australia = 100";
    const swatch = document.createElement("div");
    swatch.className = "legend-gradient";
    swatch.style.background = `linear-gradient(to right, ${layer.colors.join(", ")})`;
    const labels = document.createElement("div");
    labels.className = "legend-gradient-labels";
    for (const text of ["≤50", "100", "≥200"]) {
      const label = document.createElement("span"); label.textContent = text; labels.appendChild(label);
    }
    const note = document.createElement("div");
    note.className = "legend-note";
    note.textContent = "PHA-derived broader-area estimates, assigned to town points. 150 ≈ 1.5 times the Australian rate; 75 ≈ three-quarters. Colours saturate at 50 and 200. Outlined peers share the supplied PHA, not a town boundary.";
    const missing = document.createElement("div");
    missing.className = "legend-row";
    const dot = document.createElement("span"); dot.className = "legend-swatch"; dot.style.background = FALLBACK_COLOR;
    missing.append(dot, "Missing / suppressed / uninterpretable");
    const credit = document.createElement("a");
    credit.href = "https://creativecommons.org/licenses/by-nc-sa/3.0/au/";
    credit.textContent = "PHIDU · CC BY-NC-SA 3.0 AU"; credit.target = "_blank"; credit.rel = "noopener";
    root.append(benchmark, swatch, labels, missing, note, credit);
    return;
  }

  if (layer.kind === "sequential") {
    const [lo, hi] = layer.domain;
    const precision = layer.indicator.precision;
    const swatch = document.createElement("div");
    swatch.className = "legend-gradient";
    swatch.style.background = `linear-gradient(to right, ${layer.colors[0]}, ${layer.colors[1]})`;
    root.appendChild(swatch);
    const labels = document.createElement("div");
    labels.className = "legend-gradient-labels";
    const loEl = document.createElement("span");
    loEl.textContent = formatPercent(lo, precision);
    const hiEl = document.createElement("span");
    hiEl.textContent = formatPercent(hi, precision);
    labels.append(loEl, hiEl);
    root.appendChild(labels);
    const note = document.createElement("div");
    note.className = "legend-note";
    note.textContent = "Census-reported; not age-standardised. Colour shows the town's value, not a rank.";
    root.appendChild(note);
    return;
  }

  for (const category of layer.categories) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.dataset.category = category.value;
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = category.color;
    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = category.label;
    const count = document.createElement("span");
    count.className = "legend-count";
    count.textContent = category.count.toLocaleString("en-AU");
    row.append(swatch, label, count);
    root.appendChild(row);
  }
  const note = document.createElement("div");
  note.className = "legend-note";
  note.textContent = "ABS remoteness describes geographic accessibility, not town population.";
  root.appendChild(note);
}

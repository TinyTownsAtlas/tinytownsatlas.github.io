import { formatPercent } from "./format";
import type { MapLayer } from "./layers";

/**
 * Renders the legend for exactly the layer the map is painting. Colours come from the MapLayer
 * object that also builds the map's paint expression (layers.ts), never from a separate table.
 */
export function renderLegend(root: HTMLElement, layer: MapLayer): void {
  root.replaceChildren();
  root.dataset.layer = layer.key;

  const title = document.createElement("div");
  title.className = "legend-title";
  title.textContent = layer.title;
  root.appendChild(title);

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
}

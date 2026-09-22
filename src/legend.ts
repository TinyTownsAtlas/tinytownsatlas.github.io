import type { AtlasData } from "./data";

const REMOTENESS_COLORS: Record<string, string> = {
  "Major Cities of Australia": "#4c78a8",
  "Inner Regional Australia": "#72b7b2",
  "Outer Regional Australia": "#eeca3b",
  "Remote Australia": "#f58518",
  "Very Remote Australia": "#e45756",
};

export function renderLegend(root: HTMLElement, data: AtlasData, layer: string): void {
  root.replaceChildren();

  if (layer === "diabetes_pct") {
    const [lo, hi] = data.indicators.diabetes_pct.domain;
    const swatch = document.createElement("div");
    swatch.className = "legend-gradient";
    swatch.style.background = "linear-gradient(to right, #fff5eb, #a63603)";
    root.appendChild(swatch);
    const labels = document.createElement("div");
    labels.className = "legend-gradient-labels";
    labels.innerHTML = `<span>${lo.toFixed(1)}%</span><span>${hi.toFixed(1)}%</span>`;
    root.appendChild(labels);
    return;
  }

  for (const [name, color] of Object.entries(REMOTENESS_COLORS)) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span>${name}</span>`;
    root.appendChild(row);
  }
}

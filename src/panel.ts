import type { AtlasData, Town } from "./data";
import { formatCount, formatPercent, formatPopulation } from "./format";
import { renderDistributionStrip } from "./charts";

export function renderTownPanel(root: HTMLElement, data: AtlasData, town: Town): void {
  root.replaceChildren();

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <h2>${escapeHtml(town.ucl_name)}</h2>
    <p class="panel-subheader">${escapeHtml(town.state_name)} · ${escapeHtml(town.remoteness_name)}</p>
    <p class="panel-population">Population ${formatPopulation(town.population)}</p>
  `;
  root.appendChild(header);

  const healthSection = document.createElement("section");
  healthSection.className = "panel-section";
  const diabetes = data.indicators.diabetes_pct;
  const diabetesValue = Number(town.diabetes_pct);
  const numerator = Number(town[diabetes.numeratorField]);
  const denominator = Number(town[diabetes.denominatorField]);
  healthSection.innerHTML = `
    <h3>${escapeHtml(diabetes.label)}</h3>
    <p class="indicator-headline">${formatPercent(diabetesValue, diabetes.precision)}
      <span class="indicator-denominator">(${formatCount(numerator)} of ${formatCount(denominator)} ${escapeHtml(diabetes.denominatorLabel)})</span>
    </p>
  `;
  root.appendChild(healthSection);

  const nationalGroup = data.towns;
  const remotenessGroup = data.towns.filter((t) => t.remoteness_name === town.remoteness_name);

  const nationalChartEl = document.createElement("div");
  nationalChartEl.className = "chart-strip";
  healthSection.appendChild(nationalChartEl);
  renderDistributionStrip(nationalChartEl, {
    group: nationalGroup,
    indicator: diabetes,
    stats: diabetes.nationalStats,
    selected: town,
    title: "All tiny towns nationally",
  });

  const remotenessChartEl = document.createElement("div");
  remotenessChartEl.className = "chart-strip";
  healthSection.appendChild(remotenessChartEl);
  renderDistributionStrip(remotenessChartEl, {
    group: remotenessGroup,
    indicator: diabetes,
    stats: diabetes.remotenessStats[town.remoteness_name],
    selected: town,
    title: `Same Remoteness Area (${town.remoteness_name})`,
  });

  const contextSection = document.createElement("section");
  contextSection.className = "panel-section";
  const contextHeading = document.createElement("h3");
  contextHeading.textContent = "People and context";
  contextSection.appendChild(contextHeading);

  const contextIndicators = Object.values(data.indicators).filter((i) => i.category === "context");
  for (const indicator of contextIndicators) {
    const value = Number(town[indicator.key]);
    const num = Number(town[indicator.numeratorField]);
    const den = Number(town[indicator.denominatorField]);
    const row = document.createElement("div");
    row.className = "context-row";
    row.innerHTML = `
      <div class="context-row-label">${escapeHtml(indicator.shortLabel)}</div>
      <div class="context-row-value">${formatPercent(value, indicator.precision)}
        <span class="indicator-denominator">(${formatCount(num)} of ${formatCount(den)} ${escapeHtml(indicator.denominatorLabel)})</span>
      </div>
    `;
    contextSection.appendChild(row);
  }
  root.appendChild(contextSection);

  const aboutDrawer = document.createElement("details");
  aboutDrawer.className = "about-drawer";
  const summary = document.createElement("summary");
  summary.textContent = "About these data · interpretation notes";
  aboutDrawer.appendChild(summary);

  const aboutBody = document.createElement("div");
  aboutBody.className = "about-body";
  const allCaveats = Array.from(
    new Set(Object.values(data.indicators).flatMap((i) => i.caveats)),
  );
  aboutBody.innerHTML = `
    <ul>${allCaveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    <p>${escapeHtml(data.manifest.scopeDefinition)}</p>
    <p>Sources: ${data.manifest.sources.map((s) => escapeHtml(`${s.name} (${s.license})`)).join("; ")}.</p>
  `;
  aboutDrawer.appendChild(aboutBody);
  root.appendChild(aboutDrawer);
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

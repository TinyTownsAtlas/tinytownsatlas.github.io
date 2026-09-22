import * as Plot from "@observablehq/plot";
import type { Indicator, IndicatorStats, Town } from "./data";

/**
 * Renders a horizontal distribution strip: every town in `group` as a small dot on a continuous
 * axis, the group's median/IQR as a band, and the selected town highlighted with its own marker
 * and label. No ranking, no ordinal position, no "town N of M" text — hovering a dot shows its
 * name and value, nothing about its position relative to others.
 */
export function renderDistributionStrip(
  container: HTMLElement,
  opts: {
    group: Town[];
    indicator: Indicator;
    stats: IndicatorStats;
    selected: Town;
    title: string;
  },
): void {
  const { group, indicator, stats, selected, title } = opts;
  const key = indicator.key;

  container.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "strip-title";
  heading.textContent = `${title} (n=${stats.n})`;
  container.appendChild(heading);

  const values = group.map((t) => Number(t[key]));
  const domainMax = Math.max(indicator.domain[1], ...values) * 1.05;

  const plot = Plot.plot({
    width: container.clientWidth || 320,
    height: 90,
    marginLeft: 8,
    marginRight: 8,
    marginTop: 6,
    marginBottom: 24,
    x: {
      domain: [0, domainMax || 1],
      label: `${indicator.shortLabel} (%)`,
    },
    y: { axis: null },
    marks: [
      Plot.ruleX([stats.q1, stats.q3], { stroke: "var(--strip-iqr)", strokeWidth: 10, strokeOpacity: 0.35 }),
      Plot.ruleX([stats.median], { stroke: "var(--strip-median)", strokeWidth: 2 }),
      Plot.dot(group, {
        x: (d: Town) => Number(d[key]),
        y: () => 0.15,
        r: 2.5,
        fill: "var(--strip-dot)",
        fillOpacity: 0.5,
        title: (d: Town) => `${d.ucl_name}: ${Number(d[key]).toFixed(indicator.precision)}%`,
      }),
      Plot.dot([selected], {
        x: (d: Town) => Number(d[key]),
        y: () => 0.15,
        r: 6,
        fill: "var(--strip-selected)",
        stroke: "white",
        strokeWidth: 1.5,
        title: (d: Town) => `${d.ucl_name} (selected): ${Number(d[key]).toFixed(indicator.precision)}%`,
      }),
    ],
  });

  container.appendChild(plot);

  const caption = document.createElement("div");
  caption.className = "strip-caption";
  caption.textContent = `Median ${stats.median.toFixed(indicator.precision)}% · IQR ${stats.q1.toFixed(
    indicator.precision,
  )}–${stats.q3.toFixed(indicator.precision)}%`;
  container.appendChild(caption);
}

import {
  communityBadgeText,
  contextIndicators,
  healthIndicators,
  type AtlasData,
  type Indicator,
  type Town,
} from "./data";
import { describeStandardisedRatio, formatCount, formatPercent, formatPopulation } from "./format";
import { renderDistributionStrip } from "./charts";
import { HOSPITAL_KEYS, sharedHospitalTowns } from "./layers";

export interface PanelOptions {
  /** Health indicator key to show in the Health section. */
  outcome: string;
  layer: string;
  onOutcomeChange: (key: string) => void;
}

export function renderTownPanel(root: HTMLElement, data: AtlasData, town: Town, opts: PanelOptions): void {
  root.replaceChildren();
  root.appendChild(renderHeader(data, town));

  const outcomes = healthIndicators(data);
  const selected = outcomes.find((i) => i.key === opts.outcome) ?? outcomes[0];
  const hospitalActive = (HOSPITAL_KEYS as readonly string[]).includes(opts.layer);
  if (hospitalActive) root.appendChild(renderHospitalSection(data, town, opts.layer));
  root.appendChild(renderHealthSection(data, town, outcomes, selected, opts.onOutcomeChange));
  root.appendChild(renderContextSection(data, town));
  if (!hospitalActive) root.appendChild(renderHospitalSection(data, town));
  root.appendChild(renderAboutDrawer(data));
}

function renderHeader(data: AtlasData, town: Town): HTMLElement {
  const header = document.createElement("div");
  header.className = "panel-header";
  const tagged = data.ten4ten.uclCodes.has(town.ucl_code);
  const community = data.ten4ten.communityLabels.get(town.ucl_code);
  header.innerHTML = `
    ${tagged ? `<span class="community-badge">${escapeHtml(communityBadgeText(data.ten4ten, town.ucl_code))}</span>` : ""}
    <h2>${escapeHtml(town.ucl_name)}</h2>
    <p class="panel-subheader">${escapeHtml(town.state_name)} · ${escapeHtml(town.remoteness_name)}</p>
    <p class="panel-population">Population ${formatPopulation(town.population)} usual residents</p>
    <p class="panel-geo-note">Figures are for the 2021 ABS Urban Centre/Locality (town) boundary${
      community
        ? `: the ${escapeHtml(town.ucl_name)} locality only, not the whole of ${escapeHtml(community)}`
        : ", which can differ from the surrounding Local Government Area or suburb of the same name"
    }.</p>
  `;
  return header;
}

function renderHealthSection(
  data: AtlasData,
  town: Town,
  outcomes: Indicator[],
  selected: Indicator,
  onOutcomeChange: (key: string) => void,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "panel-section health-section";
  section.setAttribute("aria-labelledby", "health-heading");

  const headingRow = document.createElement("div");
  headingRow.className = "section-heading-row";
  headingRow.innerHTML = `<h3 id="health-heading">Health</h3><span class="section-source">2021 Census</span>`;
  section.appendChild(headingRow);

  // Native select stays usable with ten conditions on small screens.
  const selector = document.createElement("select");
  selector.id = "health-outcome";
  selector.className = "health-outcome";
  selector.setAttribute("aria-label", "Health outcome");
  for (const indicator of outcomes) {
    const option = document.createElement("option");
    option.value = indicator.key; option.textContent = indicator.shortLabel;
    selector.appendChild(option);
  }
  selector.value = selected.key;
  selector.addEventListener("change", () => {
    onOutcomeChange(selector.value);
    document.getElementById("health-outcome")?.focus();
  });
  section.appendChild(selector);
  const panel = document.createElement("div");
  panel.id = "outcome-panel";
  panel.className = "outcome-panel";

  const value = Number(town[selected.key]);
  const numerator = Number(town[selected.numeratorField]);
  const denominator = Number(town[selected.denominatorField]);
  panel.innerHTML = `
    <h4 class="outcome-label">${escapeHtml(selected.label)}</h4>
    <p class="indicator-headline">${formatPercent(value, selected.precision)}
      <span class="indicator-denominator">${formatCount(numerator)} of ${formatCount(denominator)} ${escapeHtml(selected.denominatorLabel)}</span>
    </p>
    <p class="indicator-definition">${escapeHtml(selected.definition)}</p>
  `;

  const nationalChartEl = document.createElement("div");
  nationalChartEl.className = "chart-strip";
  panel.appendChild(nationalChartEl);
  const remotenessChartEl = document.createElement("div");
  remotenessChartEl.className = "chart-strip";
  panel.appendChild(remotenessChartEl);

  const caveats = document.createElement("ul");
  caveats.className = "indicator-caveats";
  caveats.setAttribute("aria-label", "Interpretation notes");
  for (const caveat of selected.caveats) {
    const li = document.createElement("li");
    li.textContent = caveat;
    caveats.appendChild(li);
  }
  panel.appendChild(caveats);
  section.appendChild(panel);

  // Plot needs the container's laid-out width, so draw after the section is in the document.
  queueMicrotask(() => {
    renderDistributionStrip(nationalChartEl, {
      group: data.towns,
      indicator: selected,
      stats: selected.nationalStats,
      selected: town,
      title: "All tiny towns nationally",
    });
    renderDistributionStrip(remotenessChartEl, {
      group: data.towns.filter((t) => t.remoteness_name === town.remoteness_name),
      indicator: selected,
      stats: selected.remotenessStats[town.remoteness_name],
      selected: town,
      title: `Same Remoteness Area (${town.remoteness_name})`,
    });
  });

  return section;
}

function renderContextSection(data: AtlasData, town: Town): HTMLElement {
  const section = document.createElement("section");
  section.className = "panel-section";
  const heading = document.createElement("h3");
  heading.textContent = "People and context";
  section.appendChild(heading);

  for (const indicator of contextIndicators(data)) {
    const value = Number(town[indicator.key]);
    const num = Number(town[indicator.numeratorField]);
    const den = Number(town[indicator.denominatorField]);
    const row = document.createElement("div");
    row.className = "context-row";
    row.dataset.indicator = indicator.key;
    row.innerHTML = `
      <div class="context-row-label">${escapeHtml(indicator.shortLabel)}</div>
      <div class="context-row-value">${formatPercent(value, indicator.precision)}
        <span class="indicator-denominator">${formatCount(num)} of ${formatCount(den)} ${escapeHtml(indicator.denominatorLabel)}</span>
      </div>
    `;
    section.appendChild(row);
  }
  return section;
}

/**
 * PHIDU hospital estimates for the wider Population Health Area. Shown as area context with the
 * geography stated first; no town distributions or allocated counts.
 */
function renderHospitalSection(data: AtlasData, town: Town, activeKey?: string): HTMLElement {
  const hospital = data.hospital;
  const entry = hospital.towns[town.ucl_code];
  const section = document.createElement("section");
  section.className = "panel-section hospital-section";
  section.setAttribute("aria-labelledby", "hospital-heading");

  const measureKey = activeKey ?? "public_admissions";
  const peers = sharedHospitalTowns(data, town.ucl_code, measureKey);
  const sharing = entry.phaCode && entry.values[measureKey]?.status === "available"
    ? ` ${peers.length} other Atlas ${peers.length === 1 ? "town shares" : "towns share"} this published measure and supplied PHA.${activeKey && peers.length ? " Their points are outlined on the map; the outlines do not mark an area boundary." : ""}`
    : "";
  const areaNote = entry.phaName
    ? `Not measured for ${escapeHtml(town.ucl_name)}. These are PHIDU estimates for the
       <strong>${escapeHtml(entry.phaName)}</strong> Population Health Area, assigned to towns in
       proportion to population.${sharing}`
    : `Not measured for ${escapeHtml(town.ucl_name)}. PHIDU produced these estimates from
       Population Health Area data but did not identify the area for this town, so its name and
       boundary are not shown.${sharing}`;
  const values = Object.values(entry.values);
  const commonMissing = values.every((v) => v.status !== "available" && v.status === values[0].status)
    ? hospital.statusText[values[0].status as keyof typeof hospital.statusText] : null;

  const rows = Object.entries(hospital.indicators)
    .sort(([a], [b]) => Number(b === activeKey) - Number(a === activeKey))
    .map(([key, meta]) => {
      const value = entry.values[key];
      const valueHtml =
        value.status === "available" && value.sr !== null
          ? `<span class="hospital-sr">${Math.round(value.sr)}</span>
             <span class="hospital-benchmark">Australia = 100</span>
             <span class="indicator-denominator">${escapeHtml(describeStandardisedRatio(value.sr))}</span>`
          : `<span class="hospital-missing">${escapeHtml(commonMissing ? "No published interpretable ratio" : hospital.statusText[value.status as keyof typeof hospital.statusText])}</span>`;
      return `
        <div class="hospital-row" data-hospital="${escapeHtml(key)}">
          <div class="hospital-row-label">${escapeHtml(meta.label)}<span class="hospital-period">${escapeHtml(meta.period)}</span></div>
          <div class="hospital-row-value">${valueHtml}</div>
        </div>
        <p class="indicator-definition">${escapeHtml(meta.definition)}</p>`;
    })
    .join("");

  section.innerHTML = `
    <div class="section-heading-row">
      <h3 id="hospital-heading">${activeKey ? "Broader-area health service estimate" : "Hospital services: broader-area context"}</h3>
    </div>
    <p class="hospital-area-note">${areaNote}</p>
    ${commonMissing ? `<p class="indicator-definition">${escapeHtml(commonMissing)}</p>` : ""}
    ${rows}
    <details class="hospital-notes"><summary>Measure notes and interpretation</summary>
    <ul class="indicator-caveats" aria-label="Interpretation notes">${hospital.caveats
      .map((c) => `<li>${escapeHtml(c)}</li>`)
      .join("")}</ul>
    <p class="hospital-licence">Source: ${escapeHtml(hospital.licence.attribution)}. Hospital data from
      the Australian Institute of Health and Welfare on behalf of state and territory health
      departments. This extract is licensed
      <a href="${escapeHtml(hospital.licence.url)}" target="_blank" rel="noopener">${escapeHtml(hospital.licence.name)}</a>.</p></details>
  `;
  return section;
}

function renderAboutDrawer(data: AtlasData): HTMLElement {
  const drawer = document.createElement("details");
  drawer.className = "about-drawer";
  const summary = document.createElement("summary");
  summary.textContent = "About these data · definitions and interpretation notes";
  drawer.appendChild(summary);

  const body = document.createElement("div");
  body.className = "about-body";
  const entries = Object.values(data.indicators)
    .map(
      (i) => `
      <dt>${escapeHtml(i.label)}</dt>
      <dd>
        <p>${escapeHtml(i.definition)}</p>
        <ul>${i.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      </dd>`,
    )
    .join("");
  body.innerHTML = `
    <p>Comparisons show where a town sits among other tiny towns (median and interquartile range).
      They are not rankings, scores or targets.</p>
    <p>All figures are for 2021 ABS Urban Centres and Localities (town boundaries). Census
      QuickStats or other sources for the Local Government Area, suburb or island of the same name
      describe a different area and will differ.</p>
    <dl class="about-indicators">${entries}</dl>
    <p>Hospital services context: ${escapeHtml(data.hospital.licence.notice)}
      <a href="${escapeHtml(data.hospital.licence.attributionPolicyUrl)}" target="_blank" rel="noopener">PHIDU licensing and attribution</a>.</p>
    <p>${escapeHtml(data.manifest.scopeDefinition)}</p>
    <p>Sources: ${data.manifest.sources.map((s) => escapeHtml(`${s.name} (${s.license})`)).join("; ")}.</p>
  `;
  drawer.appendChild(body);
  return drawer;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

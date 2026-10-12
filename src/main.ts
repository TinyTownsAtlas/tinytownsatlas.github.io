import { healthIndicators, loadAtlasData } from "./data";
import { buildSearchIndex, search } from "./search";
import { DEFAULT_OUTCOME, StateStore, readStateFromUrl, writeStateToUrl, type AppState } from "./state";
import { createMap } from "./map";
import { renderTownPanel } from "./panel";
import { renderLegend } from "./legend";
import { getMapLayers, resolveLayer } from "./layers";

async function main(): Promise<void> {
  const data = await loadAtlasData();
  const searchIndex = buildSearchIndex(data.towns, data.ten4ten.uclCodes, data.ten4ten.communityLabels);
  const mapLayers = getMapLayers(data);
  const healthKeys = new Set(healthIndicators(data).map((i) => i.key));
  const defaultOutcome = healthKeys.has(DEFAULT_OUTCOME) ? DEFAULT_OUTCOME : [...healthKeys][0];

  // Unknown or non-map values from the URL (e.g. ?layer=indigenous_pct) fall back to defaults.
  const normalize = (s: AppState): AppState => ({
    selectedUclCode: s.selectedUclCode && data.townsByCode.has(s.selectedUclCode) ? s.selectedUclCode : null,
    layer: resolveLayer(mapLayers, s.layer).key,
    outcome: healthKeys.has(s.outcome) ? s.outcome : defaultOutcome,
  });
  const store = new StateStore(readStateFromUrl(), normalize);
  writeStateToUrl(store.get(), false); // drop invalid params from the address bar

  const panelEl = document.getElementById("panel") as HTMLElement;
  const panelContentEl = document.getElementById("panel-content") as HTMLElement;
  const panelCloseEl = document.getElementById("panel-close") as HTMLElement;
  const panelHandleEl = document.getElementById("panel-handle") as HTMLElement;
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const searchResultsEl = document.getElementById("search-results") as HTMLElement;
  const layerSelect = document.getElementById("layer-select") as HTMLSelectElement;
  const legendEl = document.getElementById("legend") as HTMLElement;
  const mapContainer = document.getElementById("map") as HTMLElement;

  layerSelect.replaceChildren(
    ...mapLayers.map((layer) => {
      const option = document.createElement("option");
      option.value = layer.key;
      option.textContent = layer.optionLabel;
      return option;
    }),
  );

  const initialLayer = resolveLayer(mapLayers, store.get().layer);
  const atlasMap = createMap(mapContainer, data, initialLayer, (uclCode) => {
    store.selectTown(uclCode);
  });

  // Development-only handle for browser smoke tests (removed from production builds).
  if (import.meta.env.DEV) (window as unknown as { __atlas: unknown }).__atlas = { map: atlasMap.map, store };

  // The selector, the map paint and the legend are always updated together from one MapLayer.
  function applyLayer(key: string): void {
    const layer = resolveLayer(mapLayers, key);
    if (layerSelect.value !== layer.key) layerSelect.value = layer.key;
    atlasMap.setLayer(layer);
    renderLegend(legendEl, layer);
  }

  function showPanel(state: AppState): void {
    const town = state.selectedUclCode ? data.townsByCode.get(state.selectedUclCode) : undefined;
    if (!town) {
      panelEl.hidden = true;
      document.body.classList.remove("panel-open", "panel-expanded");
      atlasMap.setSelected(null);
      return;
    }
    renderTownPanel(panelContentEl, data, town, {
      outcome: state.outcome,
      onOutcomeChange: (key) => store.setOutcome(key),
    });
    panelEl.hidden = false;
    document.body.classList.add("panel-open");
    atlasMap.setSelected(town.ucl_code);
  }

  applyLayer(initialLayer.key);

  let shownTown: string | null = null;
  store.subscribe((state) => {
    applyLayer(state.layer);
    showPanel(state);
    // Fly only when the selected town changes, not on every layer/outcome change.
    if (state.selectedUclCode && state.selectedUclCode !== shownTown) {
      const town = data.townsByCode.get(state.selectedUclCode)!;
      atlasMap.flyToTown(town.lon, town.lat);
    }
    shownTown = state.selectedUclCode;
  });

  panelCloseEl.addEventListener("click", () => store.selectTown(null, { pushHistory: false }));

  // Mobile bottom-sheet: tap the handle to toggle peek/expanded.
  panelHandleEl.addEventListener("click", () => {
    document.body.classList.toggle("panel-expanded");
  });

  layerSelect.addEventListener("change", () => {
    store.setLayer(layerSelect.value, { healthKeys });
  });

  let activeResultIndex = -1;
  function renderResults(query: string): void {
    const results = search(searchIndex, query);
    searchResultsEl.replaceChildren();
    activeResultIndex = -1;
    if (results.length === 0) {
      searchResultsEl.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
      return;
    }
    for (const town of results) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.textContent = `${town.ucl_name}, ${town.state_name}`;
      if (data.ten4ten.uclCodes.has(town.ucl_code)) {
        const badge = document.createElement("span");
        badge.className = "community-badge";
        badge.textContent = "Ten4Ten";
        li.append(" ", badge);
      }
      li.addEventListener("click", () => {
        store.selectTown(town.ucl_code);
        searchInput.value = town.ucl_name;
        searchResultsEl.hidden = true;
        searchInput.setAttribute("aria-expanded", "false");
      });
      searchResultsEl.appendChild(li);
    }
    searchResultsEl.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  searchInput.addEventListener("input", () => renderResults(searchInput.value));
  searchInput.addEventListener("focus", () => {
    if (searchInput.value) renderResults(searchInput.value);
  });
  searchInput.addEventListener("keydown", (e) => {
    const items = Array.from(searchResultsEl.children) as HTMLElement[];
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeResultIndex = Math.min(activeResultIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeResultIndex = Math.max(activeResultIndex - 1, 0);
    } else if (e.key === "Enter") {
      items[Math.max(activeResultIndex, 0)].click();
      return;
    } else if (e.key === "Escape") {
      searchResultsEl.hidden = true;
      return;
    } else {
      return;
    }
    items.forEach((el, i) => el.classList.toggle("active", i === activeResultIndex));
  });
  document.addEventListener("click", (e) => {
    if (!searchResultsEl.contains(e.target as Node) && e.target !== searchInput) {
      searchResultsEl.hidden = true;
    }
  });

  const initial = store.get();
  if (initial.selectedUclCode) {
    const town = data.townsByCode.get(initial.selectedUclCode)!;
    showPanel(initial);
    shownTown = town.ucl_code;
    atlasMap.map.once("load", () => {
      atlasMap.map.jumpTo({ center: [town.lon, town.lat], zoom: 8 });
      atlasMap.setSelected(town.ucl_code);
    });
  }
}

main().catch((err) => {
  console.error(err);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<p style="padding:2rem;font-family:sans-serif;">Failed to load the atlas. ${
      err instanceof Error ? err.message : String(err)
    }</p>`;
  }
});

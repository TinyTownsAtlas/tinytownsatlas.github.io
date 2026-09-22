import { loadAtlasData } from "./data";
import { buildSearchIndex, search } from "./search";
import { StateStore, readStateFromUrl } from "./state";
import { createMap } from "./map";
import { renderTownPanel } from "./panel";
import { renderLegend } from "./legend";

async function main(): Promise<void> {
  const data = await loadAtlasData();
  const searchIndex = buildSearchIndex(data.towns);
  const store = new StateStore(readStateFromUrl());

  const panelEl = document.getElementById("panel") as HTMLElement;
  const panelContentEl = document.getElementById("panel-content") as HTMLElement;
  const panelCloseEl = document.getElementById("panel-close") as HTMLElement;
  const panelHandleEl = document.getElementById("panel-handle") as HTMLElement;
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const searchResultsEl = document.getElementById("search-results") as HTMLElement;
  const layerSelect = document.getElementById("layer-select") as HTMLSelectElement;
  const legendEl = document.getElementById("legend") as HTMLElement;
  const mapContainer = document.getElementById("map") as HTMLElement;

  layerSelect.value = store.get().layer;
  renderLegend(legendEl, data, store.get().layer);

  const atlasMap = createMap(mapContainer, data, (uclCode) => {
    store.selectTown(uclCode);
  });

  function openTown(uclCode: string, flyTo: boolean): void {
    const town = data.townsByCode.get(uclCode);
    if (!town) return;
    renderTownPanel(panelContentEl, data, town);
    panelEl.hidden = false;
    document.body.classList.add("panel-open");
    atlasMap.setSelected(uclCode);
    if (flyTo) atlasMap.flyToTown(town.lon, town.lat);
  }

  function closeTown(): void {
    panelEl.hidden = true;
    document.body.classList.remove("panel-open");
    atlasMap.setSelected(null);
    store.selectTown(null, { pushHistory: false });
  }

  store.subscribe((state) => {
    if (state.selectedUclCode) {
      openTown(state.selectedUclCode, true);
    } else {
      panelEl.hidden = true;
      document.body.classList.remove("panel-open");
      atlasMap.setSelected(null);
    }
    if (state.layer !== layerSelect.value) layerSelect.value = state.layer;
    atlasMap.setLayer(state.layer);
    renderLegend(legendEl, data, state.layer);
  });

  panelCloseEl.addEventListener("click", closeTown);

  // Mobile bottom-sheet: tap the handle to toggle peek/expanded.
  panelHandleEl.addEventListener("click", () => {
    document.body.classList.toggle("panel-expanded");
  });

  layerSelect.addEventListener("change", () => {
    store.setLayer(layerSelect.value);
  });

  let activeResultIndex = -1;
  function renderResults(query: string): void {
    const results = search(searchIndex, query);
    searchResultsEl.replaceChildren();
    activeResultIndex = -1;
    if (results.length === 0) {
      searchResultsEl.hidden = true;
      return;
    }
    for (const town of results) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.textContent = `${town.ucl_name}, ${town.state_name}`;
      li.addEventListener("click", () => {
        store.selectTown(town.ucl_code);
        searchInput.value = town.ucl_name;
        searchResultsEl.hidden = true;
      });
      searchResultsEl.appendChild(li);
    }
    searchResultsEl.hidden = false;
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
      if (activeResultIndex >= 0) items[activeResultIndex].click();
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
    const town = data.townsByCode.get(initial.selectedUclCode);
    if (town) {
      renderTownPanel(panelContentEl, data, town);
      panelEl.hidden = false;
      document.body.classList.add("panel-open");
      atlasMap.map.once("load", () => {
        atlasMap.map.jumpTo({ center: [town.lon, town.lat], zoom: 8 });
        atlasMap.setSelected(town.ucl_code);
      });
    }
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

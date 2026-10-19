import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AtlasData } from "./data";
import { colorExpression, getMapLayers, hospitalMapValues, populationRadiusExpression, sharedHospitalTowns, type MapLayer } from "./layers";

// Dot styling shared with the legend swatches (see legend.ts), so the legend shows the colour as
// it is drawn on the map.
export const DOT_STYLE = { strokeWidth: 1, strokeColor: "#ffffff", opacity: 0.85 };

// Free, keyless OpenStreetMap standard raster tiles (no API key, no paid service).
const BASEMAP_TILES = [
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
];

export interface AtlasMap {
  map: maplibregl.Map;
  setLayer(layer: MapLayer): void;
  flyToTown(lon: number, lat: number): void;
  setSelected(uclCode: string | null): void;
}

export function createMap(
  container: HTMLElement,
  data: AtlasData,
  initialLayer: MapLayer,
  onSelect: (uclCode: string) => void,
  onBlankClick: () => void = () => {},
): AtlasMap {
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: BASEMAP_TILES,
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }],
    },
    center: [134.0, -25.5],
    zoom: 3.4,
    minZoom: 2,
    maxZoom: 12,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  // The map container's real size can settle after MapLibre's initial layout pass (flex/grid
  // layouts, or a container that starts hidden/zero-size), which otherwise leaves the map's
  // internal transform out of sync with its canvas and produces an incorrect center/zoom on
  // first paint. Keep it in sync for the container's lifetime.
  const resizeObserver = new ResizeObserver(() => map.resize());
  resizeObserver.observe(container);

  const primaryCodes = new Set(data.towns.map((t) => t.ucl_code));
  const townByCode = data.townsByCode;

  const layerKeys = getMapLayers(data).map((l) => l.key);
  const primaryFeatures = data.pointsGeoJSON.features.filter((f) =>
    primaryCodes.has((f.properties as { ucl_code: string }).ucl_code),
  );
  const primaryGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: primaryFeatures.map((f) => {
      const code = (f.properties as { ucl_code: string }).ucl_code;
      const town = townByCode.get(code)!;
      return {
        ...f,
        properties: {
          ...f.properties,
          population: town.population,
          ...Object.fromEntries(layerKeys.map((k) => [k, town[k]])),
          ...hospitalMapValues(data, code),
        },
      };
    }),
  };

  // Start from the app's current layer (URL/deep link), not a fixed default, so the dots and the
  // legend always describe the same layer.
  let currentLayer: MapLayer = initialLayer;
  let selectedCode: string | null = null;

  function paint(layer: MapLayer): maplibregl.ExpressionSpecification {
    return colorExpression(layer) as unknown as maplibregl.ExpressionSpecification;
  }

  map.on("load", () => {
    map.resize();
    if (!selectedCode && container.clientWidth <= 700) {
      map.fitBounds([[112, -44], [154, -10]], {
        padding: {top: 110, bottom: 100, left: 16, right: 16}, duration: 0,
      });
    }
    map.addSource("towns", { type: "geojson", data: primaryGeoJSON });

    map.addLayer({
      id: "towns-circle",
      type: "circle",
      source: "towns",
      paint: {
        "circle-radius": populationRadiusExpression() as maplibregl.ExpressionSpecification,
        "circle-color": paint(currentLayer),
        "circle-stroke-width": DOT_STYLE.strokeWidth,
        "circle-stroke-color": DOT_STYLE.strokeColor,
        "circle-opacity": DOT_STYLE.opacity,
      },
    });

    map.addLayer({
      id: "towns-shared-pha", type: "circle", source: "towns",
      filter: ["==", ["get", "ucl_code"], "__none__"],
      paint: {"circle-radius": ["+", populationRadiusExpression(), 2] as maplibregl.ExpressionSpecification, "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 1.5, "circle-stroke-color": "#465765"},
    });
    map.addLayer({
      id: "towns-selected",
      type: "circle",
      source: "towns",
      filter: ["==", ["get", "ucl_code"], "__none__"],
      paint: {
        "circle-radius": ["+", populationRadiusExpression(), 3] as maplibregl.ExpressionSpecification,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#111111",
      },
    });
    setSelected(selectedCode);

    // Transparent hit targets keep 100-resident settlements clickable without inflating their area.
    map.addLayer({id: "towns-hit", type: "circle", source: "towns", paint: {
      "circle-radius": ["max", 7, populationRadiusExpression()] as maplibregl.ExpressionSpecification,
      "circle-color": "rgba(0,0,0,0)",
    }});

    map.on("click", "towns-hit", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const code = (feature.properties as { ucl_code: string }).ucl_code;
      onSelect(code);
    });

    // A tap that lands on no town (the layer handler above handles town hits).
    map.on("click", (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ["towns-hit"] }).length === 0) onBlankClick();
    });

    map.on("mouseenter", "towns-hit", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "towns-hit", () => {
      map.getCanvas().style.cursor = "";
    });

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    map.on("mousemove", "towns-hit", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      // Name and Remoteness Area only: no indicator values on hover (see ARCHITECTURE.md).
      const props = feature.properties as { ucl_name: string; remoteness_name: string };
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${escapeHtml(props.ucl_name)}</strong><br/>${escapeHtml(props.remoteness_name)}`)
        .addTo(map);
    });
    map.on("mouseleave", "towns-hit", () => popup.remove());
  });

  function setLayer(layer: MapLayer): void {
    currentLayer = layer;
    if (!map.getLayer("towns-circle")) return;
    map.setPaintProperty("towns-circle", "circle-color", paint(layer));
    setSelected(selectedCode);
  }

  function flyToTown(lon: number, lat: number): void {
    map.flyTo({ center: [lon, lat], zoom: 8, essential: true });
  }

  function setSelected(uclCode: string | null): void {
    selectedCode = uclCode;
    if (!map.getLayer("towns-selected")) return;
    map.setFilter("towns-selected", ["==", ["get", "ucl_code"], selectedCode ?? "__none__"]);
    const shared = currentLayer.kind === "hospital" ? sharedHospitalTowns(data, selectedCode, currentLayer.key) : [];
    map.setFilter("towns-shared-pha", ["in", ["get", "ucl_code"], ["literal", shared]]);
  }

  return { map, setLayer, flyToTown, setSelected };
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

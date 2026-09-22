import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AtlasData } from "./data";

const REMOTENESS_COLORS: Record<string, string> = {
  "Major Cities of Australia": "#4c78a8",
  "Inner Regional Australia": "#72b7b2",
  "Outer Regional Australia": "#eeca3b",
  "Remote Australia": "#f58518",
  "Very Remote Australia": "#e45756",
};

// Free, keyless OpenStreetMap standard raster tiles (no API key, no paid service).
const BASEMAP_TILES = [
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
];

export interface AtlasMap {
  map: maplibregl.Map;
  setLayer(layer: string): void;
  flyToTown(lon: number, lat: number): void;
  setSelected(uclCode: string | null): void;
}

export function createMap(
  container: HTMLElement,
  data: AtlasData,
  onSelect: (uclCode: string) => void,
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
    minZoom: 3,
    maxZoom: 12,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  const primaryCodes = new Set(data.towns.map((t) => t.ucl_code));
  const townByCode = data.townsByCode;

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
          remoteness_name: town.remoteness_name,
          diabetes_pct: town.diabetes_pct,
        },
      };
    }),
  };

  let currentLayer = data.manifest.defaultMapLayer;
  let selectedCode: string | null = null;

  function remotenessColorExpression(): maplibregl.ExpressionSpecification {
    const stops: (string | string)[] = [];
    for (const [name, color] of Object.entries(REMOTENESS_COLORS)) {
      stops.push(name, color);
    }
    return ["match", ["get", "remoteness_name"], ...stops, "#999999"] as unknown as maplibregl.ExpressionSpecification;
  }

  function diabetesColorExpression(): maplibregl.ExpressionSpecification {
    const domain = data.indicators.diabetes_pct.domain;
    return [
      "interpolate",
      ["linear"],
      ["get", "diabetes_pct"],
      domain[0],
      "#fff5eb",
      domain[1],
      "#a63603",
    ] as unknown as maplibregl.ExpressionSpecification;
  }

  function paintForLayer(layer: string): maplibregl.ExpressionSpecification {
    return layer === "diabetes_pct" ? diabetesColorExpression() : remotenessColorExpression();
  }

  map.on("load", () => {
    map.addSource("towns", { type: "geojson", data: primaryGeoJSON });

    map.addLayer({
      id: "towns-circle",
      type: "circle",
      source: "towns",
      paint: {
        "circle-radius": 4,
        "circle-color": paintForLayer(currentLayer),
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.85,
      },
    });

    map.addLayer({
      id: "towns-selected",
      type: "circle",
      source: "towns",
      filter: ["==", ["get", "ucl_code"], "__none__"],
      paint: {
        "circle-radius": 8,
        "circle-color": paintForLayer(currentLayer),
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#111111",
      },
    });

    map.on("click", "towns-circle", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const code = (feature.properties as { ucl_code: string }).ucl_code;
      onSelect(code);
    });

    map.on("mouseenter", "towns-circle", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "towns-circle", () => {
      map.getCanvas().style.cursor = "";
    });

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    map.on("mousemove", "towns-circle", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties as { ucl_name: string; remoteness_name: string };
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${escapeHtml(props.ucl_name)}</strong><br/>${escapeHtml(props.remoteness_name)}`)
        .addTo(map);
    });
    map.on("mouseleave", "towns-circle", () => popup.remove());
  });

  function setLayer(layer: string): void {
    currentLayer = layer;
    if (!map.getLayer("towns-circle")) return;
    map.setPaintProperty("towns-circle", "circle-color", paintForLayer(layer));
    map.setPaintProperty("towns-selected", "circle-color", paintForLayer(layer));
  }

  function flyToTown(lon: number, lat: number): void {
    map.flyTo({ center: [lon, lat], zoom: 8, essential: true });
  }

  function setSelected(uclCode: string | null): void {
    selectedCode = uclCode;
    if (!map.getLayer("towns-selected")) return;
    map.setFilter("towns-selected", ["==", ["get", "ucl_code"], selectedCode ?? "__none__"]);
  }

  return { map, setLayer, flyToTown, setSelected };
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

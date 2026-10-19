export interface AppState {
  selectedUclCode: string | null;
  /** Map colour layer key (All towns, Census condition, hospital SR or remoteness). */
  layer: string;
  /** Health outcome shown in the town panel (a health indicator key). */
  outcome: string;
}

export const DEFAULT_LAYER = "all_towns";
export const DEFAULT_OUTCOME = "diabetes_pct";

/** Parse URL search params. Unknown values are resolved against the loaded data by the caller. */
export function parseState(search: string): AppState {
  const params = new URLSearchParams(search);
  return {
    selectedUclCode: params.get("town"),
    layer: params.get("layer") ?? DEFAULT_LAYER,
    outcome: params.get("outcome") ?? DEFAULT_OUTCOME,
  };
}

export function stateToSearch(state: AppState): string {
  const params = new URLSearchParams();
  if (state.selectedUclCode) params.set("town", state.selectedUclCode);
  if (state.layer !== DEFAULT_LAYER) params.set("layer", state.layer);
  if (state.outcome !== DEFAULT_OUTCOME) params.set("outcome", state.outcome);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function readStateFromUrl(): AppState {
  return parseState(window.location.search);
}

export function writeStateToUrl(state: AppState, push: boolean): void {
  const url = `${window.location.pathname}${stateToSearch(state)}`;
  if (push) {
    window.history.pushState(state, "", url);
  } else {
    window.history.replaceState(state, "", url);
  }
}

type Listener = (state: AppState) => void;
/** Maps raw (URL) state to valid state, e.g. replacing an unknown layer with the default. */
type Normalizer = (state: AppState) => AppState;

export class StateStore {
  private state: AppState;
  private listeners: Listener[] = [];

  constructor(initial: AppState, private normalize: Normalizer = (s) => s) {
    this.state = normalize(initial);
    window.addEventListener("popstate", () => {
      this.state = this.normalize(readStateFromUrl());
      this.notify();
    });
  }

  get(): AppState {
    return this.state;
  }

  selectTown(uclCode: string | null, opts: { pushHistory?: boolean } = {}): void {
    this.state = { ...this.state, selectedUclCode: uclCode };
    writeStateToUrl(this.state, opts.pushHistory ?? true);
    this.notify();
  }

  /** Change the map layer. Choosing a health layer also shows that outcome in the town panel. */
  setLayer(layer: string, opts: { healthKeys?: Set<string> } = {}): void {
    const outcome = opts.healthKeys?.has(layer) ? layer : this.state.outcome;
    this.state = this.normalize({ ...this.state, layer, outcome });
    writeStateToUrl(this.state, true);
    this.notify();
  }

  setOutcome(outcome: string): void {
    this.state = this.normalize({ ...this.state, outcome });
    writeStateToUrl(this.state, false);
    this.notify();
  }

  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }
}

export interface AppState {
  selectedUclCode: string | null;
  layer: string;
}

const DEFAULT_LAYER = "remoteness_name";

export function readStateFromUrl(): AppState {
  const params = new URLSearchParams(window.location.search);
  return {
    selectedUclCode: params.get("town"),
    layer: params.get("layer") ?? DEFAULT_LAYER,
  };
}

export function writeStateToUrl(state: AppState, push: boolean): void {
  const params = new URLSearchParams();
  if (state.selectedUclCode) params.set("town", state.selectedUclCode);
  if (state.layer !== DEFAULT_LAYER) params.set("layer", state.layer);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (push) {
    window.history.pushState(state, "", url);
  } else {
    window.history.replaceState(state, "", url);
  }
}

type Listener = (state: AppState) => void;

export class StateStore {
  private state: AppState;
  private listeners: Listener[] = [];

  constructor(initial: AppState) {
    this.state = initial;
    window.addEventListener("popstate", () => {
      this.state = readStateFromUrl();
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

  setLayer(layer: string): void {
    this.state = { ...this.state, layer };
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

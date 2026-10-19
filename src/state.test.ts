import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYER, DEFAULT_OUTCOME, StateStore, parseState, stateToSearch } from "./state";

describe("URL state", () => {
  it("defaults to All towns and diabetes with no params", () => {
    expect(DEFAULT_LAYER).toBe("all_towns");
    expect(parseState("")).toEqual({ selectedUclCode: null, layer: DEFAULT_LAYER, outcome: DEFAULT_OUTCOME });
    expect(stateToSearch(parseState(""))).toBe("");
  });

  it("round-trips a deep link to a town, layer and outcome", () => {
    const search = "?town=UCL121013&layer=cancer_pct&outcome=cancer_pct";
    const state = parseState(search);
    expect(state).toEqual({ selectedUclCode: "UCL121013", layer: "cancer_pct", outcome: "cancer_pct" });
    expect(stateToSearch(state)).toBe(search);
  });

  it("omits default values from the URL", () => {
    expect(stateToSearch({ selectedUclCode: "UCL322071", layer: DEFAULT_LAYER, outcome: DEFAULT_OUTCOME })).toBe(
      "?town=UCL322071",
    );
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("state transitions", () => {
  function fixture() {
    let popstate = () => {};
    const mockWindow = {
      location: {pathname: "/", search: ""},
      history: {pushState: vi.fn(), replaceState: vi.fn()},
      addEventListener: (_: string, fn: () => void) => { popstate = fn; },
    };
    vi.stubGlobal("window", mockWindow);
    return {mockWindow, pop: () => popstate()};
  }
  it("keeps hospital layer through town selection, close and reopening", () => {
    const {mockWindow} = fixture();
    const store = new StateStore(parseState("?layer=pph"));
    store.selectTown("UCL121013");
    store.selectTown(null);
    store.selectTown("UCL622006");
    expect(store.get().layer).toBe("pph");
    expect(mockWindow.history.pushState).toHaveBeenCalledTimes(3);
  });
  it("updates Census outcome with its layer and records layer history", () => {
    const {mockWindow} = fixture();
    const store = new StateStore(parseState(""));
    store.setLayer("asthma_pct", {healthKeys:new Set(["asthma_pct"])});
    expect(store.get().outcome).toBe("asthma_pct");
    expect(mockWindow.history.pushState).toHaveBeenCalled();
    store.setLayer("public_admissions");
    expect(store.get().outcome).toBe("asthma_pct");
  });
  it("restores URL state on Back/Forward using the normalizer", () => {
    const {mockWindow,pop} = fixture();
    const store = new StateStore(parseState(""), (s) => ({...s, layer:s.layer === "invalid" ? DEFAULT_LAYER : s.layer}));
    const listener = vi.fn(); store.subscribe(listener);
    mockWindow.location.search = "?town=UCL121013&layer=public_admissions";
    pop(); expect(store.get().layer).toBe("public_admissions");
    mockWindow.location.search = "?layer=invalid";
    pop(); expect(store.get().layer).toBe(DEFAULT_LAYER);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

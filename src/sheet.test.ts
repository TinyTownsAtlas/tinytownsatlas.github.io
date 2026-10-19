import { describe, expect, it } from "vitest";
import { resolveSnap } from "./sheet";

describe("resolveSnap", () => {
  it("snaps to the nearer point when released slowly", () => {
    expect(resolveSnap(100, 480, 0)).toBe("expanded");
    expect(resolveSnap(300, 480, 0)).toBe("peek");
  });
  it("lets a fast flick decide regardless of position", () => {
    expect(resolveSnap(470, 480, -0.6)).toBe("expanded");
    expect(resolveSnap(10, 480, 0.6)).toBe("peek");
  });
});

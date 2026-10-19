import { describe, expect, it } from "vitest";
import { isAtlasHref, parseAnswer, parseInline } from "./assistant-text";

describe("assistant reply parsing", () => {
  it("keeps Atlas deep links as links", () => {
    const inline = parseInline("See [Brewarrina](https://tinytownsatlas.github.io/?town=UCL121013) now", "localhost");
    expect(inline).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "Brewarrina", href: "https://tinytownsatlas.github.io/?town=UCL121013" },
      { kind: "text", text: " now" },
    ]);
  });

  it("allows links to the page's own host (local development) and drops everything else", () => {
    expect(isAtlasHref("http://localhost:5173/?town=UCL1", "localhost")).toBe(true);
    for (const bad of ["javascript:alert(1)", "https://evil.example/?town=1", "data:text/html,x", "//evil.example", "not a url"]) {
      expect(isAtlasHref(bad, "localhost")).toBe(false);
    }
    expect(parseInline("[click](javascript:alert(1))", "localhost").some((p) => p.kind === "link")).toBe(false);
  });

  it("does not interpret HTML; markup stays as text", () => {
    expect(parseInline("<img src=x onerror=alert(1)> **ok**", "localhost")).toEqual([
      { kind: "text", text: "<img src=x onerror=alert(1)> " },
      { kind: "bold", text: "ok" },
    ]);
  });

  it("groups paragraphs and bullet lists", () => {
    const blocks = parseAnswer("Top towns:\n- **A** 5.0%\n- B 4.0%\n\nNote one\nstill note", "localhost");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ul", "p"]);
    expect(blocks[1].kind === "ul" && blocks[1].items).toHaveLength(2);
    expect(blocks[2]).toEqual({ kind: "p", inline: [{ kind: "text", text: "Note one still note" }] });
  });
});

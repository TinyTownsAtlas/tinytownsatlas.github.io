import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AtlasIndex } from "./types";

/** The real generated public index, so tests run against what the Worker will serve. */
export function loadTestIndex(): AtlasIndex {
  const path = fileURLToPath(new URL("../../public/data/assistant_index.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as AtlasIndex;
}

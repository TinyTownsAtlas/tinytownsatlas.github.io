import type { AtlasIndex, Env } from "./types";

const DEFAULT_BASE = "https://tinytownsatlas.github.io";
const MEMORY_TTL_MS = 10 * 60 * 1000;
const EDGE_TTL_SECONDS = 3600;

let cached: { index: AtlasIndex; at: number; url: string } | null = null;

/** Public Atlas index, held in isolate memory for 10 minutes and in Cloudflare's edge cache for an hour. */
export async function loadIndex(env: Pick<Env, "ATLAS_BASE_URL">, fetchImpl: typeof fetch = fetch): Promise<AtlasIndex> {
  const base = (env.ATLAS_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const url = `${base}/data/assistant_index.json?v=1`; // bump v to invalidate the edge cache
  if (cached && cached.url === url && Date.now() - cached.at < MEMORY_TTL_MS) return cached.index;
  const res = await fetchImpl(url, { cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": EDGE_TTL_SECONDS, "300-599": 0 } } } as RequestInit);
  if (!res.ok) throw new Error(`Atlas index fetch failed with status ${res.status}`);
  const index = (await res.json()) as AtlasIndex;
  if (index.version !== 1 || !Array.isArray(index.towns) || index.towns.length === 0) {
    throw new Error("Atlas index has an unexpected shape");
  }
  cached = { index, at: Date.now(), url };
  return index;
}

export function resetIndexCache(): void {
  cached = null;
}

import type { Town } from "./data";

export interface SearchIndexEntry {
  town: Town;
  nameLower: string;
  /** Optional community name (e.g. "king island" for Currie (L)); matched like the town name. */
  aliasLower: string | null;
  tagged: boolean;
}

// Queries that list every tagged community (e.g. "Ten4Ten", "ten 4 ten").
const TAG_QUERY = /^ten\s*(4|four)\s*ten$/;

export function buildSearchIndex(
  towns: Town[],
  taggedCodes: Set<string> = new Set(),
  aliases: Map<string, string> = new Map(),
): SearchIndexEntry[] {
  return towns.map((town) => ({
    town,
    nameLower: town.ucl_name.toLowerCase(),
    aliasLower: aliases.get(town.ucl_code)?.toLowerCase() ?? null,
    tagged: taggedCodes.has(town.ucl_code),
  }));
}

export function search(index: SearchIndexEntry[], query: string, limit = 8): Town[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const byNameAsc = (a: Town, b: Town) => a.ucl_name.localeCompare(b.ucl_name);

  if (TAG_QUERY.test(q)) {
    return index
      .filter((entry) => entry.tagged)
      .map((entry) => entry.town)
      .sort(byNameAsc);
  }

  const startsWith: Town[] = [];
  const contains: Town[] = [];

  for (const entry of index) {
    const names = entry.aliasLower ? [entry.nameLower, entry.aliasLower] : [entry.nameLower];
    if (names.some((n) => n.startsWith(q))) {
      startsWith.push(entry.town);
    } else if (names.some((n) => n.includes(q))) {
      contains.push(entry.town);
    }
  }

  startsWith.sort(byNameAsc);
  contains.sort(byNameAsc);

  return [...startsWith, ...contains].slice(0, limit);
}

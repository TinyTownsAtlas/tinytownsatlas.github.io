import type { Town } from "./data";

export interface SearchIndexEntry {
  town: Town;
  nameLower: string;
  tagged: boolean;
}

// Queries that list every tagged community (e.g. "Ten4Ten", "ten 4 ten").
const TAG_QUERY = /^ten\s*(4|four)\s*ten$/;

export function buildSearchIndex(towns: Town[], taggedCodes: Set<string> = new Set()): SearchIndexEntry[] {
  return towns.map((town) => ({
    town,
    nameLower: town.ucl_name.toLowerCase(),
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
    if (entry.nameLower.startsWith(q)) {
      startsWith.push(entry.town);
    } else if (entry.nameLower.includes(q)) {
      contains.push(entry.town);
    }
  }

  startsWith.sort(byNameAsc);
  contains.sort(byNameAsc);

  return [...startsWith, ...contains].slice(0, limit);
}

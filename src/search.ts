import type { Town } from "./data";

export interface SearchIndexEntry {
  town: Town;
  nameLower: string;
}

export function buildSearchIndex(towns: Town[]): SearchIndexEntry[] {
  return towns.map((town) => ({ town, nameLower: town.ucl_name.toLowerCase() }));
}

export function search(index: SearchIndexEntry[], query: string, limit = 8): Town[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const startsWith: Town[] = [];
  const contains: Town[] = [];

  for (const entry of index) {
    if (entry.nameLower.startsWith(q)) {
      startsWith.push(entry.town);
    } else if (entry.nameLower.includes(q)) {
      contains.push(entry.town);
    }
  }

  const byNameAsc = (a: Town, b: Town) => a.ucl_name.localeCompare(b.ucl_name);
  startsWith.sort(byNameAsc);
  contains.sort(byNameAsc);

  return [...startsWith, ...contains].slice(0, limit);
}

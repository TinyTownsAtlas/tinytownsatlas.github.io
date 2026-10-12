import type { Town } from "./data";

export interface SearchIndexEntry {
  town: Town;
  /** Normalised UCL name, e.g. "laura l qld" for "Laura (L) (Qld)". */
  name: string;
  /** Optional community name (e.g. "king island" for Currie (L)); matched like the town name. */
  alias: string | null;
  /** Normalised state name, e.g. "queensland". */
  state: string;
  tagged: boolean;
}

// Queries that list every tagged community (e.g. "Ten4Ten", "ten 4 ten", "Ten-4-Ten").
const TAG_QUERY = /^ten ?(4|four) ?ten$/;

/** Official state/territory names (as in the data) and the abbreviations people type. */
const STATE_ALIASES: Record<string, string[]> = {
  "new south wales": ["nsw"],
  victoria: ["vic"],
  queensland: ["qld"],
  "south australia": ["sa"],
  "western australia": ["wa"],
  tasmania: ["tas"],
  "northern territory": ["nt"],
  "australian capital territory": ["act"],
  "other territories": ["ot"],
};

// Every state phrase (full name or abbreviation) -> normalised full state name, longest first so
// "south australia" is matched before "sa".
const STATE_PHRASES: Array<[string, string]> = Object.entries(STATE_ALIASES)
  .flatMap(([state, abbrevs]) => [[state, state] as [string, string], ...abbrevs.map((a) => [a, state] as [string, string])])
  .sort((a, b) => b[0].length - a[0].length);

/** Lower-case, strip diacritics, turn punctuation into spaces and collapse whitespace. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Split a normalised query into place text and a state, when the query starts or ends with a
 * state name or abbreviation ("laura qld", "laura queensland", "nsw bourke").
 */
export function splitState(query: string): { place: string; state: string } | null {
  for (const [phrase, state] of STATE_PHRASES) {
    if (query.endsWith(` ${phrase}`)) return { place: query.slice(0, -phrase.length - 1).trim(), state };
    if (query.startsWith(`${phrase} `)) return { place: query.slice(phrase.length + 1).trim(), state };
  }
  return null;
}

export function buildSearchIndex(
  towns: Town[],
  taggedCodes: Set<string> = new Set(),
  aliases: Map<string, string> = new Map(),
): SearchIndexEntry[] {
  return towns.map((town) => {
    const alias = aliases.get(town.ucl_code);
    return {
      town,
      name: normalize(town.ucl_name),
      alias: alias ? normalize(alias) : null,
      state: normalize(town.state_name),
      tagged: taggedCodes.has(town.ucl_code),
    };
  });
}

/** Prefix matches first, then substring matches; each group alphabetical. Never by indicator value. */
function matchPlace(entries: SearchIndexEntry[], q: string): Town[] {
  const startsWith: Town[] = [];
  const contains: Town[] = [];
  for (const entry of entries) {
    const names = entry.alias ? [entry.name, entry.alias] : [entry.name];
    if (names.some((n) => n.startsWith(q))) {
      startsWith.push(entry.town);
    } else if (names.some((n) => n.includes(q))) {
      contains.push(entry.town);
    }
  }
  startsWith.sort(byNameAsc);
  contains.sort(byNameAsc);
  return [...startsWith, ...contains];
}

function byNameAsc(a: Town, b: Town): number {
  return a.ucl_name.localeCompare(b.ucl_name);
}

export function search(index: SearchIndexEntry[], query: string, limit = 8): Town[] {
  const q = normalize(query);
  if (!q) return [];

  if (TAG_QUERY.test(q)) {
    return index
      .filter((entry) => entry.tagged)
      .map((entry) => entry.town)
      .sort(byNameAsc);
  }

  // The whole query as a place name first (so "Port Victoria" is not read as "Port" in Victoria);
  // only if that finds nothing, read a leading/trailing state ("Laura Qld", "Laura Queensland").
  let results = matchPlace(index, q);
  const split = results.length === 0 ? splitState(q) : null;
  if (split && split.place) {
    results = matchPlace(
      index.filter((entry) => entry.state === split.state),
      split.place,
    );
  }
  return results.slice(0, limit);
}

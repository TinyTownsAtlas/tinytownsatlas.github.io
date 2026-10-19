/** OpenAI Responses API function definitions (strict schemas), built from the loaded index. */
import { HOSPITAL_KEYS, MAX_FILTER_ROWS, MAX_TOP_N, DESCRIPTIVE_ONLY } from "./queries";
import type { AtlasIndex } from "./types";

export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
}

const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const orNull = (schema: Record<string, unknown>, description?: string) => ({
  anyOf: [schema, { type: "null" }],
  ...(description ? { description } : {}),
});

export function buildTools(idx: AtlasIndex): ToolDefinition[] {
  const sortable = [...Object.keys(idx.indicators).filter((k) => !DESCRIPTIVE_ONLY.has(k)), ...HOSPITAL_KEYS];
  const anyMeasure = [...Object.keys(idx.indicators), ...HOSPITAL_KEYS];
  // Enum lists are defined once per tool schema and referenced, instead of repeated per property.
  const defs = {
    state: { type: "string", enum: idx.states.map((s) => s.abbr) },
    remoteness: { type: "string", enum: idx.remotenessOrder },
    measure: { type: "string", enum: anyMeasure },
    sortable: { type: "string", enum: sortable },
    census: { type: "string", enum: sortable.filter((k) => !(HOSPITAL_KEYS as string[]).includes(k)) },
    direction: { type: "string", enum: ["highest", "lowest"] },
  };
  const used = (props: unknown) => {
    const text = JSON.stringify(props);
    return Object.fromEntries(Object.entries(defs).filter(([k]) => text.includes(`#/$defs/${k}"`)));
  };
  const scope = {
    state: orNull(ref("state"), "State filter or null."),
    remoteness: orNull(ref("remoteness"), "Remoteness filter or null."),
    min_population: orNull({ type: "integer" }, "Minimum usual residents or null."),
    max_population: orNull({ type: "integer" }, "Maximum usual residents or null."),
  };
  const fn = (name: string, description: string, properties: Record<string, unknown>): ToolDefinition => ({
    type: "function",
    name,
    description,
    strict: true,
    parameters: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
      $defs: used(properties),
    },
  });
  const townArg = { type: "string", description: "Town name, optionally with state (e.g. 'Laura QLD'), or a UCL code." };
  const stateArg = orNull(ref("state"), "State filter or null.");

  return [
    fn("find_town", "Look up towns by name, alias (e.g. King Island) or UCL code.", {
      query: { type: "string" },
      state: stateArg,
    }),
    fn("get_town_profile", "Profile of one town: Census conditions with counts and denominators, context indicators, hospital SR context.", {
      town: townArg,
      state: stateArg,
    }),
    fn("compare_towns", "Compare 2-4 towns on chosen measures; empty indicators gives the default set (ten conditions plus both hospital measures).", {
      towns: { type: "array", items: { type: "string" } },
      indicators: { type: "array", items: ref("measure") },
    }),
    fn("rank_towns", "Sort towns on ONE measure, highest or lowest, optionally within state, remoteness or population range. No overall or composite ranking exists.", {
      indicator: ref("sortable"),
      direction: ref("direction"),
      top_n: orNull({ type: "integer" }, `1-${MAX_TOP_N}; null means 5.`),
      ...scope,
    }),
    fn("filter_towns", "Towns meeting ALL conditions. Thresholds are percents (SR for hospital measures, Australia = 100); top_quartile/bottom_quartile use the national Atlas distribution (Census measures only; value null). Empty conditions filter only by scope.", {
      conditions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indicator: ref("sortable"),
            op: { type: "string", enum: ["gt", "gte", "lt", "lte", "top_quartile", "bottom_quartile"] },
            value: orNull({ type: "number" }),
          },
          required: ["indicator", "op", "value"],
          additionalProperties: false,
        },
      },
      sort_by: orNull(ref("sortable"), "Sort measure; null sorts by population."),
      sort_direction: orNull(ref("direction")),
      limit: orNull({ type: "integer" }, `1-${MAX_FILTER_ROWS}; null means 10.`),
      ...scope,
    }),
    fn("summarize_indicator", "Distribution (min, quartiles, median, max, extreme towns) of a Census measure in scope. Not for hospital measures.", {
      indicator: ref("census"),
      ...scope,
    }),
    fn("explain_indicator", "Definition, denominator, caveats and source of a measure; what a hospital SR value means; or 'remoteness'.", {
      indicator: { anyOf: [ref("measure"), { type: "string", enum: ["remoteness"] }] },
      sr_value: orNull({ type: "number" }, "Hospital SR value the user asked about, else null."),
    }),
    fn("get_hospital_context", "Hospital-services context for one town: both SR measures with status, Population Health Area if identified, other Atlas towns sharing it.", {
      town: townArg,
      state: stateArg,
    }),
  ];
}

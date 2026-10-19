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

const nullable = (schema: Record<string, unknown>) => ({
  ...schema,
  type: [schema.type as string, "null"],
  ...(schema.enum ? { enum: [...(schema.enum as unknown[]), null] } : {}),
});

export function buildTools(idx: AtlasIndex): ToolDefinition[] {
  const sortable = [...Object.keys(idx.indicators).filter((k) => !DESCRIPTIVE_ONLY.has(k)), ...HOSPITAL_KEYS];
  const anyMeasure = [...Object.keys(idx.indicators), ...HOSPITAL_KEYS];
  const measureHelp = Object.values(idx.indicators)
    .map((i) => `${i.key} = ${i.shortLabel}`)
    .concat(HOSPITAL_KEYS.map((k) => `${k} = ${idx.hospital.indicators[k].label} (SR, Australia = 100)`))
    .join("; ");
  const states = idx.states.map((s) => s.abbr);
  const state = nullable({ type: "string", enum: states, description: "State or territory abbreviation filter, or null for all." });
  const remoteness = nullable({ type: "string", enum: idx.remotenessOrder, description: "Remoteness class filter, or null." });
  const scope = {
    state,
    remoteness,
    min_population: nullable({ type: "integer", description: "Minimum usual residents, or null." }),
    max_population: nullable({ type: "integer", description: "Maximum usual residents, or null." }),
  };
  const fn = (name: string, description: string, properties: Record<string, unknown>): ToolDefinition => ({
    type: "function",
    name,
    description,
    strict: true,
    parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  });
  const townArg = { type: "string", description: "Town name, optionally with state (e.g. 'Laura QLD'), or a UCL code from the UI context." };

  return [
    fn("find_town", "Look up Atlas towns by name, alias (e.g. King Island) or UCL code. Use when a name may be ambiguous.", {
      query: { type: "string" },
      state,
    }),
    fn("get_town_profile", `Full profile of one town: Census health conditions with counts and denominators, context indicators, hospital SR context and deep links. Measures: ${measureHelp}.`, {
      town: townArg,
      state,
    }),
    fn("compare_towns", "Compare 2-4 towns side by side on chosen measures. Use an empty indicators list for the default set (ten Census conditions plus both hospital measures).", {
      towns: { type: "array", items: { type: "string" }, description: "2 to 4 town names (optionally with state)." },
      indicators: { type: "array", items: { type: "string", enum: anyMeasure }, description: "Measure keys, or empty for the default set." },
    }),
    fn("rank_towns", `Sort towns on ONE measure (highest or lowest observed value), optionally within a state, remoteness class or population range. There is no overall or composite ranking. Measures: ${measureHelp}.`, {
      indicator: { type: "string", enum: sortable },
      direction: { type: "string", enum: ["highest", "lowest"] },
      top_n: nullable({ type: "integer", description: `How many towns, 1-${MAX_TOP_N}. Null means 5.` }),
      ...scope,
    }),
    fn("filter_towns", "List towns meeting every condition (AND). Use numeric thresholds, or top_quartile / bottom_quartile of the national Atlas distribution for Census measures. Empty conditions filter only by state, remoteness and population.", {
      conditions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indicator: { type: "string", enum: sortable },
            op: { type: "string", enum: ["gt", "gte", "lt", "lte", "top_quartile", "bottom_quartile"] },
            value: nullable({ type: "number", description: "Threshold (percent, or SR where Australia = 100); null for quartile ops." }),
          },
          required: ["indicator", "op", "value"],
          additionalProperties: false,
        },
      },
      sort_by: nullable({ type: "string", enum: sortable, description: "Measure to sort results by, or null for population." }),
      sort_direction: nullable({ type: "string", enum: ["highest", "lowest"] }),
      limit: nullable({ type: "integer", description: `Rows to return, 1-${MAX_FILTER_ROWS}. Null means 10.` }),
      ...scope,
    }),
    fn("summarize_indicator", "Distribution summary (min, quartiles, median, max, lowest and highest town) of a Census measure across towns in scope. Not available for hospital measures.", {
      indicator: { type: "string", enum: sortable.filter((k) => !HOSPITAL_KEYS.includes(k as never)) },
      ...scope,
    }),
    fn("explain_indicator", "Definition, denominator, caveats and source for a measure, or what a hospital SR value means. Use 'remoteness' for the remoteness classes.", {
      indicator: { type: "string", enum: [...anyMeasure, "remoteness"] },
      sr_value: nullable({ type: "number", description: "A hospital SR value the user asked about, e.g. 157; otherwise null." }),
    }),
    fn("get_hospital_context", "Hospital-services context for one town: both SR measures with status, the Population Health Area (if identified) and other Atlas towns sharing it.", {
      town: townArg,
      state,
    }),
  ];
}

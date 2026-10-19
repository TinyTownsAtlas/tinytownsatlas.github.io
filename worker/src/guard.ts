import { COMPOSITE_MESSAGE } from "./queries";

// Questions that ask for a single overall health ordering. Handled without calling the model.
const OVERALL = [
  /\b(healthiest|unhealthiest|sickest|least healthy|most healthy|healthier than all)\b/i,
  /\b(best|worst)\s+(overall\s+)?(town|place|community|communities|towns|places)\b/i,
  /\boverall\s+(health\s+)?(score|ranking|rank|index)\b/i,
];

// If the question names a specific measure, let the model answer it with the single-measure tools.
const SPECIFIC_MEASURE =
  /\b(diabet|asthma|cancer|arthritis|mental|heart|lung|kidney|stroke|dementia|hospital|admission|hospitalis|pph|preventable|unemploy|income|degree|crowd|housing|assistance|overseas|indigenous|aboriginal)/i;

/** Returns the fixed reply for an overall-health-ordering question, or null. */
export function compositeGuard(question: string): string | null {
  if (SPECIFIC_MEASURE.test(question)) return null;
  return OVERALL.some((re) => re.test(question)) ? COMPOSITE_MESSAGE : null;
}

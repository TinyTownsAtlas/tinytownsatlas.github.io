export function formatPercent(value: number, precision = 1): string {
  return `${value.toFixed(precision)}%`;
}

export function formatPopulation(value: number): string {
  return value.toLocaleString("en-AU");
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-AU");
}

/**
 * Plain-language reading of an indirectly age-standardised ratio (Australia = 100), e.g. 156.6 ->
 * "about 1.6 times the Australian rate, allowing for age".
 */
export function describeStandardisedRatio(sr: number): string {
  const times = sr / 100;
  if (Math.abs(times - 1) < 0.05) return "about the same as the Australian rate, allowing for age";
  return `about ${times.toFixed(1)} times the Australian rate, allowing for age`;
}

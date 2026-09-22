export function formatPercent(value: number, precision = 1): string {
  return `${value.toFixed(precision)}%`;
}

export function formatPopulation(value: number): string {
  return value.toLocaleString("en-AU");
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-AU");
}

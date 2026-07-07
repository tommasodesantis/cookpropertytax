import { addYears, isWithinYearsOf } from "./dateUtils";

export { addYears, isWithinYearsOf };

export function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export function percentileRank(value: number, population: number[]): number | null {
  const clean = population.filter((item) => !Number.isNaN(item));
  if (clean.length === 0) {
    return null;
  }
  const lower = clean.filter((item) => item < value).length;
  const equal = clean.filter((item) => item === value).length;
  return (100 * (lower + 0.5 * equal)) / clean.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[midpoint] ?? Number.NaN;
  }
  return ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2;
}

export function gapPct(value: number | null, population: number[]): number | null {
  const clean = population.filter((item) => !Number.isNaN(item) && item > 0);
  if (value === null || clean.length === 0) {
    return null;
  }
  const med = median(clean);
  if (med === 0) {
    return null;
  }
  return (100 * (value - med)) / med;
}

export function estimatedSavingsRange(
  deltaAv: number,
  equalizer: number,
  taxRate: number,
): [number, number, number] {
  const point = Math.max(deltaAv, 0) * equalizer * taxRate;
  return [point * 0.8, point, point * 1.2];
}

export function medianValue(values: number[]): number {
  return median(values);
}

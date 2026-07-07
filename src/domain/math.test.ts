import {
  addYears,
  estimatedSavingsRange,
  gapPct,
  isWithinYearsOf,
  percentileRank,
  safeDiv,
} from "./math";

test("percentileRank uses 0.5 weight for ties", () => {
  expect(percentileRank(10, [8, 10, 12])).toBe(50);
});

test("gapPct returns zero at the median", () => {
  expect(gapPct(10, [8, 10, 12])).toBe(0);
});

test("division helpers guard zero and missing values", () => {
  expect(safeDiv(1, 0)).toBeNull();
  expect(safeDiv(null, 1)).toBeNull();
  expect(gapPct(10, [0, 0])).toBeNull();
  expect(gapPct(10, [])).toBeNull();
});

test("estimatedSavingsRange uses equalizer and tax rate assumptions", () => {
  const [low, point, high] = estimatedSavingsRange(1000, 3, 0.1);
  expect(low).toBe(240);
  expect(point).toBe(300);
  expect(high).toBe(360);
});

test("three-year date arithmetic handles leap years", () => {
  expect(isWithinYearsOf("2022-01-01", "2025-01-01", 3)).toBe(true);
  expect(isWithinYearsOf("2021-12-31", "2025-01-01", 3)).toBe(false);
  expect(addYears("2020-02-29", 1)).toBe("2021-02-28");
});

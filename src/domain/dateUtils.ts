const DAY_MS = 86_400_000;

export function parseMdyDate(value: string): string {
  const [monthText, dayText, yearText] = value.split("/");
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  return isoDate(year, month, day);
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function parts(day: string): { year: number; month: number; day: number } {
  const [yearText, monthText, dayText] = day.split("-");
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
}

export function epochDay(day: string): number {
  const parsed = parts(day);
  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / DAY_MS);
}

export function daysBetween(start: string, end: string): number {
  return epochDay(end) - epochDay(start);
}

export function addDays(day: string, days: number): string {
  const parsed = parts(day);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addYears(day: string, years: number): string {
  const parsed = parts(day);
  if (parsed.month === 2 && parsed.day === 29) {
    const target = parsed.year + years;
    const isLeap = target % 4 === 0 && (target % 100 !== 0 || target % 400 === 0);
    if (!isLeap) {
      return isoDate(target, 2, 28);
    }
  }
  return isoDate(parsed.year + years, parsed.month, parsed.day);
}

export function isWithinYearsOf(purchaseDate: string, lienDate: string, years: number): boolean {
  return purchaseDate >= addYears(lienDate, -years) && purchaseDate <= addYears(lienDate, years);
}

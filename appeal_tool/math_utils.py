from __future__ import annotations

from datetime import date
from statistics import median


def safe_div(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def percentile_rank(value: float, population: list[float]) -> float | None:
    clean = [item for item in population if item == item]
    if not clean:
        return None
    lower = sum(1 for item in clean if item < value)
    equal = sum(1 for item in clean if item == value)
    return 100.0 * (lower + 0.5 * equal) / len(clean)


def gap_pct(value: float | None, population: list[float]) -> float | None:
    clean = [item for item in population if item == item and item > 0]
    if value is None or not clean:
        return None
    med = median(clean)
    if med == 0:
        return None
    return 100.0 * (value - med) / med


def add_years(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year + years)
    except ValueError:
        return day.replace(month=2, day=28, year=day.year + years)


def is_within_years_of(purchase_date: date, lien_date: date, years: int) -> bool:
    return add_years(lien_date, -years) <= purchase_date <= add_years(lien_date, years)


def estimated_savings_range(
    delta_av: float, equalizer: float, tax_rate: float
) -> tuple[float, float, float]:
    point = max(delta_av, 0.0) * equalizer * tax_rate
    return point * 0.8, point, point * 1.2

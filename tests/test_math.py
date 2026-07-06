from __future__ import annotations

from datetime import date

from appeal_tool.math_utils import (
    add_years,
    estimated_savings_range,
    gap_pct,
    is_within_years_of,
    percentile_rank,
    safe_div,
)


def test_percentile_subject_at_median_is_approximately_50() -> None:
    assert percentile_rank(10, [8, 10, 12]) == 50


def test_gap_subject_at_median_is_zero() -> None:
    assert gap_pct(10, [8, 10, 12]) == 0


def test_division_guards_zero() -> None:
    assert safe_div(1, 0) is None
    assert safe_div(None, 1) is None
    assert gap_pct(10, [0, 0]) is None
    assert gap_pct(10, []) is None


def test_estimated_savings_range_uses_assumptions() -> None:
    low, point, high = estimated_savings_range(1000, 3.0, 0.10)
    assert low == 240
    assert point == 300
    assert high == 360


def test_three_year_date_arithmetic_handles_leap_years() -> None:
    assert is_within_years_of(date(2022, 1, 1), date(2025, 1, 1), 3)
    assert not is_within_years_of(date(2021, 12, 31), date(2025, 1, 1), 3)
    assert add_years(date(2020, 2, 29), 1) == date(2021, 2, 28)

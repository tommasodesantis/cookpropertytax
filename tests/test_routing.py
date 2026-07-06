from __future__ import annotations

from datetime import date

from appeal_tool.routing import route_case


def test_routes_to_assessor_when_ccao_window_open() -> None:
    route = route_case("Rogers Park", date(2025, 2, 15), "auto")
    assert route.venue == "assessor"
    assert route.action_status == "open"
    assert route.deadline == date(2025, 3, 3)


def test_routes_to_bor_when_bor_window_open() -> None:
    route = route_case("Rogers Park", date(2025, 7, 10), "auto")
    assert route.venue == "bor"
    assert route.action_status == "open"
    assert route.deadline == date(2025, 8, 5)


def test_routes_to_closed_when_all_windows_closed() -> None:
    route = route_case("Rogers Park", date(2026, 7, 6), "auto")
    assert route.venue == "closed"
    assert route.action_status == "closed"
    assert any("Certificate of Error" in reason for reason in route.reasoning)
    assert any("past its session end" in warning for warning in route.warnings)


def test_unknown_township_is_honest_and_non_crashing() -> None:
    route = route_case("Not A Township", date(2025, 7, 10), "auto")
    assert route.venue == "closed"
    assert route.action_status == "closed"
    assert "No configured CCAO or BOR" in route.headline


def test_ptab_requires_decision_date() -> None:
    route = route_case("Rogers Park", date(2026, 6, 1), "ptab")
    assert route.venue == "ptab"
    assert route.action_status == "needs_input"
    assert "refuses to guess" in " ".join(route.reasoning)


def test_ptab_eligible_from_supplied_decision_date() -> None:
    route = route_case("Rogers Park", date(2026, 6, 1), "auto", date(2026, 5, 20))
    assert route.venue == "ptab"
    assert route.action_status == "open"
    assert route.deadline == date(2026, 6, 19)
    assert route.days_remaining == 18


def test_ptab_expired_from_supplied_decision_date() -> None:
    route = route_case("Rogers Park", date(2026, 7, 6), "auto", date(2026, 5, 20))
    assert route.venue == "ptab"
    assert route.action_status == "expired"
    assert route.deadline == date(2026, 6, 19)
    assert route.days_remaining == -17

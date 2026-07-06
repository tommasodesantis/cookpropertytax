from __future__ import annotations

from collections.abc import Sequence
from datetime import date, timedelta
from typing import Literal

from appeal_tool.config import (
    BOR_CALENDAR,
    BOR_OFFICIAL_URL,
    CCAO_CALENDAR,
    CCAO_OFFICIAL_URL,
    PTAB_OFFICIAL_URL,
    FilingWindow,
    bor_windows_for_township,
    canonical_township,
    ccao_windows_for_township,
)
from appeal_tool.models import RouteResult, Venue

WindowStatus = Literal["open", "upcoming", "closed"]


def _first_open_or_upcoming(
    windows: Sequence[FilingWindow], today: date
) -> tuple[WindowStatus | None, date | None, int | None]:
    for window in windows:
        status, days = window.status_on(today)
        if status == "open":
            return "open", window.closes, days
    upcoming = [
        (window.opens, window) for window in windows if window.status_on(today)[0] == "upcoming"
    ]
    if upcoming:
        _, window = sorted(upcoming, key=lambda item: item[0])[0]
        return "upcoming", window.opens, window.status_on(today)[1]
    return None, None, None


def route_case(
    township_name: str,
    today: date,
    requested_venue: Venue = "auto",
    bor_decision_date: date | None = None,
) -> RouteResult:
    township = canonical_township(township_name)
    warnings = tuple(
        warning
        for warning in (
            CCAO_CALENDAR.staleness_warning(today),
            BOR_CALENDAR.staleness_warning(today),
        )
        if warning
    )

    if requested_venue == "ptab" or bor_decision_date is not None:
        if bor_decision_date is None:
            return RouteResult(
                venue="ptab",
                headline="PTAB deadline cannot be computed without your BOR decision date.",
                reasoning=(
                    "PTAB is only available after a BOR decision for the same tax year.",
                    "The 30-day deadline is jurisdictional, so this tool refuses to guess.",
                ),
                action_status="needs_input",
                warnings=warnings,
                official_url=PTAB_OFFICIAL_URL,
            )
        deadline = bor_decision_date + timedelta(days=30)
        days_remaining = (deadline - today).days
        if days_remaining >= 0:
            return RouteResult(
                venue="ptab",
                headline=f"PTAB is actionable now. File by {deadline.isoformat()}.",
                reasoning=(
                    "You supplied a BOR decision date, so the PTAB 30-day clock controls.",
                    "PTAB requires a prior BOR appeal for the year under appeal.",
                    "Taxes must be paid while PTAB is pending; success can result in a refund.",
                ),
                action_status="urgent" if days_remaining <= 7 else "open",
                deadline=deadline,
                days_remaining=days_remaining,
                warnings=warnings,
                official_url=PTAB_OFFICIAL_URL,
            )
        return RouteResult(
            venue="ptab",
            headline=f"PTAB 30-day window appears expired. Deadline was {deadline.isoformat()}.",
            reasoning=(
                "The deadline was computed only from the BOR decision date you supplied.",
                "Verify immediately with PTAB if you believe a different notice date applies.",
            ),
            action_status="expired",
            deadline=deadline,
            days_remaining=days_remaining,
            warnings=warnings,
            official_url=PTAB_OFFICIAL_URL,
        )

    ccao_status, ccao_deadline, ccao_days = _first_open_or_upcoming(
        ccao_windows_for_township(township), today
    )
    bor_status, bor_deadline, bor_days = _first_open_or_upcoming(
        bor_windows_for_township(township), today
    )

    if requested_venue == "assessor" or (requested_venue == "auto" and ccao_status == "open"):
        assessor_status: WindowStatus = ccao_status or "closed"
        return RouteResult(
            venue="assessor",
            headline=(
                "File with the Cook County Assessor now."
                if assessor_status == "open"
                else "Assessor window is not currently configured as open."
            ),
            reasoning=(
                "The Assessor is the first-level appeal and is free.",
                "Filing preserves the path to BOR, where Rule 15 may ask for Assessor documents.",
                "Property-description errors and Certificates of Error start with the Assessor.",
            ),
            action_status=assessor_status,
            deadline=ccao_deadline,
            days_remaining=ccao_days,
            warnings=warnings
            + ("CCAO township windows are partially configured; verify at the official site.",),
            official_url=CCAO_OFFICIAL_URL,
        )

    if requested_venue == "bor" or (
        requested_venue == "auto" and bor_status in {"open", "upcoming"}
    ):
        bor_action_status: WindowStatus = bor_status or "closed"
        return RouteResult(
            venue="bor",
            headline=(
                "BOR filing window is open now."
                if bor_action_status == "open"
                else "BOR window is upcoming; prepare now."
                if bor_action_status == "upcoming"
                else "BOR window is not currently open."
            ),
            reasoning=(
                f"Township routed to BOR calendar as {township}.",
                "BOR is the second-level appeal venue after or instead of the Assessor window.",
                "File by the township close date and submit evidence by the evidence deadline.",
            ),
            action_status=bor_action_status,
            deadline=bor_deadline,
            days_remaining=bor_days,
            warnings=warnings,
            official_url=BOR_OFFICIAL_URL,
        )

    return RouteResult(
        venue="closed",
        headline="No configured CCAO or BOR filing window is currently actionable.",
        reasoning=(
            "Prepare evidence for the next township session.",
            "If you recently received a BOR decision, rerun with --bor-decision-date for PTAB.",
            "For prior-year factual errors or missed exemptions, evaluate Certificate of Error.",
        ),
        action_status="closed",
        warnings=warnings,
        official_url=CCAO_OFFICIAL_URL,
    )

from __future__ import annotations

from dataclasses import replace
from datetime import date

import pytest
from pypdf import PdfReader

from appeal_tool.analysis import build_evidence_summary
from appeal_tool.models import UserEvidence
from appeal_tool.pdf import write_packet
from appeal_tool.repository import FixtureRepository
from appeal_tool.routing import route_case


def _text(path: object) -> str:
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


@pytest.mark.parametrize(
    "pin",
    [
        "03-00-000-000-0001",
        "03-00-000-000-0020",
        "03-00-000-000-0030",
    ],
)
@pytest.mark.parametrize(
    ("route_date", "venue", "decision_date", "expected_section"),
    [
        (date(2026, 5, 1), "assessor", None, "Assessor Filing Instructions"),
        (date(2025, 7, 10), "bor", None, "BOR Filing Instructions"),
        (date(2026, 6, 1), "ptab", date(2026, 5, 20), "PTAB Filing Instructions"),
    ],
)
def test_packets_for_each_parcel_and_venue_have_required_sections(
    fixture_repo: FixtureRepository,
    tmp_path: object,
    pin: str,
    route_date: date,
    venue: str,
    decision_date: date | None,
    expected_section: str,
) -> None:
    case = fixture_repo.load_case_by_pin(pin)
    evidence = build_evidence_summary(case, 0.10)
    route = route_case(case.parcel.township_name, route_date, venue, decision_date)  # type: ignore[arg-type]
    path = write_packet(case, evidence, route, tmp_path)  # type: ignore[arg-type]
    text = _text(path)
    assert "Executive Summary" in text
    assert "Evidence Tier" in text
    assert "Exemptions and Certificate of Error Screen" in text
    assert "NOT LEGAL ADVICE" in text
    assert expected_section in text
    assert route.headline.split(".")[0] in text
    assert "PLACEHOLDER" not in text
    assert "None" not in text
    assert "nan" not in text.lower()


def test_closed_window_packet_uses_closed_adapter(
    fixture_repo: FixtureRepository, tmp_path: object
) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0040")
    evidence = build_evidence_summary(case, 0.10)
    route = route_case(case.parcel.township_name, date(2025, 7, 10), "auto")
    path = write_packet(case, evidence, route, tmp_path)  # type: ignore[arg-type]
    text = _text(path)
    assert "Closed-Window Preparation Instructions" in text
    assert "Certificate of Error" in text
    assert "BOR Rules Checklist" not in text


def test_packet_labels_user_supplied_subject_values(
    fixture_repo: FixtureRepository, tmp_path: object
) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    user_evidence = UserEvidence(
        actual_sqft=1800,
        actual_av=60000,
        actual_improvement_av=50000,
    )
    override_case = replace(
        case.with_user_evidence(user_evidence),
        parcel=replace(case.parcel, building_sqft=None, current_av=None),
        subject_sales=(),
    )
    route = route_case(override_case.parcel.township_name, date(2025, 7, 10), "bor")
    evidence = build_evidence_summary(override_case, 0.10, venue=route.venue)
    path = write_packet(override_case, evidence, route, tmp_path)  # type: ignore[arg-type]
    text = _text(path)
    assert "user-supplied; document required" in text
    assert "Building / improvement assessed value" in text


def test_ptab_packet_marks_unavailable_grid_fields_as_user_supply(
    fixture_repo: FixtureRepository, tmp_path: object
) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    route = route_case(
        case.parcel.township_name,
        date(2026, 6, 1),
        "ptab",
        date(2026, 5, 20),
    )
    evidence = build_evidence_summary(case, 0.10, venue=route.venue)
    path = write_packet(case, evidence, route, tmp_path)  # type: ignore[arg-type]
    text = _text(path)
    assert "PTAB Comparable Grid Public-Data Limits" in text
    assert "Not available from public data - supply from your property record card" in text

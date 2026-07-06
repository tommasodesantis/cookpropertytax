from __future__ import annotations

from datetime import date

from pypdf import PdfReader

from appeal_tool.analysis import build_evidence_summary
from appeal_tool.pdf import write_packet
from appeal_tool.repository import FixtureRepository
from appeal_tool.routing import route_case


def _text(path: object) -> str:
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def test_packets_for_each_venue_have_required_sections(
    fixture_repo: FixtureRepository, tmp_path: object
) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    evidence = build_evidence_summary(case, 0.10)
    routes = [
        route_case("Rogers Park", date(2025, 2, 15), "assessor"),
        route_case("Rogers Park", date(2025, 7, 10), "bor"),
        route_case("Rogers Park", date(2026, 6, 1), "ptab", date(2026, 5, 20)),
    ]
    for route in routes:
        path = write_packet(case, evidence, route, tmp_path)  # type: ignore[arg-type]
        text = _text(path)
        assert "Executive Summary" in text
        assert "Evidence Tier" in text
        assert "Exemptions and Certificate of Error Screen" in text
        assert "NOT LEGAL ADVICE" in text
        assert route.headline.split(".")[0] in text
        assert "PLACEHOLDER" not in text
        assert "None" not in text
        assert "nan" not in text.lower()

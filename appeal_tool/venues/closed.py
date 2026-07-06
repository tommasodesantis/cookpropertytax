from __future__ import annotations

from appeal_tool.config import CCAO_OFFICIAL_URL
from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult
from appeal_tool.venues.base import PacketSection, VenueAdapter


class ClosedSessionAdapter(VenueAdapter):
    venue_key = "closed"
    venue_name = "Cook County Appeal Preparation Packet"
    official_url = CCAO_OFFICIAL_URL

    def checklist(self, case: CaseFile) -> tuple[str, ...]:
        return (
            "Verify whether any Assessor or BOR window has reopened or been corrected.",
            "Prepare comparable, sale, appraisal, condition, and factual-error evidence.",
            "If you recently received a BOR decision, rerun with --bor-decision-date.",
            "For prior-year factual errors or missed exemptions, ask about Certificate of Error.",
            "Check exemptions now; exemptions may be worth more than an assessment appeal.",
        )

    def sections(
        self, case: CaseFile, evidence: EvidenceSummary, route: RouteResult
    ) -> tuple[PacketSection, ...]:
        return (
            PacketSection(
                "Closed-Window Preparation Instructions",
                (
                    "No configured current-year CCAO or BOR filing window is actionable.",
                    "Use this for preparation, PTAB screening, and Certificate of Error review.",
                    "Do not file this as a BOR packet unless BOR shows a valid window.",
                    f"Official source: {self.official_url}",
                ),
            ),
            PacketSection("Closed-Window Checklist", self.checklist(case)),
        )

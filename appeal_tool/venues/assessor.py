from __future__ import annotations

from appeal_tool.config import CCAO_OFFICIAL_URL
from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult
from appeal_tool.venues.base import PacketSection, VenueAdapter


class AssessorAdapter(VenueAdapter):
    venue_key = "assessor"
    venue_name = "Cook County Assessor Appeal"
    official_url = CCAO_OFFICIAL_URL

    def checklist(self, case: CaseFile) -> tuple[str, ...]:
        items = [
            "File during the township Assessor appeal window; verify at the official source.",
            "Attach comparable, sale, appraisal, condition, and factual-error evidence.",
            "If filing later at BOR, save the Assessor appeal confirmation and documents.",
            "For prior-year factual errors or missed exemptions, ask about Certificate of Error.",
        ]
        if case.user_evidence.actual_sqft:
            items.append(
                "Property-description correction: attach proof of actual square footage "
                "(appraisal, plans, survey, or other reliable documentation)."
            )
        return tuple(items)

    def sections(
        self, case: CaseFile, evidence: EvidenceSummary, route: RouteResult
    ) -> tuple[PacketSection, ...]:
        return (
            PacketSection(
                "Assessor Filing Instructions",
                (
                    "Recommended venue: Cook County Assessor.",
                    "Use this first-level appeal while the township window is open.",
                    "Property-description errors are strongest here when documented.",
                    f"Official source: {self.official_url}",
                ),
            ),
            PacketSection("Assessor Checklist", self.checklist(case)),
        )

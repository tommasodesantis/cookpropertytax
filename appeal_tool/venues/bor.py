from __future__ import annotations

from datetime import date

from appeal_tool.config import ASSESSMENT_YEAR, BOR_OFFICIAL_URL, BOR_PORTAL_URL
from appeal_tool.math_utils import is_within_years_of
from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult
from appeal_tool.venues.base import PacketSection, VenueAdapter


class BoardOfReviewAdapter(VenueAdapter):
    venue_key = "bor"
    venue_name = "Cook County Board of Review Appeal"
    official_url = BOR_OFFICIAL_URL

    def checklist(self, case: CaseFile) -> tuple[str, ...]:
        items = [
            "[Rule 1] Pro se packet is for an individual taxpayer. Entities need counsel.",
            f"[Rule 5] File through the BOR portal: {BOR_PORTAL_URL}",
            "[Rule 7] File by the township close date; late complaints are not accepted.",
            "[Rule 13] Submit all evidence by the evidence deadline.",
            "[Rule 15] If you filed at the Assessor, attach Assessor appeal documents.",
            "[Rule 16] Sign and complete the complaint truthfully.",
            "[Rule 26] Re-review requests must be made promptly after the BOR decision letter.",
        ]
        purchase_date = case.user_evidence.purchase_date
        if purchase_date and is_within_years_of(purchase_date, date(ASSESSMENT_YEAR, 1, 1), 3):
            items.append(
                "[Rule 18] Purchase within three years of lien date: disclose price/date "
                "and attach closing statement, deed, or MyDec."
            )
        if case.user_evidence.appraisal_value:
            items.append(
                "[Rule 19] Appraisal evidence must include required property photos and PINs."
            )
        if case.user_evidence.vacancy_claim:
            items.append("[Rule 21] Vacancy claims require the BOR vacancy affidavit and proof.")
        if case.user_evidence.demolition_claim:
            items.append("[Rule 22] Demolition claims require permits and before/after photos.")
        return tuple(items)

    def sections(
        self, case: CaseFile, evidence: EvidenceSummary, route: RouteResult
    ) -> tuple[PacketSection, ...]:
        return (
            PacketSection(
                "BOR Filing Instructions",
                (
                    "Recommended venue: Cook County Board of Review.",
                    "This is the second-level Cook County appeal forum.",
                    "Use the close date and evidence deadline shown in the routing section.",
                    f"Official source: {self.official_url}",
                ),
            ),
            PacketSection("BOR Rules Checklist", self.checklist(case)),
        )

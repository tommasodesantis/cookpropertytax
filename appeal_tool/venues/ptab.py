from __future__ import annotations

from appeal_tool.config import PTAB_EFILE_URL, PTAB_OFFICIAL_URL
from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult
from appeal_tool.venues.base import PacketSection, VenueAdapter


class PtabAdapter(VenueAdapter):
    venue_key = "ptab"
    venue_name = "Illinois Property Tax Appeal Board Appeal"
    official_url = PTAB_OFFICIAL_URL

    def checklist(self, case: CaseFile) -> tuple[str, ...]:
        return (
            "Attach the BOR written decision notice. PTAB deadline is 30 days from that notice.",
            "Use the correct PTAB Residential Appeal form and include the subject PIN.",
            "State whether you are raising equity, sale, appraisal, or factual evidence.",
            "Taxes must be paid while PTAB is pending; refunds may follow if the appeal succeeds.",
            "PTAB can take a long time. Keep copies of all filings and notices.",
            "The board of review and taxing bodies may intervene.",
            f"PTAB e-filing/source: {PTAB_EFILE_URL}",
        )

    def sections(
        self, case: CaseFile, evidence: EvidenceSummary, route: RouteResult
    ) -> tuple[PacketSection, ...]:
        return (
            PacketSection(
                "PTAB Filing Instructions",
                (
                    "Recommended venue: Illinois Property Tax Appeal Board.",
                    "PTAB is available only after a BOR decision for the same tax year.",
                    "This packet computes a PTAB deadline only from your BOR decision date.",
                    f"Official source: {self.official_url}",
                ),
            ),
            PacketSection("PTAB Checklist", self.checklist(case)),
            PacketSection(
                "PTAB Comparable Grid Public-Data Limits",
                (
                    "Public data may populate PIN, class, building sqft, year built, "
                    "neighborhood, coordinates, land sqft, style, and assessment metrics when "
                    "those fields are available.",
                    "Not available from public data - supply from your property record card: "
                    "property record cards or listing sheets for the subject and comparables.",
                    "Not available from public data - supply from your property record card: "
                    "verified condition, room-by-room details, photos, and any PTAB grid field "
                    "not shown in this packet.",
                    "Do not file the PTAB grid as complete unless you have supplied and checked "
                    "the missing property-record-card fields yourself.",
                ),
            ),
        )

from __future__ import annotations

from dataclasses import dataclass

from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult


@dataclass(frozen=True)
class PacketSection:
    title: str
    lines: tuple[str, ...]


class VenueAdapter:
    venue_key = ""
    venue_name = ""
    official_url = ""

    def checklist(self, case: CaseFile) -> tuple[str, ...]:
        raise NotImplementedError

    def sections(
        self, case: CaseFile, evidence: EvidenceSummary, route: RouteResult
    ) -> tuple[PacketSection, ...]:
        raise NotImplementedError

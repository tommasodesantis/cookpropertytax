from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal

Venue = Literal["auto", "assessor", "bor", "ptab"]
ResolvedVenue = Literal["assessor", "bor", "ptab", "closed"]
EvidenceTier = Literal["STRONG", "MODERATE", "LIMITED"]


@dataclass(frozen=True)
class Parcel:
    pin: str
    pin_formatted: str
    property_class: str
    township_name: str
    address: str
    city: str = ""
    zip_code: str = ""
    neighborhood: str | None = None
    township_code: str | None = None
    building_sqft: float | None = None
    land_sqft: float | None = None
    year_built: int | None = None
    beds: float | None = None
    full_baths: float | None = None
    lat: float | None = None
    lon: float | None = None
    current_av: float | None = None
    prior_final_av: float | None = None

    @property
    def is_condo(self) -> bool:
        return self.property_class.strip() in {"299", "399"}


@dataclass(frozen=True)
class Comparable:
    pin: str
    pin_formatted: str
    address: str
    building_sqft: float | None
    year_built: int | None
    av: float | None
    neighborhood: str | None = None
    lat: float | None = None
    lon: float | None = None


@dataclass(frozen=True)
class Sale:
    sale_date: date
    sale_price: float
    source: str = "recorded sale"


@dataclass(frozen=True)
class AssessmentHistoryRow:
    year: int
    mailed_av: float | None
    certified_av: float | None
    board_av: float | None
    final_av: float | None


@dataclass(frozen=True)
class UserEvidence:
    purchase_price: float | None = None
    purchase_date: date | None = None
    appraisal_value: float | None = None
    appraisal_date: date | None = None
    condition_issues: tuple[str, ...] = ()
    ownership_type: str = "individual"
    owner_occupied: bool | None = None
    age_65_plus: bool | None = None
    household_income_below_65k: bool | None = None
    veteran_disabled: bool | None = None
    person_disabled: bool | None = None
    vacancy_claim: bool = False
    demolition_claim: bool = False
    assessor_appeal_filed: bool = False
    actual_sqft: float | None = None


@dataclass(frozen=True)
class CaseFile:
    parcel: Parcel
    assessment_history: tuple[AssessmentHistoryRow, ...] = ()
    comparables: tuple[Comparable, ...] = ()
    subject_sales: tuple[Sale, ...] = ()
    user_evidence: UserEvidence = field(default_factory=UserEvidence)
    data_warnings: tuple[str, ...] = ()

    def with_user_evidence(self, user_evidence: UserEvidence) -> CaseFile:
        return CaseFile(
            parcel=self.parcel,
            assessment_history=self.assessment_history,
            comparables=self.comparables,
            subject_sales=self.subject_sales,
            user_evidence=user_evidence,
            data_warnings=self.data_warnings,
        )


@dataclass(frozen=True)
class ComparableExhibit:
    comparable: Comparable
    av_per_sqft: float
    distance_km: float | None
    similarity: float


@dataclass(frozen=True)
class ComparableAnalysis:
    status: Literal["ok", "condo", "insufficient_data"]
    note: str
    scope: str | None = None
    pool_size: int = 0
    subject_av_per_sqft: float | None = None
    median_av_per_sqft: float | None = None
    percentile: float | None = None
    gap_pct: float | None = None
    exhibit: tuple[ComparableExhibit, ...] = ()


@dataclass(frozen=True)
class EvidenceArgument:
    argument_type: str
    strength: Literal["strong", "supporting"]
    text: str
    target_av: float | None = None
    estimated_savings: float | None = None


@dataclass(frozen=True)
class SavingsAssumption:
    tax_rate: float
    state_equalizer: float
    low: float
    point: float
    high: float


@dataclass(frozen=True)
class EvidenceSummary:
    tier: EvidenceTier
    tier_message: str
    comparable_analysis: ComparableAnalysis
    arguments: tuple[EvidenceArgument, ...]
    implied_market_value: float | None
    savings_assumptions: SavingsAssumption
    disclaimers: tuple[str, ...]


@dataclass(frozen=True)
class RouteResult:
    venue: ResolvedVenue
    headline: str
    reasoning: tuple[str, ...]
    action_status: Literal["open", "upcoming", "closed", "urgent", "expired", "needs_input"]
    deadline: date | None = None
    days_remaining: int | None = None
    warnings: tuple[str, ...] = ()
    official_url: str | None = None


@dataclass(frozen=True)
class AddressCandidate:
    pin: str
    pin_formatted: str
    address: str
    township_name: str
    property_class: str


JsonDict = dict[str, Any]

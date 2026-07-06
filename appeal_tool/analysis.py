from __future__ import annotations

import math
from datetime import date
from statistics import median
from typing import Literal

from appeal_tool.config import ASSESSMENT_LEVEL, NOT_LEGAL_ADVICE, STATE_EQUALIZER
from appeal_tool.math_utils import estimated_savings_range, gap_pct, percentile_rank, safe_div
from appeal_tool.models import (
    CaseFile,
    Comparable,
    ComparableAnalysis,
    ComparableExhibit,
    EvidenceArgument,
    EvidenceSummary,
    EvidenceTier,
    SavingsAssumption,
)

Strength = Literal["strong", "supporting"]


def _distance_km(
    lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None
) -> float | None:
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    radius = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _similarity(subject: CaseFile, comp: Comparable) -> float:
    parcel = subject.parcel
    score = 0.0
    if parcel.building_sqft and comp.building_sqft:
        score += 0.5 * abs(comp.building_sqft - parcel.building_sqft) / parcel.building_sqft
    else:
        score += 0.5
    if parcel.year_built and comp.year_built:
        score += 0.3 * min(abs(comp.year_built - parcel.year_built) / 50.0, 1.0)
    else:
        score += 0.15
    distance = _distance_km(parcel.lat, parcel.lon, comp.lat, comp.lon)
    score += 0.2 * min((distance or 1.0) / 2.0, 1.0)
    return score


def analyze_comparables(case: CaseFile, max_comps: int = 10) -> ComparableAnalysis:
    parcel = case.parcel
    if parcel.is_condo:
        return ComparableAnalysis(
            status="condo",
            note=(
                "Condo parcel: public unit square-foot coverage is often incomplete. "
                "Use building-level equity, sale, appraisal, or factual-error evidence."
            ),
        )

    subject_psf = safe_div(parcel.current_av, parcel.building_sqft)
    if subject_psf is None or parcel.building_sqft is None or parcel.building_sqft <= 0:
        return ComparableAnalysis(
            status="insufficient_data",
            note="Missing subject building square footage or current assessed value.",
        )

    candidates = [
        comp
        for comp in case.comparables
        if comp.pin != parcel.pin
        and comp.av is not None
        and comp.av > 0
        and comp.building_sqft is not None
        and comp.building_sqft > 0
    ]
    selected: list[Comparable] = []
    scope = "township"
    for sqft_tol, year_tol in ((0.25, 15), (0.40, 25), (0.60, 40)):
        scoped = [
            comp
            for comp in candidates
            if comp.building_sqft is not None
            and parcel.building_sqft * (1 - sqft_tol)
            <= comp.building_sqft
            <= parcel.building_sqft * (1 + sqft_tol)
            and (
                parcel.year_built is None
                or comp.year_built is None
                or abs(comp.year_built - parcel.year_built) <= year_tol
            )
        ]
        neighborhood = [
            comp
            for comp in scoped
            if parcel.neighborhood is not None and comp.neighborhood == parcel.neighborhood
        ]
        if len(neighborhood) >= 15:
            selected = neighborhood
            scope = "neighborhood"
        else:
            selected = scoped
            scope = "township"
        if len(selected) >= 8:
            break

    if len(selected) < 3:
        return ComparableAnalysis(
            status="insufficient_data",
            note=f"Only {len(selected)} similar parcels found; too few for a reliable exhibit.",
            scope=scope,
            pool_size=len(selected),
        )

    av_psf_values = [
        comp.av / comp.building_sqft
        for comp in selected
        if comp.av is not None and comp.building_sqft is not None and comp.building_sqft > 0
    ]
    median_psf = median(av_psf_values)
    percentile = percentile_rank(subject_psf, av_psf_values)
    gap = gap_pct(subject_psf, av_psf_values)
    exhibits = []
    for comp in selected:
        comp_psf = safe_div(comp.av, comp.building_sqft)
        if comp_psf is None or comp_psf >= subject_psf:
            continue
        exhibits.append(
            ComparableExhibit(
                comparable=comp,
                av_per_sqft=comp_psf,
                distance_km=_distance_km(parcel.lat, parcel.lon, comp.lat, comp.lon),
                similarity=_similarity(case, comp),
            )
        )
    exhibits = sorted(exhibits, key=lambda item: item.similarity)[:max_comps]
    return ComparableAnalysis(
        status="ok",
        note="Comparable analysis completed from the shared case file.",
        scope=scope,
        pool_size=len(selected),
        subject_av_per_sqft=subject_psf,
        median_av_per_sqft=median_psf,
        percentile=percentile,
        gap_pct=gap,
        exhibit=tuple(exhibits),
    )


def assessment_shock_pct(case: CaseFile) -> float | None:
    current = case.parcel.current_av
    prior = case.parcel.prior_final_av
    if current is None or prior is None or prior <= 0:
        return None
    return 100.0 * (current - prior) / prior


def build_evidence_summary(
    case: CaseFile, tax_rate: float, lien_date: date | None = None
) -> EvidenceSummary:
    parcel = case.parcel
    comparable_analysis = analyze_comparables(case)
    implied_market = parcel.current_av / ASSESSMENT_LEVEL if parcel.current_av else None
    arguments: list[EvidenceArgument] = []
    tier_points = 0

    if comparable_analysis.status == "ok":
        percentile = comparable_analysis.percentile or 0.0
        gap = comparable_analysis.gap_pct or 0.0
        if percentile >= 75 and gap >= 10:
            strength: Strength = "strong"
            tier_points += 2
        elif percentile >= 60 or gap >= 5:
            strength = "supporting"
            tier_points += 1
        else:
            strength = "supporting"
        if gap > 0 and comparable_analysis.median_av_per_sqft and parcel.building_sqft:
            target_av = comparable_analysis.median_av_per_sqft * parcel.building_sqft
            _, point, _ = estimated_savings_range(
                (parcel.current_av or 0) - target_av, STATE_EQUALIZER, tax_rate
            )
            arguments.append(
                EvidenceArgument(
                    argument_type="uniformity",
                    strength=strength,
                    text=(
                        f"Your assessment per square foot is higher than {percentile:.0f}% "
                        f"of {comparable_analysis.pool_size} similar homes and {gap:.0f}% "
                        "above their median."
                    ),
                    target_av=target_av,
                    estimated_savings=point,
                )
            )

    evidence_value = None
    evidence_source = None
    if case.subject_sales:
        latest = sorted(case.subject_sales, key=lambda sale: sale.sale_date, reverse=True)[0]
        evidence_value = latest.sale_price
        evidence_source = f"recorded sale on {latest.sale_date.isoformat()}"
    if case.user_evidence.purchase_price:
        evidence_value = case.user_evidence.purchase_price
        when = (
            case.user_evidence.purchase_date.isoformat()
            if case.user_evidence.purchase_date
            else "date n/a"
        )
        evidence_source = f"reported purchase on {when}"
    if case.user_evidence.appraisal_value:
        evidence_value = case.user_evidence.appraisal_value
        when = (
            case.user_evidence.appraisal_date.isoformat()
            if case.user_evidence.appraisal_date
            else "date n/a"
        )
        evidence_source = f"reported appraisal on {when}"

    if evidence_value and implied_market and evidence_value > 0 and evidence_value < implied_market:
        over = 100.0 * (implied_market - evidence_value) / evidence_value
        tier_points += 2 if over >= 10 else 1
        target_av = evidence_value * ASSESSMENT_LEVEL
        _, point, _ = estimated_savings_range(
            (parcel.current_av or 0) - target_av, STATE_EQUALIZER, tax_rate
        )
        arguments.append(
            EvidenceArgument(
                argument_type="overvaluation",
                strength="strong" if over >= 10 else "supporting",
                text=(
                    f"The implied market value is {over:.0f}% above the {evidence_source} "
                    f"of ${evidence_value:,.0f}."
                ),
                target_av=target_av,
                estimated_savings=point,
            )
        )

    if case.user_evidence.actual_sqft and parcel.building_sqft:
        sqft_delta = parcel.building_sqft - case.user_evidence.actual_sqft
        if abs(sqft_delta) / parcel.building_sqft >= 0.05:
            tier_points += 2
            arguments.append(
                EvidenceArgument(
                    argument_type="property_description",
                    strength="strong",
                    text=(
                        f"The Assessor record shows {parcel.building_sqft:,.0f} sqft, "
                        f"but you reported {case.user_evidence.actual_sqft:,.0f} sqft. "
                        "A documented factual correction is strongest at the Assessor level."
                    ),
                )
            )

    shock = assessment_shock_pct(case)
    if shock is not None and shock >= 15:
        tier_points += 1
        arguments.append(
            EvidenceArgument(
                argument_type="assessment_shock",
                strength="supporting",
                text=f"Current assessed value increased {shock:.0f}% from the prior final value.",
            )
        )

    if case.user_evidence.condition_issues:
        arguments.append(
            EvidenceArgument(
                argument_type="condition",
                strength="supporting",
                text=(
                    "Reported condition issues: "
                    + "; ".join(case.user_evidence.condition_issues)
                    + ". Attach dated photos and repair estimates."
                ),
            )
        )

    if tier_points >= 3:
        tier: EvidenceTier = "STRONG"
        tier_message = "Multiple independent grounds support spending time on an appeal."
    elif tier_points >= 1:
        tier = "MODERATE"
        tier_message = "At least one credible ground supports an appeal."
    else:
        tier = "LIMITED"
        tier_message = (
            "Public data alone is limited. Appealing is free, but add sale, appraisal, "
            "condition, or factual-error evidence before investing significant time."
        )

    all_savings = [
        argument.estimated_savings for argument in arguments if argument.estimated_savings
    ]
    point_savings = max(all_savings) if all_savings else 0.0
    return EvidenceSummary(
        tier=tier,
        tier_message=tier_message,
        comparable_analysis=comparable_analysis,
        arguments=tuple(arguments),
        implied_market_value=implied_market,
        savings_assumptions=SavingsAssumption(
            tax_rate=tax_rate,
            state_equalizer=STATE_EQUALIZER,
            low=point_savings * 0.8,
            point=point_savings,
            high=point_savings * 1.2,
        ),
        disclaimers=(
            NOT_LEGAL_ADVICE,
            "Estimated savings are rough ranges, not promises. Taxes must still be paid on time.",
        ),
    )

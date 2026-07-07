from __future__ import annotations

import json
from pathlib import Path

from appeal_tool.formatting import parcel_address
from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult


def _money(value: float | None) -> str:
    return "not available" if value is None else f"${value:,.0f}"


def _subject_sqft(case: CaseFile) -> str:
    if case.parcel.building_sqft:
        return f"{case.parcel.building_sqft:,.0f}"
    if case.user_evidence.actual_sqft:
        return f"{case.user_evidence.actual_sqft:,.0f} (user-supplied; document required)"
    return "missing"


def _subject_total_av(case: CaseFile) -> str:
    if case.parcel.current_av:
        return _money(case.parcel.current_av)
    if case.user_evidence.actual_av:
        return f"{_money(case.user_evidence.actual_av)} (user-supplied; document required)"
    return _money(None)


def _subject_improvement_av(case: CaseFile) -> str | None:
    if case.parcel.current_improvement_av:
        return _money(case.parcel.current_improvement_av)
    if case.user_evidence.actual_improvement_av:
        return (
            f"{_money(case.user_evidence.actual_improvement_av)} (user-supplied; document required)"
        )
    return None


def _comparable_metric_value(
    profile_key: str, comp_av: float | None, improvement_av: float | None
) -> float | None:
    if profile_key in {"bor", "ptab"}:
        return improvement_av
    return comp_av


def console_report(
    case: CaseFile, evidence: EvidenceSummary, route: RouteResult, pdf_path: Path | None
) -> str:
    lines = [
        "Cook County Property Tax Appeal Assistant",
        "",
        "ROUTING DECISION",
        route.headline,
    ]
    for reason in route.reasoning:
        lines.append(f"- {reason}")
    if route.deadline:
        lines.append(f"Deadline: {route.deadline.isoformat()}")
    if route.days_remaining is not None:
        lines.append(f"Days remaining: {route.days_remaining}")
    for warning in route.warnings:
        lines.append(f"WARNING: {warning}")
    for warning in case.data_warnings:
        lines.append(f"DATA WARNING: {warning}")

    parcel = case.parcel
    subject_lines = [
        "",
        "SUBJECT",
        f"PIN: {parcel.pin_formatted}",
        f"Address: {parcel_address(parcel)}",
        f"Class / township: {parcel.property_class} / {parcel.township_name}",
        f"Building sqft: {_subject_sqft(case)}",
        f"Current assessed value: {_subject_total_av(case)}",
    ]
    if improvement_av := _subject_improvement_av(case):
        subject_lines.append(f"Building / improvement assessed value: {improvement_av}")
    subject_lines.extend(
        [
            "",
            "EVIDENCE",
            f"Tier: {evidence.tier}",
            evidence.tier_message,
            (
                "Comparable profile: "
                f"{evidence.comparable_analysis.profile_label} "
                f"({evidence.comparable_analysis.metric_label})"
            ),
            f"Comparable status: {evidence.comparable_analysis.status}",
            f"Comparable note: {evidence.comparable_analysis.note}",
        ]
    )
    lines.extend(subject_lines)
    for warning in evidence.comparable_analysis.warnings:
        lines.append(f"COMPARABLE WARNING: {warning}")
    if evidence.arguments:
        lines.append("Arguments:")
        for argument in evidence.arguments:
            lines.append(f"- {argument.argument_type}: {argument.text}")
    else:
        lines.append("Arguments: no strong public-data argument found.")
    savings = evidence.savings_assumptions
    lines.extend(
        [
            "",
            "ESTIMATED SAVINGS",
            (
                f"Range: {_money(savings.low)} - {_money(savings.high)} "
                f"(point estimate {_money(savings.point)})"
            ),
            (
                f"Assumptions: state equalizer {savings.state_equalizer}, "
                f"tax rate {savings.tax_rate:.2%}."
            ),
            "",
            "NEXT STEPS",
            "1. Verify the deadline at the official venue source before filing.",
            "2. Attach proof for any sale, appraisal, condition, or factual-error claim.",
            "3. Check exemptions and Certificate of Error options.",
            "4. Keep copies of all filings and notices.",
        ]
    )
    if pdf_path:
        lines.append(f"PDF packet: {pdf_path}")
    return "\n".join(lines)


def json_summary(
    case: CaseFile, evidence: EvidenceSummary, route: RouteResult, pdf_path: Path | None
) -> str:
    comps = evidence.comparable_analysis
    payload = {
        "pin": case.parcel.pin_formatted,
        "venue": route.venue,
        "routing_headline": route.headline,
        "deadline": route.deadline.isoformat() if route.deadline else None,
        "days_remaining": route.days_remaining,
        "evidence_tier": evidence.tier,
        "comparable_profile": comps.profile_key,
        "comparable_status": comps.status,
        "comparable_note": comps.note,
        "comparable_missing_data_rate": comps.missing_data_rate,
        "comparable_warnings": list(comps.warnings),
        "comparable_analysis": {
            "profile": comps.profile_key,
            "profile_label": comps.profile_label,
            "metric_label": comps.metric_label,
            "status": comps.status,
            "scope": comps.scope,
            "pool_size": comps.pool_size,
            "subject_metric_per_sqft": comps.subject_av_per_sqft,
            "median_metric_per_sqft": comps.median_av_per_sqft,
            "exhibits": [
                {
                    "pin": exhibit.comparable.pin_formatted,
                    "address": exhibit.comparable.address,
                    "neighborhood": exhibit.comparable.neighborhood,
                    "lat": exhibit.comparable.lat,
                    "lon": exhibit.comparable.lon,
                    "building_sqft": exhibit.comparable.building_sqft,
                    "metric_value": _comparable_metric_value(
                        comps.profile_key,
                        exhibit.comparable.av,
                        exhibit.comparable.improvement_av,
                    ),
                    "metric_per_sqft": exhibit.av_per_sqft,
                    "distance_km": exhibit.distance_km,
                }
                for exhibit in comps.exhibit
            ],
        },
        "estimated_savings_point": evidence.savings_assumptions.point,
        "warnings": (
            list(route.warnings)
            + list(case.data_warnings)
            + list(evidence.comparable_analysis.warnings)
        ),
        "pdf_path": str(pdf_path) if pdf_path else None,
    }
    return json.dumps(payload, indent=2, sort_keys=True)

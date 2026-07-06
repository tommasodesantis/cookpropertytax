from __future__ import annotations

import json
from pathlib import Path

from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult


def _money(value: float | None) -> str:
    return "not available" if value is None else f"${value:,.0f}"


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

    parcel = case.parcel
    lines.extend(
        [
            "",
            "SUBJECT",
            f"PIN: {parcel.pin_formatted}",
            f"Address: {parcel.address}, {parcel.city} {parcel.zip_code}".strip(),
            f"Class / township: {parcel.property_class} / {parcel.township_name}",
            f"Building sqft: {parcel.building_sqft:,.0f}"
            if parcel.building_sqft
            else "Building sqft: missing",
            f"Current assessed value: {_money(parcel.current_av)}",
            "",
            "EVIDENCE",
            f"Tier: {evidence.tier}",
            evidence.tier_message,
        ]
    )
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
    payload = {
        "pin": case.parcel.pin_formatted,
        "venue": route.venue,
        "routing_headline": route.headline,
        "deadline": route.deadline.isoformat() if route.deadline else None,
        "days_remaining": route.days_remaining,
        "evidence_tier": evidence.tier,
        "estimated_savings_point": evidence.savings_assumptions.point,
        "warnings": list(route.warnings) + list(case.data_warnings),
        "pdf_path": str(pdf_path) if pdf_path else None,
    }
    return json.dumps(payload, indent=2, sort_keys=True)

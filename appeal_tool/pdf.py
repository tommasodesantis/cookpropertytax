from __future__ import annotations

# ruff: noqa: E402,I001

import warnings
from pathlib import Path

warnings.filterwarnings(
    "ignore",
    message="You have both PyFPDF & fpdf2 installed.*",
    category=UserWarning,
)

from fpdf import FPDF

from appeal_tool.config import ASSESSMENT_LEVEL, NOT_LEGAL_ADVICE
from appeal_tool.models import CaseFile, EvidenceSummary, RouteResult
from appeal_tool.venues.assessor import AssessorAdapter
from appeal_tool.venues.base import VenueAdapter
from appeal_tool.venues.bor import BoardOfReviewAdapter
from appeal_tool.venues.ptab import PtabAdapter


def _clean(value: object) -> str:
    if value is None:
        return "Not available"
    text = str(value)
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for before, after in replacements.items():
        text = text.replace(before, after)
    return text.encode("latin-1", "replace").decode("latin-1")


def money(value: float | None) -> str:
    return "Not available" if value is None else f"${value:,.0f}"


class PacketPdf(FPDF):  # type: ignore[misc]
    def __init__(self, title: str) -> None:
        super().__init__()
        self.title = title
        self.set_auto_page_break(auto=True, margin=15)

    def header(self) -> None:
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 6, _clean(self.title), 0, 1, "C")
        self.ln(1)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Helvetica", "I", 7)
        self.cell(0, 5, _clean("NOT LEGAL ADVICE. Pro se individual filer packet."), 0, 0, "L")
        self.cell(0, 5, f"Page {self.page_no()}", 0, 0, "R")

    def h1(self, title: str) -> None:
        self.set_font("Helvetica", "B", 13)
        self.set_fill_color(230, 230, 230)
        self.cell(0, 8, _clean(title), 0, 1, "L", True)
        self.ln(2)

    def para(self, text: str, size: int = 10, style: str = "") -> None:
        self.set_font("Helvetica", style, size)
        self.multi_cell(0, 5, _clean(text))
        self.ln(1)

    def kv(self, key: str, value: object) -> None:
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 5, _clean(key), 0, 1)
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 5, _clean(value))
        self.ln(1)


def adapter_for(route: RouteResult) -> VenueAdapter:
    if route.venue == "assessor":
        return AssessorAdapter()
    if route.venue == "ptab":
        return PtabAdapter()
    return BoardOfReviewAdapter()


def write_packet(
    case: CaseFile, evidence: EvidenceSummary, route: RouteResult, output_dir: Path
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    adapter = adapter_for(route)
    path = output_dir / f"packet_{adapter.venue_key}_{case.parcel.pin}.pdf"
    pdf = PacketPdf(f"{adapter.venue_name} - PIN {case.parcel.pin_formatted}")
    pdf.add_page()

    pdf.h1("Executive Summary")
    pdf.para(route.headline, style="B")
    for reason in route.reasoning:
        pdf.para(f"- {reason}")
    if route.deadline:
        pdf.kv("Deadline", route.deadline.isoformat())
    if route.days_remaining is not None:
        pdf.kv("Days remaining", route.days_remaining)
    for warning in route.warnings:
        pdf.para(f"Warning: {warning}", size=9, style="B")
    pdf.para(NOT_LEGAL_ADVICE, size=9, style="B")

    pdf.h1("Subject Property")
    parcel = case.parcel
    pdf.kv("PIN", parcel.pin_formatted)
    pdf.kv("Address", f"{parcel.address}, {parcel.city} {parcel.zip_code}".strip())
    pdf.kv("Class / Township", f"{parcel.property_class} / {parcel.township_name}")
    pdf.kv("Building sqft", f"{parcel.building_sqft:,.0f}" if parcel.building_sqft else "Missing")
    pdf.kv("Current assessed value", money(parcel.current_av))
    if parcel.current_av:
        pdf.kv("Implied market value", money(parcel.current_av / ASSESSMENT_LEVEL))

    pdf.h1("Evidence Tier")
    pdf.para(f"{evidence.tier}: {evidence.tier_message}", style="B")
    pdf.kv(
        "Estimated savings range",
        (
            f"{money(evidence.savings_assumptions.low)} - "
            f"{money(evidence.savings_assumptions.high)} "
            f"(point estimate {money(evidence.savings_assumptions.point)})"
        ),
    )
    pdf.para(
        f"Assumptions: equalizer {evidence.savings_assumptions.state_equalizer}, "
        f"tax rate {evidence.savings_assumptions.tax_rate:.2%}."
    )
    if evidence.arguments:
        for argument in evidence.arguments:
            pdf.para(f"- {argument.argument_type}: {argument.text}")
    else:
        pdf.para("No strong public-data argument was found. Add owner evidence if available.")

    pdf.h1("Comparable Assessments")
    comps = evidence.comparable_analysis
    pdf.para(comps.note)
    if comps.status == "ok":
        pdf.para(
            f"Subject AV/sqft ${comps.subject_av_per_sqft:,.2f}; "
            f"median ${comps.median_av_per_sqft:,.2f}; percentile {comps.percentile:.0f}; "
            f"gap {comps.gap_pct:.0f}%."
        )
        pdf.set_font("Helvetica", "B", 7)
        widths = [35, 62, 18, 20, 20, 16]
        for label, width in zip(
            ("PIN", "Address", "Sqft", "AV", "AV/sf", "km"), widths, strict=True
        ):
            pdf.cell(width, 5, label, 1)
        pdf.ln()
        pdf.set_font("Helvetica", "", 7)
        for exhibit in comps.exhibit:
            comp = exhibit.comparable
            row = [
                comp.pin_formatted,
                comp.address[:36],
                f"{comp.building_sqft:,.0f}" if comp.building_sqft else "Missing",
                money(comp.av),
                f"${exhibit.av_per_sqft:,.2f}",
                "n/a" if exhibit.distance_km is None else f"{exhibit.distance_km:.2f}",
            ]
            for value, width in zip(row, widths, strict=True):
                pdf.cell(width, 5, _clean(value), 1)
            pdf.ln()

    pdf.add_page()
    for section in adapter.sections(case, evidence, route):
        pdf.h1(section.title)
        for line in section.lines:
            pdf.para(f"- {line}")

    pdf.h1("Exemptions and Certificate of Error Screen")
    pdf.para(
        "Check Homeowner, Senior, Senior Freeze, Disability, Veterans, and other exemptions. "
        "Missed past-year exemptions or factual errors may be recoverable through "
        "Certificate of Error."
    )
    pdf.para("Verify exemptions at the Cook County Assessor official source.")

    pdf.output(str(path))
    return path

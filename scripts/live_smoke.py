from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import fitz
import requests
from PIL import Image, ImageDraw
from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from appeal_tool.config import ASSESSMENT_YEAR  # noqa: E402
from appeal_tool.repository import DATASETS, SOCRATA_DOMAIN  # noqa: E402


@dataclass(frozen=True)
class SampleSpec:
    label: str
    township: str
    property_class: str


@dataclass(frozen=True)
class SelectedParcel:
    spec: SampleSpec
    pin: str


@dataclass(frozen=True)
class PdfCheck:
    ok: bool
    page_count: int
    rendered_page: Path | None
    issues: tuple[str, ...]


@dataclass(frozen=True)
class SmokeResult:
    selected: SelectedParcel
    returncode: int
    venue: str
    evidence_tier: str
    routing_headline: str
    pdf_path: Path | None
    pdf_check: PdfCheck | None
    warnings: tuple[str, ...]
    stdout_tail: str
    stderr_tail: str


SAMPLE_SPECS = (
    SampleSpec("north suburban single-family", "Barrington", "203"),
    SampleSpec("north suburban condo", "Niles", "299"),
    SampleSpec("northwest suburban single-family", "Wheeling", "203"),
    SampleSpec("west suburban single-family", "Oak Park", "203"),
    SampleSpec("west suburban multi-family", "Proviso", "211"),
    SampleSpec("city north condo", "Rogers Park", "299"),
    SampleSpec("city north multi-family", "Lake View", "211"),
    SampleSpec("city south single-family", "Hyde Park", "203"),
    SampleSpec("south suburban single-family", "Thornton", "203"),
    SampleSpec("south city condo", "South Chicago", "299"),
)

REQUIRED_PDF_SECTIONS = (
    "Executive Summary",
    "Subject Property",
    "Evidence Tier",
    "Comparable Assessments",
    "Exemptions and Certificate of Error Screen",
    "NOT LEGAL ADVICE",
)

BANNED_TEXT = ("PLACEHOLDER", "None", "nan", "\ufffd", "â€")


def _tail(text: str, max_chars: int = 500) -> str:
    return text[-max_chars:].strip()


def _query_one(session: requests.Session, spec: SampleSpec, timeout: int) -> SelectedParcel:
    dataset = DATASETS["parcel_universe"]
    url = f"{SOCRATA_DOMAIN}/{dataset}.json"
    headers = {}
    params = {
        "$limit": "1",
        "$select": "pin,class,township_name,year",
        "$where": (
            f"year='{ASSESSMENT_YEAR}' AND township_name='{spec.township}' "
            f"AND class='{spec.property_class}'"
        ),
    }
    response = session.get(url, params=params, headers=headers, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list) or not payload:
        raise RuntimeError(
            f"No {ASSESSMENT_YEAR} class {spec.property_class} parcel found in {spec.township}."
        )
    row = payload[0]
    if not isinstance(row, dict) or not row.get("pin"):
        raise RuntimeError(f"Unexpected parcel selection payload for {spec}.")
    return SelectedParcel(spec=spec, pin=str(row["pin"]))


def _extract_json(stdout: str) -> dict[str, Any]:
    start = stdout.find("{")
    end = stdout.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError("CLI did not emit a JSON summary.")
    payload = json.loads(stdout[start : end + 1])
    if not isinstance(payload, dict):
        raise RuntimeError("CLI JSON summary was not an object.")
    return payload


def _bbox_area(bbox: tuple[float, float, float, float]) -> float:
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])


def _intersection_area(
    left: tuple[float, float, float, float], right: tuple[float, float, float, float]
) -> float:
    x0 = max(left[0], right[0])
    y0 = max(left[1], right[1])
    x1 = min(left[2], right[2])
    y1 = min(left[3], right[3])
    return _bbox_area((x0, y0, x1, y1))


def _find_layout_issues(doc: fitz.Document) -> list[str]:
    issues: list[str] = []
    for page_index, page in enumerate(doc, start=1):
        rect = page.rect
        blocks = []
        for block in page.get_text("blocks"):
            x0, y0, x1, y1, text, *_ = block
            if not str(text).strip():
                continue
            bbox = (float(x0), float(y0), float(x1), float(y1))
            if x0 < -2 or y0 < -2 or x1 > rect.width + 2 or y1 > rect.height + 2:
                issues.append(f"page {page_index}: text outside page bounds")
            if _bbox_area(bbox) > 20:
                blocks.append(bbox)
        for left_index, left in enumerate(blocks):
            for right in blocks[left_index + 1 :]:
                overlap = _intersection_area(left, right)
                if overlap <= 1:
                    continue
                smaller = min(_bbox_area(left), _bbox_area(right))
                if smaller > 0 and overlap / smaller > 0.35:
                    issues.append(f"page {page_index}: possible overlapping text blocks")
                    break
    return issues


def _inspect_pdf(path: Path, render_dir: Path) -> PdfCheck:
    issues: list[str] = []
    reader = PdfReader(path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    for required in REQUIRED_PDF_SECTIONS:
        if required not in text:
            issues.append(f"missing section: {required}")
    for banned in BANNED_TEXT:
        if banned.lower() in text.lower():
            issues.append(f"banned text found: {banned}")

    doc = fitz.open(path)
    try:
        issues.extend(_find_layout_issues(doc))
        rendered_page = render_dir / f"{path.stem}_page1.png"
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(0.75, 0.75), alpha=False)
        pix.save(rendered_page)
    finally:
        doc.close()
    return PdfCheck(
        ok=not issues,
        page_count=len(reader.pages),
        rendered_page=rendered_page,
        issues=tuple(issues),
    )


def _run_cli(
    pin: str, today: str, output_dir: Path, timeout: int
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "appeal_tool.py",
            "--pin",
            pin,
            "--today",
            today,
            "--output-dir",
            str(output_dir),
            "--json",
        ],
        text=True,
        capture_output=True,
        check=False,
        timeout=timeout,
    )


def _make_contact_sheet(images: list[Path], output_path: Path) -> Path | None:
    if not images:
        return None
    thumbnails: list[Image.Image] = []
    for image_path in images:
        image = Image.open(image_path).convert("RGB")
        image.thumbnail((260, 340))
        tile = Image.new("RGB", (280, 380), "white")
        tile.paste(image, ((280 - image.width) // 2, 10))
        draw = ImageDraw.Draw(tile)
        draw.text((10, 352), image_path.stem.replace("_page1", ""), fill="black")
        thumbnails.append(tile)
    cols = 2
    rows = (len(thumbnails) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 280, rows * 380), "white")
    for index, tile in enumerate(thumbnails):
        sheet.paste(tile, ((index % cols) * 280, (index // cols) * 380))
    sheet.save(output_path)
    return output_path


def _write_report(
    path: Path,
    today: str,
    results: list[SmokeResult],
    contact_sheet: Path | None,
    selection_errors: list[str],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Live Smoke Test - 10 Cook County Properties",
        "",
        f"- Run date: {date.today().isoformat()}",
        f"- CLI routing date: {today}",
        f"- Configured assessment year: {ASSESSMENT_YEAR}",
        "- Data source: Cook County Socrata parcel universe plus live CLI data loads",
        "- PDF checks: pypdf extraction, PyMuPDF open/render, required-section checks, "
        "banned-text checks, page-bounds and coarse text-overlap checks",
        "",
        "## Result Summary",
        "",
        "| # | Sample | Township | Class | PIN | CLI | Venue | Tier | PDF | Notes |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for index, result in enumerate(results, start=1):
        pdf_state = "n/a"
        if result.pdf_check:
            pdf_state = "ok" if result.pdf_check.ok else "issues"
        notes = []
        if result.warnings:
            notes.append(f"{len(result.warnings)} warning(s)")
        if result.pdf_check and result.pdf_check.issues:
            notes.extend(result.pdf_check.issues)
        if result.returncode != 0:
            notes.append(_tail(result.stdout_tail or result.stderr_tail, 120).replace("|", "/"))
        note_text = "; ".join(notes) if notes else "no issues detected"
        spec = result.selected.spec
        lines.append(
            "| "
            f"{index} | {spec.label} | {spec.township} | {spec.property_class} | "
            f"{result.selected.pin} | {result.returncode} | {result.venue} | "
            f"{result.evidence_tier} | {pdf_state} | {note_text} |"
        )

    lines.extend(["", "## Routing Headlines", ""])
    for result in results:
        lines.append(f"- {result.selected.pin}: {result.routing_headline}")

    if selection_errors:
        lines.extend(["", "## Selection Errors", ""])
        for error in selection_errors:
            lines.append(f"- {error}")

    lines.extend(
        [
            "",
            "## PDF Rendering Notes",
            "",
            "- Each generated PDF opened with PyMuPDF and pypdf.",
            "- First pages rendered to PNG for manual review.",
            "- No text block was allowed outside the page bounds.",
            "- Coarse overlap detection flagged any materially overlapping text blocks.",
        ]
    )
    if contact_sheet:
        lines.append(f"- Manual first-page contact sheet: `{contact_sheet}`")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir)
    render_dir = output_dir / "rendered"
    output_dir.mkdir(parents=True, exist_ok=True)
    render_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    results: list[SmokeResult] = []
    selection_errors: list[str] = []
    rendered_pages: list[Path] = []

    for spec in SAMPLE_SPECS:
        try:
            selected = _query_one(session, spec, args.selection_timeout)
        except Exception as exc:  # noqa: BLE001
            selection_errors.append(
                f"{spec.label} / {spec.township} / {spec.property_class}: {exc}"
            )
            continue

        completed = _run_cli(selected.pin, args.today, output_dir, args.cli_timeout)
        venue = "unknown"
        tier = "unknown"
        headline = "CLI JSON unavailable"
        pdf_path: Path | None = None
        warnings: tuple[str, ...] = ()
        pdf_check: PdfCheck | None = None
        if completed.returncode == 0:
            try:
                payload = _extract_json(completed.stdout)
                venue = str(payload.get("venue") or "unknown")
                tier = str(payload.get("evidence_tier") or "unknown")
                headline = str(payload.get("routing_headline") or "")
                warnings = tuple(str(item) for item in payload.get("warnings", []))
                raw_pdf_path = payload.get("pdf_path")
                if raw_pdf_path:
                    pdf_path = Path(str(raw_pdf_path))
                    pdf_check = _inspect_pdf(pdf_path, render_dir)
                    if pdf_check.rendered_page:
                        rendered_pages.append(pdf_check.rendered_page)
            except Exception as exc:  # noqa: BLE001
                warnings = (f"Smoke harness could not parse or inspect CLI output: {exc}",)

        results.append(
            SmokeResult(
                selected=selected,
                returncode=completed.returncode,
                venue=venue,
                evidence_tier=tier,
                routing_headline=headline,
                pdf_path=pdf_path,
                pdf_check=pdf_check,
                warnings=warnings,
                stdout_tail=_tail(completed.stdout),
                stderr_tail=_tail(completed.stderr),
            )
        )

    contact_sheet = _make_contact_sheet(rendered_pages, output_dir / "pdf_contact_sheet.png")
    _write_report(Path(args.report), args.today, results, contact_sheet, selection_errors)

    failures = [
        result
        for result in results
        if result.returncode != 0 or result.pdf_check is None or not result.pdf_check.ok
    ]
    if selection_errors or len(results) != len(SAMPLE_SPECS) or failures:
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run 10-property live CLI/PDF smoke validation.")
    parser.add_argument("--today", default=date.today().isoformat())
    parser.add_argument("--output-dir", default="tmp/live_smoke")
    parser.add_argument("--report", default="reports/live_smoke_2026-07-06.md")
    parser.add_argument("--selection-timeout", type=int, default=30)
    parser.add_argument("--cli-timeout", type=int, default=240)
    parser.add_argument("--keep-artifacts", action="store_true")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    try:
        return run(args)
    finally:
        if not args.keep_artifacts and output_dir.exists():
            shutil.rmtree(output_dir)


if __name__ == "__main__":
    raise SystemExit(main())

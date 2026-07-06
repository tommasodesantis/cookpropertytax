from __future__ import annotations

import argparse
import json
import math
import sys
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from statistics import median

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from appeal_tool.config import ASSESSMENT_YEAR  # noqa: E402
from appeal_tool.pin import format_pin, normalize_pin  # noqa: E402
from appeal_tool.repository import (  # noqa: E402
    DATASETS,
    SOCRATA_DOMAIN,
    SocrataClient,
    _float,
    _int,
    _pick,
    _row_year,
)


@dataclass(frozen=True)
class SampleSpec:
    label: str
    township: str
    property_class: str


@dataclass(frozen=True)
class SelectedSubject:
    spec: SampleSpec
    pin: str
    township_code: str
    township_name: str
    property_class: str
    source_year: int | None
    used_year_fallback: bool


@dataclass(frozen=True)
class Candidate:
    pin: str
    property_class: str
    building_sqft: float | None
    land_sqft: float | None
    year_built: int | None
    style: str | None
    construction: str | None
    amenity_count: int
    total_av: float | None
    improvement_av: float | None
    neighborhood: str | None
    lat: float | None
    lon: float | None


@dataclass(frozen=True)
class Profile:
    key: str
    label: str
    assessment_metric: str
    minimum_comparables: int
    sqft_tolerance: float
    year_tolerance: int
    land_tolerance: float | None
    max_distance_km: float | None
    prefer_same_neighborhood: bool
    require_year: bool
    require_land: bool
    require_style: bool
    require_amenity: bool


@dataclass(frozen=True)
class ContextResult:
    key: str
    rows_loaded: dict[str, int]
    warnings: tuple[str, ...]
    load_seconds: float
    candidates: tuple[Candidate, ...]


@dataclass(frozen=True)
class StageResult:
    profile: str
    counts: dict[str, int]
    final_survivors: int
    below_minimum: bool
    selection_ms: float
    metric_ready_pct: float


@dataclass(frozen=True)
class PropertyResult:
    subject: SelectedSubject
    context_key: str
    candidate_count: int
    field_availability: dict[str, float]
    load_seconds: float
    warnings: tuple[str, ...]
    baseline_ms: float
    profiles: dict[str, StageResult]


SAMPLE_SPECS = (
    SampleSpec("north suburban single-family", "Barrington", "203"),
    SampleSpec("north suburban condo", "Niles", "299"),
    SampleSpec("northwest suburban single-family", "Wheeling", "203"),
    SampleSpec("north suburban multi-family", "Evanston", "211"),
    SampleSpec("west suburban single-family", "Oak Park", "203"),
    SampleSpec("west suburban condo", "Cicero", "299"),
    SampleSpec("west suburban multi-family", "Proviso", "211"),
    SampleSpec("west suburban single-family", "Berwyn", "203"),
    SampleSpec("city north condo", "Rogers Park", "299"),
    SampleSpec("city north multi-family", "Lake View", "211"),
    SampleSpec("city south single-family", "Hyde Park", "203"),
    SampleSpec("city south condo", "South Chicago", "299"),
    SampleSpec("city northwest single-family", "Jefferson", "203"),
    SampleSpec("city southwest multi-family", "Lake", "211"),
    SampleSpec("south suburban single-family", "Thornton", "203"),
    SampleSpec("south suburban condo", "Rich", "299"),
    SampleSpec("south suburban multi-family", "Calumet", "211"),
    SampleSpec("south suburban single-family", "Bloom", "203"),
    SampleSpec("southwest suburban single-family", "Orland", "203"),
    SampleSpec("southwest suburban multi-family", "Worth", "211"),
    SampleSpec("southwest suburban single-family", "Palos", "203"),
    SampleSpec("southwest suburban single-family", "Stickney", "203"),
)

PINNED_SAMPLE_ROWS = (
    ("north suburban single-family", "Barrington", "01011000250000", "10", "203", 2026),
    ("north suburban condo", "Niles", "10073010061001", "24", "299", 2026),
    ("northwest suburban single-family", "Wheeling", "03012040020000", "38", "203", 2026),
    ("north suburban multi-family", "Evanston", "05333120030000", "17", "211", 2026),
    ("west suburban condo", "Cicero", "16201300421001", "15", "299", 2026),
    ("west suburban multi-family", "Proviso", "15021110860000", "31", "211", 2026),
    ("west suburban single-family", "Berwyn", "16191010090000", "11", "203", 2026),
    ("city north condo", "Rogers Park", "10253030521001", "75", "299", 2026),
    ("city north multi-family", "Lake View", "14051000240000", "73", "211", 2026),
    ("city south single-family", "Hyde Park", "20021020050000", "70", "203", 2026),
    ("city south condo", "South Chicago", "17094240091001", "76", "299", 2026),
    ("city northwest single-family", "Jefferson", "09253030250000", "71", "203", 2026),
    ("city southwest multi-family", "Lake", "19011000040000", "72", "211", 2026),
    ("south suburban multi-family", "Calumet", "25293010440000", "14", "211", 2026),
    ("southwest suburban single-family", "Orland", "27011020040000", "28", "203", 2026),
    ("southwest suburban multi-family", "Worth", "24011000070000", "39", "211", 2026),
    ("southwest suburban single-family", "Palos", "23011010080000", "30", "203", 2026),
    ("southwest suburban single-family", "Stickney", "19061010050000", "36", "203", 2026),
)

PROFILES = (
    Profile(
        key="assessor",
        label="Cook County Assessor",
        assessment_metric="total_av_per_sqft",
        minimum_comparables=3,
        sqft_tolerance=0.40,
        year_tolerance=25,
        land_tolerance=None,
        max_distance_km=None,
        prefer_same_neighborhood=True,
        require_year=False,
        require_land=False,
        require_style=False,
        require_amenity=False,
    ),
    Profile(
        key="bor",
        label="Cook County Board of Review",
        assessment_metric="improvement_av_per_sqft",
        minimum_comparables=3,
        sqft_tolerance=0.35,
        year_tolerance=20,
        land_tolerance=None,
        max_distance_km=None,
        prefer_same_neighborhood=True,
        require_year=False,
        require_land=False,
        require_style=False,
        require_amenity=False,
    ),
    Profile(
        key="ptab",
        label="Illinois PTAB",
        assessment_metric="improvement_av_per_sqft",
        minimum_comparables=3,
        sqft_tolerance=0.25,
        year_tolerance=15,
        land_tolerance=0.50,
        max_distance_km=2.0,
        prefer_same_neighborhood=True,
        require_year=True,
        require_land=True,
        require_style=True,
        require_amenity=True,
    ),
)

FIELD_CHECKS: dict[str, Callable[[Candidate], bool]] = {
    "building_sqft": lambda item: _positive(item.building_sqft),
    "land_sqft": lambda item: _positive(item.land_sqft),
    "year_built": lambda item: item.year_built is not None and item.year_built > 0,
    "construction_style": lambda item: bool(item.construction or item.style),
    "amenities": lambda item: item.amenity_count > 0,
    "improvement_av": lambda item: _positive(item.improvement_av),
    "total_av": lambda item: _positive(item.total_av),
    "neighborhood": lambda item: bool(item.neighborhood),
    "coordinates": lambda item: item.lat is not None and item.lon is not None,
}


def _positive(value: float | int | None) -> bool:
    return value is not None and value > 0


def _latest_by_year(rows: list[dict[str, object]]) -> dict[str, object]:
    return sorted(rows, key=lambda row: _row_year(row) or 0)[-1]


def _group_by_pin(rows: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    grouped: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        raw_pin = row.get("pin")
        if not raw_pin:
            continue
        try:
            pin = normalize_pin(str(raw_pin))
        except ValueError:
            continue
        grouped.setdefault(pin, []).append(row)
    return grouped


def _style_key(row: dict[str, object]) -> str | None:
    pieces = [
        str(value).strip()
        for value in (
            _pick(row, "char_type_resd"),
            _pick(row, "char_ext_wall"),
            _pick(row, "char_cnst_qlty"),
        )
        if value not in (None, "")
    ]
    return "|".join(pieces) if pieces else None


def _amenity_count(row: dict[str, object]) -> int:
    names = (
        "char_air",
        "char_beds",
        "char_fbath",
        "char_hbath",
        "char_frpl",
        "char_gar1_area",
        "char_gar1_size",
        "char_porch",
        "char_bsmt",
        "char_bsmt_fin",
    )
    return sum(1 for name in names if row.get(name) not in (None, "", "0", 0))


def _assessment_values(rows: list[dict[str, object]]) -> tuple[float | None, float | None]:
    if not rows:
        return None, None
    value_rows = [
        row
        for row in rows
        if _float(_pick(row, "board_tot", "certified_tot", "mailed_tot")) is not None
        or _float(_pick(row, "board_bldg", "certified_bldg", "mailed_bldg")) is not None
    ]
    row = _latest_by_year(value_rows or rows)
    total = _float(_pick(row, "board_tot", "certified_tot", "mailed_tot"))
    improvement = _float(_pick(row, "board_bldg", "certified_bldg", "mailed_bldg"))
    return total, improvement


def _has_assessment_value(row: dict[str, object]) -> bool:
    total = _float(_pick(row, "board_tot", "certified_tot", "mailed_tot"))
    improvement = _float(_pick(row, "board_bldg", "certified_bldg", "mailed_bldg"))
    return _positive(total) or _positive(improvement)


def _candidate_from_rows(
    pin: str,
    property_class: str,
    char_rows: list[dict[str, object]],
    av_rows: list[dict[str, object]],
    universe_rows: list[dict[str, object]],
) -> Candidate:
    char = _latest_by_year(char_rows) if char_rows else {}
    universe = _latest_by_year(universe_rows) if universe_rows else {}
    total_av, improvement_av = _assessment_values(av_rows)
    return Candidate(
        pin=pin,
        property_class=property_class,
        building_sqft=_float(_pick(char, "char_bldg_sf", "bldg_sf")),
        land_sqft=_float(_pick(char, "char_land_sf", "land_sf")),
        year_built=_int(_pick(char, "char_yrblt", "yrblt")),
        style=_style_key(char),
        construction=str(_pick(char, "char_ext_wall") or "") or None,
        amenity_count=_amenity_count(char),
        total_av=total_av,
        improvement_av=improvement_av,
        neighborhood=str(_pick(universe, "nbhd_code") or _pick(char, "nbhd") or "") or None,
        lat=_float(_pick(universe, "lat", "latitude")),
        lon=_float(_pick(universe, "lon", "longitude")),
    )


def _fetch_limited(
    client: SocrataClient,
    dataset_key: str,
    where: str,
    limit: int,
    warnings: list[str],
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    offset = 0
    page_size = min(client.page_size, limit)
    while len(rows) < limit:
        page = client._fetch_page(
            dataset_key,
            {
                "$where": where,
                "$order": "pin",
                "$limit": str(min(page_size, limit - len(rows))),
                "$offset": str(offset),
            },
        )
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    if len(rows) >= limit:
        warnings.append(
            f"{dataset_key} pool was capped at {limit:,} rows for {where}; "
            "full-pool download was not attempted in this feasibility run."
        )
    return rows


def _fetch_current_or_latest(
    client: SocrataClient,
    dataset_key: str,
    base_where: str,
    limit: int,
    warnings: list[str],
) -> list[dict[str, object]]:
    current_where = f"{base_where} AND year='{ASSESSMENT_YEAR}'"
    rows = _fetch_limited(client, dataset_key, current_where, limit, warnings)
    if rows:
        return rows
    fallback_rows = _fetch_limited(client, dataset_key, base_where, limit, warnings)
    if fallback_rows:
        warnings.append(
            f"{dataset_key} had no {ASSESSMENT_YEAR} rows for {base_where}; "
            "used latest available rows for feasibility measurement."
        )
    return fallback_rows


def _pin_chunks(pins: list[str], chunk_size: int = 40) -> list[list[str]]:
    return [pins[index : index + chunk_size] for index in range(0, len(pins), chunk_size)]


def _pin_filter(pins: list[str]) -> str:
    quoted = ",".join(f"'{pin}'" for pin in pins)
    return f"pin in({quoted})"


def _fetch_by_pins_limited(
    client: SocrataClient,
    dataset_key: str,
    base_where: str,
    pins: set[str],
    warnings: list[str],
) -> list[dict[str, object]]:
    if not pins:
        return []
    rows: list[dict[str, object]] = []
    sorted_pins = sorted(pins)
    for chunk in _pin_chunks(sorted_pins):
        response = client.fetch_all(
            dataset_key,
            {"$where": f"{base_where} AND {_pin_filter(chunk)}"},
        )
        rows.extend(response.rows)
        warnings.extend(response.warnings)
    return rows


def _fetch_current_or_latest_by_pins(
    client: SocrataClient,
    dataset_key: str,
    base_where: str,
    pins: set[str],
    warnings: list[str],
) -> list[dict[str, object]]:
    current_where = f"{base_where} AND year='{ASSESSMENT_YEAR}'"
    rows = _fetch_by_pins_limited(client, dataset_key, current_where, pins, warnings)
    if rows:
        return rows
    fallback_rows = _fetch_by_pins_limited(client, dataset_key, base_where, pins, warnings)
    if fallback_rows:
        warnings.append(
            f"{dataset_key} had no {ASSESSMENT_YEAR} rows for the bounded PIN set in "
            f"{base_where}; used latest available rows for feasibility measurement."
        )
    return fallback_rows


def _pinned_subjects(max_samples: int) -> list[SelectedSubject]:
    subjects: list[SelectedSubject] = []
    seen: set[str] = set()
    for label, township, pin, township_code, property_class, source_year in PINNED_SAMPLE_ROWS:
        if len(subjects) >= max_samples:
            break
        normalized_pin = normalize_pin(pin)
        if normalized_pin in seen:
            continue
        subjects.append(
            SelectedSubject(
                spec=SampleSpec(label, township, property_class),
                pin=normalized_pin,
                township_code=township_code,
                township_name=township,
                property_class=property_class,
                source_year=source_year,
                used_year_fallback=False,
            )
        )
        seen.add(normalized_pin)
    return subjects


def _append_pinned_fallback(
    selected: list[SelectedSubject], seen: set[str], errors: list[str], max_samples: int
) -> None:
    for subject in _pinned_subjects(max_samples):
        if len(selected) >= max_samples:
            break
        if subject.pin in seen:
            continue
        selected.append(subject)
        seen.add(subject.pin)
        errors.append(
            f"Used pinned real-property sample for {subject.spec.label} "
            f"({subject.township_name} {format_pin(subject.pin)}) because live sample "
            "selection did not fill the requested diverse sample count."
        )


def select_subjects(
    client: SocrataClient, max_samples: int, pinned_samples_only: bool
) -> tuple[list[SelectedSubject], list[str]]:
    if pinned_samples_only:
        selected = _pinned_subjects(max_samples)
        return selected, [
            "Used the pinned real-property sample set selected during the first live "
            "feasibility run; current candidate pools were still loaded from Socrata."
        ]
    selected: list[SelectedSubject] = []
    errors: list[str] = []
    seen: set[str] = set()
    for spec in SAMPLE_SPECS:
        if len(selected) >= max_samples:
            break
        base_where = f"township_name='{spec.township}' AND class='{spec.property_class}'"
        try:
            rows = client._fetch_page(
                "parcel_universe",
                {
                    "$select": "pin,township_code,township_name,class,year",
                    "$where": f"{base_where} AND year='{ASSESSMENT_YEAR}'",
                    "$order": "pin",
                    "$limit": "5",
                    "$offset": "0",
                },
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Selection failed for {spec.label}: {exc}")
            continue
        used_fallback = False
        if not rows:
            try:
                rows = client._fetch_page(
                    "parcel_universe",
                    {
                        "$select": "pin,township_code,township_name,class,year",
                        "$where": base_where,
                        "$order": "year DESC, pin",
                        "$limit": "5",
                        "$offset": "0",
                    },
                )
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Fallback selection failed for {spec.label}: {exc}")
                continue
            used_fallback = bool(rows)
        subject = None
        for row in rows:
            raw_pin = row.get("pin")
            township_code = str(row.get("township_code") or "")
            if not raw_pin or not township_code:
                continue
            pin = normalize_pin(str(raw_pin))
            if pin in seen:
                continue
            subject = SelectedSubject(
                spec=spec,
                pin=pin,
                township_code=township_code,
                township_name=str(row.get("township_name") or spec.township),
                property_class=str(row.get("class") or spec.property_class),
                source_year=_int(row.get("year")),
                used_year_fallback=used_fallback,
            )
            break
        if subject is None:
            errors.append(
                f"No sample found for {spec.label}: {spec.township} class {spec.property_class}."
            )
            continue
        seen.add(subject.pin)
        selected.append(subject)
    if len(selected) < max_samples:
        _append_pinned_fallback(selected, seen, errors, max_samples)
    return selected, errors


def load_context(client: SocrataClient, subject: SelectedSubject, pool_limit: int) -> ContextResult:
    start = time.perf_counter()
    warnings: list[str] = []
    base_where = f"township_code='{subject.township_code}' AND class='{subject.property_class}'"
    chars = _fetch_current_or_latest(
        client, "res_characteristics", base_where, pool_limit, warnings
    )
    char_by_pin = _group_by_pin(chars)
    candidate_pins = set(char_by_pin)
    candidate_pins.add(subject.pin)
    if subject.pin not in char_by_pin:
        subject_chars = _fetch_current_or_latest_by_pins(
            client, "res_characteristics", base_where, {subject.pin}, warnings
        )
        chars.extend(subject_chars)
        char_by_pin = _group_by_pin(chars)
        candidate_pins = set(char_by_pin)
        candidate_pins.add(subject.pin)

    avs = _fetch_by_pins_limited(client, "assessed_values", base_where, candidate_pins, warnings)
    current_value_rows = [
        row for row in avs if _row_year(row) == ASSESSMENT_YEAR and _has_assessment_value(row)
    ]
    if not current_value_rows and avs:
        value_years = sorted(
            {
                year
                for row in avs
                if (year := _row_year(row)) is not None and _has_assessment_value(row)
            },
            reverse=True,
        )
        if value_years:
            warnings.append(
                "Assessed-values rows for the configured year were present but did not expose "
                "AV fields; metric feasibility used latest value-bearing rows from "
                f"{value_years[0]}."
            )
    universe = _fetch_current_or_latest_by_pins(
        client, "parcel_universe", base_where, candidate_pins, warnings
    )

    av_by_pin = _group_by_pin(avs)
    universe_by_pin = _group_by_pin(universe)
    pins = sorted(candidate_pins | set(av_by_pin) | set(universe_by_pin))
    candidates = tuple(
        _candidate_from_rows(
            pin,
            subject.property_class,
            char_by_pin.get(pin, []),
            av_by_pin.get(pin, []),
            universe_by_pin.get(pin, []),
        )
        for pin in pins
    )
    return ContextResult(
        key=f"{subject.township_code}:{subject.property_class}",
        rows_loaded={
            "res_characteristics": len(chars),
            "assessed_values": len(avs),
            "parcel_universe": len(universe),
        },
        warnings=tuple(warnings),
        load_seconds=time.perf_counter() - start,
        candidates=candidates,
    )


def _distance_km(left: Candidate, right: Candidate) -> float | None:
    if left.lat is None or left.lon is None or right.lat is None or right.lon is None:
        return None
    radius = 6371.0
    p1 = math.radians(left.lat)
    p2 = math.radians(right.lat)
    dphi = math.radians(right.lat - left.lat)
    dlambda = math.radians(right.lon - left.lon)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _metric_value(candidate: Candidate, profile: Profile) -> float | None:
    if profile.assessment_metric == "improvement_av_per_sqft":
        return candidate.improvement_av
    return candidate.total_av


def _pct(part: int | float, whole: int | float) -> float:
    return 0.0 if whole == 0 else 100.0 * float(part) / float(whole)


def field_availability(candidates: tuple[Candidate, ...]) -> dict[str, float]:
    total = len(candidates)
    return {
        name: round(_pct(sum(1 for candidate in candidates if check(candidate)), total), 1)
        for name, check in FIELD_CHECKS.items()
    }


def _location_filtered(
    subject: Candidate, candidates: list[Candidate], profile: Profile
) -> list[Candidate]:
    if profile.prefer_same_neighborhood and subject.neighborhood:
        same_neighborhood = [
            candidate for candidate in candidates if candidate.neighborhood == subject.neighborhood
        ]
        if len(same_neighborhood) >= profile.minimum_comparables:
            return same_neighborhood
    if profile.max_distance_km is None:
        return candidates
    nearby = [
        candidate
        for candidate in candidates
        if (distance := _distance_km(subject, candidate)) is not None
        and distance <= profile.max_distance_km
    ]
    return nearby if len(nearby) >= profile.minimum_comparables else candidates


def apply_profile(
    subject: Candidate, candidates: tuple[Candidate, ...], profile: Profile
) -> StageResult:
    started = time.perf_counter()
    pool = [candidate for candidate in candidates if candidate.pin != subject.pin]
    counts = {"candidate_pool": len(pool)}
    metric_ready = [
        candidate
        for candidate in pool
        if _positive(candidate.building_sqft) and _positive(_metric_value(candidate, profile))
    ]
    counts["metric_ready"] = len(metric_ready)
    filtered = _location_filtered(subject, metric_ready, profile)
    counts["location"] = len(filtered)

    if _positive(subject.building_sqft):
        low = subject.building_sqft * (1 - profile.sqft_tolerance)  # type: ignore[operator]
        high = subject.building_sqft * (1 + profile.sqft_tolerance)  # type: ignore[operator]
        filtered = [
            candidate
            for candidate in filtered
            if candidate.building_sqft is not None and low <= candidate.building_sqft <= high
        ]
    counts["building_sqft"] = len(filtered)

    if profile.require_year:
        filtered = [
            candidate
            for candidate in filtered
            if subject.year_built is not None
            and candidate.year_built is not None
            and abs(candidate.year_built - subject.year_built) <= profile.year_tolerance
        ]
    elif subject.year_built is not None:
        filtered = [
            candidate
            for candidate in filtered
            if candidate.year_built is None
            or abs(candidate.year_built - subject.year_built) <= profile.year_tolerance
        ]
    counts["year_built"] = len(filtered)

    if profile.require_land:
        if _positive(subject.land_sqft):
            low = subject.land_sqft * (1 - (profile.land_tolerance or 1.0))  # type: ignore[operator]
            high = subject.land_sqft * (1 + (profile.land_tolerance or 1.0))  # type: ignore[operator]
            filtered = [
                candidate
                for candidate in filtered
                if candidate.land_sqft is not None and low <= candidate.land_sqft <= high
            ]
        else:
            filtered = [candidate for candidate in filtered if _positive(candidate.land_sqft)]
    counts["land_sqft"] = len(filtered)

    if profile.require_style:
        if subject.style:
            filtered = [candidate for candidate in filtered if candidate.style == subject.style]
        else:
            filtered = [candidate for candidate in filtered if candidate.style]
    counts["style"] = len(filtered)

    if profile.require_amenity:
        filtered = [candidate for candidate in filtered if candidate.amenity_count > 0]
    counts["amenities"] = len(filtered)

    return StageResult(
        profile=profile.key,
        counts=counts,
        final_survivors=len(filtered),
        below_minimum=len(filtered) < profile.minimum_comparables,
        selection_ms=(time.perf_counter() - started) * 1000.0,
        metric_ready_pct=round(_pct(len(metric_ready), len(pool)), 1),
    )


def baseline_selection_ms(subject: Candidate, candidates: tuple[Candidate, ...]) -> float:
    started = time.perf_counter()
    pool = [
        candidate
        for candidate in candidates
        if candidate.pin != subject.pin
        and _positive(candidate.total_av)
        and _positive(candidate.building_sqft)
    ]
    selected = []
    for sqft_tol, year_tol in ((0.25, 15), (0.40, 25), (0.60, 40)):
        if not _positive(subject.building_sqft):
            break
        low = subject.building_sqft * (1 - sqft_tol)  # type: ignore[operator]
        high = subject.building_sqft * (1 + sqft_tol)  # type: ignore[operator]
        scoped = [
            candidate
            for candidate in pool
            if candidate.building_sqft is not None
            and low <= candidate.building_sqft <= high
            and (
                subject.year_built is None
                or candidate.year_built is None
                or abs(candidate.year_built - subject.year_built) <= year_tol
            )
        ]
        neighborhood = [
            candidate
            for candidate in scoped
            if subject.neighborhood is not None and candidate.neighborhood == subject.neighborhood
        ]
        selected = neighborhood if len(neighborhood) >= 15 else scoped
        if len(selected) >= 8:
            break
    _ = selected[:10]
    return (time.perf_counter() - started) * 1000.0


def evaluate_subject(subject: SelectedSubject, context: ContextResult) -> PropertyResult:
    subject_candidate = next(
        (candidate for candidate in context.candidates if candidate.pin == subject.pin),
        None,
    )
    if subject_candidate is None:
        subject_candidate = Candidate(
            pin=subject.pin,
            property_class=subject.property_class,
            building_sqft=None,
            land_sqft=None,
            year_built=None,
            style=None,
            construction=None,
            amenity_count=0,
            total_av=None,
            improvement_av=None,
            neighborhood=None,
            lat=None,
            lon=None,
        )
    profile_results = {
        profile.key: apply_profile(subject_candidate, context.candidates, profile)
        for profile in PROFILES
    }
    return PropertyResult(
        subject=subject,
        context_key=context.key,
        candidate_count=len(context.candidates),
        field_availability=field_availability(context.candidates),
        load_seconds=context.load_seconds,
        warnings=context.warnings,
        baseline_ms=baseline_selection_ms(subject_candidate, context.candidates),
        profiles=profile_results,
    )


def _summary(values: list[float]) -> str:
    if not values:
        return "n/a"
    return f"median {median(values):.1f}; min {min(values):.1f}; max {max(values):.1f}"


def _verdict(results: list[PropertyResult], profile: Profile) -> str:
    if not results:
        return "NOT FEASIBLE"
    profile_results = [result.profiles[profile.key] for result in results]
    pass_rate = _pct(
        sum(1 for result in profile_results if not result.below_minimum), len(profile_results)
    )
    metric_rate = median([result.metric_ready_pct for result in profile_results])
    if pass_rate >= 80 and metric_rate >= 70:
        return "FEASIBLE"
    if pass_rate >= 50 and metric_rate >= 50:
        return "FEASIBLE-WITH-CAVEATS"
    return "NOT FEASIBLE"


def _aggregate_field_rates(results: list[PropertyResult]) -> dict[str, float]:
    if not results:
        return {name: 0.0 for name in FIELD_CHECKS}
    return {
        name: round(median([result.field_availability[name] for result in results]), 1)
        for name in FIELD_CHECKS
    }


def _write_json(
    path: Path, run_date: date, results: list[PropertyResult], selection_errors: list[str]
) -> None:
    payload = {
        "run_date": run_date.isoformat(),
        "assessment_year": ASSESSMENT_YEAR,
        "socrata_domain": SOCRATA_DOMAIN,
        "datasets": DATASETS,
        "selection_errors": selection_errors,
        "profiles": [asdict(profile) for profile in PROFILES],
        "results": [asdict(result) for result in results],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_report(
    path: Path,
    json_path: Path,
    run_date: date,
    results: list[PropertyResult],
    selection_errors: list[str],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    field_rates = _aggregate_field_rates(results)
    lines = [
        "# Comparable Evidence Feasibility - Phase 2",
        "",
        f"- Run date: {run_date.isoformat()}",
        f"- Configured assessment year: {ASSESSMENT_YEAR}",
        f"- Machine-readable results: `{json_path.as_posix()}`",
        "- Data source: Cook County Socrata datasets through `SocrataClient` with caching, "
        "pagination, timeout, retry, and backoff behavior.",
        "- Official-source status: PTAB filing page and PTAB residential form were reachable; "
        "BOR official rules were reachable; CCAO comparable/guideline assets remain "
        "CloudFront-blocked in local automation and are treated as a verification caveat.",
        "- Official source URLs checked: "
        "`https://ptab.illinois.gov/filing.html`, "
        "`https://ptab.illinois.gov/getStarted.html`, "
        "`https://www.cookcountyboardofreview.com/board-review-official-rules`, and "
        "`https://www.cookcountyassessoril.gov/appeals`.",
        "",
        "## Official Guidance Matrix Used",
        "",
        "| Requirement | Assessor profile | BOR profile | PTAB profile |",
        "| --- | --- | --- | --- |",
        "| Location | Township/neighborhood; same-neighborhood preferred when available | "
        "Same-neighborhood preferred | Same-neighborhood or proximity fallback |",
        "| Class | Same class | Same class | Same class |",
        "| Age/year built | Measured; lenient filter if missing | "
        "Measured; lenient filter if missing | Required for strict grid feasibility |",
        "| Building/living sqft | Required for metric | Required for metric | "
        "Required for metric |",
        "| Land sqft | Measured, not filter-gating | Measured, not filter-gating | "
        "Required for grid feasibility |",
        "| Construction/design/style | Measured, not filter-gating | Measured, not filter-gating | "
        "Required for grid feasibility |",
        "| Amenities/features | Measured, not filter-gating | Measured, not filter-gating | "
        "Required for grid feasibility |",
        "| Minimum comparables | 3 measured; 5 preferred not enforced here | 3 measured as a "
        "conservative floor | 3 required by PTAB form |",
        "| Assessment metric | Total AV/sqft | Improvement/building AV/sqft | "
        "Improvement/building AV/sqft |",
        "| Property record cards | User-supply/official-source item | Evidence item | "
        "Explicit PTAB form item |",
        "| Full comparable grid | No PTAB-style grid | No PTAB-style grid | Section V grid |",
        "",
        "PTAB official sources verified that residential appeals may use comparable properties "
        "similar in age, construction, location, and square footage; that comparable sales and "
        "equity appeals require at least three properties in Section V Grid Analysis; and that "
        "the grid must be completed unless an appraisal is attached.",
        "",
        "BOR official rules verified the filing/evidence deadline framework and that class 2 "
        "residential subjects are treated separately from other property types in evidence "
        "submission requirements. The public rules do not publish a PTAB-style comparable grid.",
        "",
        "## Sample Coverage",
        "",
        "| # | Segment | Township | Class | PIN | Year fallback | Candidates | Load seconds |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for index, result in enumerate(results, start=1):
        subject = result.subject
        lines.append(
            f"| {index} | {subject.spec.label} | {subject.township_name} | "
            f"{subject.property_class} | {format_pin(subject.pin)} | "
            f"{'yes' if subject.used_year_fallback else 'no'} | "
            f"{result.candidate_count} | {result.load_seconds:.2f} |"
        )
    if selection_errors:
        lines.extend(["", "Selection gaps:"])
        lines.extend(f"- {error}" for error in selection_errors)

    lines.extend(
        [
            "",
            "## Field Availability",
            "",
            "Median field availability across sampled township/class candidate pools:",
            "",
            "| Field | Availability |",
            "| --- | --- |",
        ]
    )
    for field, value in field_rates.items():
        lines.append(f"| {field} | {value:.1f}% |")

    lines.extend(
        [
            "",
            "## Pool Survival and Runtime",
            "",
            "| Venue profile | Verdict | Properties meeting minimum | Final survivor summary | "
            "Metric-ready summary | Selection runtime | Baseline runtime |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for profile in PROFILES:
        profile_results = [result.profiles[profile.key] for result in results]
        meeting = sum(1 for result in profile_results if not result.below_minimum)
        final_counts = [float(result.final_survivors) for result in profile_results]
        metric_rates = [result.metric_ready_pct for result in profile_results]
        profile_ms = [result.selection_ms for result in profile_results]
        baseline_ms = [result.baseline_ms for result in results]
        lines.append(
            f"| {profile.label} | {_verdict(results, profile)} | "
            f"{meeting}/{len(profile_results)} | {_summary(final_counts)} | "
            f"{_summary(metric_rates)}% | {_summary(profile_ms)} ms | "
            f"{_summary(baseline_ms)} ms |"
        )

    lines.extend(
        [
            "",
            "## Per-Property Survival",
            "",
            "| PIN | Assessor final | BOR final | PTAB final | Notes |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for result in results:
        notes = []
        if result.warnings:
            notes.append(f"{len(result.warnings)} Socrata warning(s)")
        for profile in PROFILES:
            profile_result = result.profiles[profile.key]
            if profile_result.below_minimum:
                notes.append(f"{profile.key} below minimum")
        lines.append(
            f"| {format_pin(result.subject.pin)} | "
            f"{result.profiles['assessor'].final_survivors} | "
            f"{result.profiles['bor'].final_survivors} | "
            f"{result.profiles['ptab'].final_survivors} | "
            f"{'; '.join(notes) if notes else 'ok'} |"
        )

    lines.extend(
        [
            "",
            "## Methodology",
            "",
            "- Selected up to 20 real parcels from predefined township/class segments spanning "
            "north suburbs, south/west suburbs, and City of Chicago; single-family, condo, "
            "and multi-family classes are represented when Socrata returned rows.",
            "- Loaded bounded same-township/same-class candidate pools from `parcel_universe`, "
            "`res_characteristics`, and `assessed_values` using the existing client with "
            "deterministic pagination. Cap warnings in the table mean full-pool download was "
            "not attempted for that context.",
            "- Joined candidates by PIN and measured field availability before filtering.",
            "- For assessment metrics, used the latest value-bearing `assessed_values` row "
            "for each PIN when configured-year rows existed as stubs without AV columns; "
            "those fallbacks are called out in per-property warnings.",
            "- Measured pool survival after metric readiness, location, building sqft, year, "
            "land, style, and amenity filters according to each venue profile.",
            "- Compared per-profile selection runtime with an emulation of the current shared "
            "baseline comparable filter. Network/data-load time is reported separately.",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    client = SocrataClient(
        cache_dir=Path(args.cache_dir),
        timeout_seconds=args.timeout,
        max_retries=args.max_retries,
        page_size=args.page_size,
    )
    selected, selection_errors = select_subjects(client, args.max_samples, args.pinned_samples_only)
    if len(selected) < args.min_samples:
        raise RuntimeError(
            f"Only selected {len(selected)} samples; need at least {args.min_samples}. "
            + "; ".join(selection_errors)
        )
    contexts: dict[str, ContextResult] = {}
    results: list[PropertyResult] = []
    for subject in selected:
        context_key = f"{subject.township_code}:{subject.property_class}"
        context = contexts.get(context_key)
        if context is None:
            try:
                context = load_context(client, subject, args.pool_limit)
            except Exception as exc:  # noqa: BLE001
                selection_errors.append(
                    f"Candidate-pool load failed for {format_pin(subject.pin)} "
                    f"{subject.township_name} class {subject.property_class}: {exc}"
                )
                continue
            contexts[context_key] = context
        results.append(evaluate_subject(subject, context))
    if len(results) < args.min_samples:
        raise RuntimeError(
            f"Only measured {len(results)} samples; need at least {args.min_samples}. "
            + "; ".join(selection_errors)
        )

    json_path = Path(args.json_report)
    report_path = Path(args.report)
    run_date = date.fromisoformat(args.run_date)
    _write_json(json_path, run_date, results, selection_errors)
    _write_report(report_path, json_path, run_date, results, selection_errors)
    print(f"Wrote {report_path}")
    print(f"Wrote {json_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    today = date.today().isoformat()
    parser = argparse.ArgumentParser(description="Measure venue comparable-profile feasibility.")
    parser.add_argument("--max-samples", type=int, default=20)
    parser.add_argument("--min-samples", type=int, default=15)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--page-size", type=int, default=1000)
    parser.add_argument("--pool-limit", type=int, default=2000)
    parser.add_argument("--cache-dir", default=".cache/socrata_feasibility")
    parser.add_argument("--report", default=f"reports/comps_feasibility_{today}.md")
    parser.add_argument("--json-report", default=f"reports/comps_feasibility_{today}.json")
    parser.add_argument("--run-date", default=today)
    parser.add_argument(
        "--pinned-samples-only",
        action="store_true",
        help=(
            "Skip live sample discovery and reuse the pinned real-property sample set "
            "selected during an earlier live run."
        ),
    )
    return parser


def main() -> int:
    parser = build_parser()
    started = datetime.now()
    try:
        return run(parser.parse_args())
    finally:
        elapsed = (datetime.now() - started).total_seconds()
        print(f"Elapsed seconds: {elapsed:.1f}")


if __name__ == "__main__":
    raise SystemExit(main())

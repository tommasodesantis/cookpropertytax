from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Protocol, cast

import requests

from appeal_tool.config import ASSESSMENT_YEAR
from appeal_tool.errors import DataAccessError, DataErrorKind, NotFoundError
from appeal_tool.models import (
    AddressCandidate,
    AssessmentHistoryRow,
    CaseFile,
    Comparable,
    JsonDict,
    Parcel,
    Sale,
)
from appeal_tool.pin import format_pin, normalize_pin

SOCRATA_DOMAIN = "https://datacatalog.cookcountyil.gov/resource"
DATASETS = {
    "parcel_universe": "nj4t-kc8j",
    "assessed_values": "uzyt-m557",
    "res_characteristics": "x54s-btds",
    "parcel_sales": "wvhk-k5uv",
}


class CaseRepository(Protocol):
    def load_case_by_pin(self, pin: str) -> CaseFile: ...

    def lookup_address(self, query: str) -> list[AddressCandidate]: ...


def _parse_date(value: object) -> date | None:
    if not value:
        return None
    text = str(value)
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y"):
        try:
            return datetime.strptime(text[: len(fmt)], fmt).date()
        except ValueError:
            continue
    return None


def _float(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def _int(value: object) -> int | None:
    number = _float(value)
    return int(number) if number is not None else None


def _pick(row: JsonDict, *names: str) -> object:
    for name in names:
        if row.get(name) not in (None, ""):
            return row[name]
    return None


def _row_year(row: JsonDict) -> int | None:
    return _int(row.get("year") or row.get("tax_year"))


def _latest_row(rows: list[JsonDict]) -> JsonDict:
    return sorted(rows, key=lambda row: _row_year(row) or 0)[-1]


def _unique(items: list[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(items))


def _parcel_from_json(raw: JsonDict) -> Parcel:
    pin = normalize_pin(str(raw["pin"]))
    return Parcel(
        pin=pin,
        pin_formatted=format_pin(pin),
        property_class=str(raw.get("property_class") or raw.get("class") or ""),
        township_name=str(raw.get("township_name") or ""),
        address=str(raw.get("address") or raw.get("prop_address_full") or ""),
        city=str(raw.get("city") or raw.get("prop_address_city_name") or ""),
        zip_code=str(raw.get("zip_code") or raw.get("prop_address_zipcode_1") or ""),
        neighborhood=str(raw["neighborhood"]) if raw.get("neighborhood") else None,
        township_code=str(raw["township_code"]) if raw.get("township_code") else None,
        building_sqft=_float(raw.get("building_sqft")),
        land_sqft=_float(raw.get("land_sqft")),
        year_built=_int(raw.get("year_built")),
        style=str(raw["style"]) if raw.get("style") else None,
        amenity_count=int(_float(raw.get("amenity_count")) or 0),
        beds=_float(raw.get("beds")),
        full_baths=_float(raw.get("full_baths")),
        lat=_float(raw.get("lat")),
        lon=_float(raw.get("lon")),
        current_av=_float(raw.get("current_av")),
        current_improvement_av=_float(raw.get("current_improvement_av")),
        prior_final_av=_float(raw.get("prior_final_av")),
    )


def _comparable_from_json(raw: JsonDict) -> Comparable:
    pin = normalize_pin(str(raw["pin"]))
    return Comparable(
        pin=pin,
        pin_formatted=format_pin(pin),
        address=str(raw.get("address") or ""),
        building_sqft=_float(raw.get("building_sqft")),
        year_built=_int(raw.get("year_built")),
        av=_float(raw.get("av")),
        improvement_av=_float(raw.get("improvement_av")),
        land_sqft=_float(raw.get("land_sqft")),
        style=str(raw["style"]) if raw.get("style") else None,
        amenity_count=int(_float(raw.get("amenity_count")) or 0),
        neighborhood=str(raw["neighborhood"]) if raw.get("neighborhood") else None,
        lat=_float(raw.get("lat")),
        lon=_float(raw.get("lon")),
    )


class FixtureRepository:
    def __init__(self, fixture_dir: Path) -> None:
        self.fixture_dir = fixture_dir

    def _paths(self) -> list[Path]:
        return sorted(self.fixture_dir.glob("*.json"))

    def load_case_by_pin(self, pin: str) -> CaseFile:
        normalized = normalize_pin(pin)
        path = self.fixture_dir / f"{normalized}.json"
        if not path.exists():
            raise NotFoundError(f"PIN {format_pin(normalized)} was not found in offline fixtures.")
        raw = json.loads(path.read_text(encoding="utf-8"))
        return self._case_from_raw(raw)

    def lookup_address(self, query: str) -> list[AddressCandidate]:
        query_normalized = " ".join(query.upper().split())
        matches = []
        for path in self._paths():
            raw = json.loads(path.read_text(encoding="utf-8"))
            parcel = raw["parcel"]
            address = str(parcel.get("address", ""))
            if query_normalized in address.upper():
                pin = normalize_pin(str(parcel["pin"]))
                matches.append(
                    AddressCandidate(
                        pin=pin,
                        pin_formatted=format_pin(pin),
                        address=address,
                        township_name=str(parcel.get("township_name") or ""),
                        property_class=str(parcel.get("property_class") or ""),
                    )
                )
        return matches

    def _case_from_raw(self, raw: JsonDict) -> CaseFile:
        parcel = _parcel_from_json(raw["parcel"])
        history = tuple(
            AssessmentHistoryRow(
                year=int(item["year"]),
                mailed_av=_float(item.get("mailed_av")),
                certified_av=_float(item.get("certified_av")),
                board_av=_float(item.get("board_av")),
                final_av=_float(item.get("final_av")),
            )
            for item in raw.get("assessment_history", [])
        )
        comps = tuple(_comparable_from_json(item) for item in raw.get("comparables", []))
        sales = tuple(
            Sale(sale_date=parsed, sale_price=float(item["sale_price"]))
            for item in raw.get("subject_sales", [])
            if (parsed := _parse_date(item.get("sale_date"))) is not None
        )
        warnings = tuple(str(item) for item in raw.get("data_warnings", []))
        return CaseFile(
            parcel=parcel,
            assessment_history=history,
            comparables=comps,
            subject_sales=sales,
            data_warnings=warnings,
        )


@dataclass(frozen=True)
class SocrataResponse:
    rows: list[JsonDict]
    warnings: tuple[str, ...]


class SocrataClient:
    def __init__(
        self,
        cache_dir: Path = Path(".cache/socrata"),
        no_cache: bool = False,
        timeout_seconds: int = 30,
        max_retries: int = 3,
        page_size: int = 5000,
        ttl: timedelta = timedelta(hours=12),
    ) -> None:
        self.cache_dir = cache_dir
        self.no_cache = no_cache
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.page_size = page_size
        self.ttl = ttl
        self.session = requests.Session()
        self.app_token = os.getenv("SOCRATA_APP_TOKEN")

    def fetch_all(self, dataset_key: str, params: dict[str, str]) -> SocrataResponse:
        if dataset_key not in DATASETS:
            raise DataAccessError(
                f"Unknown Socrata dataset '{dataset_key}'.",
                DataErrorKind.UNKNOWN_DATASET,
            )
        rows: list[JsonDict] = []
        warnings: list[str] = []
        offset = 0
        paginated = False
        while True:
            page_params = dict(params)
            page_params["$limit"] = str(self.page_size)
            page_params["$offset"] = str(offset)
            page = self._fetch_page(dataset_key, page_params)
            rows.extend(page)
            if len(page) < self.page_size:
                break
            offset += self.page_size
            paginated = True
        if paginated:
            warnings.append(
                f"Socrata pagination fetched {len(rows):,} rows for {dataset_key}; "
                "all available pages were requested."
            )
        return SocrataResponse(rows=rows, warnings=tuple(warnings))

    def _fetch_page(self, dataset_key: str, params: dict[str, str]) -> list[JsonDict]:
        cache_key = self._cache_key(dataset_key, params)
        if not self.no_cache and cache_key.exists():
            age = datetime.now() - datetime.fromtimestamp(cache_key.stat().st_mtime)
            if age <= self.ttl:
                cached = json.loads(cache_key.read_text(encoding="utf-8"))
                if not isinstance(cached, list):
                    raise DataAccessError(
                        f"Cached Socrata response was invalid for {dataset_key}.",
                        DataErrorKind.INVALID_CACHE,
                    )
                return [cast(JsonDict, row) for row in cached if isinstance(row, dict)]
        url = f"{SOCRATA_DOMAIN}/{DATASETS[dataset_key]}.json"
        headers = {"X-App-Token": self.app_token} if self.app_token else {}
        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                response = self.session.get(
                    url, params=params, headers=headers, timeout=self.timeout_seconds
                )
                if response.status_code in {429, 500, 502, 503, 504}:
                    raise DataAccessError(
                        f"Socrata transient HTTP {response.status_code} for {dataset_key}.",
                        DataErrorKind.TRANSIENT_HTTP,
                    )
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, list):
                    raise DataAccessError(
                        f"Socrata returned non-list JSON for {dataset_key}.",
                        DataErrorKind.INVALID_JSON,
                    )
                if not self.no_cache:
                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    cache_key.write_text(json.dumps(data), encoding="utf-8")
                return [cast(JsonDict, row) for row in data if isinstance(row, dict)]
            except requests.HTTPError as exc:
                last_error = DataAccessError(
                    f"Socrata HTTP error for {dataset_key}: {exc}",
                    DataErrorKind.HTTP_ERROR,
                )
                if attempt == self.max_retries - 1:
                    break
                sleep_seconds = (0.5 * (2**attempt)) + random.uniform(0, 0.25)
                time.sleep(sleep_seconds)
            except (requests.RequestException, DataAccessError, ValueError) as exc:
                last_error = exc
                if attempt == self.max_retries - 1:
                    break
                sleep_seconds = (0.5 * (2**attempt)) + random.uniform(0, 0.25)
                time.sleep(sleep_seconds)
        kind = last_error.kind if isinstance(last_error, DataAccessError) else DataErrorKind.NETWORK
        raise DataAccessError(
            f"Socrata request failed for {dataset_key}: {last_error}",
            kind,
        ) from last_error

    def _cache_key(self, dataset_key: str, params: dict[str, str]) -> Path:
        payload = json.dumps({"dataset": dataset_key, "params": params}, sort_keys=True)
        safe = str(abs(hash(payload)))
        return self.cache_dir / f"{safe}.json"


class SocrataRepository:
    def __init__(self, client: SocrataClient | None = None) -> None:
        self.client = client or SocrataClient()

    def load_case_by_pin(self, pin: str) -> CaseFile:
        normalized = normalize_pin(pin)
        warnings: list[str] = []
        parcel_response = self.client.fetch_all(
            "parcel_universe", {"$where": f"pin='{normalized}' AND year='{ASSESSMENT_YEAR}'"}
        )
        warnings.extend(parcel_response.warnings)
        parcel_rows = parcel_response.rows
        if not parcel_rows:
            fallback_response = self.client.fetch_all(
                "parcel_universe", {"$where": f"pin='{normalized}'"}
            )
            warnings.extend(fallback_response.warnings)
            parcel_rows = fallback_response.rows
            if parcel_rows:
                fallback_year = _row_year(_latest_row(parcel_rows))
                warnings.append(
                    f"Parcel universe had no {ASSESSMENT_YEAR} row; using latest available "
                    f"year {fallback_year or 'unknown'}."
                )
        if not parcel_rows:
            raise NotFoundError(
                f"PIN {format_pin(normalized)} was not found in the parcel universe."
            )
        universe = _latest_row(parcel_rows)
        char_response = self.client.fetch_all(
            "res_characteristics", {"$where": f"pin='{normalized}' AND year='{ASSESSMENT_YEAR}'"}
        )
        warnings.extend(char_response.warnings)
        char_rows = char_response.rows
        if not char_rows:
            fallback_response = self.client.fetch_all(
                "res_characteristics", {"$where": f"pin='{normalized}'"}
            )
            warnings.extend(fallback_response.warnings)
            char_rows = fallback_response.rows
            if char_rows:
                fallback_year = _row_year(_latest_row(char_rows))
                warnings.append(
                    f"Residential characteristics had no {ASSESSMENT_YEAR} row; using latest "
                    f"available year {fallback_year or 'unknown'}."
                )
        char = _latest_row(char_rows) if char_rows else {}
        if not char_rows:
            warnings.append(
                "Residential characteristics were unavailable; square-foot and comparable "
                "analysis may be limited."
            )
        av_response = self.client.fetch_all(
            "assessed_values", {"$where": f"pin='{normalized}' AND year='{ASSESSMENT_YEAR}'"}
        )
        warnings.extend(av_response.warnings)
        av_rows = av_response.rows
        if not av_rows:
            fallback_response = self.client.fetch_all(
                "assessed_values", {"$where": f"pin='{normalized}'"}
            )
            warnings.extend(fallback_response.warnings)
            av_rows = fallback_response.rows
            if av_rows:
                fallback_year = _row_year(_latest_row(av_rows))
                warnings.append(
                    f"Assessed values had no {ASSESSMENT_YEAR} row; using latest available "
                    f"year {fallback_year or 'unknown'}."
                )
        current, current_improvement, current_year = _latest_assessment_values(av_rows)
        if av_rows and current is None and current_improvement is None:
            fallback_response = self.client.fetch_all(
                "assessed_values", {"$where": f"pin='{normalized}'"}
            )
            warnings.extend(fallback_response.warnings)
            av_rows = fallback_response.rows
            current, current_improvement, current_year = _latest_assessment_values(av_rows)
            if current is not None or current_improvement is not None:
                warnings.append(
                    "Configured-year assessed-value row had no AV fields; using latest "
                    f"value-bearing year {current_year or 'unknown'}."
                )
        parcel = Parcel(
            pin=normalized,
            pin_formatted=format_pin(normalized),
            property_class=str(_pick(universe, "class") or ""),
            township_name=str(_pick(universe, "township_name") or ""),
            address=str(_pick(universe, "prop_address_full", "property_address") or ""),
            city=str(_pick(universe, "prop_address_city_name") or ""),
            zip_code=str(_pick(universe, "prop_address_zipcode_1") or ""),
            neighborhood=str(_pick(universe, "nbhd_code", "nbhd", "town_nbhd") or ""),
            township_code=str(_pick(universe, "township_code") or ""),
            building_sqft=_float(_pick(char, "char_bldg_sf", "bldg_sf")),
            land_sqft=_float(_pick(char, "char_land_sf", "land_sf")),
            year_built=_int(_pick(char, "char_yrblt", "yrblt")),
            style=_style_key(char),
            amenity_count=_amenity_count(char),
            beds=_float(_pick(char, "char_beds")),
            full_baths=_float(_pick(char, "char_fbath")),
            lat=_float(_pick(universe, "lat", "latitude")),
            lon=_float(_pick(universe, "lon", "longitude")),
            current_av=current,
            current_improvement_av=current_improvement,
            prior_final_av=None,
        )
        if not parcel.address:
            warnings.append(
                "The live parcel universe response did not include a property address; "
                "the packet identifies the subject by PIN, township, and class."
            )
        if current is None:
            warnings.append(
                "Current assessed value was unavailable; savings and market-value estimates "
                "are limited."
            )
        comps, comparable_warnings = self._load_comparables(parcel)
        warnings.extend(comparable_warnings)
        sales, sales_warnings = self._load_sales(normalized)
        warnings.extend(sales_warnings)
        return CaseFile(
            parcel=parcel,
            comparables=tuple(comps),
            subject_sales=tuple(sales),
            data_warnings=_unique(warnings),
        )

    def lookup_address(self, query: str) -> list[AddressCandidate]:
        escaped = " ".join(query.upper().split()).replace("'", "''")
        rows = self.client.fetch_all(
            "parcel_universe", {"$where": f"upper(prop_address_full) like '%{escaped}%'"}
        ).rows
        candidates = []
        seen: set[str] = set()
        for row in rows:
            raw_pin = row.get("pin")
            if not raw_pin:
                continue
            pin = normalize_pin(str(raw_pin))
            if pin in seen:
                continue
            seen.add(pin)
            candidates.append(
                AddressCandidate(
                    pin=pin,
                    pin_formatted=format_pin(pin),
                    address=str(_pick(row, "prop_address_full") or ""),
                    township_name=str(_pick(row, "township_name") or ""),
                    property_class=str(_pick(row, "class") or ""),
                )
            )
        return candidates

    def _load_sales(self, pin: str) -> tuple[list[Sale], tuple[str, ...]]:
        response = self.client.fetch_all("parcel_sales", {"$where": f"pin='{pin}'"})
        rows = response.rows
        sales = []
        for row in rows:
            sale_date = _parse_date(_pick(row, "sale_date"))
            price = _float(_pick(row, "sale_price"))
            if sale_date and price and price > 1000:
                sales.append(Sale(sale_date=sale_date, sale_price=price))
        return sorted(sales, key=lambda item: item.sale_date, reverse=True), response.warnings

    def _load_comparables(self, parcel: Parcel) -> tuple[list[Comparable], tuple[str, ...]]:
        warnings: list[str] = []
        if not parcel.township_code or not parcel.property_class:
            return [], (
                "Comparable search was skipped because township code or property class was "
                "unavailable.",
            )
        where = f"township_code='{parcel.township_code}' AND class='{parcel.property_class}'"
        year_where = f"{where} AND year='{ASSESSMENT_YEAR}'"
        char_response = self.client.fetch_all("res_characteristics", {"$where": year_where})
        warnings.extend(char_response.warnings)
        chars = char_response.rows
        if not chars:
            fallback_response = self.client.fetch_all("res_characteristics", {"$where": where})
            warnings.extend(fallback_response.warnings)
            chars = fallback_response.rows
            if chars:
                warnings.append(
                    "Comparable characteristics had no configured-year rows; using latest "
                    "available rows from the source."
                )
        av_response = self.client.fetch_all("assessed_values", {"$where": year_where})
        warnings.extend(av_response.warnings)
        avs = av_response.rows
        if avs and not any(_has_assessment_value(row) for row in avs):
            prior_year = ASSESSMENT_YEAR - 1
            prior_response = self.client.fetch_all(
                "assessed_values", {"$where": f"{where} AND year='{prior_year}'"}
            )
            warnings.extend(prior_response.warnings)
            if prior_response.rows:
                avs = prior_response.rows
                warnings.append(
                    "Comparable assessed-value rows for the configured year had no AV fields; "
                    f"using latest value-bearing rows from {prior_year}."
                )
        if not avs:
            fallback_response = self.client.fetch_all("assessed_values", {"$where": where})
            warnings.extend(fallback_response.warnings)
            avs = fallback_response.rows
            if avs:
                warnings.append(
                    "Comparable assessed values had no configured-year rows; using latest "
                    "available rows from the source."
                )
        universe_response = self.client.fetch_all("parcel_universe", {"$where": year_where})
        warnings.extend(universe_response.warnings)
        universe_rows = universe_response.rows
        if not universe_rows:
            fallback_response = self.client.fetch_all("parcel_universe", {"$where": where})
            warnings.extend(fallback_response.warnings)
            universe_rows = fallback_response.rows
            if universe_rows:
                warnings.append(
                    "Comparable parcel-universe rows had no configured-year rows; using latest "
                    "available rows from the source."
                )
        av_rows_by_pin = _group_by_pin(avs)
        universe_by_pin = _group_by_pin(universe_rows)
        comps = []
        missing_addresses = 0
        for row in chars:
            raw_pin = row.get("pin")
            if not raw_pin:
                continue
            comp_pin = normalize_pin(str(raw_pin))
            total_av, improvement_av, _ = _latest_assessment_values(
                av_rows_by_pin.get(comp_pin, [])
            )
            universe = _latest_row(universe_by_pin[comp_pin]) if comp_pin in universe_by_pin else {}
            address = str(_pick(universe, "prop_address_full", "property_address") or "")
            if not address:
                missing_addresses += 1
                address = "Address not available from public data"
            comps.append(
                Comparable(
                    pin=comp_pin,
                    pin_formatted=format_pin(comp_pin),
                    address=address,
                    building_sqft=_float(_pick(row, "char_bldg_sf", "bldg_sf")),
                    year_built=_int(_pick(row, "char_yrblt", "yrblt")),
                    av=total_av,
                    improvement_av=improvement_av,
                    land_sqft=_float(_pick(row, "char_land_sf", "land_sf")),
                    style=_style_key(row),
                    amenity_count=_amenity_count(row),
                    neighborhood=str(
                        _pick(universe, "nbhd_code", "nbhd", "town_nbhd")
                        or _pick(row, "nbhd")
                        or ""
                    )
                    or None,
                    lat=_float(_pick(universe, "lat", "latitude")),
                    lon=_float(_pick(universe, "lon", "longitude")),
                )
            )
        if not comps:
            warnings.append(
                "No comparable characteristic rows were returned for the subject township/class."
            )
        if missing_addresses:
            warnings.append(
                "Comparable parcel-universe rows did not include property address fields; "
                "comparable exhibits label those addresses as unavailable from public data."
            )
        return comps, tuple(warnings)


def _latest_av(rows: list[JsonDict]) -> float | None:
    total, _, _ = _latest_assessment_values(rows)
    return total


def _latest_assessment_values(
    rows: list[JsonDict],
) -> tuple[float | None, float | None, int | None]:
    value_rows = [row for row in rows if _has_assessment_value(row)]
    if not value_rows:
        return None, None, None
    row = _latest_row(value_rows)
    total = _float(_pick(row, "board_tot", "certified_tot", "mailed_tot"))
    improvement = _float(_pick(row, "board_bldg", "certified_bldg", "mailed_bldg"))
    return total, improvement, _row_year(row)


def _has_assessment_value(row: JsonDict) -> bool:
    total = _float(_pick(row, "board_tot", "certified_tot", "mailed_tot"))
    improvement = _float(_pick(row, "board_bldg", "certified_bldg", "mailed_bldg"))
    return (total is not None and total > 0) or (improvement is not None and improvement > 0)


def _group_by_pin(rows: list[JsonDict]) -> dict[str, list[JsonDict]]:
    grouped: dict[str, list[JsonDict]] = {}
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


def _style_key(row: JsonDict) -> str | None:
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


def _amenity_count(row: JsonDict) -> int:
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

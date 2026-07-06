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

from appeal_tool.errors import DataAccessError, NotFoundError
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
        beds=_float(raw.get("beds")),
        full_baths=_float(raw.get("full_baths")),
        lat=_float(raw.get("lat")),
        lon=_float(raw.get("lon")),
        current_av=_float(raw.get("current_av")),
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
            raise DataAccessError(f"Unknown Socrata dataset '{dataset_key}'.")
        rows: list[JsonDict] = []
        warnings: list[str] = []
        offset = 0
        while True:
            page_params = dict(params)
            page_params["$limit"] = str(self.page_size)
            page_params["$offset"] = str(offset)
            page = self._fetch_page(dataset_key, page_params)
            rows.extend(page)
            if len(page) < self.page_size:
                break
            offset += self.page_size
            warnings.append(
                f"Socrata pagination continued past {offset} rows for {dataset_key}; "
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
                    raise DataAccessError(f"Cached Socrata response was invalid for {dataset_key}.")
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
                        f"Socrata transient HTTP {response.status_code} for {dataset_key}."
                    )
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, list):
                    raise DataAccessError(f"Socrata returned non-list JSON for {dataset_key}.")
                if not self.no_cache:
                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    cache_key.write_text(json.dumps(data), encoding="utf-8")
                return [cast(JsonDict, row) for row in data if isinstance(row, dict)]
            except (requests.RequestException, DataAccessError, ValueError) as exc:
                last_error = exc
                if attempt == self.max_retries - 1:
                    break
                sleep_seconds = (0.5 * (2**attempt)) + random.uniform(0, 0.25)
                time.sleep(sleep_seconds)
        raise DataAccessError(
            f"Socrata request failed for {dataset_key}: {last_error}"
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
        parcel_rows = self.client.fetch_all(
            "parcel_universe", {"$where": f"pin='{normalized}'"}
        ).rows
        if not parcel_rows:
            raise NotFoundError(
                f"PIN {format_pin(normalized)} was not found in the parcel universe."
            )
        universe = parcel_rows[-1]
        char_rows = self.client.fetch_all(
            "res_characteristics", {"$where": f"pin='{normalized}'"}
        ).rows
        char = char_rows[-1] if char_rows else {}
        av_rows = self.client.fetch_all("assessed_values", {"$where": f"pin='{normalized}'"}).rows
        current = _latest_av(av_rows)
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
            beds=_float(_pick(char, "char_beds")),
            full_baths=_float(_pick(char, "char_fbath")),
            lat=_float(_pick(universe, "lat", "latitude")),
            lon=_float(_pick(universe, "lon", "longitude")),
            current_av=current,
            prior_final_av=None,
        )
        comps = self._load_comparables(parcel)
        sales = self._load_sales(normalized)
        return CaseFile(parcel=parcel, comparables=tuple(comps), subject_sales=tuple(sales))

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

    def _load_sales(self, pin: str) -> list[Sale]:
        rows = self.client.fetch_all("parcel_sales", {"$where": f"pin='{pin}'"}).rows
        sales = []
        for row in rows:
            sale_date = _parse_date(_pick(row, "sale_date"))
            price = _float(_pick(row, "sale_price"))
            if sale_date and price and price > 1000:
                sales.append(Sale(sale_date=sale_date, sale_price=price))
        return sorted(sales, key=lambda item: item.sale_date, reverse=True)

    def _load_comparables(self, parcel: Parcel) -> list[Comparable]:
        if not parcel.township_code or not parcel.property_class:
            return []
        where = f"township_code='{parcel.township_code}' AND class='{parcel.property_class}'"
        chars = self.client.fetch_all("res_characteristics", {"$where": where}).rows
        avs = self.client.fetch_all("assessed_values", {"$where": where}).rows
        av_by_pin: dict[str, float] = {}
        for row in avs:
            raw_pin = row.get("pin")
            if not raw_pin:
                continue
            value = _latest_av([row])
            if value:
                av_by_pin[normalize_pin(str(raw_pin))] = value
        comps = []
        for row in chars:
            raw_pin = row.get("pin")
            if not raw_pin:
                continue
            comp_pin = normalize_pin(str(raw_pin))
            comps.append(
                Comparable(
                    pin=comp_pin,
                    pin_formatted=format_pin(comp_pin),
                    address="",
                    building_sqft=_float(_pick(row, "char_bldg_sf", "bldg_sf")),
                    year_built=_int(_pick(row, "char_yrblt", "yrblt")),
                    av=av_by_pin.get(comp_pin),
                    neighborhood=None,
                )
            )
        return comps


def _latest_av(rows: list[JsonDict]) -> float | None:
    if not rows:
        return None
    sorted_rows = sorted(rows, key=lambda row: str(row.get("year") or row.get("tax_year") or ""))
    row = sorted_rows[-1]
    return _float(_pick(row, "mailed_tot", "certified_tot", "board_tot"))

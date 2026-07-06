from __future__ import annotations

from pathlib import Path

import pytest

from appeal_tool.errors import DataAccessError, DataErrorKind
from appeal_tool.repository import SocrataClient, SocrataRepository, SocrataResponse


class FakeResponse:
    def __init__(self, status_code: int, payload: object) -> None:
        self.status_code = status_code
        self.payload = payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> object:
        return self.payload


class FakeSession:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def get(
        self,
        url: str,
        params: dict[str, str],
        headers: dict[str, str],
        timeout: int,
    ) -> FakeResponse:
        self.calls.append(dict(params))
        offset = int(params["$offset"])
        if offset == 0:
            return FakeResponse(200, [{"row": 1}, {"row": 2}])
        return FakeResponse(200, [{"row": 3}])


class TransientSession:
    def __init__(self) -> None:
        self.calls = 0

    def get(
        self,
        url: str,
        params: dict[str, str],
        headers: dict[str, str],
        timeout: int,
    ) -> FakeResponse:
        self.calls += 1
        if self.calls == 1:
            return FakeResponse(503, {"error": "try later"})
        return FakeResponse(200, [{"row": "ok"}])


class InvalidJsonSession:
    def get(
        self,
        url: str,
        params: dict[str, str],
        headers: dict[str, str],
        timeout: int,
    ) -> FakeResponse:
        return FakeResponse(200, {"not": "a list"})


def test_socrata_client_paginates_and_caches(tmp_path: Path) -> None:
    client = SocrataClient(cache_dir=tmp_path, page_size=2)
    fake = FakeSession()
    client.session = fake  # type: ignore[assignment]
    first = client.fetch_all("parcel_universe", {"$where": "pin='x'"})
    assert [row["row"] for row in first.rows] == [1, 2, 3]
    assert first.warnings == (
        "Socrata pagination fetched 3 rows for parcel_universe; "
        "all available pages were requested.",
    )
    assert len(fake.calls) == 2

    second = client.fetch_all("parcel_universe", {"$where": "pin='x'"})
    assert [row["row"] for row in second.rows] == [1, 2, 3]
    assert len(fake.calls) == 2


def test_socrata_client_retries_transient_http(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("appeal_tool.repository.time.sleep", lambda seconds: None)
    client = SocrataClient(cache_dir=tmp_path, page_size=10, max_retries=2)
    fake = TransientSession()
    client.session = fake  # type: ignore[assignment]
    result = client.fetch_all("parcel_universe", {"$where": "pin='x'"})
    assert result.rows == [{"row": "ok"}]
    assert fake.calls == 2


def test_socrata_client_classifies_invalid_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("appeal_tool.repository.time.sleep", lambda seconds: None)
    client = SocrataClient(cache_dir=tmp_path, max_retries=1)
    client.session = InvalidJsonSession()  # type: ignore[assignment]
    with pytest.raises(DataAccessError) as excinfo:
        client.fetch_all("parcel_universe", {"$where": "pin='x'"})
    assert excinfo.value.kind == DataErrorKind.INVALID_JSON


def test_socrata_client_classifies_unknown_dataset(tmp_path: Path) -> None:
    client = SocrataClient(cache_dir=tmp_path)
    with pytest.raises(DataAccessError) as excinfo:
        client.fetch_all("missing", {})
    assert excinfo.value.kind == DataErrorKind.UNKNOWN_DATASET


def test_socrata_client_classifies_invalid_cache(tmp_path: Path) -> None:
    client = SocrataClient(cache_dir=tmp_path)
    cache_key = client._cache_key("parcel_universe", {"$limit": "5000", "$offset": "0"})
    tmp_path.mkdir(parents=True, exist_ok=True)
    cache_key.write_text('{"bad": true}', encoding="utf-8")
    with pytest.raises(DataAccessError) as excinfo:
        client.fetch_all("parcel_universe", {})
    assert excinfo.value.kind == DataErrorKind.INVALID_CACHE


class MissingAddressClient:
    def fetch_all(self, dataset_key: str, params: dict[str, str]) -> SocrataResponse:
        where = params.get("$where", "")
        if dataset_key == "parcel_universe":
            return SocrataResponse(
                rows=[
                    {
                        "pin": "03000000000001",
                        "class": "203",
                        "township_name": "Barrington",
                        "township_code": "10",
                    }
                ],
                warnings=("parcel pagination warning",),
            )
        if dataset_key == "res_characteristics" and where == "pin='03000000000001'":
            return SocrataResponse(rows=[], warnings=())
        if dataset_key in {"res_characteristics", "assessed_values", "parcel_sales"}:
            return SocrataResponse(rows=[], warnings=())
        raise AssertionError(f"Unexpected dataset {dataset_key}")


def test_socrata_repository_surfaces_missing_live_fields() -> None:
    repo = SocrataRepository(client=MissingAddressClient())  # type: ignore[arg-type]
    case = repo.load_case_by_pin("03-00-000-000-0001")
    warnings = "\n".join(case.data_warnings)
    assert "parcel pagination warning" in warnings
    assert "did not include a property address" in warnings
    assert "Residential characteristics were unavailable" in warnings
    assert "Current assessed value was unavailable" in warnings

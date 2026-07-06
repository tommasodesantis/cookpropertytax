from __future__ import annotations

from pathlib import Path

from appeal_tool.repository import SocrataClient


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


def test_socrata_client_paginates_and_caches(tmp_path: Path) -> None:
    client = SocrataClient(cache_dir=tmp_path, page_size=2)
    fake = FakeSession()
    client.session = fake  # type: ignore[assignment]
    first = client.fetch_all("parcel_universe", {"$where": "pin='x'"})
    assert [row["row"] for row in first.rows] == [1, 2, 3]
    assert len(fake.calls) == 2

    second = client.fetch_all("parcel_universe", {"$where": "pin='x'"})
    assert [row["row"] for row in second.rows] == [1, 2, 3]
    assert len(fake.calls) == 2

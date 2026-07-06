from __future__ import annotations

from pathlib import Path

import pytest

from appeal_tool.repository import FixtureRepository


@pytest.fixture
def fixture_dir() -> Path:
    return Path(__file__).parent / "fixtures" / "cases"


@pytest.fixture
def fixture_repo(fixture_dir: Path) -> FixtureRepository:
    return FixtureRepository(fixture_dir)

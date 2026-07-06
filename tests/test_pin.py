from __future__ import annotations

import pytest

from appeal_tool.errors import UserInputError
from appeal_tool.pin import format_pin, normalize_pin


def test_normalize_pin_accepts_formatted_pin() -> None:
    assert normalize_pin("03-00-000-000-0001") == "03000000000001"


def test_normalize_pin_expands_pin10() -> None:
    assert normalize_pin("03-00-000-000") == "03000000000000"


def test_normalize_pin_rejects_invalid_pin_with_expected_format() -> None:
    with pytest.raises(UserInputError, match="Expected a 14-digit Cook County PIN"):
        normalize_pin("abc")


def test_format_pin() -> None:
    assert format_pin("03000000000001") == "03-00-000-000-0001"

from __future__ import annotations

import re

from appeal_tool.errors import UserInputError

PIN_EXPECTED = "Expected a 14-digit Cook County PIN, for example 03-00-000-000-0001."


def normalize_pin(pin: str) -> str:
    digits = re.sub(r"\D", "", str(pin))
    if len(digits) == 10:
        digits += "0000"
    if len(digits) != 14:
        raise UserInputError(f"Invalid PIN '{pin}'. {PIN_EXPECTED}")
    return digits


def format_pin(pin: str) -> str:
    digits = normalize_pin(pin)
    return f"{digits[0:2]}-{digits[2:4]}-{digits[4:7]}-{digits[7:10]}-{digits[10:14]}"

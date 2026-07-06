from __future__ import annotations

from appeal_tool.models import Parcel


def parcel_address(parcel: Parcel) -> str:
    city_zip = " ".join(part for part in (parcel.city.strip(), parcel.zip_code.strip()) if part)
    pieces = [part for part in (parcel.address.strip(), city_zip) if part]
    if not pieces:
        return "Not available from public dataset"
    return ", ".join(pieces)

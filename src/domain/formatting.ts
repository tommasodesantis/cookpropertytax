import type { Parcel } from "./models";

export function parcelAddress(parcel: Parcel): string {
  const cityZip = [parcel.city.trim(), parcel.zipCode.trim()].filter(Boolean).join(" ");
  const pieces = [parcel.address.trim(), cityZip].filter(Boolean);
  if (pieces.length === 0) {
    return "Not available from public dataset";
  }
  return pieces.join(", ");
}

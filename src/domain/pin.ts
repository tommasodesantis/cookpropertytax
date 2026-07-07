import { UserInputError } from "./errors";

export const PIN_EXPECTED = "Expected a 14-digit Cook County PIN, for example 03-00-000-000-0001.";

export function normalizePin(pin: string): string {
  let digits = String(pin).replace(/\D/g, "");
  if (digits.length === 10) {
    digits += "0000";
  }
  if (digits.length !== 14) {
    throw new UserInputError(`Invalid PIN '${pin}'. ${PIN_EXPECTED}`);
  }
  return digits;
}

export function formatPin(pin: string): string {
  const digits = normalizePin(pin);
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 7)}-${digits.slice(
    7,
    10,
  )}-${digits.slice(10, 14)}`;
}

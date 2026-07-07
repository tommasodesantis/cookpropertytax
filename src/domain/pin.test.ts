import { UserInputError } from "./errors";
import { formatPin, normalizePin } from "./pin";

test("normalizePin accepts a formatted PIN", () => {
  expect(normalizePin("03-00-000-000-0001")).toBe("03000000000001");
});

test("normalizePin expands PIN10", () => {
  expect(normalizePin("03-00-000-000")).toBe("03000000000000");
});

test("normalizePin rejects invalid PIN with the expected format", () => {
  expect(() => normalizePin("abc")).toThrow(UserInputError);
  expect(() => normalizePin("abc")).toThrow("Expected a 14-digit Cook County PIN");
});

test("formatPin adds Cook County separators", () => {
  expect(formatPin("03000000000001")).toBe("03-00-000-000-0001");
});

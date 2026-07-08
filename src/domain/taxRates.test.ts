import { DEFAULT_TAX_RATE } from "./config";
import { CLERK_TAX_RATE_SOURCE_YEAR, clerkTaxRateForCode } from "./taxRates";

test("Clerk tax-code lookup returns a parcel-specific composite rate", () => {
  const result = clerkTaxRateForCode("10001");

  expect(result).toMatchObject({
    taxCode: "10001",
    taxRate: 0.077774,
  });
  expect(result?.source).toContain("approximate parcel-specific rate 7.7774%");
  expect(result?.source).toContain(`Cook County Clerk ${CLERK_TAX_RATE_SOURCE_YEAR}`);
  expect(result?.source).toContain("tax code 10001");
});

test("Clerk tax-code lookup returns null for missing or unknown codes", () => {
  expect(clerkTaxRateForCode(null)).toBeNull();
  expect(clerkTaxRateForCode("")).toBeNull();
  expect(clerkTaxRateForCode("99999")).toBeNull();
  expect(DEFAULT_TAX_RATE).toBe(0.1);
});

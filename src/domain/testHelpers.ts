import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { caseFileFromJson } from "./caseSerde";
import type { CaseFile, Comparable } from "./models";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadFixtureCase(pin: string): CaseFile {
  const raw = JSON.parse(readFileSync(join(root, "fixtures", "cases", `${pin}.json`), "utf8"));
  return caseFileFromJson(raw);
}

export function loadAuthorityCrosscheck(): unknown {
  return JSON.parse(
    readFileSync(join(root, "fixtures", "authority", "ccao_2026_deadline_crosscheck.json"), "utf8"),
  );
}

export function makeComparable(overrides: Partial<Comparable>): Comparable {
  return {
    pin: "03000000990000",
    pinFormatted: "03-00-000-099-0000",
    address: "TEST ST",
    buildingSqft: 1800,
    yearBuilt: 1924,
    assessmentYear: null,
    av: 40000,
    improvementAv: null,
    landSqft: null,
    style: null,
    amenityCount: 0,
    neighborhood: "0101",
    lat: null,
    lon: null,
    ...overrides,
  };
}

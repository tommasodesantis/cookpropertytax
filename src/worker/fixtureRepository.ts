import fixture0001 from "../../fixtures/cases/03000000000001.json";
import fixture0020 from "../../fixtures/cases/03000000000020.json";
import fixture0030 from "../../fixtures/cases/03000000000030.json";
import fixture0040 from "../../fixtures/cases/03000000000040.json";
import { caseFileFromJson } from "../domain/caseSerde";
import { NotFoundError } from "../domain/errors";
import type { CaseFile } from "../domain/models";
import { formatPin, normalizePin } from "../domain/pin";
import type { CaseRepository } from "./repository";

const FIXTURES: Record<string, unknown> = {
  "03000000000001": fixture0001,
  "03000000000020": fixture0020,
  "03000000000030": fixture0030,
  "03000000000040": fixture0040,
};

export interface DemoCase {
  pin: string;
  pinFormatted: string;
  address: string;
  townshipName: string;
  propertyClass: string;
  label: string;
}

export class FixtureRepository implements CaseRepository {
  async loadCaseByPin(pin: string): Promise<CaseFile> {
    const normalized = normalizePin(pin);
    const fixture = FIXTURES[normalized];
    if (!fixture) {
      throw new NotFoundError(`PIN ${formatPin(normalized)} was not found in offline fixtures.`);
    }
    return caseFileFromJson(fixture);
  }
}

export function demoCases(): DemoCase[] {
  return Object.values(FIXTURES).map((fixture) => {
    const caseFile = caseFileFromJson(fixture);
    const condo = caseFile.parcel.propertyClass === "299";
    const missingData = caseFile.parcel.buildingSqft === null;
    return {
      pin: caseFile.parcel.pin,
      pinFormatted: caseFile.parcel.pinFormatted,
      address: caseFile.parcel.address,
      townshipName: caseFile.parcel.townshipName,
      propertyClass: caseFile.parcel.propertyClass,
      label: condo
        ? "Condo missing-data sample"
        : missingData
          ? "Missing sqft sample"
          : "Sample property",
    };
  });
}

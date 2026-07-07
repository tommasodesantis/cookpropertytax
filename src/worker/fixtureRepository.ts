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

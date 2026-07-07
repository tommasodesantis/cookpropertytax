import { buildEvidenceSummary } from "../domain/analysis";
import { DEFAULT_TAX_RATE, SUPPORTED_JURISDICTIONS } from "../domain/config";
import { UserInputError } from "../domain/errors";
import {
  type CaseFile,
  type Jurisdiction,
  type UserEvidence,
  defaultUserEvidence,
  withUserEvidence,
} from "../domain/models";
import type { Venue } from "../domain/models";
import type { AppealStatusInput } from "../domain/routing";
import { routeCase } from "../domain/routing";
import { adapterForVenue } from "../domain/venues";
import type { CaseRepository } from "./repository";

export interface CasePayload {
  ok: true;
  demo: boolean;
  generatedAt: string;
  today: string;
  case: CaseFile;
  routing: ReturnType<typeof routeCase>;
  evidence: ReturnType<typeof buildEvidenceSummary>;
  venue: {
    key: string;
    name: string;
    officialUrl: string;
    checklist: string[];
    sections: Array<{ title: string; lines: string[] }>;
  };
  warnings: string[];
}

const ENTITY_REFUSAL_MESSAGE =
  "Appeal Compass is designed only for individual residential homeowners appealing their own home; entity-owned, commercial, and association properties are not supported and generally require an attorney.";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function positiveNumber(params: URLSearchParams, name: string): number | null {
  const value = params.get(name);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function booleanFlag(params: URLSearchParams, name: string): boolean {
  return params.get(name) === "1" || params.get(name) === "true";
}

function requiredChoice<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[],
  label: string,
): T {
  const value = params.get(name);
  if (!value || !allowed.includes(value as T)) {
    throw new UserInputError(`Choose ${label}.`);
  }
  return value as T;
}

function requiredBoolean(params: URLSearchParams, name: string, label: string): boolean {
  const value = params.get(name);
  if (value === "yes" || value === "true" || value === "1") {
    return true;
  }
  if (value === "no" || value === "false" || value === "0") {
    return false;
  }
  throw new UserInputError(`Answer ${label}.`);
}

function jurisdictionFromParams(params: URLSearchParams): Jurisdiction {
  const jurisdiction = (params.get("jurisdiction") ?? "cook_county_il") as Jurisdiction;
  if (!(jurisdiction in SUPPORTED_JURISDICTIONS)) {
    throw new UserInputError("Appeal Compass currently supports only Cook County, Illinois.");
  }
  return jurisdiction;
}

function userEvidenceFromParams(params: URLSearchParams): UserEvidence {
  const ownershipType = requiredChoice(
    params,
    "ownershipType",
    ["individual", "llc", "corporation", "other"] as const,
    "an ownership type",
  );
  if (ownershipType !== "individual") {
    throw new UserInputError(ENTITY_REFUSAL_MESSAGE);
  }
  const assessorAppealFiled = requiredBoolean(
    params,
    "assessorAppealFiled",
    "whether you already filed an Assessor appeal",
  );
  const assessorDecisionReceived = assessorAppealFiled
    ? requiredBoolean(
        params,
        "assessorDecisionReceived",
        "whether you received the Assessor decision",
      )
    : null;
  const borAppealFiled = requiredBoolean(
    params,
    "borAppealFiled",
    "whether you already filed a Board of Review appeal",
  );
  const borDecisionReceived = borAppealFiled
    ? requiredBoolean(params, "borDecisionReceived", "whether you received the BOR decision")
    : null;
  const borDecisionDate = borDecisionReceived
    ? (params.get("borDecisionDate")?.trim() ?? null)
    : null;
  return defaultUserEvidence({
    purchasePrice: positiveNumber(params, "purchasePrice"),
    purchaseDate: params.get("purchaseDate"),
    appraisalValue: positiveNumber(params, "appraisalValue"),
    appraisalDate: params.get("appraisalDate"),
    conditionIssues: params.getAll("conditionIssue").filter(Boolean),
    ownershipType,
    ownerOccupied: booleanFlag(params, "ownerOccupied") ? true : null,
    age65Plus: booleanFlag(params, "age65Plus") ? true : null,
    householdIncomeBelow65k: booleanFlag(params, "seniorFreezeIncome") ? true : null,
    veteranDisabled: booleanFlag(params, "veteranDisabled") ? true : null,
    personDisabled: booleanFlag(params, "personDisabled") ? true : null,
    vacancyClaim: booleanFlag(params, "vacancyClaim"),
    demolitionClaim: booleanFlag(params, "demolitionClaim"),
    assessorAppealFiled,
    assessorDecisionReceived,
    borAppealFiled,
    borDecisionReceived,
    borDecisionDate,
    actualSqft: positiveNumber(params, "actualSqft"),
    actualAv: positiveNumber(params, "actualAv"),
    actualImprovementAv: positiveNumber(params, "actualImprovementAv"),
  });
}

function appealStatusFromEvidence(userEvidence: UserEvidence): AppealStatusInput {
  return {
    assessorAppealFiled: userEvidence.assessorAppealFiled === true,
    assessorDecisionReceived: userEvidence.assessorDecisionReceived,
    borAppealFiled: userEvidence.borAppealFiled === true,
    borDecisionReceived: userEvidence.borDecisionReceived,
    borDecisionDate: userEvidence.borDecisionDate,
  };
}

export async function buildCasePayload(
  repo: CaseRepository,
  params: URLSearchParams,
  demo: boolean,
): Promise<CasePayload> {
  const pin = params.get("pin") ?? "";
  const today = params.get("today") ?? todayIso();
  jurisdictionFromParams(params);
  const requestedVenue = (params.get("venue") ?? "auto") as Venue;
  const taxRate = positiveNumber(params, "taxRate") ?? DEFAULT_TAX_RATE;
  const userEvidence = userEvidenceFromParams(params);
  const caseFile = withUserEvidence(await repo.loadCaseByPin(pin), userEvidence);
  const routing = routeCase(
    caseFile.parcel.townshipName,
    today,
    requestedVenue,
    userEvidence.borDecisionDate,
    appealStatusFromEvidence(userEvidence),
  );
  const evidence = buildEvidenceSummary(caseFile, taxRate, routing.venue);
  const adapter = adapterForVenue(routing.venue);
  const sections = adapter.sections(caseFile, evidence, routing);
  return {
    ok: true,
    demo,
    generatedAt: new Date().toISOString(),
    today,
    case: caseFile,
    routing,
    evidence,
    venue: {
      key: adapter.venueKey,
      name: adapter.venueName,
      officialUrl: adapter.officialUrl,
      checklist: adapter.checklist(caseFile),
      sections,
    },
    warnings: [
      ...routing.warnings,
      ...caseFile.dataWarnings,
      ...evidence.comparableAnalysis.warnings,
    ],
  };
}

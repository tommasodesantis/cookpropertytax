export type Venue = "auto" | "assessor" | "bor" | "ptab";
export type Jurisdiction = "cook_county_il";
export type ResolvedVenue = "assessor" | "bor" | "ptab" | "closed";
export type EvidenceTier = "STRONG" | "MODERATE" | "LIMITED";
export type ActionStatus = "open" | "upcoming" | "closed" | "urgent" | "expired" | "needs_input";
export type ComparableStatus = "ok" | "condo" | "insufficient_data";
export type ArgumentStrength = "strong" | "supporting";

export interface Parcel {
  pin: string;
  pinFormatted: string;
  propertyClass: string;
  townshipName: string;
  address: string;
  city: string;
  zipCode: string;
  neighborhood: string | null;
  townshipCode: string | null;
  buildingSqft: number | null;
  landSqft: number | null;
  yearBuilt: number | null;
  style: string | null;
  amenityCount: number;
  beds: number | null;
  fullBaths: number | null;
  lat: number | null;
  lon: number | null;
  currentAv: number | null;
  currentImprovementAv: number | null;
  priorFinalAv: number | null;
}

export interface Comparable {
  pin: string;
  pinFormatted: string;
  address: string;
  buildingSqft: number | null;
  yearBuilt: number | null;
  assessmentYear: number | null;
  av: number | null;
  improvementAv: number | null;
  landSqft: number | null;
  style: string | null;
  amenityCount: number;
  neighborhood: string | null;
  lat: number | null;
  lon: number | null;
}

export interface Sale {
  saleDate: string;
  salePrice: number;
  source: string;
}

export interface AssessmentHistoryRow {
  year: number;
  mailedAv: number | null;
  certifiedAv: number | null;
  boardAv: number | null;
  finalAv: number | null;
}

export interface UserEvidence {
  purchasePrice: number | null;
  purchaseDate: string | null;
  appraisalValue: number | null;
  appraisalDate: string | null;
  ownershipType: "individual" | "llc" | "corporation" | "other";
  assessorAppealFiled: boolean | null;
  assessorDecisionReceived: boolean | null;
  borAppealFiled: boolean | null;
  borDecisionReceived: boolean | null;
  borDecisionDate: string | null;
  actualSqft: number | null;
  actualAv: number | null;
  actualImprovementAv: number | null;
}

export interface CaseFile {
  parcel: Parcel;
  assessmentHistory: AssessmentHistoryRow[];
  comparables: Comparable[];
  subjectSales: Sale[];
  userEvidence: UserEvidence;
  dataWarnings: string[];
}

export interface ComparableExhibit {
  comparable: Comparable;
  avPerSqft: number;
  distanceKm: number | null;
  similarity: number;
}

export interface ComparableAnalysis {
  status: ComparableStatus;
  note: string;
  profileKey: string;
  profileLabel: string;
  metricLabel: string;
  warnings: string[];
  missingDataRate: number | null;
  scope: string | null;
  poolSize: number;
  subjectAvPerSqft: number | null;
  medianAvPerSqft: number | null;
  percentile: number | null;
  gapPct: number | null;
  exhibit: ComparableExhibit[];
}

export interface EvidenceArgument {
  argumentType: string;
  strength: ArgumentStrength;
  text: string;
  targetAv: number | null;
  estimatedSavings: number | null;
}

export interface SavingsAssumption {
  taxRate: number;
  stateEqualizer: number;
  low: number;
  point: number;
  high: number;
}

export interface EvidenceSummary {
  tier: EvidenceTier;
  tierMessage: string;
  comparableAnalysis: ComparableAnalysis;
  arguments: EvidenceArgument[];
  impliedMarketValue: number | null;
  savingsAssumptions: SavingsAssumption;
  disclaimers: string[];
}

export interface RouteResult {
  venue: ResolvedVenue;
  headline: string;
  reasoning: string[];
  actionStatus: ActionStatus;
  deadline: string | null;
  daysRemaining: number | null;
  warnings: string[];
  officialUrl: string | null;
}

export interface PacketSection {
  title: string;
  lines: string[];
}

export function defaultUserEvidence(overrides: Partial<UserEvidence> = {}): UserEvidence {
  return {
    purchasePrice: null,
    purchaseDate: null,
    appraisalValue: null,
    appraisalDate: null,
    ownershipType: "individual",
    assessorAppealFiled: null,
    assessorDecisionReceived: null,
    borAppealFiled: null,
    borDecisionReceived: null,
    borDecisionDate: null,
    actualSqft: null,
    actualAv: null,
    actualImprovementAv: null,
    ...overrides,
  };
}

export function withUserEvidence(caseFile: CaseFile, userEvidence: UserEvidence): CaseFile {
  return {
    ...caseFile,
    userEvidence,
  };
}

export function isCondo(parcel: Parcel): boolean {
  return parcel.propertyClass.trim() === "299" || parcel.propertyClass.trim() === "399";
}

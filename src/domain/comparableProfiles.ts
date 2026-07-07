import type { ResolvedVenue } from "./models";

export type AssessmentMetric = "total_av" | "improvement_av";

export interface SimilarityStep {
  sqftTolerance: number;
  yearTolerance: number;
}

export interface ComparableProfile {
  key: string;
  venueLabel: string;
  metric: AssessmentMetric;
  metricLabel: string;
  minimumComparables: number;
  targetComparables: number;
  similaritySteps: SimilarityStep[];
  preferSameNeighborhoodMinimum: number;
  requireYear: boolean;
  requireLand: boolean;
  requireStyle: boolean;
  requireAmenity: boolean;
  landTolerance: number | null;
  feasibilityVerdict: string;
  sourceNote: string;
}

export const ASSESSOR_PROFILE: ComparableProfile = {
  key: "assessor",
  venueLabel: "Cook County Assessor",
  metric: "total_av",
  metricLabel: "total assessed value",
  minimumComparables: 3,
  targetComparables: 8,
  similaritySteps: [
    { sqftTolerance: 0.25, yearTolerance: 15 },
    { sqftTolerance: 0.4, yearTolerance: 25 },
    { sqftTolerance: 0.6, yearTolerance: 40 },
  ],
  preferSameNeighborhoodMinimum: 15,
  requireYear: false,
  requireLand: false,
  requireStyle: false,
  requireAmenity: false,
  landTolerance: null,
  feasibilityVerdict: "FEASIBLE-WITH-CAVEATS",
  sourceNote:
    "Profile verified against reachable Phase 2 official guidance and measured in reports/comps_feasibility_2026-07-06.md.",
};

export const BOR_PROFILE: ComparableProfile = {
  key: "bor",
  venueLabel: "Cook County Board of Review",
  metric: "improvement_av",
  metricLabel: "building assessment",
  minimumComparables: 3,
  targetComparables: 8,
  similaritySteps: [
    { sqftTolerance: 0.25, yearTolerance: 15 },
    { sqftTolerance: 0.35, yearTolerance: 20 },
    { sqftTolerance: 0.5, yearTolerance: 35 },
  ],
  preferSameNeighborhoodMinimum: 3,
  requireYear: false,
  requireLand: false,
  requireStyle: false,
  requireAmenity: false,
  landTolerance: null,
  feasibilityVerdict: "FEASIBLE-WITH-CAVEATS",
  sourceNote:
    "BOR public rules do not publish a PTAB-style grid; this profile uses the measured building-assessment-per-square-foot path from Phase 2 feasibility.",
};

export const PTAB_PROFILE: ComparableProfile = {
  key: "ptab",
  venueLabel: "Illinois PTAB",
  metric: "improvement_av",
  metricLabel: "improvement assessment",
  minimumComparables: 3,
  targetComparables: 6,
  similaritySteps: [{ sqftTolerance: 0.25, yearTolerance: 15 }],
  preferSameNeighborhoodMinimum: 3,
  requireYear: true,
  requireLand: true,
  requireStyle: true,
  requireAmenity: true,
  landTolerance: 0.5,
  feasibilityVerdict: "NOT FEASIBLE",
  sourceNote:
    "Full PTAB grid alignment is blocked by public-data limits; see BLOCKERS.md and reports/comps_feasibility_2026-07-06.md.",
};

export const PROFILES_BY_VENUE: Record<ResolvedVenue, ComparableProfile> = {
  assessor: ASSESSOR_PROFILE,
  bor: BOR_PROFILE,
  ptab: PTAB_PROFILE,
  closed: ASSESSOR_PROFILE,
};

export function profileForVenue(venue: ResolvedVenue | null): ComparableProfile {
  return PROFILES_BY_VENUE[venue ?? "assessor"];
}

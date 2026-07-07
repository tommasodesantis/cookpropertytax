import type { ComparableProfile } from "./comparableProfiles";
import { ASSESSOR_PROFILE, profileForVenue } from "./comparableProfiles";
import { ASSESSMENT_LEVEL, NOT_LEGAL_ADVICE, STATE_EQUALIZER } from "./config";
import { estimatedSavingsRange, gapPct, medianValue, percentileRank, safeDiv } from "./math";
import type {
  ArgumentStrength,
  CaseFile,
  Comparable,
  ComparableAnalysis,
  ComparableExhibit,
  EvidenceArgument,
  EvidenceSummary,
  EvidenceTier,
  Parcel,
  ResolvedVenue,
} from "./models";
import { isCondo } from "./models";

function distanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null,
): number | null {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }
  const radius = 6371.0;
  const p1 = (Math.PI * lat1) / 180;
  const p2 = (Math.PI * lat2) / 180;
  const dphi = (Math.PI * (lat2 - lat1)) / 180;
  const dlambda = (Math.PI * (lon2 - lon1)) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlambda / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function similarity(subject: CaseFile, comp: Comparable): number {
  const parcel = subject.parcel;
  let score = 0;
  if (parcel.buildingSqft && comp.buildingSqft) {
    score += (0.5 * Math.abs(comp.buildingSqft - parcel.buildingSqft)) / parcel.buildingSqft;
  } else {
    score += 0.5;
  }
  if (parcel.yearBuilt && comp.yearBuilt) {
    score += 0.3 * Math.min(Math.abs(comp.yearBuilt - parcel.yearBuilt) / 50, 1);
  } else {
    score += 0.15;
  }
  const distance = distanceKm(parcel.lat, parcel.lon, comp.lat, comp.lon);
  score += 0.2 * Math.min((distance ?? 1) / 2, 1);
  return score;
}

function subjectMetricValue(parcel: Parcel, profile: ComparableProfile): number | null {
  if (profile.metric === "improvement_av") {
    return parcel.currentImprovementAv;
  }
  return parcel.currentAv;
}

function effectiveSqft(caseFile: CaseFile): number | null {
  return caseFile.parcel.buildingSqft || caseFile.userEvidence.actualSqft;
}

function effectiveTotalAv(caseFile: CaseFile): number | null {
  return caseFile.parcel.currentAv || caseFile.userEvidence.actualAv;
}

function effectiveMetricValue(caseFile: CaseFile, profile: ComparableProfile): number | null {
  const official = subjectMetricValue(caseFile.parcel, profile);
  if (official) {
    return official;
  }
  if (profile.metric === "improvement_av") {
    return caseFile.userEvidence.actualImprovementAv;
  }
  return caseFile.userEvidence.actualAv;
}

function userSuppliedWarnings(caseFile: CaseFile, profile: ComparableProfile): string[] {
  const warnings: string[] = [];
  if (caseFile.parcel.buildingSqft === null && caseFile.userEvidence.actualSqft) {
    warnings.push(
      "Using user-supplied building sqft for comparable analysis; document it with a property record card, appraisal, plans, or other reliable source.",
    );
  }
  if (caseFile.parcel.currentAv === null && caseFile.userEvidence.actualAv) {
    warnings.push(
      "Using user-supplied current total assessed value for analysis; attach official assessment documentation.",
    );
  }
  if (
    profile.metric === "improvement_av" &&
    caseFile.parcel.currentImprovementAv === null &&
    caseFile.userEvidence.actualImprovementAv
  ) {
    warnings.push(
      "Using user-supplied building/improvement assessment for comparable analysis; document it with the property record card or official assessment notice.",
    );
  }
  return warnings;
}

function missingSubjectFlags(caseFile: CaseFile, profile: ComparableProfile): string[] {
  const flags: string[] = [];
  if (!effectiveSqft(caseFile)) {
    flags.push("--actual-sqft");
  }
  if (profile.metric === "improvement_av") {
    if (!effectiveMetricValue(caseFile, profile)) {
      flags.push("--actual-improvement-av");
    }
  } else if (!effectiveMetricValue(caseFile, profile)) {
    flags.push("--actual-av");
  }
  return flags;
}

function comparableMetricValue(comp: Comparable, profile: ComparableProfile): number | null {
  if (profile.metric === "improvement_av") {
    return comp.improvementAv;
  }
  return comp.av;
}

function profiledAnalysis(input: {
  status: ComparableAnalysis["status"];
  note: string;
  profile: ComparableProfile;
  warnings?: string[];
  missingDataRate?: number | null;
  scope?: string | null;
  poolSize?: number;
  subjectAvPerSqft?: number | null;
  medianAvPerSqft?: number | null;
  percentile?: number | null;
  gap?: number | null;
  exhibit?: ComparableExhibit[];
}): ComparableAnalysis {
  return {
    status: input.status,
    note: input.note,
    profileKey: input.profile.key,
    profileLabel: input.profile.venueLabel,
    metricLabel: input.profile.metricLabel,
    warnings: input.warnings ?? [],
    missingDataRate: input.missingDataRate ?? null,
    scope: input.scope ?? null,
    poolSize: input.poolSize ?? 0,
    subjectAvPerSqft: input.subjectAvPerSqft ?? null,
    medianAvPerSqft: input.medianAvPerSqft ?? null,
    percentile: input.percentile ?? null,
    gapPct: input.gap ?? null,
    exhibit: input.exhibit ?? [],
  };
}

function passesYearFilter(parcel: Parcel, comp: Comparable, profile: ComparableProfile): boolean {
  const lastStep = profile.similaritySteps[profile.similaritySteps.length - 1];
  const tolerance = lastStep?.yearTolerance ?? 0;
  if (profile.requireYear) {
    return (
      parcel.yearBuilt !== null &&
      comp.yearBuilt !== null &&
      Math.abs(comp.yearBuilt - parcel.yearBuilt) <= tolerance
    );
  }
  return (
    parcel.yearBuilt === null ||
    comp.yearBuilt === null ||
    Math.abs(comp.yearBuilt - parcel.yearBuilt) <= tolerance
  );
}

function passesProfileRequirements(
  parcel: Parcel,
  comp: Comparable,
  profile: ComparableProfile,
): boolean {
  if (!passesYearFilter(parcel, comp, profile)) {
    return false;
  }
  if (profile.requireLand) {
    if (!parcel.landSqft || !comp.landSqft) {
      return false;
    }
    const tolerance = profile.landTolerance ?? 1;
    const low = parcel.landSqft * (1 - tolerance);
    const high = parcel.landSqft * (1 + tolerance);
    if (!(low <= comp.landSqft && comp.landSqft <= high)) {
      return false;
    }
  }
  if (profile.requireStyle) {
    if (parcel.style && comp.style !== parcel.style) {
      return false;
    }
    if (!parcel.style && !comp.style) {
      return false;
    }
  }
  return !(profile.requireAmenity && comp.amenityCount <= 0);
}

function targetTotalAv(caseFile: CaseFile, profile: ComparableProfile, targetMetricValue: number) {
  const currentTotal = effectiveTotalAv(caseFile);
  const currentImprovement =
    caseFile.parcel.currentImprovementAv || caseFile.userEvidence.actualImprovementAv;
  if (profile.metric === "improvement_av" && currentImprovement && currentTotal) {
    const reduction = Math.max(0, currentImprovement - targetMetricValue);
    return Math.max(0, currentTotal - reduction);
  }
  return targetMetricValue;
}

function condoMissingDataRate(caseFile: CaseFile, profile: ComparableProfile): number {
  const candidates = caseFile.comparables.filter((comp) => comp.pin !== caseFile.parcel.pin);
  if (candidates.length === 0) {
    return 100;
  }
  let missing = 0;
  for (const comp of candidates) {
    const metricValue = comparableMetricValue(comp, profile);
    if (!comp.buildingSqft || comp.buildingSqft <= 0 || !metricValue || metricValue <= 0) {
      missing += 1;
    }
  }
  return Math.round((1000 * missing) / candidates.length) / 10;
}

function condoReliability(
  caseFile: CaseFile,
  profile: ComparableProfile,
): { shouldRun: boolean; warnings: string[]; missingRate: number } {
  const missingRate = condoMissingDataRate(caseFile, profile);
  if (missingRate > 50) {
    return { shouldRun: false, warnings: [], missingRate };
  }
  if (missingRate >= 30) {
    return {
      shouldRun: true,
      warnings: [
        `Condo comparable analysis is less reliable because ${missingRate.toFixed(
          0,
        )}% of public condo candidates are missing unit sqft or ${profile.metricLabel}.`,
      ],
      missingRate,
    };
  }
  return { shouldRun: true, warnings: [], missingRate };
}

export function analyzeComparables(
  caseFile: CaseFile,
  maxComps = 10,
  profile: ComparableProfile = ASSESSOR_PROFILE,
): ComparableAnalysis {
  const parcel = caseFile.parcel;
  let warnings = userSuppliedWarnings(caseFile, profile);
  let missingDataRate: number | null = null;

  if (isCondo(parcel)) {
    const reliability = condoReliability(caseFile, profile);
    warnings = reliability.warnings;
    missingDataRate = reliability.missingRate;
    if (!reliability.shouldRun) {
      return profiledAnalysis({
        status: "condo",
        note: `Condo comparable analysis skipped after measuring ${missingDataRate.toFixed(
          0,
        )}% missing unit sqft or ${
          profile.metricLabel
        } in the public condo candidate pool. Use sale, appraisal, building-level equity, or factual-error evidence.`,
        profile,
        missingDataRate,
      });
    }
  }

  const subjectMetric = effectiveMetricValue(caseFile, profile);
  const subjectSqft = effectiveSqft(caseFile);
  const subjectPsf = safeDiv(subjectMetric, subjectSqft);
  if (subjectPsf === null || subjectSqft === null || subjectSqft <= 0) {
    const flags = missingSubjectFlags(caseFile, profile);
    const flagText = flags.length > 0 ? flags.join(" ") : "documented subject-data override flags";
    return profiledAnalysis({
      status: "insufficient_data",
      note: `Missing subject building square footage or ${profile.metricLabel}. Re-run with ${flagText} if you can document the missing value.`,
      profile,
      warnings,
      missingDataRate,
    });
  }

  const candidates = caseFile.comparables.filter((comp) => {
    const metricValue = comparableMetricValue(comp, profile);
    return (
      comp.pin !== parcel.pin &&
      metricValue !== null &&
      metricValue > 0 &&
      comp.buildingSqft !== null &&
      comp.buildingSqft > 0 &&
      passesProfileRequirements(parcel, comp, profile)
    );
  });

  let selected: Comparable[] = [];
  let scope = "township";
  for (const step of profile.similaritySteps) {
    const scoped = candidates.filter(
      (comp) =>
        comp.buildingSqft !== null &&
        subjectSqft * (1 - step.sqftTolerance) <= comp.buildingSqft &&
        comp.buildingSqft <= subjectSqft * (1 + step.sqftTolerance) &&
        (parcel.yearBuilt === null ||
          comp.yearBuilt === null ||
          Math.abs(comp.yearBuilt - parcel.yearBuilt) <= step.yearTolerance),
    );
    const neighborhood = scoped.filter(
      (comp) => parcel.neighborhood !== null && comp.neighborhood === parcel.neighborhood,
    );
    if (neighborhood.length >= profile.preferSameNeighborhoodMinimum) {
      selected = neighborhood;
      scope = "neighborhood";
    } else {
      selected = scoped;
      scope = "township";
    }
    if (selected.length >= profile.targetComparables) {
      break;
    }
  }

  if (selected.length < profile.minimumComparables) {
    return profiledAnalysis({
      status: "insufficient_data",
      note: `Only ${selected.length} similar parcels found under the ${profile.venueLabel} profile; too few for a reliable exhibit.`,
      profile,
      warnings,
      missingDataRate,
      scope,
      poolSize: selected.length,
    });
  }

  const avPsfValues = selected
    .map((comp) => {
      const metricValue = comparableMetricValue(comp, profile);
      if (metricValue === null || comp.buildingSqft === null || comp.buildingSqft <= 0) {
        return null;
      }
      return metricValue / comp.buildingSqft;
    })
    .filter((value): value is number => value !== null);
  const medianPsf = medianValue(avPsfValues);
  const percentile = percentileRank(subjectPsf, avPsfValues);
  const gap = gapPct(subjectPsf, avPsfValues);
  const exhibits: ComparableExhibit[] = [];
  for (const comp of selected) {
    const compPsf = safeDiv(comparableMetricValue(comp, profile), comp.buildingSqft);
    if (compPsf === null || compPsf >= subjectPsf) {
      continue;
    }
    exhibits.push({
      comparable: comp,
      avPerSqft: compPsf,
      distanceKm: distanceKm(parcel.lat, parcel.lon, comp.lat, comp.lon),
      similarity: similarity(caseFile, comp),
    });
  }

  return profiledAnalysis({
    status: "ok",
    note: `Comparable analysis completed with the ${profile.venueLabel} profile using ${profile.metricLabel} per square foot.`,
    profile,
    warnings,
    missingDataRate,
    scope,
    poolSize: selected.length,
    subjectAvPerSqft: subjectPsf,
    medianAvPerSqft: medianPsf,
    percentile,
    gap,
    exhibit: exhibits.sort((a, b) => a.similarity - b.similarity).slice(0, maxComps),
  });
}

export function assessmentShockPct(caseFile: CaseFile): number | null {
  const current = caseFile.parcel.currentAv;
  const prior = caseFile.parcel.priorFinalAv;
  if (current === null || prior === null || prior <= 0) {
    return null;
  }
  return (100 * (current - prior)) / prior;
}

export function buildEvidenceSummary(
  caseFile: CaseFile,
  taxRate: number,
  venue: ResolvedVenue | null = null,
): EvidenceSummary {
  const parcel = caseFile.parcel;
  const profile = profileForVenue(venue);
  const comparableAnalysis = analyzeComparables(caseFile, 10, profile);
  const currentTotalAv = effectiveTotalAv(caseFile);
  const impliedMarket = currentTotalAv ? currentTotalAv / ASSESSMENT_LEVEL : null;
  const args: EvidenceArgument[] = [];
  let tierPoints = 0;

  if (comparableAnalysis.status === "ok") {
    const percentile = comparableAnalysis.percentile ?? 0;
    const gap = comparableAnalysis.gapPct ?? 0;
    let strength: ArgumentStrength = "supporting";
    if (percentile >= 75 && gap >= 10) {
      strength = "strong";
      tierPoints += 2;
    } else if (percentile >= 60 || gap >= 5) {
      tierPoints += 1;
    }
    if (gap > 0 && comparableAnalysis.medianAvPerSqft && effectiveSqft(caseFile)) {
      const targetMetric = comparableAnalysis.medianAvPerSqft * (effectiveSqft(caseFile) ?? 0);
      const targetAv = targetTotalAv(caseFile, profile, targetMetric);
      const [, point] = estimatedSavingsRange(
        (currentTotalAv ?? 0) - targetAv,
        STATE_EQUALIZER,
        taxRate,
      );
      args.push({
        argumentType: "uniformity",
        strength,
        text: `Your ${profile.metricLabel} per square foot is higher than ${percentile.toFixed(
          0,
        )}% of ${comparableAnalysis.poolSize} similar homes and ${gap.toFixed(
          0,
        )}% above their median.`,
        targetAv,
        estimatedSavings: point,
      });
    }
  }

  let evidenceValue: number | null = null;
  let evidenceSource: string | null = null;
  if (caseFile.subjectSales.length > 0) {
    const latest = [...caseFile.subjectSales].sort((a, b) =>
      b.saleDate.localeCompare(a.saleDate),
    )[0];
    if (latest) {
      evidenceValue = latest.salePrice;
      evidenceSource = `recorded sale on ${latest.saleDate}`;
    }
  }
  if (caseFile.userEvidence.purchasePrice) {
    evidenceValue = caseFile.userEvidence.purchasePrice;
    const when = caseFile.userEvidence.purchaseDate ?? "date n/a";
    evidenceSource = `reported purchase on ${when}`;
  }
  if (caseFile.userEvidence.appraisalValue) {
    evidenceValue = caseFile.userEvidence.appraisalValue;
    const when = caseFile.userEvidence.appraisalDate ?? "date n/a";
    evidenceSource = `reported appraisal on ${when}`;
  }

  if (evidenceValue && impliedMarket && evidenceValue > 0 && evidenceValue < impliedMarket) {
    const over = (100 * (impliedMarket - evidenceValue)) / evidenceValue;
    tierPoints += over >= 10 ? 2 : 1;
    const targetAv = evidenceValue * ASSESSMENT_LEVEL;
    const [, point] = estimatedSavingsRange(
      (currentTotalAv ?? 0) - targetAv,
      STATE_EQUALIZER,
      taxRate,
    );
    args.push({
      argumentType: "overvaluation",
      strength: over >= 10 ? "strong" : "supporting",
      text: `The implied market value is ${over.toFixed(0)}% above the ${evidenceSource} of $${Math.round(
        evidenceValue,
      ).toLocaleString("en-US")}.`,
      targetAv,
      estimatedSavings: point,
    });
  }

  if (caseFile.userEvidence.actualSqft && parcel.buildingSqft) {
    const sqftDelta = parcel.buildingSqft - caseFile.userEvidence.actualSqft;
    if (Math.abs(sqftDelta) / parcel.buildingSqft >= 0.05) {
      tierPoints += 2;
      args.push({
        argumentType: "property_description",
        strength: "strong",
        text: `The Assessor record shows ${parcel.buildingSqft.toLocaleString(
          "en-US",
        )} sqft, but you reported ${caseFile.userEvidence.actualSqft.toLocaleString(
          "en-US",
        )} sqft. A documented factual correction is strongest at the Assessor level.`,
        targetAv: null,
        estimatedSavings: null,
      });
    }
  }

  const shock = assessmentShockPct(caseFile);
  if (shock !== null && shock >= 15) {
    tierPoints += 1;
    args.push({
      argumentType: "assessment_shock",
      strength: "supporting",
      text: `Current assessed value increased ${shock.toFixed(0)}% from the prior final value.`,
      targetAv: null,
      estimatedSavings: null,
    });
  }

  if (caseFile.userEvidence.conditionIssues.length > 0) {
    args.push({
      argumentType: "condition",
      strength: "supporting",
      text: `Reported condition issues: ${caseFile.userEvidence.conditionIssues.join(
        "; ",
      )}. Attach dated photos and repair estimates.`,
      targetAv: null,
      estimatedSavings: null,
    });
  }

  let tier: EvidenceTier;
  let tierMessage: string;
  if (tierPoints >= 3) {
    tier = "STRONG";
    tierMessage = "Multiple independent grounds support spending time on an appeal.";
  } else if (tierPoints >= 1) {
    tier = "MODERATE";
    tierMessage = "At least one credible ground supports an appeal.";
  } else {
    tier = "LIMITED";
    tierMessage =
      "Public data alone is limited. Appealing is free, but add sale, appraisal, condition, or factual-error evidence before investing significant time.";
  }

  const pointSavings = Math.max(0, ...args.map((argument) => argument.estimatedSavings ?? 0));
  return {
    tier,
    tierMessage,
    comparableAnalysis,
    arguments: args,
    impliedMarketValue: impliedMarket,
    savingsAssumptions: {
      taxRate,
      stateEqualizer: STATE_EQUALIZER,
      low: pointSavings * 0.8,
      point: pointSavings,
      high: pointSavings * 1.2,
    },
    disclaimers: [
      NOT_LEGAL_ADVICE,
      "Estimated savings are rough ranges, not promises. Taxes must still be paid on time.",
    ],
  };
}

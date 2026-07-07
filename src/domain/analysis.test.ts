import { analyzeComparables, buildEvidenceSummary } from "./analysis";
import { BOR_PROFILE, PTAB_PROFILE } from "./comparableProfiles";
import { type CaseFile, type Comparable, defaultUserEvidence, withUserEvidence } from "./models";
import { loadFixtureCase, makeComparable } from "./testHelpers";

function condoCaseWithMissingRate(missingCount: number, totalCount: number): CaseFile {
  const caseFile = loadFixtureCase("03000000000001");
  const comps: Comparable[] = [];
  for (let index = 0; index < totalCount; index += 1) {
    const missing = index < missingCount;
    comps.push(
      makeComparable({
        pin: `0300000099${index.toString().padStart(4, "0")}`,
        pinFormatted: `03-00-000-099-${index.toString().padStart(4, "0")}`,
        address: `${index} CONDO ST`,
        buildingSqft: missing ? null : 980 + index,
        yearBuilt: 1980,
        av: missing ? null : 35000 + index * 1000,
        neighborhood: "0199",
        lat: 41.9902 + index * 0.0001,
        lon: -87.6972 - index * 0.0001,
      }),
    );
  }
  return {
    ...caseFile,
    parcel: {
      ...caseFile.parcel,
      propertyClass: "299",
      currentAv: 60000,
      buildingSqft: 1000,
      yearBuilt: 1980,
      neighborhood: "0199",
    },
    comparables: comps,
    subjectSales: [],
  };
}

test("comparable analysis known fixture is strong", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const comps = analyzeComparables(caseFile);
  expect(comps.status).toBe("ok");
  expect(comps.profileKey).toBe("assessor");
  expect(comps.poolSize).toBe(10);
  expect(comps.percentile).not.toBeNull();
  expect(comps.percentile ?? 0).toBeGreaterThanOrEqual(75);
  expect(comps.gapPct).not.toBeNull();
  expect(comps.gapPct ?? 0).toBeGreaterThan(10);
});

test("condo degrades after measuring empty pool", () => {
  const caseFile = loadFixtureCase("03000000000020");
  const comps = analyzeComparables(caseFile);
  expect(comps.status).toBe("condo");
  expect(comps.missingDataRate).toBe(100);
  expect(comps.note).toContain("100%");
});

test("condo missing rate above 50 skips with measured note", () => {
  const analysis = analyzeComparables(condoCaseWithMissingRate(6, 10));
  expect(analysis.status).toBe("condo");
  expect(analysis.missingDataRate).toBe(60);
  expect(analysis.note).toContain("60%");
});

test("condo missing rate 30 to 50 runs with warning", () => {
  const analysis = analyzeComparables(condoCaseWithMissingRate(4, 10));
  expect(analysis.status).toBe("ok");
  expect(analysis.missingDataRate).toBe(40);
  expect(analysis.warnings[0]).toContain("40%");
});

test("condo missing rate below 30 runs without warning", () => {
  const analysis = analyzeComparables(condoCaseWithMissingRate(2, 10));
  expect(analysis.status).toBe("ok");
  expect(analysis.missingDataRate).toBe(20);
  expect(analysis.warnings).toEqual([]);
});

test("missing characteristics degrade without crashing", () => {
  const caseFile = loadFixtureCase("03000000000030");
  const comps = analyzeComparables(caseFile);
  expect(comps.status).toBe("insufficient_data");
  expect(comps.note).toContain("--actual-sqft");
});

test("missing sqft with user override completes and labels source", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const overrideCase = {
    ...withUserEvidence(caseFile, defaultUserEvidence({ actualSqft: 1800 })),
    parcel: { ...caseFile.parcel, buildingSqft: null },
    subjectSales: [],
  };
  const analysis = analyzeComparables(overrideCase);
  expect(analysis.status).toBe("ok");
  expect(analysis.warnings.some((warning) => warning.includes("user-supplied building sqft"))).toBe(
    true,
  );
  expect(overrideCase.parcel.buildingSqft).toBeNull();
});

test("missing total AV guidance names actual AV flag", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const missingAvCase = { ...caseFile, parcel: { ...caseFile.parcel, currentAv: null } };
  const analysis = analyzeComparables(missingAvCase);
  expect(analysis.status).toBe("insufficient_data");
  expect(analysis.note).toContain("--actual-av");
});

test("BOR missing improvement AV guidance names improvement flag", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const comps = caseFile.comparables
    .filter((comp) => comp.av !== null)
    .map((comp) => ({ ...comp, improvementAv: comp.av }));
  const missingImprovementCase = { ...caseFile, comparables: comps };
  const analysis = analyzeComparables(missingImprovementCase, 10, BOR_PROFILE);
  expect(analysis.status).toBe("insufficient_data");
  expect(analysis.note).toContain("--actual-improvement-av");
});

test("BOR user improvement AV override completes without mutating official record", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const comps = caseFile.comparables
    .filter((comp) => comp.av !== null)
    .map((comp) => ({ ...comp, improvementAv: comp.av }));
  const overrideCase = {
    ...withUserEvidence(caseFile, defaultUserEvidence({ actualImprovementAv: 60000 })),
    comparables: comps,
    subjectSales: [],
  };
  const analysis = analyzeComparables(overrideCase, 10, BOR_PROFILE);
  expect(analysis.status).toBe("ok");
  expect(
    analysis.warnings.some((warning) => warning.includes("user-supplied building/improvement")),
  ).toBe(true);
  expect(overrideCase.parcel.currentImprovementAv).toBeNull();
});

test("evidence summary has honest strong tier", () => {
  const evidence = buildEvidenceSummary(loadFixtureCase("03000000000001"), 0.1);
  expect(evidence.tier).toBe("STRONG");
  expect(evidence.savingsAssumptions.point).toBeGreaterThan(0);
});

test("comparable analysis uses neighborhood scope", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const comps = Array.from({ length: 16 }, (_, index) =>
    makeComparable({
      pin: `0300000001${index.toString().padStart(4, "0")}`,
      pinFormatted: `03-00-000-001-${index.toString().padStart(4, "0")}`,
      address: `${index} TEST ST`,
      buildingSqft: 1750 + index,
      yearBuilt: index === 0 ? null : 1924,
      av: 35000 + index * 1000,
      neighborhood: "0101",
      lat: index === 0 ? null : 41.99,
      lon: index === 0 ? null : -87.69,
    }),
  );
  const analysis = analyzeComparables({ ...caseFile, comparables: comps });
  expect(analysis.status).toBe("ok");
  expect(analysis.scope).toBe("neighborhood");
  expect(analysis.poolSize).toBe(16);
});

test("comparable analysis rejects too few comps", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const analysis = analyzeComparables({
    ...caseFile,
    comparables: caseFile.comparables.slice(0, 2),
  });
  expect(analysis.status).toBe("insufficient_data");
  expect(analysis.note).toContain("too few");
});

test("BOR profile uses improvement assessment metric", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const parcel = { ...caseFile.parcel, currentAv: 120000, currentImprovementAv: 90000 };
  const comps = Array.from({ length: 5 }, (_, index) =>
    makeComparable({
      pin: `0300000003${index.toString().padStart(4, "0")}`,
      pinFormatted: `03-00-000-003-${index.toString().padStart(4, "0")}`,
      address: `${index} BOR ST`,
      buildingSqft: 1800,
      yearBuilt: 1924,
      av: 140000,
      improvementAv: 60000 + index * 1000,
      neighborhood: "0101",
      lat: 41.9902,
      lon: -87.6972,
    }),
  );
  const analysis = analyzeComparables(
    { ...caseFile, parcel, comparables: comps, subjectSales: [] },
    10,
    BOR_PROFILE,
  );
  expect(analysis.status).toBe("ok");
  expect(analysis.profileKey).toBe("bor");
  expect(analysis.metricLabel).toBe("building assessment");
  expect(analysis.subjectAvPerSqft).toBe(50);
  expect(analysis.medianAvPerSqft).not.toBeNull();
  expect(analysis.medianAvPerSqft ?? 0).toBeLessThan(analysis.subjectAvPerSqft ?? 0);
});

test("PTAB profile can run when strict grid fields exist", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const parcel = {
    ...caseFile.parcel,
    currentAv: 120000,
    currentImprovementAv: 90000,
    landSqft: 4000,
    style: "1 Story|Frame|Average",
    amenityCount: 4,
  };
  const comps = Array.from({ length: 4 }, (_, index) =>
    makeComparable({
      pin: `0300000004${index.toString().padStart(4, "0")}`,
      pinFormatted: `03-00-000-004-${index.toString().padStart(4, "0")}`,
      address: `${index} PTAB ST`,
      buildingSqft: 1760 + index * 10,
      yearBuilt: 1920 + index,
      av: 115000,
      improvementAv: 62000 + index * 1000,
      landSqft: 3900 + index * 25,
      style: "1 Story|Frame|Average",
      amenityCount: 5,
      neighborhood: "0101",
      lat: 41.9902 + index * 0.0001,
      lon: -87.6972 - index * 0.0001,
    }),
  );
  const analysis = analyzeComparables(
    { ...caseFile, parcel, comparables: comps, subjectSales: [] },
    10,
    PTAB_PROFILE,
  );
  expect(analysis.status).toBe("ok");
  expect(analysis.profileKey).toBe("ptab");
  expect(analysis.poolSize).toBe(4);
  expect(analysis.exhibit).toHaveLength(4);
});

test("evidence summary supporting uniformity is moderate", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const parcel = { ...caseFile.parcel, currentAv: 45000, priorFinalAv: 45000 };
  const psfValues = [20, 21, 22, 23, 24, 26, 27, 28];
  const comps = psfValues.map((psf, index) =>
    makeComparable({
      pin: `0300000002${index.toString().padStart(4, "0")}`,
      pinFormatted: `03-00-000-002-${index.toString().padStart(4, "0")}`,
      address: `${index} MODERATE ST`,
      buildingSqft: 1800,
      yearBuilt: 1924,
      av: 1800 * psf,
      neighborhood: "0101",
    }),
  );
  const evidence = buildEvidenceSummary(
    { ...caseFile, parcel, comparables: comps, subjectSales: [] },
    0.1,
  );
  expect(evidence.tier).toBe("MODERATE");
  expect(evidence.arguments.some((argument) => argument.argumentType === "uniformity")).toBe(true);
});

test("evidence summary user evidence paths", () => {
  const caseFile = loadFixtureCase("03000000000001");
  const evidenceCase = {
    ...withUserEvidence(
      caseFile,
      defaultUserEvidence({
        purchasePrice: 500000,
        purchaseDate: "2024-06-01",
        appraisalValue: 420000,
        appraisalDate: "2024-08-01",
        actualSqft: 1600,
        conditionIssues: ["basement water damage"],
      }),
    ),
    subjectSales: [],
  };
  const evidence = buildEvidenceSummary(evidenceCase, 0.1);
  const argumentTypes = new Set(evidence.arguments.map((argument) => argument.argumentType));
  expect([...argumentTypes]).toEqual(
    expect.arrayContaining(["overvaluation", "property_description", "condition"]),
  );
  expect(evidence.arguments.some((argument) => argument.text.includes("reported appraisal"))).toBe(
    true,
  );
});

test("limited evidence path has no forced recommendation", () => {
  const caseFile = loadFixtureCase("03000000000030");
  const limitedCase = {
    ...caseFile,
    parcel: { ...caseFile.parcel, currentAv: 45000, priorFinalAv: 45000 },
    subjectSales: [],
  };
  const evidence = buildEvidenceSummary(limitedCase, 0.1);
  expect(evidence.tier).toBe("LIMITED");
  expect(evidence.arguments).toEqual([]);
});

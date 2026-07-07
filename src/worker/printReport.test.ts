import worker from "./index";

const REQUIRED_STEP_ONE = "ownershipType=individual&assessorAppealFiled=no&borAppealFiled=no";

async function printText(query: string): Promise<string> {
  const response = await worker.fetch(new Request(`http://example.test/print?${query}`), {});
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  return response.text();
}

function expectNoBannedText(html: string): void {
  expect(html).not.toContain("PLACEHOLDER");
  expect(html).not.toContain("undefined");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain(">null<");
  expect(html.toLowerCase()).not.toContain(" null ");
}

test("print route renders required Assessor packet sections", async () => {
  const html = await printText(
    `demo=1&pin=03-00-000-000-0001&venue=assessor&today=2026-05-01&${REQUIRED_STEP_ONE}`,
  );
  expect(html).toContain("Executive Summary");
  expect(html).toContain("Subject Property");
  expect(html).toContain("Evidence Tier");
  expect(html).toContain("Comparable Assessments");
  expect(html).toContain("Assessor Filing Instructions");
  expect(html).toContain("Assessor Checklist");
  expect(html).toContain("Exemptions and Certificate of Error Screen");
  expect(html).toContain("NOT LEGAL ADVICE");
  expect(html).toContain("Verify at the official source before filing");
  expect(html).toContain("Print / Save as PDF");
  expectNoBannedText(html);
});

test("print route renders PTAB public-data-limit language", async () => {
  const html = await printText(
    "demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01&ownershipType=individual&assessorAppealFiled=yes&assessorDecisionReceived=yes&borAppealFiled=yes&borDecisionReceived=yes&borDecisionDate=2026-05-20",
  );
  expect(html).toContain("PTAB Filing Instructions");
  expect(html).toContain("PTAB Checklist");
  expect(html).toContain("PTAB Comparable Grid Public-Data Limits");
  expect(html).toContain("Not available from public data - supply from your property record card");
  expect(html).toContain("Attach the BOR written decision notice");
  expectNoBannedText(html);
});

test("print route labels user-supplied subject values", async () => {
  const html = await printText(
    `demo=1&pin=03-00-000-000-0030&venue=bor&today=2025-07-10&actualSqft=1400&actualImprovementAv=30000&${REQUIRED_STEP_ONE}`,
  );
  expect(html).toContain("user-supplied; documentation required");
  expect(html).toContain("Building / improvement assessed value");
  expect(html).toContain("BOR Filing Instructions");
  expectNoBannedText(html);
});

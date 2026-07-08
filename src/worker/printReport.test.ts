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
  expect(html).toContain("<h1>Appeal Compass</h1>");
  expect(html).toContain("Back to Appeal Compass");
  expect(html).toContain('href="/"');
  expect(html).toContain("Packet produced:");
  expect(html).toContain("Subject property specifications");
  expect(html).toContain("Selected venue");
  expect(html).toContain("Cook County Assessor");
  expect(html).toContain("Comparable method");
  expect(html).toContain("same-class, same-township public records");
  expect(html).toContain("Comparable table");
  expect(html).toContain("Comparable analysis results");
  expect(html).toContain("Year built");
  expect(html).toContain("Sale date");
  expect(html).toContain("Sale price");
  expect(html).toContain("Assessment type");
  expect(html).toContain("Assessment $/sqft");
  expect(html).toContain("Similarity score");
  expect(html).toContain("approximate parcel-specific rate 7.7774%");
  expect(html).toContain("Cook County Clerk 2024 Tax Code Agency Rate file");
  expect(html).toContain("NOT LEGAL ADVICE");
  expect(html).not.toContain("Executive Summary");
  expect(html).not.toContain("Assessor Filing Instructions");
  expect(html).not.toContain("Assessor Checklist");
  expect(html).not.toContain("Exemptions and Certificate of Error Screen");
  expect(html).not.toContain("Verify at the official source before filing");
  expect(html).not.toContain("Socrata pagination");
  expect(html).toContain("Print / Save as PDF");
  expectNoBannedText(html);
});

test("print route suppresses user-facing calendar staleness warnings", async () => {
  const html = await printText(
    `demo=1&pin=03-00-000-000-0001&venue=assessor&today=2027-01-01&${REQUIRED_STEP_ONE}`,
  );
  expect(html).not.toContain("configured calendar is past");
  expect(html).not.toContain("Verify current deadlines");
  expect(html).not.toContain("Deadline:");
  expect(html).toContain("Comparable analysis results");
  expectNoBannedText(html);
});

test("print route omits PTAB checklist language from the simplified packet", async () => {
  const html = await printText(
    "demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01&ownershipType=individual&assessorAppealFiled=yes&assessorDecisionReceived=yes&borAppealFiled=yes&borDecisionReceived=yes&borDecisionDate=2026-05-20",
  );
  expect(html).toContain("Selected venue");
  expect(html).toContain("Illinois PTAB");
  expect(html).toContain("Comparable method");
  expect(html).not.toContain("PTAB Filing Instructions");
  expect(html).not.toContain("PTAB Checklist");
  expect(html).not.toContain("PTAB Comparable Grid Public-Data Limits");
  expect(html).not.toContain("Attach the BOR written decision notice");
  expectNoBannedText(html);
});

test("print route labels user-supplied subject values", async () => {
  const html = await printText(
    `demo=1&pin=03-00-000-000-0030&venue=bor&today=2025-07-10&actualSqft=1400&actualImprovementAv=30000&${REQUIRED_STEP_ONE}`,
  );
  expect(html).toContain("user-supplied; documentation required");
  expect(html).toContain("Current improvement assessed value");
  expect(html).not.toContain("BOR Filing Instructions");
  expect(html).not.toContain("2025TOWNSHIPOPEN-CLOSE.pdf");
  expectNoBannedText(html);
});

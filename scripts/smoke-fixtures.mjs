const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8787";
const requiredStepOne = "ownershipType=individual&assessorAppealFiled=no&borAppealFiled=no";
const ptabStepOne =
  "ownershipType=individual&assessorAppealFiled=yes&assessorDecisionReceived=yes&borAppealFiled=yes&borDecisionReceived=yes";

const checks = [
  {
    label: "assessor sample",
    path: `/api/case?demo=1&pin=03-00-000-000-0001&venue=assessor&today=2026-05-01&${requiredStepOne}`,
    expect: ["\"venue\":\"assessor\"", "\"tier\":\"STRONG\""],
  },
  {
    label: "bor sample",
    path: `/api/case?demo=1&pin=03-00-000-000-0001&venue=bor&today=2025-07-10&${requiredStepOne}`,
    expect: ["\"venue\":\"bor\"", "\"BOR Rules Checklist\""],
  },
  {
    label: "ptab sample",
    path: `/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01&${ptabStepOne}&borDecisionDate=2026-05-20`,
    expect: ["\"venue\":\"ptab\"", "\"PTAB Checklist\""],
  },
  {
    label: "ptab needs input",
    path: `/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01&${ptabStepOne}`,
    expect: ["\"actionStatus\":\"needs_input\"", "refuses to guess"],
  },
  {
    label: "ptab expired",
    path: `/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-07-06&${ptabStepOne}&borDecisionDate=2026-05-20`,
    expect: ["\"actionStatus\":\"expired\"", "Deadline was 2026-06-19"],
  },
  {
    label: "condo missing data",
    path: `/api/case?demo=1&pin=03-00-000-000-0020&venue=assessor&today=2026-05-01&${requiredStepOne}`,
    expect: ["\"status\":\"condo\"", "missing unit sqft"],
  },
  {
    label: "missing sqft",
    path: `/api/case?demo=1&pin=03-00-000-000-0030&venue=bor&today=2025-07-10&${requiredStepOne}`,
    expect: ["\"status\":\"insufficient_data\"", "Actual sqft field"],
  },
  {
    label: "unknown township closed",
    path: `/api/case?demo=1&pin=03-00-000-000-0040&venue=bor&today=2025-07-10&${requiredStepOne}`,
    expect: ["\"venue\":\"bor\"", "BOR window is not currently open"],
  },
  {
    label: "print ptab",
    path: `/print?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01&${ptabStepOne}&borDecisionDate=2026-05-20`,
    expect: ["Selected venue", "Illinois PTAB", "Comparable method"],
  },
  {
    label: "print assessor comps",
    path: `/print?demo=1&pin=03-00-000-000-0001&venue=assessor&today=2026-05-01&${requiredStepOne}`,
    expect: ["Year built", "Assessment $/sqft", "Comparable analysis results"],
  },
];

const banned = ["PLACEHOLDER", "undefined", "NaN", ">null<"];

for (const check of checks) {
  const response = await fetch(new URL(check.path, baseUrl));
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${check.label} failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  for (const expected of check.expect) {
    if (!text.includes(expected)) {
      throw new Error(`${check.label} missing expected text: ${expected}`);
    }
  }
  for (const marker of banned) {
    if (text.includes(marker)) {
      throw new Error(`${check.label} contained banned text: ${marker}`);
    }
  }
  console.log(`ok - ${check.label}`);
}

console.log(`Fixture smoke passed against ${baseUrl}`);

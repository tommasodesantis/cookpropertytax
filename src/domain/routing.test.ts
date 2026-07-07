import { routeCase } from "./routing";
import type { AppealStatusInput } from "./routing";

const noneFiled: AppealStatusInput = {
  assessorAppealFiled: false,
  assessorDecisionReceived: null,
  borAppealFiled: false,
  borDecisionReceived: null,
  borDecisionDate: null,
};

test.each([
  ["Berwyn", "2026-07-06", "2026-07-06"],
  ["Cicero", "2026-07-06", "2026-07-31"],
  ["Palos", "2026-07-06", "2026-07-17"],
  ["Lakeview", "2026-07-06", "2026-07-13"],
  ["Maine", "2026-07-06", "2026-07-21"],
  ["Elk Grove", "2026-07-06", "2026-08-04"],
  ["Stickney", "2026-07-06", "2026-08-12"],
])("routes %s to Assessor when the authority CCAO window is open", (township, today, deadline) => {
  const route = routeCase(township, today, "auto", null, noneFiled);
  expect(route.venue).toBe("assessor");
  expect(route.actionStatus).toBe("open");
  expect(route.deadline).toBe(deadline);
  expect(route.warnings.some((warning) => warning.includes("partially configured"))).toBe(false);
});

test("routes to BOR when a BOR window is open", () => {
  const route = routeCase("Rogers Park", "2025-07-10", "auto", null, noneFiled);
  expect(route.venue).toBe("bor");
  expect(route.actionStatus).toBe("open");
  expect(route.deadline).toBe("2025-08-05");
});

test("routes closed when all configured windows are closed", () => {
  const route = routeCase("Rogers Park", "2027-01-01", "auto", null, noneFiled);
  expect(route.venue).toBe("closed");
  expect(route.actionStatus).toBe("closed");
  expect(route.reasoning.some((reason) => reason.includes("Certificate of Error"))).toBe(true);
  expect(route.warnings.some((warning) => warning.includes("past its session end"))).toBe(true);
});

test("unknown township is honest and non-crashing", () => {
  const route = routeCase("Not A Township", "2025-07-10", "auto", null, noneFiled);
  expect(route.venue).toBe("closed");
  expect(route.actionStatus).toBe("closed");
  expect(route.headline).toContain("No configured CCAO or BOR");
});

test("PTAB requires a decision date", () => {
  const route = routeCase("Rogers Park", "2026-06-01", "ptab", null, {
    assessorAppealFiled: true,
    assessorDecisionReceived: true,
    borAppealFiled: true,
    borDecisionReceived: true,
    borDecisionDate: null,
  });
  expect(route.venue).toBe("ptab");
  expect(route.actionStatus).toBe("needs_input");
  expect(route.reasoning.join(" ")).toContain("refuses to guess");
});

test("PTAB is eligible from a supplied decision date", () => {
  const route = routeCase("Rogers Park", "2026-06-01", "auto", null, {
    assessorAppealFiled: true,
    assessorDecisionReceived: true,
    borAppealFiled: true,
    borDecisionReceived: true,
    borDecisionDate: "2026-05-20",
  });
  expect(route.venue).toBe("ptab");
  expect(route.actionStatus).toBe("open");
  expect(route.deadline).toBe("2026-06-19");
  expect(route.daysRemaining).toBe(18);
});

test("PTAB expires from a supplied decision date", () => {
  const route = routeCase("Rogers Park", "2026-07-06", "auto", null, {
    assessorAppealFiled: true,
    assessorDecisionReceived: true,
    borAppealFiled: true,
    borDecisionReceived: true,
    borDecisionDate: "2026-05-20",
  });
  expect(route.venue).toBe("ptab");
  expect(route.actionStatus).toBe("expired");
  expect(route.deadline).toBe("2026-06-19");
  expect(route.daysRemaining).toBe(-17);
});

test.each<{
  label: string;
  township: string;
  today: string;
  status: AppealStatusInput;
  expectedVenue: string;
  expectedAction: string;
  expectedText: string;
}>([
  {
    label: "no filings use current Assessor/BOR window logic",
    township: "Berwyn",
    today: "2026-07-06",
    status: noneFiled,
    expectedVenue: "assessor",
    expectedAction: "open",
    expectedText: "Assessor is the first-level appeal",
  },
  {
    label: "Assessor filed and waiting does not route back to Assessor",
    township: "Rogers Park",
    today: "2025-07-10",
    status: {
      assessorAppealFiled: true,
      assessorDecisionReceived: false,
      borAppealFiled: false,
      borDecisionReceived: null,
      borDecisionDate: null,
    },
    expectedVenue: "bor",
    expectedAction: "open",
    expectedText: "Do not file another Assessor appeal",
  },
  {
    label: "Assessor decision received routes to BOR when available",
    township: "Rogers Park",
    today: "2025-07-10",
    status: {
      assessorAppealFiled: true,
      assessorDecisionReceived: true,
      borAppealFiled: false,
      borDecisionReceived: null,
      borDecisionDate: null,
    },
    expectedVenue: "bor",
    expectedAction: "open",
    expectedText: "Assessor appeal is complete",
  },
  {
    label: "BOR filed and waiting explains PTAB later without needs-input",
    township: "Rogers Park",
    today: "2026-06-01",
    status: {
      assessorAppealFiled: true,
      assessorDecisionReceived: true,
      borAppealFiled: true,
      borDecisionReceived: false,
      borDecisionDate: null,
    },
    expectedVenue: "ptab",
    expectedAction: "upcoming",
    expectedText: "Wait for the BOR decision",
  },
  {
    label: "BOR decision with date computes PTAB deadline",
    township: "Rogers Park",
    today: "2026-06-01",
    status: {
      assessorAppealFiled: true,
      assessorDecisionReceived: true,
      borAppealFiled: true,
      borDecisionReceived: true,
      borDecisionDate: "2026-05-20",
    },
    expectedVenue: "ptab",
    expectedAction: "open",
    expectedText: "30-day clock controls",
  },
  {
    label: "BOR decision without date refuses to guess",
    township: "Rogers Park",
    today: "2026-06-01",
    status: {
      assessorAppealFiled: true,
      assessorDecisionReceived: true,
      borAppealFiled: true,
      borDecisionReceived: true,
      borDecisionDate: null,
    },
    expectedVenue: "ptab",
    expectedAction: "needs_input",
    expectedText: "refuses to guess",
  },
])("$label", ({ township, today, status, expectedVenue, expectedAction, expectedText }) => {
  const route = routeCase(township, today, "auto", null, status);
  expect(route.venue).toBe(expectedVenue);
  expect(route.actionStatus).toBe(expectedAction);
  expect(`${route.headline} ${route.reasoning.join(" ")}`).toContain(expectedText);
});

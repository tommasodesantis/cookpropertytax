import { routeCase } from "./routing";

test.each([
  ["Berwyn", "2026-07-06", "2026-07-06"],
  ["Cicero", "2026-07-06", "2026-07-31"],
  ["Palos", "2026-07-06", "2026-07-17"],
  ["Lakeview", "2026-07-06", "2026-07-13"],
  ["Maine", "2026-07-06", "2026-07-21"],
  ["Elk Grove", "2026-07-06", "2026-08-04"],
  ["Stickney", "2026-07-06", "2026-08-12"],
])("routes %s to Assessor when the authority CCAO window is open", (township, today, deadline) => {
  const route = routeCase(township, today, "auto");
  expect(route.venue).toBe("assessor");
  expect(route.actionStatus).toBe("open");
  expect(route.deadline).toBe(deadline);
  expect(route.warnings.some((warning) => warning.includes("partially configured"))).toBe(false);
});

test("routes to BOR when a BOR window is open", () => {
  const route = routeCase("Rogers Park", "2025-07-10", "auto");
  expect(route.venue).toBe("bor");
  expect(route.actionStatus).toBe("open");
  expect(route.deadline).toBe("2025-08-05");
});

test("routes closed when all configured windows are closed", () => {
  const route = routeCase("Rogers Park", "2027-01-01", "auto");
  expect(route.venue).toBe("closed");
  expect(route.actionStatus).toBe("closed");
  expect(route.reasoning.some((reason) => reason.includes("Certificate of Error"))).toBe(true);
  expect(route.warnings.some((warning) => warning.includes("past its session end"))).toBe(true);
});

test("unknown township is honest and non-crashing", () => {
  const route = routeCase("Not A Township", "2025-07-10", "auto");
  expect(route.venue).toBe("closed");
  expect(route.actionStatus).toBe("closed");
  expect(route.headline).toContain("No configured CCAO or BOR");
});

test("PTAB requires a decision date", () => {
  const route = routeCase("Rogers Park", "2026-06-01", "ptab");
  expect(route.venue).toBe("ptab");
  expect(route.actionStatus).toBe("needs_input");
  expect(route.reasoning.join(" ")).toContain("refuses to guess");
});

test("PTAB is eligible from a supplied decision date", () => {
  const route = routeCase("Rogers Park", "2026-06-01", "auto", "2026-05-20");
  expect(route.venue).toBe("ptab");
  expect(route.actionStatus).toBe("open");
  expect(route.deadline).toBe("2026-06-19");
  expect(route.daysRemaining).toBe(18);
});

test("PTAB expires from a supplied decision date", () => {
  const route = routeCase("Rogers Park", "2026-07-06", "auto", "2026-05-20");
  expect(route.venue).toBe("ptab");
  expect(route.actionStatus).toBe("expired");
  expect(route.deadline).toBe("2026-06-19");
  expect(route.daysRemaining).toBe(-17);
});

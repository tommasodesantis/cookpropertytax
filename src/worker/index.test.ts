import worker from "./index";

const REQUIRED_STEP_ONE = "ownershipType=individual&assessorAppealFiled=no&borAppealFiled=no";

test("health endpoint returns a JSON status", async () => {
  const response = await worker.fetch(new Request("http://example.test/api/health"), {});
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "Appeal Compass",
  });
});

test("fixture-mode case endpoint returns a computed case payload", async () => {
  const response = await worker.fetch(
    new Request(
      `http://example.test/api/case?demo=1&pin=03-00-000-000-0001&today=2025-07-10&${REQUIRED_STEP_ONE}`,
    ),
    {},
  );
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload).toMatchObject({
    ok: true,
    demo: true,
    routing: {
      venue: "bor",
    },
    evidence: {
      tier: "STRONG",
    },
  });
  expect(JSON.stringify(payload)).toContain("NOT LEGAL ADVICE");
});

test.each([
  ["03-00-000-000-0001", "assessor", "2026-05-01", "assessor", "open"],
  ["03-00-000-000-0001", "bor", "2025-07-10", "bor", "open"],
  ["03-00-000-000-0020", "assessor", "2026-05-01", "assessor", "open"],
  ["03-00-000-000-0030", "bor", "2025-07-10", "bor", "open"],
  ["03-00-000-000-0040", "auto", "2025-07-10", "closed", "closed"],
])(
  "fixture endpoint handles %s at %s without crashing",
  async (pin, venue, today, expectedVenue, expectedStatus) => {
    const response = await worker.fetch(
      new Request(
        `http://example.test/api/case?demo=1&pin=${pin}&venue=${venue}&today=${today}&${REQUIRED_STEP_ONE}`,
      ),
      {},
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as CasePayloadLike;
    expect(payload.routing.venue).toBe(expectedVenue);
    expect(payload.routing.actionStatus).toBe(expectedStatus);
    expect(JSON.stringify(payload)).not.toContain("Traceback");
  },
);

test("fixture endpoint surfaces PTAB needs-input and expired states", async () => {
  const needsInput = await worker.fetch(
    new Request(
      "http://example.test/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01&ownershipType=individual&assessorAppealFiled=yes&assessorDecisionReceived=yes&borAppealFiled=yes&borDecisionReceived=yes",
    ),
    {},
  );
  expect(needsInput.status).toBe(200);
  await expect(needsInput.json()).resolves.toMatchObject({
    routing: { venue: "ptab", actionStatus: "needs_input" },
  });

  const expired = await worker.fetch(
    new Request(
      "http://example.test/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-07-06&ownershipType=individual&assessorAppealFiled=yes&assessorDecisionReceived=yes&borAppealFiled=yes&borDecisionReceived=yes&borDecisionDate=2026-05-20",
    ),
    {},
  );
  expect(expired.status).toBe(200);
  await expect(expired.json()).resolves.toMatchObject({
    routing: { venue: "ptab", actionStatus: "expired", deadline: "2026-06-19" },
  });
});

test("case endpoint returns user-facing errors", async () => {
  const response = await worker.fetch(
    new Request("http://example.test/api/case?demo=1&pin=bad"),
    {},
  );
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: {
      kind: "input",
    },
  });
});

test("case endpoint refuses entity-owned properties before assessment", async () => {
  const response = await worker.fetch(
    new Request(
      "http://example.test/api/case?demo=1&pin=03-00-000-000-0001&ownershipType=llc&assessorAppealFiled=no&borAppealFiled=no",
    ),
    {},
  );
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: {
      kind: "input",
      message:
        "Appeal Compass is designed only for individual residential homeowners appealing their own home; entity-owned, commercial, and association properties are not supported and generally require an attorney.",
    },
  });
});

test("case endpoint rejects unsupported jurisdictions", async () => {
  const response = await worker.fetch(
    new Request(
      `http://example.test/api/case?demo=1&pin=03-00-000-000-0001&jurisdiction=other&${REQUIRED_STEP_ONE}`,
    ),
    {},
  );
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: { kind: "input" },
  });
});

test("public demo endpoint is removed", async () => {
  const response = await worker.fetch(new Request("http://example.test/api/demo"), {});
  expect(response.status).toBe(404);
});

interface CasePayloadLike {
  routing: {
    venue: string;
    actionStatus: string;
  };
}

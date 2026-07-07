import worker from "./index";

test("health endpoint returns a JSON status", async () => {
  const response = await worker.fetch(new Request("http://example.test/api/health"), {});
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "cookpropertytax",
  });
});

test("fixture-mode case endpoint returns a computed case payload", async () => {
  const response = await worker.fetch(
    new Request("http://example.test/api/case?demo=1&pin=03-00-000-000-0001&today=2025-07-10"),
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
      new Request(`http://example.test/api/case?demo=1&pin=${pin}&venue=${venue}&today=${today}`),
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
      "http://example.test/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-06-01",
    ),
    {},
  );
  expect(needsInput.status).toBe(200);
  await expect(needsInput.json()).resolves.toMatchObject({
    routing: { venue: "ptab", actionStatus: "needs_input" },
  });

  const expired = await worker.fetch(
    new Request(
      "http://example.test/api/case?demo=1&pin=03-00-000-000-0001&venue=ptab&today=2026-07-06&borDecisionDate=2026-05-20",
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

interface CasePayloadLike {
  routing: {
    venue: string;
    actionStatus: string;
  };
}

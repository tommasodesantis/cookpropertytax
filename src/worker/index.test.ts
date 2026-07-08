import worker from "./index";
import { createWorker } from "./index";
import { ConcurrencyLimiter } from "./limiter";
import { QUEUED_MESSAGE } from "./messages";

const REQUIRED_STEP_ONE = "ownershipType=individual&assessorAppealFiled=no&borAppealFiled=no";

test("health endpoint returns a JSON status", async () => {
  const response = await worker.fetch(new Request("http://example.test/api/health"), {});
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "Appeal Compass",
  });
});

test("app shell never renders analytics and omits Turnstile while public token is empty", async () => {
  const response = await worker.fetch(new Request("http://example.test/"), {});
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain("Appeal Compass");
  expect(html).not.toContain("static.cloudflareinsights.com/beacon.min.js");
  expect(html).not.toContain("challenges.cloudflare.com/turnstile/v0/api.js");
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

function reportRequest(ip: string, body: Record<string, unknown>): Request {
  return new Request("http://example.test/api/report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

test("report endpoint verifies Turnstile and creates sanitized GitHub issue", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("turnstile")) {
      return Response.json({ success: true });
    }
    if (url.includes("api.github.com")) {
      const body = String(init?.body ?? "");
      expect(body).not.toContain("<b>");
      expect(body).not.toContain("turnstile-token");
      expect(body).toContain("Wrong deadline");
      return Response.json(
        { html_url: "https://github.com/tommasodesantis/appealcompass/issues/1" },
        { status: 201 },
      );
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const response = await worker.fetch(
      reportRequest("10.0.0.1", {
        category: "wrong_deadline",
        description: "<b>Deadline is wrong</b>",
        context: "PIN 03-00-000-000-0001",
        turnstileToken: "turnstile-token",
      }),
      { TURNSTILE_SECRET_KEY: "turnstile-secret", GITHUB_ISSUES_TOKEN: "github-secret" },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      issueUrl: "https://github.com/tommasodesantis/appealcompass/issues/1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("report endpoint rejects failed Turnstile verification", async () => {
  const fetchMock = vi.fn(async () => Response.json({ success: false }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    const response = await worker.fetch(
      reportRequest("10.0.0.2", {
        category: "wrong_comparables",
        description: "Comps look wrong",
        turnstileToken: "bad-token",
      }),
      { TURNSTILE_SECRET_KEY: "turnstile-secret", GITHUB_ISSUES_TOKEN: "github-secret" },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { kind: "turnstile" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("report endpoint returns friendly error when GitHub issue creation fails", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("turnstile")) {
      return Response.json({ success: true });
    }
    return Response.json({ message: "server error" }, { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const response = await worker.fetch(
      reportRequest("10.0.0.3", {
        category: "feature_request",
        description: "Please add a feature",
        turnstileToken: "ok-token",
      }),
      { TURNSTILE_SECRET_KEY: "turnstile-secret", GITHUB_ISSUES_TOKEN: "github-secret" },
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { kind: "github" },
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

function caseRequest(index = 0): Request {
  return new Request(
    `http://example.test/api/case?demo=1&pin=03-00-000-000-0001&today=2025-07-10&request=${index}&${REQUIRED_STEP_ONE}`,
  );
}

test("assessment limiter queues a fifth simultaneous case request and completes it", async () => {
  const limiter = new ConcurrencyLimiter(4);
  let active = 0;
  let maxActive = 0;
  const testWorker = createWorker({
    assessmentLimiter: limiter,
    queueTimeoutMs: 1000,
    caseBuilder: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return { ok: true } as never;
    },
  });

  const requests = Array.from({ length: 5 }, (_, index) =>
    testWorker.fetch(caseRequest(index), {}),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(limiter.activeCount).toBe(4);
  expect(limiter.pendingCount).toBe(1);

  const queueResponse = await testWorker.fetch(new Request("http://example.test/api/queue"), {});
  await expect(queueResponse.json()).resolves.toMatchObject({
    ok: true,
    active: 4,
    queued: 1,
    busy: true,
    message: QUEUED_MESSAGE,
  });

  const responses = await Promise.all(requests);
  expect(maxActive).toBeLessThanOrEqual(4);
  expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
});

test("assessment queue timeout returns friendly 503", async () => {
  const limiter = new ConcurrencyLimiter(1);
  let releaseFirst = () => {};
  const testWorker = createWorker({
    assessmentLimiter: limiter,
    queueTimeoutMs: 5,
    caseBuilder: async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return { ok: true } as never;
    },
  });

  const first = testWorker.fetch(caseRequest(1), {});
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = await testWorker.fetch(caseRequest(2), {});
  expect(second.status).toBe(503);
  await expect(second.json()).resolves.toMatchObject({
    ok: false,
    error: {
      kind: "queue_timeout",
      message: expect.stringContaining("busy helping other homeowners"),
    },
  });

  releaseFirst();
  await expect(first).resolves.toMatchObject({ status: 200 });
});

interface CasePayloadLike {
  routing: {
    venue: string;
    actionStatus: string;
  };
}

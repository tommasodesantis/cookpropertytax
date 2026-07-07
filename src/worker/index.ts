import { NotFoundError, UserInputError } from "../domain/errors";
import { GITHUB_ISSUES_REPOSITORY } from "../domain/publicConfig";
import { appShell } from "./appShell";
import { CloudflareCacheStore, sharedMemoryCache } from "./cache";
import { buildCasePayload } from "./casePayload";
import { FixtureRepository } from "./fixtureRepository";
import { ConcurrencyLimiter, QueueTimeoutError } from "./limiter";
import { QUEUED_MESSAGE } from "./messages";
import { buildPrintReport } from "./printReport";
import { type CaseRepository, SocrataRepository } from "./repository";
import { SocrataClient, friendlyDataError } from "./socrataClient";

export interface Env {
  ASSETS?: Fetcher;
  SOCRATA_APP_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  GITHUB_ISSUES_TOKEN?: string;
}

const ASSESSMENT_CONCURRENCY = 4;
const ASSESSMENT_QUEUE_TIMEOUT_MS = 60_000;
const REPORT_PAYLOAD_LIMIT = 10_000;
const REPORT_RATE_LIMIT = 5;
const REPORT_RATE_WINDOW_MS = 60 * 60 * 1000;
const QUEUE_TIMEOUT_MESSAGE =
  "Appeal Compass is busy helping other homeowners right now. Your assessment did not start within a minute. Please try again in a moment.";
const sharedAssessmentLimiter = new ConcurrencyLimiter(ASSESSMENT_CONCURRENCY);
const reportRateLimit = new Map<string, { count: number; resetAt: number }>();

const REPORT_CATEGORIES = {
  wrong_deadline: { label: "Wrong deadline", githubLabel: "wrong-deadline" },
  wrong_jurisdiction: { label: "Wrong jurisdiction info", githubLabel: "wrong-jurisdiction" },
  wrong_comparables: { label: "Wrong comparables", githubLabel: "wrong-comparables" },
  wrong_assessment_data: { label: "Wrong assessment data", githubLabel: "wrong-assessment-data" },
  feature_request: { label: "Feature request", githubLabel: "feature-request" },
} as const;

interface RepositorySelection {
  repo: CaseRepository;
  demo: boolean;
}

interface WorkerOptions {
  assessmentLimiter?: ConcurrencyLimiter;
  queueTimeoutMs?: number;
  caseBuilder?: typeof buildCasePayload;
  repositoryFactory?: (url: URL, env: Env) => RepositorySelection;
}

interface WorkerHandler {
  fetch(request: Request, env: Env): Promise<Response>;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function replaceControlCharacters(value: string): string {
  let output = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    output += code < 32 || code === 127 ? " " : char;
  }
  return output;
}

function sanitizeText(value: unknown, maxLength: number): string {
  return replaceControlCharacters(String(value ?? "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function isRateLimited(request: Request): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const current = reportRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    reportRateLimit.set(key, { count: 1, resetAt: now + REPORT_RATE_WINDOW_MS });
    return false;
  }
  if (current.count >= REPORT_RATE_LIMIT) {
    return true;
  }
  current.count += 1;
  return false;
}

async function reportJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > REPORT_PAYLOAD_LIMIT) {
    throw new UserInputError("Report is too large.");
  }
  const text = await request.text();
  if (text.length > REPORT_PAYLOAD_LIMIT) {
    throw new UserInputError("Report is too large.");
  }
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UserInputError("Report payload is invalid.");
  }
  return parsed as Record<string, unknown>;
}

async function verifyTurnstile(token: string, request: Request, secret: string): Promise<boolean> {
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const remoteIp = request.headers.get("cf-connecting-ip");
  if (remoteIp) {
    form.set("remoteip", remoteIp);
  }
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const result = (await response.json().catch(() => ({}))) as { success?: boolean };
  return response.ok && result.success === true;
}

async function createGithubIssue(input: {
  token: string;
  category: (typeof REPORT_CATEGORIES)[keyof typeof REPORT_CATEGORIES];
  description: string;
  context: string;
}): Promise<string | null> {
  const body = [
    "Submitted through the Appeal Compass report form.",
    "",
    `Category: ${input.category.label}`,
    "",
    "Description:",
    input.description,
    "",
    "Context:",
    input.context || "Not provided",
  ].join("\n");
  const response = await fetch(`https://api.github.com/repos/${GITHUB_ISSUES_REPOSITORY}/issues`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json",
      "user-agent": "appeal-compass",
    },
    body: JSON.stringify({
      title: `[${input.category.label}] Appeal Compass report`,
      body,
      labels: ["appeal-compass-report", input.category.githubLabel],
    }),
  });
  if (!response.ok) {
    return null;
  }
  const result = (await response.json().catch(() => ({}))) as { html_url?: string };
  return result.html_url ?? null;
}

function cacheStore() {
  return typeof caches === "undefined" ? sharedMemoryCache : new CloudflareCacheStore();
}

function repositoryFor(url: URL, env: Env): RepositorySelection {
  if (url.searchParams.get("demo") === "1" || url.searchParams.get("demo") === "true") {
    return { repo: new FixtureRepository(), demo: true };
  }
  return {
    repo: new SocrataRepository(
      new SocrataClient({
        ...(env.SOCRATA_APP_TOKEN ? { appToken: env.SOCRATA_APP_TOKEN } : {}),
        cache: cacheStore(),
      }),
    ),
    demo: false,
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof QueueTimeoutError) {
    return json(
      {
        ok: false,
        error: {
          kind: "queue_timeout",
          message: QUEUE_TIMEOUT_MESSAGE,
        },
      },
      503,
    );
  }
  if (error instanceof UserInputError) {
    return json({ ok: false, error: { kind: "input", message: error.message } }, 400);
  }
  if (error instanceof NotFoundError) {
    return json({ ok: false, error: { kind: "not_found", message: error.message } }, 404);
  }
  const friendly = friendlyDataError(error);
  const status = friendly.kind === "transient_http" || friendly.kind === "network" ? 503 : 502;
  return json({ ok: false, error: friendly }, status);
}

function queueStatus(limiter: ConcurrencyLimiter) {
  const active = limiter.activeCount;
  const queued = limiter.pendingCount;
  return {
    ok: true,
    limit: limiter.limit,
    active,
    queued,
    busy: active >= limiter.limit || queued > 0,
    message: active >= limiter.limit || queued > 0 ? QUEUED_MESSAGE : null,
  };
}

async function handleReport(request: Request, env: Env): Promise<Response> {
  if (!env.TURNSTILE_SECRET_KEY || !env.GITHUB_ISSUES_TOKEN) {
    return json(
      {
        ok: false,
        error: {
          kind: "configuration",
          message: "Problem reporting is not configured yet.",
        },
      },
      503,
    );
  }
  if (isRateLimited(request)) {
    return json(
      {
        ok: false,
        error: {
          kind: "rate_limited",
          message: "Too many reports from this connection. Try again later.",
        },
      },
      429,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await reportJson(request);
  } catch (error) {
    return errorResponse(error);
  }

  const categoryKey = sanitizeText(payload.category, 80);
  const category = REPORT_CATEGORIES[categoryKey as keyof typeof REPORT_CATEGORIES];
  const description = sanitizeText(payload.description, 4000);
  const context = sanitizeText(payload.context, 2000);
  const turnstileToken = sanitizeText(payload.turnstileToken, 2048);
  if (!category) {
    return json({ ok: false, error: { kind: "input", message: "Choose a report category." } }, 400);
  }
  if (!description) {
    return json({ ok: false, error: { kind: "input", message: "Describe the problem." } }, 400);
  }
  if (!turnstileToken) {
    return json(
      { ok: false, error: { kind: "input", message: "Complete the verification challenge." } },
      400,
    );
  }

  const turnstileOk = await verifyTurnstile(turnstileToken, request, env.TURNSTILE_SECRET_KEY);
  if (!turnstileOk) {
    return json(
      { ok: false, error: { kind: "turnstile", message: "Verification failed. Try again." } },
      400,
    );
  }

  const issueUrl = await createGithubIssue({
    token: env.GITHUB_ISSUES_TOKEN,
    category,
    description,
    context,
  });
  if (!issueUrl) {
    return json(
      {
        ok: false,
        error: {
          kind: "github",
          message: "The report could not be submitted right now. Try again later.",
        },
      },
      502,
    );
  }
  return json({ ok: true, issueUrl });
}

export function createWorker(options: WorkerOptions = {}): WorkerHandler {
  const assessmentLimiter = options.assessmentLimiter ?? sharedAssessmentLimiter;
  const queueTimeoutMs = options.queueTimeoutMs ?? ASSESSMENT_QUEUE_TIMEOUT_MS;
  const caseBuilder = options.caseBuilder ?? buildCasePayload;
  const repositoryFactory = options.repositoryFactory ?? repositoryFor;

  async function buildQueuedCasePayload(
    repo: CaseRepository,
    params: URLSearchParams,
    demo: boolean,
  ) {
    return assessmentLimiter.run(() => caseBuilder(repo, params, demo), {
      maxQueueWaitMs: queueTimeoutMs,
    });
  }

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === "/api/health") {
        return json({
          ok: true,
          service: "Appeal Compass",
        });
      }

      if (url.pathname === "/api/queue") {
        return json(queueStatus(assessmentLimiter));
      }

      if (url.pathname === "/api/report") {
        if (request.method !== "POST") {
          return json(
            { ok: false, error: { kind: "method", message: "Use POST for reports." } },
            405,
          );
        }
        return handleReport(request, env);
      }

      if (url.pathname === "/api/case") {
        try {
          if (!url.searchParams.get("pin")) {
            throw new UserInputError("Enter a Cook County PIN.");
          }
          const { repo, demo } = repositoryFactory(url, env);
          return json(await buildQueuedCasePayload(repo, url.searchParams, demo));
        } catch (error) {
          return errorResponse(error);
        }
      }

      if (url.pathname === "/print") {
        try {
          if (!url.searchParams.get("pin")) {
            throw new UserInputError("Enter a Cook County PIN.");
          }
          const { repo, demo } = repositoryFactory(url, env);
          const payload = await buildQueuedCasePayload(repo, url.searchParams, demo);
          return new Response(buildPrintReport(payload), {
            headers: { "content-type": "text/html;charset=utf-8" },
          });
        } catch (error) {
          return errorResponse(error);
        }
      }

      if (url.pathname.startsWith("/api/")) {
        return json(
          { ok: false, error: { kind: "not_found", message: "API endpoint not found." } },
          404,
        );
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(appShell(), {
          headers: { "content-type": "text/html;charset=utf-8" },
        });
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Appeal Compass", {
        headers: { "content-type": "text/plain;charset=utf-8" },
      });
    },
  } satisfies WorkerHandler;
}

const worker = createWorker();

export default worker satisfies ExportedHandler<Env>;

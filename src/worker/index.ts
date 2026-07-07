import { NotFoundError, UserInputError } from "../domain/errors";
import { CloudflareCacheStore, sharedMemoryCache } from "./cache";
import { buildCasePayload } from "./casePayload";
import { FixtureRepository } from "./fixtureRepository";
import { buildPrintReport } from "./printReport";
import { SocrataRepository } from "./repository";
import { SocrataClient, friendlyDataError } from "./socrataClient";

export interface Env {
  ASSETS?: Fetcher;
  SOCRATA_APP_TOKEN?: string;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function cacheStore() {
  return typeof caches === "undefined" ? sharedMemoryCache : new CloudflareCacheStore();
}

function repositoryFor(url: URL, env: Env) {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "Appeal Compass",
      });
    }

    if (url.pathname === "/api/case") {
      try {
        if (!url.searchParams.get("pin")) {
          throw new UserInputError("Enter a Cook County PIN.");
        }
        const { repo, demo } = repositoryFor(url, env);
        return json(await buildCasePayload(repo, url.searchParams, demo));
      } catch (error) {
        return errorResponse(error);
      }
    }

    if (url.pathname === "/print") {
      try {
        if (!url.searchParams.get("pin")) {
          throw new UserInputError("Enter a Cook County PIN.");
        }
        const { repo, demo } = repositoryFor(url, env);
        const payload = await buildCasePayload(repo, url.searchParams, demo);
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

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Appeal Compass", {
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  },
} satisfies ExportedHandler<Env>;

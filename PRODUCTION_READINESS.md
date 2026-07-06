# Production Readiness Tracker

Created from the mission exit criteria. Check a box only when the criterion is verified, not assumed.

- [x] Single CLI entry point; zero Colab artifacts; `pip install -r requirements.txt && python appeal_tool.py --pin <PIN>` works on a clean machine.
- [x] Venue routing produces the correct venue + reasoning for: CCAO open, BOR open, both closed, PTAB-eligible (decision date given), and PTAB-expired scenarios, each covered by a test with a mocked date.
- [x] All three venue packets (CCAO, BOR, PTAB) generate correctly from the same shared case file, each validated by an automated PDF content check.
- [x] PTAB deadline is only ever computed from a user-supplied BOR decision date; the tool refuses to guess and clearly asks for it.
- [x] No unhandled tracebacks reachable via CLI inputs (fuzz the CLI with garbage to confirm).
- [x] All network I/O has timeouts, retries with backoff, pagination, caching, and classified errors.
- [x] Comparable-selection and all financial math covered by known-answer tests; >=85% line coverage on core analysis modules.
- [x] Condos, missing-data parcels, closed-deadline townships, and unknown townships produce correct, honest, non-crashing output at every venue (each has a test).
- [x] Time-sensitive constants centralized in config with staleness warnings that actually fire.
- [x] `ruff`, `mypy`, `pytest`, and the E2E smoke suite all pass via one `verify` command.
- [x] README + disclaimers complete; `PRODUCTION_READINESS.md` fully checked; `.gitignore` prevents artifact commits.
- [x] Two consecutive full verification runs pass with zero code changes needed (stability confirmation).

## Phase 2 Hardening Checklist

- [x] Every township window in `appeal_tool/config.py` matches the provided authority calendar
      file; the cross-check diff report exists in `reports/`; no township that the authority file
      shows as open on a mocked in-window date is routed as closed.
- [ ] The venue comparable-expectation matrix has been verified against official sources,
      corrected where needed, and encoded as documented per-venue comparable profiles.
- [x] A comparable-evidence feasibility report exists with measured field availability, pool
      survival, runtime, and per-venue verdicts across at least 15 diverse real properties.
- [ ] Venue-aware comparable selection/exhibits are implemented for every venue judged feasible;
      unavailable PTAB grid fields are explicitly marked as user-supply items, never fabricated.
- [ ] Condo comparable analysis is gated by measured missing-data rates with the <30%, 30-50%,
      and >50% behavior bands, each covered by tests; the blanket condo skip is gone.
- [ ] Missing subject sqft/AV cases accept documented user-supplied overrides, clearly labeled as
      user-supplied in console and PDF, with actionable re-run guidance when data is missing and
      no override was given.
- [ ] Live comparables are enriched with parcel-universe fields; the live test validates
      user-facing evidence quality across at least 10 diverse properties and fails on quality
      regressions; superseded live-test logic is removed.
- [x] Local-snapshot feasibility report exists only if token-backed concurrency proves poor
      practical simultaneous-user capacity; no snapshot architecture is built without that trigger.
- [x] Concurrency probe report exists with measured throttle behavior and an estimated
      simultaneous-user ceiling with and without app token.
- [ ] `BLOCKERS.md` documents every feasibility failure with measured evidence and a concrete
      fallback strategy.
- [ ] `python scripts/verify.py` passes end-to-end; all Phase 1 guarantees remain intact.
- [ ] Two consecutive full verification runs pass with zero code changes needed.

## Iteration Notes

### Iteration 1

- Built the single CLI scaffold, venue adapter skeleton, fixture-backed repository, BOR/CCAO/PTAB routing, PDF generator, tests, and verifier.
- CCAO official calendar refresh is blocked by CloudFront 403; see `BLOCKERS.md`.
- BOR fixture smoke path is included in the automated CLI/PDF tests.
- Full verifier passes via `python scripts/verify.py` with 95% measured coverage on core analysis modules.

### Iteration 2

- Added a closed-session packet adapter so closed/no-action routing does not show BOR rules.
- Expanded CLI smoke tests to run single-family, condo, missing-characteristics, and unknown-township fixtures through venue paths.
- Expanded PDF content tests across Assessor, BOR, PTAB, and closed-window packets.
- Full verifier passes via `python scripts/verify.py` with 55 tests.

### Iteration 3

- Added `DataErrorKind` classification for Socrata/network failures.
- Added tests for transient retry, pagination, cache reuse, invalid JSON/cache, and unknown dataset handling.
- Full verifier passes via `python scripts/verify.py` with 59 tests.

### Iteration 4

- Added hygiene tests that enforce zero Colab artifacts in Python files.
- Added `.gitignore` generated-artifact checks.
- Added README assertions for venue ladder, Socrata token documentation, and exact `NOT LEGAL ADVICE` wording.
- Full verifier passes via `python scripts/verify.py` with 62 tests.

### Iteration 5

- Verified runtime installation in a clean workspace-local venv using `pip install -r requirements.txt`.
- Verified fixture-backed CLI/PDF generation from the clean venv.
- Verified live no-fixture Socrata CLI and default PDF generation for PIN `03-27-402-011-0000` with network access.
- Added local venv ignore patterns and completed the two-run stability gate.

### Iteration 6

- Retested the CCAO calendar blocker after VPN activation: browser access can load the official redirected calendar page, but direct local `curl.exe` automation still receives CloudFront 403.
- Added live-source hardening for configured assessment-year selection, missing address/schema warnings, and de-duplicated pagination warnings.
- Added `scripts/live_smoke.py` for a reproducible 10-property live CLI/PDF smoke run across suburban/city, single-family/condo/multi-family samples.
- Verified all 10 live properties completed with user-facing output and PDFs that opened, extracted, rendered, and showed no automated or manual first-page layout failures.

### Phase 2 Iteration 1

- Extracted the provided authority PDF last updated 6/29/26 into
  `reports/deadline_crosscheck_2026-07-06.md` and JSON.
- Replaced the stale 2025 partial CCAO scaffold with 2026 Assessor windows and explicit rows for
  all 38 townships.
- Added routing regressions for seven authority-file open townships plus a config/report sync test.
- BOR dates were not changed because the Assessor PDF lists only BOR pass markers, not BOR
  open/close/evidence deadlines; see `BLOCKERS.md`.

### Phase 2 Iteration 2

- Added `scripts/feasibility_comps.py`, a bounded Socrata feasibility harness for venue-specific
  comparable profiles.
- Verified the venue matrix against reachable PTAB filing/form sources and BOR official rules;
  CCAO comparable/guideline automation remains CloudFront-blocked.
- Regenerated `reports/comps_feasibility_2026-07-06.md` and JSON from 18 real parcels using the
  supplied Socrata app token as a process-local environment variable only.
- Assessor and BOR profiles measured `FEASIBLE-WITH-CAVEATS`; PTAB full-grid alignment measured
  `NOT FEASIBLE`, and condo comparable pools remain data-limited; see `BLOCKERS.md`.
- Plan adjustment: run token-backed concurrency before any local snapshot feasibility study, and
  run the snapshot study only if concurrency remains poor with the token.

### Phase 2 Iteration 3

- Added `scripts/concurrency_probe.py`, a polite bounded Socrata concurrency harness that uses
  `SocrataClient` with no cache, timeouts, retries, backoff, and per-user sessions.
- Ran no-token and app-token probes at 1, 2, 4, and 8 simulated users; see
  `reports/concurrency_2026-07-06.md` and JSON.
- Measured practical ceiling: 2 users without token and 4 users with token, with zero HTTP 429s
  observed in both modes.
- Under the revised plan, local snapshot feasibility is not triggered because token-backed
  concurrency did not show poor capacity at the 4-user practical ceiling.

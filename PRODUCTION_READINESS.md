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

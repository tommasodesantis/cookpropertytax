# Production Readiness Tracker

Created from the mission exit criteria. Check a box only when the criterion is verified, not assumed.

- [ ] Single CLI entry point; zero Colab artifacts; `pip install -r requirements.txt && python appeal_tool.py --pin <PIN>` works on a clean machine.
- [x] Venue routing produces the correct venue + reasoning for: CCAO open, BOR open, both closed, PTAB-eligible (decision date given), and PTAB-expired scenarios, each covered by a test with a mocked date.
- [x] All three venue packets (CCAO, BOR, PTAB) generate correctly from the same shared case file, each validated by an automated PDF content check.
- [x] PTAB deadline is only ever computed from a user-supplied BOR decision date; the tool refuses to guess and clearly asks for it.
- [x] No unhandled tracebacks reachable via CLI inputs (fuzz the CLI with garbage to confirm).
- [ ] All network I/O has timeouts, retries with backoff, pagination, caching, and classified errors.
- [x] Comparable-selection and all financial math covered by known-answer tests; >=85% line coverage on core analysis modules.
- [ ] Condos, missing-data parcels, closed-deadline townships, and unknown townships produce correct, honest, non-crashing output at every venue (each has a test).
- [x] Time-sensitive constants centralized in config with staleness warnings that actually fire.
- [x] `ruff`, `mypy`, `pytest`, and the E2E smoke suite all pass via one `verify` command.
- [ ] README + disclaimers complete; `PRODUCTION_READINESS.md` fully checked; `.gitignore` prevents artifact commits.
- [ ] Two consecutive full verification runs pass with zero code changes needed (stability confirmation).

## Iteration Notes

### Iteration 1

- Built the single CLI scaffold, venue adapter skeleton, fixture-backed repository, BOR/CCAO/PTAB routing, PDF generator, tests, and verifier.
- CCAO official calendar refresh is blocked by CloudFront 403; see `BLOCKERS.md`.
- BOR fixture smoke path is included in the automated CLI/PDF tests.
- Full verifier passes via `python scripts/verify.py` with 95% measured coverage on core analysis modules.

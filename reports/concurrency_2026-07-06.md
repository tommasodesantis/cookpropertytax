# Socrata Concurrency Probe - Phase 2

- Run date: 2026-07-06
- Configured assessment year: 2026
- Machine-readable results: `reports/concurrency_2026-07-06.json`
- Data source: Cook County Socrata through `SocrataClient` with no cache, timeouts, retries, backoff, and bounded page queries.
- Token handling: the probe records only whether an app token was present; the token value is never written to this report or JSON.
- Simulated user load: subject parcel, residential characteristics, assessed values, sales, and three bounded comparable-pool page queries.
- Ramp policy: 1, 2, 4, and 8 parallel users; a mode stops early on sustained 429s, operation failures, or transient server-error concentration.

## Summary

- Practical ceiling without app token: 2 users.
- Practical ceiling with app token: 4 users.
- Local snapshot feasibility trigger: NO.

## Level Results

| Mode | Users | Users OK | Ops OK | HTTP requests | 429s | Retry successes | Median user ms | P95 user ms | Stop reason |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| no_token | 1 | 1/1 | 7/7 | 7 | 0 | 0 | 4515.5 | 4515.5 |  |
| no_token | 2 | 2/2 | 14/14 | 14 | 0 | 0 | 3905.7 | 4549.2 |  |
| no_token | 4 | 3/4 | 27/28 | 29 | 0 | 0 | 3851.3 | 62523.4 |  |
| no_token | 8 | 4/8 | 51/56 | 61 | 0 | 0 | 31953.8 | 95796.9 | stopped after 4/8 simulated users failed |
| app_token | 1 | 1/1 | 7/7 | 7 | 0 | 0 | 5108.2 | 5108.2 |  |
| app_token | 2 | 2/2 | 14/14 | 14 | 0 | 0 | 5791.3 | 8430.6 |  |
| app_token | 4 | 4/4 | 28/28 | 28 | 0 | 0 | 4607.7 | 15927.5 |  |
| app_token | 8 | 6/8 | 54/56 | 60 | 0 | 0 | 17095.2 | 82317.7 |  |

## Methodology

- Each simulated user used a separate `SocrataClient` and `requests.Session`; no cache was used, so requests hit Socrata rather than local files.
- Exact subject queries used PIN filters; comparable-pool queries were limited to a bounded first page of same-township/same-class rows.
- The practical ceiling is the highest tested user count where all simulated users and operations succeeded, no HTTP 429 was observed, and p95 user load time stayed under 60 seconds.
- Per-operation HTTP statuses and durations are available in the JSON report.

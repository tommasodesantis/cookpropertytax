# Data Sources

All live county data is fetched server-side. The browser never receives the Socrata app token.

| Source | Dataset ID | Fields used |
| --- | --- | --- |
| Parcel universe | `nj4t-kc8j` | `pin`, `class`, `township_name`, `township_code`, `nbhd_code`, `lat`, `lon`, `year`, `zip_code` |
| Assessed values | `uzyt-m557` | `pin`, `year`, `mailed_tot`, `certified_tot`, `board_tot`, `mailed_bldg`, `certified_bldg`, `board_bldg` |
| Residential characteristics | `x54s-btds` | `pin`, `class`, `township_code`, `year`, building/land sqft, year built, construction/style inputs, beds, baths, amenities |
| Parcel sales | `wvhk-k5uv` | `pin`, `sale_date`, `sale_price` |

## Known Limits

- Parcel-universe rows used by the current public dataset do not include street-address fields.
  Comparable exhibits identify properties by formatted PIN.
- Live address search is disabled because the current public parcel-universe dataset does not
  expose a reliable address field. Users should recover their PIN from the official Cook County
  Property Tax Portal.
- Configured-year assessed-value rows can exist without AV fields. The app falls back to the latest
  value-bearing row and warns the user.
- Condo pools can be sparse. The app uses the measured missing-data bands described in
  [LEARNINGS.md](LEARNINGS.md).
- PTAB full-grid evidence is not feasible from public data alone. The packet includes
  property-record-card user-supply language.

## Operational Guardrails

- Cache TTL: 12 hours.
- Identical in-flight Socrata requests are coalesced within the server instance.
- Per-case outbound Socrata fetch concurrency is capped at 2.
- Case and print builds are capped at 4 concurrent assessments per server instance. Extra requests
  wait in FIFO order instead of increasing Socrata pressure.
- Queued assessments wait up to 60 seconds. If a request cannot start in that window, the API
  returns a friendly 503 with retry guidance.
- `/api/queue` exposes active/queued counts so the browser can show a plain-language busy message
  while the user waits.
- The Socrata app token is read from `SOCRATA_APP_TOKEN` and never committed.
- Problem reports require `TURNSTILE_SECRET_KEY` and `GITHUB_ISSUES_TOKEN`; those secrets are never
  sent to the browser.

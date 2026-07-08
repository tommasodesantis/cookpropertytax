# Appeal Compass Development Learnings

This document preserves the durable findings from the Python CLI development cycle before the
repository was refactored into a server-rendered webapp. The webapp keeps these constraints in code,
tests, and user-facing copy.

## Source Access And Calendar Authority

- Cook County Assessor calendar automation remains blocked in direct shell fetches. The official
  page redirects to `https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines`, but
  command-line retrieval returned CloudFront 403 during the 2026-07-06 retest.
- Browser access to the official Assessor calendar worked, and the manual authority PDF
  `Assessment & Appeal Calendar _ Cook County Assessor's Office.pdf` was extracted locally on
  2026-07-06. The authority file reported `Last updated: 6/29/26`.
- Assessor constants are therefore maintained manually from the authority PDF until direct
  automation is available. Runtime output must warn users when today's date is past the configured
  Assessor session end and must point to the official source URL.
- The Assessor PDF does not contain BOR open dates, close dates, or evidence deadlines. It shows
  only pass markers and a repeated BOR-related label, so BOR dates stay sourced to the official BOR
  dates PDF.

## Comparable Evidence Feasibility

- The Assessor comparable profile is feasible with caveats. It uses same class, township or
  neighborhood preference, building square footage, lenient year filtering when data exists, and
  total assessed value per square foot.
- The Board of Review comparable profile is feasible with caveats. Public BOR rules do not publish
  a PTAB-style grid, so the implementation uses a conservative building/improvement assessment per
  square foot profile with same-class and similarity filters.
- The PTAB full comparable grid is not feasible from public Socrata data alone. In the 18-property
  Phase 2 sample, only 8 of 18 parcels met the three-comparable floor after strict PTAB-style
  location, square footage, age, land, style, and amenity filters. The median final survivor count
  was 2.
- PTAB output must therefore expose public-data limits and require the homeowner to supply
  property record cards, listing sheets, condition details, photos, and any missing grid fields.
  It must not present a generated PTAB grid as complete from public data.

## Condo And Missing Data Gates

- Condo public-data pools were data-limited in the measured Phase 2 run. Four condominium samples
  produced only the subject row in same-township and same-class candidate pools, with no usable
  unit square-foot availability.
- Condo comparable analysis is no longer skipped blindly. Runtime analysis measures the active
  comparable pool's missing-data rate for unit square footage and the active assessment metric.
- If the missing-data rate is below 30%, condo analysis can run normally. From 30% through 50%, it
  can run with a measured-rate warning. Above 50%, the analysis is skipped with the measured rate
  and guidance to use sale, appraisal, building-level equity, or factual-error evidence.

## Socrata Data Quirks

- The Cook County parcel-universe rows used for subject and comparable pools do not expose street
  address fields. Comparable exhibits identify properties by formatted PIN, not by an unavailable
  address placeholder.
- Live address search was removed on 2026-07-07 after a temporary probe against live Socrata
  metadata and query endpoints. The probe checked `nj4t-kc8j`, `uzyt-m557`, `x54s-btds`, and
  `wvhk-k5uv` metadata via `/api/views/{id}`, tried `prop_address_full`, `property_address`, and
  `address` with raw and normalized searches for `1906 W Huron St, Chicago, IL 60622, United
  States`, and confirmed that `nj4t-kc8j` has no address-like fields and returns Socrata
  `query.soql.no-such-column` for those fields. Two address-bearing candidates,
  `5pge-nu6u` and `bcnq-qi2z`, found `1906 W HURON ST`, but both are archived 2022 Assessor
  datasets, so they are not reliable enough for current address search or current comparable
  addresses.
- Configured-year assessed-value rows often exist without value fields. The data layer must select
  the latest value-bearing row and warn when it falls back from the configured assessment year.
- Residential characteristics can be missing for a subject parcel. The app must degrade without a
  crash, explain which documented override can unblock analysis, and label user-supplied values as
  user-supplied documentation items.
- Warnings must be de-duplicated before they reach the user.

## Socrata Concurrency And Architecture

- The 2026-07-06 concurrency probe measured a practical ceiling of 2 simultaneous users without an
  app token and 4 simultaneous users with a Socrata app token.
- No HTTP 429 responses were observed in that probe, but p95 latency degraded sharply at 8
  simulated users. The no-token 8-user run stopped after 4 of 8 simulated users failed.
- The webapp architecture must be cache-first, coalesce identical in-flight upstream requests,
  limit per-case outbound Socrata fetch concurrency to at most 2, keep comparable pool queries
  bounded, and honor `Retry-After` for 429 responses.
- The Socrata app token must remain server-side only. It belongs in `.dev.vars` for local
  Wrangler development and in a production server secret, never in committed files, browser code,
  logs, or reports.

## Datasets And Fields

| Logical source | Dataset ID | Important fields and quirks |
| --- | --- | --- |
| Parcel universe | `nj4t-kc8j` | PIN, class, township, township code, neighborhood, tax code, coordinates, ZIP, geography. Comparable pool rows may not include street addresses. |
| Assessed values | `uzyt-m557` | `mailed_tot`, `certified_tot`, `board_tot`, `mailed_bldg`, `certified_bldg`, `board_bldg`, `year` or `tax_year`. Configured-year rows may lack value fields. |
| Residential characteristics | `x54s-btds` | Building square footage, land square footage, year built, residential type, exterior wall, construction quality, beds, baths, amenities. Condo unit data can be sparse. |
| Parcel sales | `wvhk-k5uv` | Sale date and sale price. Ignore unusable or nominal prices. |
| Clerk tax-code rates | manual Clerk XLSX | `Code24` and composite `CodeRate24` from the Cook County Clerk 2024 Tax Code Agency Rate file, retrieved 2026-07-08 from `https://www.cookcountyclerkil.gov/sites/default/files/2026-04/2024-tax-code-agency-rate-file.xlsx`. A current Socrata tax-rate mapping API was not verified during the Step 6 research pass. |

## Tax Rate Assumptions

- The parcel universe exposes `tax_code`, which allows a parcel to be mapped to a committed Clerk
  tax-code rate lookup when the code is present.
- The Clerk tax-code rate lookup is sourced from the Cook County Clerk 2024 Tax Code Agency Rate
  file and uses the composite `CodeRate24` value converted to a decimal tax rate. It is labeled
  approximate wherever it appears.
- If the parcel tax code is missing or absent from the lookup, estimated savings fall back to
  `DEFAULT_TAX_RATE` and must label the fallback as a county default assumption.
- The UI, print packet, and workbook must show the equalizer and the tax-rate source next to the
  estimated savings range.

## Constants To Refresh Annually

- `ASSESSMENT_YEAR`
- `STATE_EQUALIZER`
- `DEFAULT_TAX_RATE`
- Clerk tax-code composite-rate lookup in `src/domain/taxRates.ts`
- Assessor township windows and Assessor `session_end`
- BOR township windows, evidence deadlines, and BOR `session_end`
- Official source URLs and source notes
- Any public-data dataset IDs or field mappings that changed upstream

## Product Honesty Requirements

- Evidence precedence is documented in `docs/EVIDENCE_PRECEDENCE.md`: positive public values win
  when present, user values are fallback-only, and user-supplied values remain
  documentation-required.
- Show `NOT LEGAL ADVICE. Appeal Compass supports only individual residential homeowners appealing
  their own home. Entity-owned properties, commercial properties, and association properties are
  not supported and generally require an attorney.` in every results view and printable packet.
- Every deadline must carry a link to the official venue source and the instruction to verify at
  the official source before filing.
- Users explicitly choose Assessor, BOR, or PTAB. The app must not silently switch venues; when a
  selected Assessor or BOR window is closed, keep preparation guidance available while preserving
  the selected venue's comparable profile and checklist.
- PTAB deadlines are computed only from a user-entered BOR decision date. If no date is provided,
  the app must refuse to guess.
- Estimated savings are rough ranges only. Display the equalizer and tax-rate assumptions next to
  the range.
- User-supplied values must be labeled as user-supplied and documentation-required, never as
  official county data.

## Sale Recency Rule

- Recorded sales and user-reported purchases may drive an overvaluation argument only when the
  sale date is within three years before the January 1 lien date for `ASSESSMENT_YEAR`.
- This matches Cook County Board of Review Rule 18, which requires disclosure and sale documents
  when a purchase took place within three years of the lien date:
  https://www.cookcountyboardofreview.com/board-review-official-rules
- It is also consistent with the Cook County Assessor's public valuation explanation that
  residential assessments are as of January 1 and use three to five years of prior sales to
  stabilize market-value estimates:
  https://www.cookcountyassessoril.gov/how-properties-are-valued
- PTAB filing instructions recognize Recent Sale, Comparable Sales, and Recent Appraisal as
  evidence categories and require closing documents for a Recent Sale:
  https://ptab.illinois.gov/filing.html
- Implementation note: stale sales may be shown as informational context, but must not create an
  overvaluation argument or estimated savings. PTAB deadlines remain unrelated and are computed
  only from a user-supplied BOR decision date.
- Phase 6 implementation: `buildEvidenceSummary` filters recorded sales and user-reported
  purchases through this rule before assigning an overvaluation target or estimated savings.
  Appraisals remain labeled by date; no deterministic official appraisal-age window was identified.

## Assessment Queueing

- Per-case outbound Socrata fetch concurrency stays capped at 2; this remains the measured safe
  ceiling for a single case build.
- Case and print builds now share an assessment-level limiter capped at 4 concurrent builds per
  server instance. This matches the measured token-backed Socrata ceiling while allowing several
  homeowners to proceed at once.
- Requests above that limit wait in FIFO order. They time out after 60 seconds with friendly retry
  guidance instead of failing immediately or increasing upstream pressure.
- `/api/queue` reports active and queued counts so the browser can tell a user when Appeal Compass
  is busy and the assessment is in line.

## Reporting

- Problem reporting is wired but disabled until deployment secrets and public keys are configured.
  Server-side secrets are `TURNSTILE_SECRET_KEY` and `GITHUB_ISSUES_TOKEN`; public constants are
  `TURNSTILE_SITE_KEY` in `src/domain/publicConfig.ts`.
- The Turnstile secret and GitHub token must never be committed or sent to the browser. The
  reporting endpoint strips HTML from submitted text and excludes Turnstile tokens from GitHub issue
  bodies.

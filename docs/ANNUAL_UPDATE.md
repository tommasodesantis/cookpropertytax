# Annual Update Procedure

Refresh these constants before each assessment session and before presenting the app as current.

## 1. Verify Official Sources

- Open the Cook County Assessor calendar page in a browser:
  `https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines`.
- If shell automation still receives CloudFront 403, download or print the official authority PDF
  manually and record its last-updated date.
- Open the Cook County Board of Review site and the official township dates PDF:
  `https://www.cookcountyboardofreview.com/`.
- Verify PTAB filing guidance at `https://ptab.illinois.gov/`.
- Reconfirm sale-evidence guidance for the three-year pre-lien-date rule in
  `docs/LEARNINGS.md`.

## 2. Update Calendar Constants

- Update `ASSESSMENT_YEAR`.
- Update every Assessor township window from the Assessor authority file.
- Keep known townships explicit even when a future window is blank.
- Update the Assessor calendar label, source note, source URL, and `session_end`.
- Update BOR township groups, open dates, close dates, evidence deadlines, source URL, source note,
  and `session_end` only from an official BOR source with concrete date values.
- Do not infer BOR dates from the Assessor PDF pass markers.

## 3. Update Financial Assumptions

- Update `STATE_EQUALIZER`.
- Update `DEFAULT_TAX_RATE`.
- Confirm the residential `ASSESSMENT_LEVEL` remains correct before changing it.
- Re-run known-answer tests for estimated savings:
  `delta AV * equalizer * tax rate`, with a plus/minus 20% range.

## 4. Recheck Socrata Schema And Fallbacks

- Confirm dataset IDs for parcel universe, assessed values, residential characteristics, and parcel
  sales.
- Confirm the field mappings for PIN, class, township, township code, neighborhood, coordinates,
  building square footage, land square footage, year built, style inputs, amenities, assessed-value
  columns, and sale fields.
- Re-run tests for configured-year fallback, latest value-bearing AV fallback, removed address
  search, PIN-only comparable labels, and missing subject-data guidance.
- Do not restore address search unless the current public parcel-universe dataset exposes reliable
  address fields and live LIKE queries are verified.

## 5. Recheck Feasibility And Concurrency

- Re-run a bounded comparable-feasibility sample before changing comparable profiles.
- Preserve the PTAB public-data-limits language unless public data can actually satisfy the full
  PTAB grid and documentation requirements.
- Re-run the polite concurrency probe if the Socrata token policy, dataset behavior, or server
  request strategy changes.
- Keep per-case outbound Socrata concurrency at 2 unless a new measured ceiling supports a change.
- Keep the assessment-level build limiter at 4 concurrent case/print builds unless a new measured
  token-backed ceiling supports a change.
- Confirm `/api/queue` and the queue-timeout 503 path still pass tests.

## 6. Verify Reporting And Exports

- Confirm `TURNSTILE_SITE_KEY` remains empty in the public repo unless intentionally enabling
  Turnstile for deployment.
- Confirm `TURNSTILE_SECRET_KEY` and `GITHUB_ISSUES_TOKEN` are configured only as secrets.
- Re-run report endpoint tests for Turnstile pass/fail and GitHub success/failure.
- Open the generated `.xlsx` comparable export in Excel or LibreOffice after workbook schema
  changes.

## 7. Verify User-Facing Honesty

- Confirm calendar staleness warnings fire after the configured session end.
- Confirm PTAB still refuses to compute a deadline without a user-entered BOR decision date.
- Confirm every deadline includes a verify-at-source link.
- Confirm every user-supplied value is labeled as user-supplied with documentation required.
- Confirm estimated savings show the equalizer and tax-rate assumptions.

## 8. Final Checks

- Run the full verification command twice with no intervening changes.
- Update `docs/LEARNINGS.md` if the source access, public-data feasibility, concurrency ceiling, or
  product limitations changed.
- Do not commit Socrata tokens, downloaded scratch files, rendered packets, build caches, or local
  Wrangler state.

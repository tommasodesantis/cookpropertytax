# Blockers

## 2026-07-06 - Cook County Assessor calendar source automation blocked

- Attempted source: `https://www.cookcountyassessor.com/assessment-calendar-and-deadlines`
- VPN retest: direct `curl.exe` fetch still returns CloudFront 403 after redirect to `https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines`.
- Browser-access retest: the official redirected calendar page loaded on 2026-07-06 and reported `Last updated: 1/27/26`.
- Manual authority file supplied for Phase 2: `Assessment & Appeal Calendar _ Cook County Assessor's Office.pdf`.
- Manual authority file provenance: official Assessor calendar printout, `Last updated: 6/29/26`,
  extracted locally on 2026-07-06.
- Socrata retest: live Cook County Socrata API calls work through the VPN path and passed the 10-property smoke run in `reports/live_smoke_2026-07-06.md`.
- Mitigation now applied: the manual authority file supersedes the stale CCAO constants. CCAO
  windows are centralized in `appeal_tool/config.py`; routing emits staleness warnings after the
  extracted authority file's latest listed Assessor deadline, and points users to the official
  Assessor URL instead of presenting stale dates as guaranteed current.
- Remaining blocker: automated local refresh of the CCAO calendar source is still blocked by CloudFront, so calendar constants must be manually verified at the official page until direct fetch access is available.

## 2026-07-06 - Assessor authority PDF does not provide BOR date values

- Attempted source: `Assessment & Appeal Calendar _ Cook County Assessor's Office.pdf`, extracted
  on 2026-07-06.
- Measured evidence: each township row repeats a `Last File Date Board of Review Appeal Dates`
  field, and some rows show `Pass 1` or `Pass 2`, but the PDF provides no BOR open date, close
  date, or evidence deadline values.
- Why this blocks fuller BOR calendar alignment: `BOR_GROUPS` requires concrete open/close/evidence
  deadlines. The Assessor PDF cannot safely supersede the official BOR date PDF without those
  values.
- Fallback strategy: retain `BOR_GROUPS` and `BOR_CALENDAR` from the official BOR PDF source,
  keep BOR staleness warnings active after the configured 2025-26 session end, and update BOR
  constants only from an official BOR source that lists actual township date ranges.

## 2026-07-06 - Full PTAB comparable grid not feasible from public data alone

- Attempted source/venue: `scripts/feasibility_comps.py` measured PTAB-style comparable filters
  against Cook County Socrata `parcel_universe`, `res_characteristics`, and `assessed_values`
  using 18 real parcels across suburban/city, single-family/condo/multi-family segments.
- Official guidance checked: PTAB filing/get-started pages and residential form/help PDF; BOR
  official rules page; CCAO comparable/guideline automation remains CloudFront-blocked.
- Measured evidence: `reports/comps_feasibility_2026-07-06.md` reports PTAB as `NOT FEASIBLE`.
  Only 8 of 18 sampled properties met the 3-comparable floor after PTAB-style location, sqft,
  age, land, style, and amenity filters; median final survivors were 2.0, with a 0.0 minimum and
  73.0 maximum.
- Data caveat: configured-year 2026 assessed-value rows were present but often lacked AV fields,
  so metric feasibility used the latest value-bearing rows, usually 2025, with warnings recorded
  in the report.
- Why this blocks fuller PTAB alignment: PTAB expects a complete Section V grid and supporting
  property record-card/listing material. Public Socrata data can populate many columns, but it
  cannot consistently produce at least three strict PTAB-style comparables across the measured
  sample and does not provide the user's documentary support.
- Fallback strategy: implement PTAB exhibits only with available public fields plus explicit
  `Not available from public data - supply from your property record card` placeholders for
  missing grid/document fields. Do not present a generated PTAB grid as complete unless the
  runtime pool meets the measured minimum.

## 2026-07-06 - Condo comparable pools remain data-limited

- Attempted source/venue: the comparable feasibility harness included four condominium samples
  from Niles, Cicero, Rogers Park, and South Chicago.
- Measured evidence: each condo sample produced only the subject row in the bounded same
  township/class candidate pool, and building/unit sqft availability was 0.0% for those condo
  contexts. Assessor, BOR, and PTAB final survivor counts were all 0 for all four condo samples.
- Why this blocks blanket condo comparable generation: same-class condo public-data pools did not
  provide enough unit-sqft candidates to calculate reliable AV-per-sqft comparable evidence in
  this measured run.
- Fallback strategy: remove the blanket `is_condo` skip only after adding the Workstream 3
  runtime missing-data gate. Condo comparable analysis should run when the measured active-profile
  missing-data rate is below 30%, warn at 30-50%, and skip with a measured-rate note above 50%.
- Runtime status: the missing-data gate is now implemented in `appeal_tool.analysis`; the public
  data blocker still applies whenever a specific condo candidate pool measures above the 50%
  missing-data threshold.

## 2026-07-06 - Comparable street addresses unavailable in parcel-universe rows

- Attempted source/path: Workstream 5 live smoke rerun on 2026-07-06 using
  `SocrataRepository._load_comparables` joined to Cook County Socrata `parcel_universe`,
  `res_characteristics`, and `assessed_values`.
- Measured evidence: direct Socrata schema probe for `parcel_universe` rejected
  `prop_address_full`, `property_address`, and `address` as missing columns; bulk
  `parcel_universe` rows expose PIN, class, township, neighborhood, lat/lon, zip, and geography
  fields, but not street addresses.
- Why this blocks fuller user-facing comparable exhibits: the public data can enrich comparable
  neighborhood and coordinates, but it cannot populate actual street addresses from the current
  parcel-universe source.
- Fallback strategy: generated comparable rows now use the explicit label
  `Address not available from public data` instead of a blank address, and the case warnings state
  that comparable parcel-universe rows did not include property address fields.

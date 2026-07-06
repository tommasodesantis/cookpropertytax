# Comparable Evidence Feasibility - Phase 2

- Run date: 2026-07-06
- Configured assessment year: 2026
- Machine-readable results: `reports/comps_feasibility_2026-07-06.json`
- Data source: Cook County Socrata datasets through `SocrataClient` with caching, pagination, timeout, retry, and backoff behavior.
- Official-source status: PTAB filing page and PTAB residential form were reachable; BOR official rules were reachable; CCAO comparable/guideline assets remain CloudFront-blocked in local automation and are treated as a verification caveat.
- Official source URLs checked: `https://ptab.illinois.gov/filing.html`, `https://ptab.illinois.gov/getStarted.html`, `https://www.cookcountyboardofreview.com/board-review-official-rules`, and `https://www.cookcountyassessoril.gov/appeals`.

## Official Guidance Matrix Used

| Requirement | Assessor profile | BOR profile | PTAB profile |
| --- | --- | --- | --- |
| Location | Township/neighborhood; same-neighborhood preferred when available | Same-neighborhood preferred | Same-neighborhood or proximity fallback |
| Class | Same class | Same class | Same class |
| Age/year built | Measured; lenient filter if missing | Measured; lenient filter if missing | Required for strict grid feasibility |
| Building/living sqft | Required for metric | Required for metric | Required for metric |
| Land sqft | Measured, not filter-gating | Measured, not filter-gating | Required for grid feasibility |
| Construction/design/style | Measured, not filter-gating | Measured, not filter-gating | Required for grid feasibility |
| Amenities/features | Measured, not filter-gating | Measured, not filter-gating | Required for grid feasibility |
| Minimum comparables | 3 measured; 5 preferred not enforced here | 3 measured as a conservative floor | 3 required by PTAB form |
| Assessment metric | Total AV/sqft | Improvement/building AV/sqft | Improvement/building AV/sqft |
| Property record cards | User-supply/official-source item | Evidence item | Explicit PTAB form item |
| Full comparable grid | No PTAB-style grid | No PTAB-style grid | Section V grid |

PTAB official sources verified that residential appeals may use comparable properties similar in age, construction, location, and square footage; that comparable sales and equity appeals require at least three properties in Section V Grid Analysis; and that the grid must be completed unless an appraisal is attached.

BOR official rules verified the filing/evidence deadline framework and that class 2 residential subjects are treated separately from other property types in evidence submission requirements. The public rules do not publish a PTAB-style comparable grid.

## Sample Coverage

| # | Segment | Township | Class | PIN | Year fallback | Candidates | Load seconds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | north suburban single-family | Barrington | 203 | 01-01-100-025-0000 | no | 100 | 11.40 |
| 2 | north suburban condo | Niles | 299 | 10-07-301-006-1001 | no | 1 | 1.31 |
| 3 | northwest suburban single-family | Wheeling | 203 | 03-01-204-002-0000 | no | 100 | 8.52 |
| 4 | north suburban multi-family | Evanston | 211 | 05-33-312-003-0000 | no | 97 | 8.07 |
| 5 | west suburban condo | Cicero | 299 | 16-20-130-042-1001 | no | 1 | 1.32 |
| 6 | west suburban multi-family | Proviso | 211 | 15-02-111-086-0000 | no | 100 | 17.64 |
| 7 | west suburban single-family | Berwyn | 203 | 16-19-101-009-0000 | no | 100 | 7.84 |
| 8 | city north condo | Rogers Park | 299 | 10-25-303-052-1001 | no | 1 | 1.43 |
| 9 | city north multi-family | Lake View | 211 | 14-05-100-024-0000 | no | 100 | 8.20 |
| 10 | city south single-family | Hyde Park | 203 | 20-02-102-005-0000 | no | 99 | 9.91 |
| 11 | city south condo | South Chicago | 299 | 17-09-424-009-1001 | no | 1 | 1.26 |
| 12 | city northwest single-family | Jefferson | 203 | 09-25-303-025-0000 | no | 100 | 7.93 |
| 13 | city southwest multi-family | Lake | 211 | 19-01-100-004-0000 | no | 98 | 9.80 |
| 14 | south suburban multi-family | Calumet | 211 | 25-29-301-044-0000 | no | 99 | 8.19 |
| 15 | southwest suburban single-family | Orland | 203 | 27-01-102-004-0000 | no | 100 | 11.27 |
| 16 | southwest suburban multi-family | Worth | 211 | 24-01-100-007-0000 | no | 100 | 11.97 |
| 17 | southwest suburban single-family | Palos | 203 | 23-01-101-008-0000 | no | 100 | 9.60 |
| 18 | southwest suburban single-family | Stickney | 203 | 19-06-101-005-0000 | no | 100 | 12.57 |

Selection gaps:
- Used the pinned real-property sample set selected during the first live feasibility run; current candidate pools were still loaded from Socrata.

## Field Availability

Median field availability across sampled township/class candidate pools:

| Field | Availability |
| --- | --- |
| building_sqft | 100.0% |
| land_sqft | 100.0% |
| year_built | 100.0% |
| construction_style | 100.0% |
| amenities | 100.0% |
| improvement_av | 100.0% |
| total_av | 100.0% |
| neighborhood | 100.0% |
| coordinates | 100.0% |

## Pool Survival and Runtime

| Venue profile | Verdict | Properties meeting minimum | Final survivor summary | Metric-ready summary | Selection runtime | Baseline runtime |
| --- | --- | --- | --- | --- | --- | --- |
| Cook County Assessor | FEASIBLE-WITH-CAVEATS | 14/18 | median 17.5; min 0.0; max 93.0 | median 100.0; min 0.0; max 100.0% | median 0.1; min 0.0; max 0.2 ms | median 0.1; min 0.0; max 0.1 ms |
| Cook County Board of Review | FEASIBLE-WITH-CAVEATS | 14/18 | median 15.0; min 0.0; max 90.0 | median 100.0; min 0.0; max 100.0% | median 0.1; min 0.0; max 0.2 ms | median 0.1; min 0.0; max 0.1 ms |
| Illinois PTAB | NOT FEASIBLE | 8/18 | median 2.0; min 0.0; max 73.0 | median 100.0; min 0.0; max 100.0% | median 0.1; min 0.0; max 0.2 ms | median 0.1; min 0.0; max 0.1 ms |

## Per-Property Survival

| PIN | Assessor final | BOR final | PTAB final | Notes |
| --- | --- | --- | --- | --- |
| 01-01-100-025-0000 | 41 | 30 | 0 | 5 Socrata warning(s); ptab below minimum |
| 10-07-301-006-1001 | 0 | 0 | 0 | 1 Socrata warning(s); assessor below minimum; bor below minimum; ptab below minimum |
| 03-01-204-002-0000 | 62 | 50 | 1 | 5 Socrata warning(s); ptab below minimum |
| 05-33-312-003-0000 | 17 | 13 | 2 | 4 Socrata warning(s); ptab below minimum |
| 16-20-130-042-1001 | 0 | 0 | 0 | assessor below minimum; bor below minimum; ptab below minimum |
| 15-02-111-086-0000 | 18 | 18 | 2 | 5 Socrata warning(s); ptab below minimum |
| 16-19-101-009-0000 | 77 | 68 | 22 | 4 Socrata warning(s) |
| 10-25-303-052-1001 | 0 | 0 | 0 | assessor below minimum; bor below minimum; ptab below minimum |
| 14-05-100-024-0000 | 61 | 45 | 13 | 4 Socrata warning(s) |
| 20-02-102-005-0000 | 19 | 11 | 0 | 5 Socrata warning(s); ptab below minimum |
| 17-09-424-009-1001 | 0 | 0 | 0 | 1 Socrata warning(s); assessor below minimum; bor below minimum; ptab below minimum |
| 09-25-303-025-0000 | 93 | 90 | 73 | 5 Socrata warning(s) |
| 19-01-100-004-0000 | 57 | 33 | 12 | 5 Socrata warning(s) |
| 25-29-301-044-0000 | 13 | 11 | 8 | 5 Socrata warning(s) |
| 27-01-102-004-0000 | 17 | 17 | 5 | 5 Socrata warning(s) |
| 24-01-100-007-0000 | 7 | 7 | 7 | 5 Socrata warning(s) |
| 23-01-101-008-0000 | 12 | 7 | 2 | 4 Socrata warning(s); ptab below minimum |
| 19-06-101-005-0000 | 27 | 24 | 3 | 4 Socrata warning(s) |

## Methodology

- Selected up to 20 real parcels from predefined township/class segments spanning north suburbs, south/west suburbs, and City of Chicago; single-family, condo, and multi-family classes are represented when Socrata returned rows.
- Loaded bounded same-township/same-class candidate pools from `parcel_universe`, `res_characteristics`, and `assessed_values` using the existing client with deterministic pagination. Cap warnings in the table mean full-pool download was not attempted for that context.
- Joined candidates by PIN and measured field availability before filtering.
- For assessment metrics, used the latest value-bearing `assessed_values` row for each PIN when configured-year rows existed as stubs without AV columns; those fallbacks are called out in per-property warnings.
- Measured pool survival after metric readiness, location, building sqft, year, land, style, and amenity filters according to each venue profile.
- Compared per-profile selection runtime with an emulation of the current shared baseline comparable filter. Network/data-load time is reported separately.

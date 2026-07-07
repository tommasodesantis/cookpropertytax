# Live Smoke Test - 10 Cook County Properties

- Run date: 2026-07-06
- CLI routing date: 2026-07-06
- Configured assessment year: 2026
- Data source: Cook County Socrata parcel universe plus live CLI data loads
- PDF checks: pypdf extraction, PyMuPDF open/render, required-section checks, banned-text checks, page-bounds and coarse text-overlap checks

## Result Summary

| # | Sample | Township | Class | PIN | CLI | Venue | Tier | Comps | PDF | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | north suburban single-family | Barrington | 203 | 01011000250000 | 0 | closed | MODERATE | ok/assessor/neighborhood/41 | ok | 5 warning(s) |
| 2 | north suburban condo | Niles | 299 | 10073010061001 | 0 | closed | LIMITED | condo/assessor/n/a/0 | ok | 8 warning(s) |
| 3 | northwest suburban single-family | Wheeling | 203 | 03302200680000 | 0 | closed | LIMITED | ok/assessor/neighborhood/1679 | ok | 9 warning(s) |
| 4 | west suburban single-family | Oak Park | 203 | 16053000050000 | 0 | closed | LIMITED | ok/assessor/neighborhood/544 | ok | 3 warning(s) |
| 5 | west suburban multi-family | Proviso | 211 | 15021110860000 | 0 | closed | LIMITED | ok/assessor/neighborhood/18 | ok | 5 warning(s) |
| 6 | city north condo | Rogers Park | 299 | 10253030521001 | 0 | closed | LIMITED | condo/assessor/n/a/0 | ok | 6 warning(s) |
| 7 | city north multi-family | Lake View | 211 | 14062200040000 | 0 | assessor | LIMITED | ok/assessor/neighborhood/52 | ok | 6 warning(s) |
| 8 | city south single-family | Hyde Park | 203 | 25011090430000 | 0 | closed | MODERATE | ok/assessor/neighborhood/2050 | ok | 9 warning(s) |
| 9 | south suburban single-family | Thornton | 203 | 29131030200000 | 0 | closed | MODERATE | ok/assessor/neighborhood/21 | ok | 9 warning(s) |
| 10 | south city condo | South Chicago | 299 | 17094300241002 | 0 | closed | LIMITED | condo/assessor/n/a/0 | ok | 8 warning(s) |

## Routing Headlines

- 01011000250000: No configured CCAO or BOR filing window is currently actionable.
- 10073010061001: No configured CCAO or BOR filing window is currently actionable.
- 03302200680000: No configured CCAO or BOR filing window is currently actionable.
- 16053000050000: No configured CCAO or BOR filing window is currently actionable.
- 15021110860000: No configured CCAO or BOR filing window is currently actionable.
- 10253030521001: No configured CCAO or BOR filing window is currently actionable.
- 14062200040000: File with the Cook County Assessor now.
- 25011090430000: No configured CCAO or BOR filing window is currently actionable.
- 29131030200000: No configured CCAO or BOR filing window is currently actionable.
- 17094300241002: No configured CCAO or BOR filing window is currently actionable.

## PDF Rendering Notes

- Each generated PDF opened with PyMuPDF and pypdf.
- First pages rendered to PNG for manual review.
- No text block was allowed outside the page bounds.
- Coarse overlap detection flagged any materially overlapping text blocks.
- Comparable quality checks require non-empty address/neighborhood, valid Cook County coordinates, positive building sqft, positive assessment metric, plausible metric per sqft, and pool size/scope consistency for every generated exhibit.
- Temporary rendered pages and contact sheet were removed after checks.

# Live Smoke Test - 10 Cook County Properties

- Run date: 2026-07-06
- CLI routing date: 2026-07-06
- Configured assessment year: 2025
- Data source: Cook County Socrata parcel universe plus live CLI data loads
- PDF checks: pypdf extraction, PyMuPDF open/render, required-section checks, banned-text checks, page-bounds and coarse text-overlap checks

## Result Summary

| # | Sample | Township | Class | PIN | CLI | Venue | Tier | PDF | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | north suburban single-family | Barrington | 203 | 01281020100000 | 0 | closed | MODERATE | ok | 3 warning(s) |
| 2 | north suburban condo | Niles | 299 | 10073010061001 | 0 | closed | LIMITED | ok | 6 warning(s) |
| 3 | northwest suburban single-family | Wheeling | 203 | 03051210090000 | 0 | closed | LIMITED | ok | 5 warning(s) |
| 4 | west suburban single-family | Oak Park | 203 | 16051000130000 | 0 | closed | MODERATE | ok | 3 warning(s) |
| 5 | west suburban multi-family | Proviso | 211 | 15134280440000 | 0 | closed | MODERATE | ok | 3 warning(s) |
| 6 | city north condo | Rogers Park | 299 | 11313030801003 | 0 | closed | LIMITED | ok | 6 warning(s) |
| 7 | city north multi-family | Lake View | 211 | 14051220570000 | 0 | closed | LIMITED | ok | 5 warning(s) |
| 8 | city south single-family | Hyde Park | 203 | 20272300300000 | 0 | closed | LIMITED | ok | 5 warning(s) |
| 9 | south suburban single-family | Thornton | 203 | 29082210620000 | 0 | closed | LIMITED | ok | 5 warning(s) |
| 10 | south city condo | South Chicago | 299 | 17104000551005 | 0 | closed | LIMITED | ok | 6 warning(s) |

## Routing Headlines

- 01281020100000: No configured CCAO or BOR filing window is currently actionable.
- 10073010061001: No configured CCAO or BOR filing window is currently actionable.
- 03051210090000: No configured CCAO or BOR filing window is currently actionable.
- 16051000130000: No configured CCAO or BOR filing window is currently actionable.
- 15134280440000: No configured CCAO or BOR filing window is currently actionable.
- 11313030801003: No configured CCAO or BOR filing window is currently actionable.
- 14051220570000: No configured CCAO or BOR filing window is currently actionable.
- 20272300300000: No configured CCAO or BOR filing window is currently actionable.
- 29082210620000: No configured CCAO or BOR filing window is currently actionable.
- 17104000551005: No configured CCAO or BOR filing window is currently actionable.

## PDF Rendering Notes

- Each generated PDF opened with PyMuPDF and pypdf.
- First pages rendered to PNG for manual review.
- No text block was allowed outside the page bounds.
- Coarse overlap detection flagged any materially overlapping text blocks.
- Manual first-page contact sheet reviewed before cleanup: no visible overflow, clipping, or overlapping elements were found.
- Temporary render artifact path during review: `tmp\live_smoke_2026-07-06-fresh\pdf_contact_sheet.png`

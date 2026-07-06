# Cook County Property Tax Appeal Assistant

Single-entry-point CLI for Cook County, Illinois residential property-tax appeal screening.

```powershell
python appeal_tool.py --pin 03-00-000-000-0001 --fixture-dir tests/fixtures/cases
```

## What It Does

- Screens for over-assessment using one shared case file: uniformity comparables, overvaluation evidence, assessment history, and estimated savings assumptions.
- Routes the homeowner across the residential appeal ladder: Cook County Assessor, Board of Review, and Illinois PTAB.
- Generates a venue-specific pro se evidence packet PDF with routing, deadlines, checklist, evidence summary, and exemptions screen.

## What It Does Not Do

- It is NOT LEGAL ADVICE.
- It does not file an appeal for you.
- It does not represent LLCs, corporations, condo associations, or other entities. Those filers generally need an attorney.
- It does not guess missing deadlines or facts. PTAB deadlines require a user-supplied BOR decision date.

## Appeal Ladder

1. Cook County Assessor appeal: first-level appeal during the township filing window. This is also where property-description errors and Certificates of Error for prior-year factual errors or missed exemptions are surfaced.
2. Board of Review appeal: second-level appeal under the BOR township calendar and official rules.
3. Illinois Property Tax Appeal Board: state-level appeal after a BOR decision. PTAB filing is due within 30 days of the written BOR decision notice. The tool computes this only from `--bor-decision-date`.

## Installation

Python 3.10+ is required.

```powershell
python -m pip install -r requirements.txt
```

Development verification:

```powershell
python -m pip install -r requirements-dev.txt
python scripts/verify.py
```

## Usage Examples

Auto-route by PIN:

```powershell
python appeal_tool.py --pin 03-00-000-000-0001 --output-dir packets
```

Force BOR packet:

```powershell
python appeal_tool.py --pin 03-00-000-000-0001 --venue bor --output-dir packets
```

PTAB packet with required BOR decision date:

```powershell
python appeal_tool.py --pin 03-00-000-000-0001 --venue ptab --bor-decision-date 2026-05-20 --output-dir packets
```

Add homeowner evidence:

```powershell
python appeal_tool.py --pin 03-00-000-000-0001 --purchase-price 285000 --purchase-date 2024-06-15 --condition-issue "roof leak"
```

Offline fixture mode for repeatable tests:

```powershell
python appeal_tool.py --pin 03-00-000-000-0001 --fixture-dir tests/fixtures/cases
```

## Data Sources

- Cook County Socrata datasets for parcel, assessment, residential characteristics, and sales data.
- Cook County Board of Review dates and rules: https://www.cookcountyboardofreview.com/
- Cook County Assessor appeals and exemptions: https://www.cookcountyassessor.com/
- Illinois PTAB: https://ptab.illinois.gov/

Set `SOCRATA_APP_TOKEN` to reduce throttling risk. The tool also supports an on-disk `.cache/` and `--no-cache`.

## Annual Constants Update Procedure

Update `appeal_tool/config.py` before each assessment session:

- `ASSESSMENT_YEAR`
- `STATE_EQUALIZER`
- `DEFAULT_TAX_RATE`
- CCAO township filing windows
- BOR township filing windows and evidence deadlines
- Calendar `session_end` values
- Official source URLs and source notes

If today's date is past a configured session end, the CLI and PDF show a staleness warning and direct the homeowner to the official source URL.

## Verification

```powershell
python scripts/verify.py
```

The verifier runs `ruff check`, `ruff format --check`, `mypy`, and `pytest` with coverage.

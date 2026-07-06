# Blockers

## 2026-07-06 - Cook County Assessor calendar source blocked

- Attempted source: `https://www.cookcountyassessor.com/assessment-calendar-and-deadlines`
- Result: CloudFront 403 in browser and direct `curl.exe` fetch.
- Mitigation: CCAO windows are centralized in `appeal_tool/config.py`; routing emits verify/staleness warnings and points users to the official Assessor URL instead of presenting stale dates as guaranteed current.
- Next retry: refresh from the official Assessor source when accessible.

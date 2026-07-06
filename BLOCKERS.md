# Blockers

## 2026-07-06 - Cook County Assessor calendar source blocked

- Attempted source: `https://www.cookcountyassessor.com/assessment-calendar-and-deadlines`
- VPN retest: direct `curl.exe` fetch still returns CloudFront 403 after redirect to `https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines`.
- Browser-access retest: the official redirected calendar page loaded on 2026-07-06 and reported `Last updated: 1/27/26`.
- Socrata retest: live Cook County Socrata API calls work through the VPN path and passed the 10-property smoke run in `reports/live_smoke_2026-07-06.md`.
- Mitigation: CCAO windows are centralized in `appeal_tool/config.py`; routing emits verify/staleness warnings and points users to the official Assessor URL instead of presenting stale dates as guaranteed current.
- Remaining blocker: automated local refresh of the CCAO calendar source is still blocked by CloudFront, so calendar constants must be manually verified at the official page until direct fetch access is available.

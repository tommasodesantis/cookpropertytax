# Cook County Property Tax Appeal Assistant

A minimalist Cloudflare Worker webapp for screening Cook County, Illinois residential parcels for
property-tax appeal evidence.

It loads public county data server-side, routes a homeowner through the Assessor -> Board of Review
-> PTAB appeal ladder, and generates a print-optimized evidence packet that can be saved as PDF from
the browser.

## What It Does

- Looks up a residential parcel by PIN, with fixture-backed demo mode for samples.
- Screens public data for uniformity, sale/appraisal, factual-error, condition, and assessment-shock
  evidence.
- Routes the case to the Cook County Assessor, Cook County Board of Review, Illinois PTAB, or a
  closed-window preparation path.
- Shows deadlines, days remaining, official-source links, warning messages, comparable evidence,
  estimated savings assumptions, and a venue-specific checklist.
- Produces a printable evidence packet at `/print`.

## What It Does Not Do

- It is NOT LEGAL ADVICE.
- It does not file an appeal for you.
- It does not represent LLCs, corporations, condo associations, or other entities. Those filers
  generally need an attorney.
- It does not guess missing deadlines or facts. PTAB deadlines require a user-supplied BOR decision
  date.
- It does not promise savings. Estimated savings are rough ranges using the configured equalizer and
  tax-rate assumptions.

## Appeal Ladder

1. Cook County Assessor appeal: first-level appeal during the township filing window. This is also
   where property-description errors and Certificates of Error for prior-year factual errors or
   missed exemptions are surfaced.
2. Board of Review appeal: second-level appeal under the BOR township calendar and official rules.
3. Illinois Property Tax Appeal Board: state-level appeal after a BOR decision. PTAB filing is due
   within 30 days of the written BOR decision notice; this app computes that date only from a BOR
   decision date entered by the user.

Every deadline shown by the app links users back to the official venue source and tells them to
verify before filing.

## Local Development

Install dependencies:

```powershell
npm install
```

Create `.dev.vars` for local Wrangler development:

```powershell
SOCRATA_APP_TOKEN=your_token_here
```

The token stays server-side. Do not put it in committed files, browser code, logs, or reports.

Run locally:

```powershell
npm run dev
```

Then open `http://127.0.0.1:8787`.

Useful endpoints:

- `GET /api/health`
- `GET /api/demo`
- `GET /api/case?pin=03-00-000-000-0001&demo=1`
- `GET /print?pin=03-00-000-000-0001&demo=1`

## Testing

```powershell
npm run verify
```

`verify` builds the tiny browser bundle, runs Biome linting, TypeScript typechecking, and all
Vitest tests.

Fixture smoke against a running local Worker:

```powershell
npm run dev
npm run smoke:fixtures
```

## Data Sources

The Worker reads Cook County Socrata datasets server-side:

- Parcel universe: `nj4t-kc8j`
- Assessed values: `uzyt-m557`
- Residential characteristics: `x54s-btds`
- Parcel sales: `wvhk-k5uv`

See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) and [docs/LEARNINGS.md](docs/LEARNINGS.md) for
dataset quirks, public-data limits, comparable feasibility findings, concurrency limits, and annual
update notes.

## Deploying To Cloudflare

This repository is deploy-ready but this project does not deploy automatically.

1. Authenticate Wrangler.
2. Add the production secret:

   ```powershell
   npx wrangler secret put SOCRATA_APP_TOKEN
   ```

3. Review `wrangler.jsonc`.
4. Deploy intentionally:

   ```powershell
   npx wrangler deploy
   ```

The browser talks only to the Worker API; the Socrata token is never sent client-side.

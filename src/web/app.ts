interface ApiError {
  ok: false;
  error: {
    kind: string;
    message: string;
  };
}

interface CasePayload {
  ok: true;
  demo: boolean;
  today: string;
  case: {
    parcel: {
      pin: string;
      pinFormatted: string;
      propertyClass: string;
      townshipName: string;
      address: string;
      city: string;
      zipCode: string;
      buildingSqft: number | null;
      currentAv: number | null;
      currentImprovementAv: number | null;
    };
    userEvidence: {
      actualSqft: number | null;
      actualAv: number | null;
      actualImprovementAv: number | null;
      purchasePrice: number | null;
      appraisalValue: number | null;
    };
    dataWarnings: string[];
  };
  routing: {
    venue: string;
    headline: string;
    reasoning: string[];
    actionStatus: string;
    deadline: string | null;
    daysRemaining: number | null;
    warnings: string[];
    officialUrl: string | null;
  };
  evidence: {
    tier: string;
    tierMessage: string;
    impliedMarketValue: number | null;
    savingsAssumptions: {
      taxRate: number;
      stateEqualizer: number;
      low: number;
      point: number;
      high: number;
    };
    disclaimers: string[];
    arguments: Array<{
      argumentType: string;
      strength: string;
      text: string;
      targetAv: number | null;
      estimatedSavings: number | null;
    }>;
    comparableAnalysis: {
      status: string;
      note: string;
      profileLabel: string;
      metricLabel: string;
      warnings: string[];
      missingDataRate: number | null;
      scope: string | null;
      poolSize: number;
      subjectAvPerSqft: number | null;
      medianAvPerSqft: number | null;
      percentile: number | null;
      gapPct: number | null;
      exhibit: Array<{
        avPerSqft: number;
        distanceKm: number | null;
        comparable: {
          pinFormatted: string;
          buildingSqft: number | null;
          yearBuilt: number | null;
          av: number | null;
          improvementAv: number | null;
        };
      }>;
    };
  };
  venue: {
    key: string;
    name: string;
    officialUrl: string;
    checklist: string[];
    sections: Array<{ title: string; lines: string[] }>;
  };
  warnings: string[];
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing app root.");
}
const appRoot = app;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ENTITY_REFUSAL_MESSAGE =
  "Appeal Compass is designed only for individual residential homeowners appealing their own home; entity-owned, commercial, and association properties are not supported and generally require an attorney.";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dollars(value: number | null): string {
  return value === null ? "Not available" : money.format(value);
}

function numberText(value: number | null, digits = 0): string {
  return value === null
    ? "Not available"
    : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const data = (await response.json()) as T | ApiError;
  if (!response.ok || (typeof data === "object" && data && "ok" in data && data.ok === false)) {
    const message = (data as ApiError).error?.message ?? "The request failed.";
    throw new Error(message);
  }
  return data as T;
}

function formValue(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

function addOptionalParams(params: URLSearchParams, form: HTMLFormElement): void {
  const names = [
    "jurisdiction",
    "venue",
    "ownershipType",
    "assessorAppealFiled",
    "assessorDecisionReceived",
    "borAppealFiled",
    "borDecisionReceived",
    "borDecisionDate",
    "purchasePrice",
    "purchaseDate",
    "appraisalValue",
    "appraisalDate",
    "actualSqft",
    "actualAv",
    "actualImprovementAv",
  ];
  for (const name of names) {
    const value = formValue(form, name);
    if (value) {
      params.set(name, value);
    }
  }
  for (const flag of [
    "ownerOccupied",
    "age65Plus",
    "seniorFreezeIncome",
    "veteranDisabled",
    "personDisabled",
    "vacancyClaim",
    "demolitionClaim",
  ]) {
    if ((form.elements.namedItem(flag) as HTMLInputElement | null)?.checked) {
      params.set(flag, "1");
    }
  }
  const issues = formValue(form, "conditionIssue")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const issue of issues) {
    params.append("conditionIssue", issue);
  }
}

function progressHtml(message: string): string {
  return `<section class="progress" aria-live="polite"><p>${escapeHtml(message)}</p></section>`;
}

function githubLogo(): string {
  return `<svg aria-hidden="true" class="github-mark" viewBox="0 0 16 16" width="20" height="20">
    <path fill="currentColor" d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.78.4.08.55-.18.55-.39 0-.19-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.43 7.43 0 0 1 8 3.98c.68 0 1.36.09 2 .28 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.76.54 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.47.55.39A8.08 8.08 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"/>
  </svg>`;
}

function siteFooter(): string {
  return `<footer class="site-footer">
    <p>Appeal Compass is an open-source project developed by <a href="https://github.com/tommasodesantis" target="_blank" rel="noreferrer">Tommaso De Santis<span class="sr-only"> (opens in new tab)</span></a> under GPLv3.</p>
    <a class="footer-icon-link" href="https://github.com/tommasodesantis/appealcompass" target="_blank" rel="noreferrer">${githubLogo()}<span>View on GitHub</span><span class="sr-only"> (opens in new tab)</span></a>
    <a href="https://ko-fi.com/tomdesantis" target="_blank" rel="noreferrer">Donations help the project grow and cover hosting and maintenance costs.<span class="sr-only"> (opens in new tab)</span></a>
  </footer>`;
}

function startProgress(): () => void {
  const steps = [
    "Looking up your property...",
    "Fetching assessment history...",
    "Finding similar homes...",
    "Building the evidence summary...",
  ];
  let index = 0;
  const firstStep = steps[0] ?? "";
  const progress = document.querySelector<HTMLElement>("#progress");
  if (progress) {
    progress.innerHTML = progressHtml(steps[index] ?? firstStep);
  }
  const timer = window.setInterval(() => {
    index = (index + 1) % steps.length;
    const target = document.querySelector<HTMLElement>("#progress");
    if (target) {
      target.innerHTML = progressHtml(steps[index] ?? firstStep);
    }
  }, 650);
  return () => window.clearInterval(timer);
}

function shell(): void {
  appRoot.innerHTML = `
    <header class="topline">
      <h1>Appeal Compass</h1>
      <p class="lede">Enter a PIN. A PIN is the 14-digit parcel number on your assessment notice, tax bill, or property record card.</p>
    </header>

    <section class="panel" aria-labelledby="step-one">
      <div class="step-label">Step 1</div>
      <h2 id="step-one">Find the property</h2>
      <form id="case-form" class="stack">
        <div id="form-error" aria-live="polite"></div>
        <label>
          <span>Jurisdiction</span>
          <select name="jurisdiction" required>
            <option value="cook_county_il" selected>Cook County, Illinois</option>
          </select>
        </label>
        <p class="hint">More jurisdictions may be added - this is an open-source project.</p>
        <div class="lookup-grid">
          <label>
            <span>PIN</span>
            <input name="pin" autocomplete="off" inputmode="numeric" placeholder="03-00-000-000-0001" required>
          </label>
        </div>
        <p class="hint pin-help">Don't know your PIN? You can recover it from the <a href="https://www.cookcountypropertyinfo.com/" target="_blank" rel="noreferrer">Cook County Property Tax Portal<span class="sr-only"> (opens in new tab)</span></a>.</p>

        <fieldset class="question-group">
          <legend>Ownership type</legend>
          <label>
            <span>Who owns the property?</span>
            <select name="ownershipType" required>
              <option value="">Choose ownership type</option>
              <option value="individual">Individual</option>
              <option value="llc">LLC</option>
              <option value="corporation">Corporation</option>
              <option value="other">Other entity</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="question-group">
          <legend>Assessor appeal status</legend>
          <p>Have you already filed an Assessor appeal for this year?</p>
          <div class="choice-row">
            <label><input type="radio" name="assessorAppealFiled" value="yes" required><span>Yes</span></label>
            <label><input type="radio" name="assessorAppealFiled" value="no" required><span>No</span></label>
          </div>
          <div class="conditional" data-conditional="assessorDecision" hidden>
            <p>Have you already received the Assessor decision?</p>
            <div class="choice-row">
              <label><input type="radio" name="assessorDecisionReceived" value="yes"><span>Yes</span></label>
              <label><input type="radio" name="assessorDecisionReceived" value="no"><span>No</span></label>
            </div>
          </div>
        </fieldset>

        <fieldset class="question-group">
          <legend>Board of Review appeal status</legend>
          <p>Have you already filed a Board of Review appeal for this year?</p>
          <div class="choice-row">
            <label><input type="radio" name="borAppealFiled" value="yes" required><span>Yes</span></label>
            <label><input type="radio" name="borAppealFiled" value="no" required><span>No</span></label>
          </div>
          <div class="conditional" data-conditional="borDecision" hidden>
            <p>Have you already received the BOR decision?</p>
            <div class="choice-row">
              <label><input type="radio" name="borDecisionReceived" value="yes"><span>Yes</span></label>
              <label><input type="radio" name="borDecisionReceived" value="no"><span>No</span></label>
            </div>
          </div>
          <div class="conditional" data-conditional="borDecisionDate" hidden>
            <label>
              <span>BOR decision date</span>
              <input name="borDecisionDate" type="date">
            </label>
          </div>
        </fieldset>

        <details class="evidence">
          <summary>Add your own evidence</summary>
          <div class="evidence-grid">
            <label>
              <span>Venue</span>
              <select name="venue">
                <option value="auto">Auto-route</option>
                <option value="assessor">Assessor</option>
                <option value="bor">Board of Review</option>
                <option value="ptab">PTAB</option>
              </select>
            </label>
            <label>
              <span>Purchase price</span>
              <input name="purchasePrice" inputmode="decimal">
            </label>
            <label>
              <span>Purchase date</span>
              <input name="purchaseDate" type="date">
            </label>
            <label>
              <span>Appraisal value</span>
              <input name="appraisalValue" inputmode="decimal">
            </label>
            <label>
              <span>Appraisal date</span>
              <input name="appraisalDate" type="date">
            </label>
            <label>
              <span>Actual sqft</span>
              <input name="actualSqft" inputmode="decimal" aria-describedby="actual-help">
            </label>
            <label>
              <span>Actual total AV</span>
              <input name="actualAv" inputmode="decimal">
            </label>
            <label>
              <span>Actual improvement AV</span>
              <input name="actualImprovementAv" inputmode="decimal">
            </label>
          </div>
          <p id="actual-help" class="hint">User-supplied values are labeled documentation-required and are used only when official public data is missing.</p>
          <label>
            <span>Condition issues</span>
            <textarea name="conditionIssue" rows="3" placeholder="One issue per line"></textarea>
          </label>
          <div class="checks">
            ${[
              ["ownerOccupied", "Owner occupied"],
              ["age65Plus", "Age 65+"],
              ["seniorFreezeIncome", "Senior Freeze income screen"],
              ["veteranDisabled", "Disabled veteran"],
              ["personDisabled", "Person with disability"],
              ["vacancyClaim", "Vacancy claim"],
              ["demolitionClaim", "Demolition claim"],
            ]
              .map(
                ([name, label]) =>
                  `<label><input type="checkbox" name="${name}"><span>${label}</span></label>`,
              )
              .join("")}
          </div>
        </details>

        <div class="actions">
          <button type="submit">Review my case</button>
        </div>
      </form>
    </section>

    <div id="progress"></div>
    <div id="results"></div>
    ${siteFooter()}
  `;
}

function setFormError(message: string): void {
  const target = document.querySelector<HTMLElement>("#form-error");
  if (!target) {
    return;
  }
  target.innerHTML = message
    ? `<section class="error inline-error" role="alert">${escapeHtml(message)}</section>`
    : "";
}

function checkedValue(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}

function setConditional(form: HTMLFormElement, name: string, show: boolean): void {
  const section = form.querySelector<HTMLElement>(`[data-conditional="${name}"]`);
  if (!section) {
    return;
  }
  section.hidden = !show;
  for (const element of Array.from(section.querySelectorAll("input, select, textarea"))) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    const input = element;
    input.disabled = !show;
    input.required = show;
    if (!show) {
      if (input instanceof HTMLInputElement && input.type === "radio") {
        input.checked = false;
      } else {
        input.value = "";
      }
    }
  }
}

function updateConditionalFields(form: HTMLFormElement): void {
  const assessorFiled = checkedValue(form, "assessorAppealFiled") === "yes";
  const borFiled = checkedValue(form, "borAppealFiled") === "yes";
  const borDecisionReceived = checkedValue(form, "borDecisionReceived") === "yes";
  setConditional(form, "assessorDecision", assessorFiled);
  setConditional(form, "borDecision", borFiled);
  setConditional(form, "borDecisionDate", borFiled && borDecisionReceived);
}

function validateStepOne(form: HTMLFormElement): boolean {
  setFormError("");
  updateConditionalFields(form);
  if (!form.reportValidity()) {
    return false;
  }
  if (formValue(form, "ownershipType") !== "individual") {
    setFormError(ENTITY_REFUSAL_MESSAGE);
    return false;
  }
  return true;
}

function warningList(warnings: string[]): string {
  if (warnings.length === 0) {
    return "";
  }
  return `<section class="warnings" aria-label="Warnings"><h2>Warnings</h2><ul>${warnings
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("")}</ul></section>`;
}

function renderDeadline(payload: CasePayload): string {
  const route = payload.routing;
  const official = route.officialUrl
    ? `<a href="${escapeHtml(route.officialUrl)}" target="_blank" rel="noreferrer">Verify at the official source before filing</a>`
    : "";
  if (!route.deadline) {
    return `<p>No computed deadline. ${official}</p>`;
  }
  const days =
    route.daysRemaining === null
      ? ""
      : ` ${
          route.daysRemaining >= 0
            ? `${route.daysRemaining} days remaining.`
            : `${Math.abs(route.daysRemaining)} days past the computed deadline.`
        }`;
  return `<p><strong>Deadline:</strong> ${escapeHtml(route.deadline)}.${escapeHtml(days)} ${official}</p>`;
}

function renderComparables(payload: CasePayload): string {
  const comps = payload.evidence.comparableAnalysis;
  const rows = comps.exhibit
    .map((exhibit) => {
      const metric =
        comps.profileLabel.includes("Assessor") || payload.routing.venue === "closed"
          ? exhibit.comparable.av
          : exhibit.comparable.improvementAv;
      return `<tr>
        <td>${escapeHtml(exhibit.comparable.pinFormatted)}</td>
        <td>${numberText(exhibit.comparable.buildingSqft)}</td>
        <td>${escapeHtml(exhibit.comparable.yearBuilt ?? "Not available")}</td>
        <td>${dollars(metric)}</td>
        <td>${dollars(exhibit.avPerSqft)}</td>
      </tr>`;
    })
    .join("");
  const table =
    rows.length === 0
      ? "<p>No lower-assessed comparable exhibit is available from the current public data.</p>"
      : `<div class="table-wrap"><table>
          <thead><tr><th>PIN</th><th>Sqft</th><th>Year</th><th>Metric</th><th>Metric/sqft</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
  return `<section class="panel" aria-labelledby="step-four">
    <div class="step-label">Step 4</div>
    <h2 id="step-four">Evidence summary</h2>
    <p><strong>Tier:</strong> ${escapeHtml(payload.evidence.tier)}. ${escapeHtml(payload.evidence.tierMessage)}</p>
    <p class="hint">The tier is a rough screen of how much public data supports spending time on an appeal.</p>
    <p><strong>Comparable profile:</strong> ${escapeHtml(comps.profileLabel)} using ${escapeHtml(comps.metricLabel)}.</p>
    <p class="hint">Comparable analysis matters because uniformity appeals compare your assessment to similar homes.</p>
    <p>${escapeHtml(comps.note)}</p>
    <p><strong>Pool:</strong> ${numberText(comps.poolSize)} similar homes, ${escapeHtml(
      comps.scope ?? "no scope",
    )}; subject ${escapeHtml(comps.metricLabel)}/sqft ${dollars(
      comps.subjectAvPerSqft,
    )}; median ${dollars(comps.medianAvPerSqft)}; gap ${numberText(comps.gapPct, 1)}%.</p>
    ${table}
    <h3>Arguments</h3>
    ${
      payload.evidence.arguments.length
        ? `<ul>${payload.evidence.arguments
            .map(
              (argument) =>
                `<li><strong>${escapeHtml(argument.argumentType)}:</strong> ${escapeHtml(argument.text)}</li>`,
            )
            .join("")}</ul>`
        : "<p>No strong public-data argument was found. Add sale, appraisal, condition, or factual-error evidence if available.</p>"
    }
    <h3>Rough savings estimate</h3>
    <p>${dollars(payload.evidence.savingsAssumptions.low)} to ${dollars(
      payload.evidence.savingsAssumptions.high,
    )}, with point estimate ${dollars(payload.evidence.savingsAssumptions.point)}.</p>
    <p class="hint">Assumes equalizer ${payload.evidence.savingsAssumptions.stateEqualizer} and tax rate ${(
      payload.evidence.savingsAssumptions.taxRate * 100
    ).toFixed(2)}%; this is a rough range, not a promise.</p>
  </section>`;
}

function renderResults(payload: CasePayload, query: URLSearchParams): void {
  const subject = payload.case.parcel;
  const subjectAddress = [subject.address, subject.city, subject.zipCode]
    .filter(Boolean)
    .join(", ");
  const userValues = [
    payload.case.userEvidence.actualSqft
      ? `Actual sqft ${numberText(payload.case.userEvidence.actualSqft)}`
      : "",
    payload.case.userEvidence.actualAv
      ? `Actual AV ${dollars(payload.case.userEvidence.actualAv)}`
      : "",
    payload.case.userEvidence.actualImprovementAv
      ? `Actual improvement AV ${dollars(payload.case.userEvidence.actualImprovementAv)}`
      : "",
  ].filter(Boolean);
  const printQuery = new URLSearchParams(query);
  printQuery.set("pin", subject.pin);
  if (payload.demo) {
    printQuery.set("demo", "1");
  }

  const results = document.querySelector<HTMLElement>("#results");
  if (!results) {
    return;
  }
  results.innerHTML = `
    <section class="notice"><strong>${escapeHtml(payload.evidence.disclaimers[0])}</strong></section>
    <section class="panel" aria-labelledby="step-three">
      <div class="step-label">Step 3</div>
      <h2 id="step-three">Routing decision</h2>
      <p class="headline">${escapeHtml(payload.routing.headline)}</p>
      ${renderDeadline(payload)}
      <ul>${payload.routing.reasoning.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
    </section>

    <section class="subject panel">
      <h2>Subject property</h2>
      <dl>
        <div><dt>PIN</dt><dd>${escapeHtml(subject.pinFormatted)}</dd></div>
        ${subjectAddress ? `<div><dt>Address</dt><dd>${escapeHtml(subjectAddress)}</dd></div>` : ""}
        <div><dt>Class / township</dt><dd>${escapeHtml(subject.propertyClass)} / ${escapeHtml(subject.townshipName)}</dd></div>
        <div><dt>Building sqft</dt><dd>${numberText(subject.buildingSqft)}</dd></div>
        <div><dt>Total AV</dt><dd>${dollars(subject.currentAv)}</dd></div>
        <div><dt>Improvement AV</dt><dd>${dollars(subject.currentImprovementAv)}</dd></div>
      </dl>
      ${
        userValues.length
          ? `<p class="tagline">${escapeHtml(userValues.join("; "))} - user-supplied; documentation required.</p>`
          : ""
      }
    </section>

    ${renderComparables(payload)}

    <section class="panel" aria-labelledby="step-five">
      <div class="step-label">Step 5</div>
      <h2 id="step-five">${escapeHtml(payload.venue.name)} checklist</h2>
      <p class="hint">Use this checklist to assemble documents before filing at the official venue.</p>
      <ul>${payload.venue.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <a class="button-link" href="/print?${printQuery.toString()}">Print / Save as PDF</a>
    </section>

    ${warningList(payload.warnings)}
  `;
}

async function loadCase(params: URLSearchParams): Promise<void> {
  const stop = startProgress();
  try {
    const payload = await fetchJson<CasePayload>(`/api/case?${params.toString()}`);
    renderResults(payload, params);
  } catch (error) {
    const target = document.querySelector<HTMLElement>("#results");
    if (target) {
      target.innerHTML = `<section class="error" role="alert">${escapeHtml(
        error instanceof Error ? error.message : "The case could not be loaded.",
      )}</section>`;
    }
  } finally {
    stop();
    const progress = document.querySelector<HTMLElement>("#progress");
    if (progress) {
      progress.innerHTML = "";
    }
  }
}

async function submitCase(form: HTMLFormElement): Promise<void> {
  if (!validateStepOne(form)) {
    return;
  }
  const params = new URLSearchParams();
  const pin = formValue(form, "pin");
  addOptionalParams(params, form);
  if (pin) {
    params.set("pin", pin);
    await loadCase(params);
    return;
  }
  const target = document.querySelector<HTMLElement>("#results");
  if (target) {
    target.innerHTML = `<section class="error" role="alert">Enter a PIN.</section>`;
  }
}

shell();

const form = document.querySelector<HTMLFormElement>("#case-form");
if (form) {
  updateConditionalFields(form);
}

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form instanceof HTMLFormElement && form.id === "case-form") {
    event.preventDefault();
    void submitCase(form);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    const activeForm = target.form;
    if (activeForm?.id === "case-form") {
      setFormError("");
      updateConditionalFields(activeForm);
    }
  }
});

document.documentElement.dataset.enhanced = "true";

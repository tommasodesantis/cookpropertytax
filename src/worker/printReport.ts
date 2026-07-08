import {
  ASSESSMENT_LEVEL,
  CCAO_EXEMPTIONS_URL,
  COOK_PROPERTY_TAX_PORTAL_URL,
  NOT_LEGAL_ADVICE,
} from "../domain/config";
import type { Parcel } from "../domain/models";
import type { CasePayload } from "./casePayload";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkedText(value: unknown): string {
  const text = String(value ?? "");
  const pattern = /https?:\/\/[^\s<>"']+/g;
  let rendered = "";
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;
    const trailing = rawUrl.match(/[.,;:)]+$/)?.[0] ?? "";
    const url = rawUrl.slice(0, rawUrl.length - trailing.length);
    rendered += escapeHtml(text.slice(lastIndex, start));
    rendered += `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    lastIndex = start + rawUrl.length;
  }
  return rendered + escapeHtml(text.slice(lastIndex));
}

function linkedSource(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function dollars(value: number | null): string {
  return value === null || Number.isNaN(value) ? "Not available" : money.format(value);
}

function numberText(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value)) {
    return "Not available";
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function list(items: string[]): string {
  if (items.length === 0) {
    return "<p>None.</p>";
  }
  return `<ul>${items.map((item) => `<li>${linkedText(item)}</li>`).join("")}</ul>`;
}

function githubLogo(): string {
  return `<svg aria-hidden="true" class="github-mark" viewBox="0 0 16 16" width="20" height="20">
    <path fill="currentColor" d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.78.4.08.55-.18.55-.39 0-.19-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.43 7.43 0 0 1 8 3.98c.68 0 1.36.09 2 .28 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.76.54 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.47.55.39A8.08 8.08 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"/>
  </svg>`;
}

function siteFooter(): string {
  return `<footer class="site-footer no-print">
    <p>Appeal Compass is an open-source project developed by <a href="https://github.com/tommasodesantis" target="_blank" rel="noreferrer">Tommaso De Santis<span class="sr-only"> (opens in new tab)</span></a> under GPLv3.</p>
    <a class="footer-icon-link" href="https://github.com/tommasodesantis/appealcompass" target="_blank" rel="noreferrer">${githubLogo()}<span>View on GitHub</span><span class="sr-only"> (opens in new tab)</span></a>
    <a href="https://ko-fi.com/tomdesantis" target="_blank" rel="noreferrer">Donations help the project grow and cover hosting and maintenance costs.<span class="sr-only"> (opens in new tab)</span></a>
  </footer>`;
}

function knownParcelAddress(parcel: Parcel): string | null {
  const cityZip = [parcel.city.trim(), parcel.zipCode.trim()].filter(Boolean).join(" ");
  const pieces = [parcel.address.trim(), cityZip].filter(Boolean);
  return pieces.length > 0 ? pieces.join(", ") : null;
}

function deadline(payload: CasePayload): string {
  const route = payload.routing;
  const official = route.officialUrl
    ? `<a href="${escapeHtml(route.officialUrl)}">Verify at the official source before filing</a>`
    : "Verify at the official source before filing.";
  if (!route.deadline) {
    return `<p><strong>Deadline:</strong> No computed deadline. ${official}</p>`;
  }
  const days =
    route.daysRemaining === null
      ? ""
      : route.daysRemaining >= 0
        ? ` ${route.daysRemaining} days remaining.`
        : ` ${Math.abs(route.daysRemaining)} days past the computed deadline.`;
  return `<p><strong>Deadline:</strong> ${escapeHtml(route.deadline)}.${escapeHtml(days)} ${official}</p>`;
}

function generatedDate(payload: CasePayload): string {
  const datePart = payload.generatedAt.slice(0, 10);
  const [yearText, monthText, dayText] = datePart.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return datePart || "unknown date";
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function subjectValues(payload: CasePayload): string {
  const caseFile = payload.case;
  const parcel = caseFile.parcel;
  const effectiveAv = parcel.currentAv ?? caseFile.userEvidence.actualAv;
  const rows = [
    ["PIN", parcel.pinFormatted],
    ["Class / Township", `${parcel.propertyClass} / ${parcel.townshipName}`],
    [
      "Building sqft",
      parcel.buildingSqft
        ? numberText(parcel.buildingSqft)
        : caseFile.userEvidence.actualSqft
          ? `${numberText(caseFile.userEvidence.actualSqft)} (user-supplied; documentation required)`
          : "Missing",
    ],
    [
      "Current assessed value",
      parcel.currentAv
        ? dollars(parcel.currentAv)
        : caseFile.userEvidence.actualAv
          ? `${dollars(caseFile.userEvidence.actualAv)} (user-supplied; documentation required)`
          : "Not available",
    ],
  ];
  const address = knownParcelAddress(parcel);
  if (address) {
    rows.splice(1, 0, ["Address", address]);
  }
  if (parcel.currentImprovementAv || caseFile.userEvidence.actualImprovementAv) {
    rows.push([
      "Building / improvement assessed value",
      parcel.currentImprovementAv
        ? dollars(parcel.currentImprovementAv)
        : `${dollars(caseFile.userEvidence.actualImprovementAv)} (user-supplied; documentation required)`,
    ]);
  }
  if (effectiveAv) {
    rows.push(["Implied market value", dollars(effectiveAv / ASSESSMENT_LEVEL)]);
  }
  return `<dl class="packet-dl">${rows
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("")}</dl>`;
}

function comparableMetric(
  payload: CasePayload,
  comp: { av: number | null; improvementAv: number | null },
) {
  const profile = payload.evidence.comparableAnalysis.profileKey;
  return profile === "bor" || profile === "ptab" ? comp.improvementAv : comp.av;
}

function comparablesTable(payload: CasePayload): string {
  const comps = payload.evidence.comparableAnalysis;
  if (comps.status !== "ok" || comps.exhibit.length === 0) {
    return `<p>${escapeHtml(comps.note)}</p>`;
  }
  return `<table>
    <thead><tr><th>PIN</th><th>Sqft</th><th>Built Year</th><th>Assessment Year</th><th>Metric</th><th>Metric/sqft</th><th>Distance</th></tr></thead>
    <tbody>
      ${comps.exhibit
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.comparable.pinFormatted)}</td>
            <td>${numberText(item.comparable.buildingSqft)}</td>
            <td>${escapeHtml(item.comparable.yearBuilt ?? "Not available")}</td>
            <td>${escapeHtml(item.comparable.assessmentYear ?? "Not available")}</td>
            <td>${dollars(comparableMetric(payload, item.comparable))}</td>
            <td>${dollars(item.avPerSqft)}</td>
            <td>${item.distanceKm === null ? "Not available" : `${numberText(item.distanceKm, 2)} km`}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
  </table>`;
}

function venueSections(payload: CasePayload): string {
  return payload.venue.sections
    .map(
      (section) => `<section class="packet-section">
        <h2>${escapeHtml(section.title)}</h2>
        ${list(section.lines)}
      </section>`,
    )
    .join("");
}

function packetWarnings(payload: CasePayload): string[] {
  const comps = payload.evidence.comparableAnalysis;
  return [...payload.case.dataWarnings, ...comps.warnings].filter(
    (warning) =>
      !warning.includes("Socrata") &&
      !warning.toLowerCase().includes("queue") &&
      !warning.toLowerCase().includes("configured calendar is past"),
  );
}

export function buildPrintReport(payload: CasePayload): string {
  const evidence = payload.evidence;
  const comps = evidence.comparableAnalysis;
  const warnings = packetWarnings(payload);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Appeal Compass - ${escapeHtml(payload.venue.name)} - ${escapeHtml(payload.case.parcel.pinFormatted)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,650;12..96,800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="print-body">
    <main class="packet">
      <a class="button-link no-print" href="/">Back to Appeal Compass</a>
      <button class="no-print" type="button" onclick="window.print()">Print / Save as PDF</button>
      <section class="notice"><strong>${escapeHtml(NOT_LEGAL_ADVICE)}</strong></section>

      <section class="packet-section">
        <h1>Appeal Compass Evidence Packet</h1>
        <p>This evidence packet was generated by Appeal Compass on ${escapeHtml(
          generatedDate(payload),
        )} to support a residential property-tax appeal for PIN ${escapeHtml(
          payload.case.parcel.pinFormatted,
        )}. All deadlines and data should be verified at the official sources cited.</p>
      </section>

      <section class="packet-section">
        <h2>Executive Summary</h2>
        <p><strong>${escapeHtml(payload.routing.headline)}</strong></p>
        ${deadline(payload)}
        ${list(payload.routing.reasoning)}
      </section>

      <section class="packet-section">
        <h2>Subject Property</h2>
        ${subjectValues(payload)}
      </section>

      <section class="packet-section">
        <h2>Evidence Tier</h2>
        <p><strong>${escapeHtml(evidence.tier)}:</strong> ${escapeHtml(evidence.tierMessage)}</p>
        <p><strong>Estimated savings range:</strong> ${dollars(evidence.savingsAssumptions.low)} to ${dollars(
          evidence.savingsAssumptions.high,
        )} (point estimate ${dollars(evidence.savingsAssumptions.point)}).</p>
        <p>Assumptions: equalizer ${escapeHtml(
          evidence.savingsAssumptions.stateEqualizer,
        )}, tax rate ${(evidence.savingsAssumptions.taxRate * 100).toFixed(2)}%.</p>
        ${
          evidence.arguments.length
            ? list(
                evidence.arguments.map((argument) => `${argument.argumentType}: ${argument.text}`),
              )
            : "<p>No strong public-data argument was found. Add owner evidence if available.</p>"
        }
      </section>

      <section class="packet-section">
        <h2>Comparable Assessments</h2>
        <p><strong>Comparable profile:</strong> ${escapeHtml(comps.profileLabel)}</p>
        <p><strong>Assessment metric:</strong> ${escapeHtml(comps.metricLabel)}</p>
        <p>${escapeHtml(comps.note)}</p>
        <p>Subject ${escapeHtml(comps.metricLabel)}/sqft ${dollars(
          comps.subjectAvPerSqft,
        )}; median ${dollars(comps.medianAvPerSqft)}; percentile ${numberText(
          comps.percentile,
        )}; gap ${numberText(comps.gapPct)}%.</p>
        ${comparablesTable(payload)}
      </section>

      ${venueSections(payload)}

      <section class="packet-section">
        <h2>Exemptions and Certificate of Error Screen</h2>
        <p>Exemptions are fixed reductions in taxable value for owner-occupants, seniors, veterans, people with disabilities, and some other homeowners. They can be worth more than an appeal.</p>
        <p>Check exemptions at the ${linkedSource(CCAO_EXEMPTIONS_URL, "Cook County Assessor exemptions page")} and the ${linkedSource(COOK_PROPERTY_TAX_PORTAL_URL, "Cook County Property Tax Portal")}. Bring documentation for any missing or incorrect exemption.</p>
        <p>A Certificate of Error is a Cook County process to fix past-year mistakes - like a missed exemption or wrong property facts - which can lead to a refund. Ask the Assessor's office about it.</p>
      </section>

      ${
        warnings.length
          ? `<section class="packet-section warnings"><h2>Warnings</h2>${list(warnings)}</section>`
          : ""
      }
      ${siteFooter()}
    </main>
  </body>
</html>`;
}

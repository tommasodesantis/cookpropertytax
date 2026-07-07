import {
  BOR_CALENDAR,
  BOR_OFFICIAL_URL,
  CCAO_CALENDAR,
  CCAO_OFFICIAL_URL,
  type FilingWindow,
  PTAB_OFFICIAL_URL,
  type WindowStatus,
  borWindowsForTownship,
  canonicalTownship,
  ccaoWindowsForTownship,
  stalenessWarning,
  windowStatusOn,
} from "./config";
import { addDays, daysBetween } from "./dateUtils";
import type { RouteResult, Venue } from "./models";

function firstOpenOrUpcoming(
  windows: FilingWindow[],
  today: string,
): { status: WindowStatus | null; deadline: string | null; days: number | null } {
  for (const window of windows) {
    const { status, days } = windowStatusOn(window, today);
    if (status === "open") {
      return { status: "open", deadline: window.closes, days };
    }
  }

  const upcoming = windows
    .map((window) => ({ window, status: windowStatusOn(window, today) }))
    .filter((item) => item.status.status === "upcoming")
    .sort((a, b) => a.window.opens.localeCompare(b.window.opens));

  const next = upcoming[0];
  if (next) {
    return {
      status: "upcoming",
      deadline: next.window.opens,
      days: next.status.days,
    };
  }

  return { status: null, deadline: null, days: null };
}

export function routeCase(
  townshipName: string,
  today: string,
  requestedVenue: Venue = "auto",
  borDecisionDate: string | null = null,
): RouteResult {
  const township = canonicalTownship(townshipName);
  const warnings = [
    stalenessWarning(CCAO_CALENDAR, today),
    stalenessWarning(BOR_CALENDAR, today),
  ].filter((warning): warning is string => Boolean(warning));

  if (requestedVenue === "ptab" || borDecisionDate !== null) {
    if (borDecisionDate === null) {
      return {
        venue: "ptab",
        headline: "PTAB deadline cannot be computed without your BOR decision date.",
        reasoning: [
          "PTAB is only available after a BOR decision for the same tax year.",
          "The 30-day deadline is jurisdictional, so this tool refuses to guess.",
        ],
        actionStatus: "needs_input",
        deadline: null,
        daysRemaining: null,
        warnings,
        officialUrl: PTAB_OFFICIAL_URL,
      };
    }
    const deadline = addDays(borDecisionDate, 30);
    const daysRemaining = daysBetween(today, deadline);
    if (daysRemaining >= 0) {
      return {
        venue: "ptab",
        headline: `PTAB is actionable now. File by ${deadline}.`,
        reasoning: [
          "You supplied a BOR decision date, so the PTAB 30-day clock controls.",
          "PTAB requires a prior BOR appeal for the year under appeal.",
          "Taxes must be paid while PTAB is pending; success can result in a refund.",
        ],
        actionStatus: daysRemaining <= 7 ? "urgent" : "open",
        deadline,
        daysRemaining,
        warnings,
        officialUrl: PTAB_OFFICIAL_URL,
      };
    }
    return {
      venue: "ptab",
      headline: `PTAB 30-day window appears expired. Deadline was ${deadline}.`,
      reasoning: [
        "The deadline was computed only from the BOR decision date you supplied.",
        "Verify immediately with PTAB if you believe a different notice date applies.",
      ],
      actionStatus: "expired",
      deadline,
      daysRemaining,
      warnings,
      officialUrl: PTAB_OFFICIAL_URL,
    };
  }

  const ccao = firstOpenOrUpcoming(ccaoWindowsForTownship(township), today);
  const bor = firstOpenOrUpcoming(borWindowsForTownship(township), today);

  if (requestedVenue === "assessor" || (requestedVenue === "auto" && ccao.status === "open")) {
    const assessorStatus = ccao.status ?? "closed";
    return {
      venue: "assessor",
      headline:
        assessorStatus === "open"
          ? "File with the Cook County Assessor now."
          : "Assessor window is not currently configured as open.",
      reasoning: [
        "The Assessor is the first-level appeal and is free.",
        "Filing preserves the path to BOR, where Rule 15 may ask for Assessor documents.",
        "Property-description errors and Certificates of Error start with the Assessor.",
      ],
      actionStatus: assessorStatus,
      deadline: ccao.deadline,
      daysRemaining: ccao.days,
      warnings,
      officialUrl: CCAO_OFFICIAL_URL,
    };
  }

  if (requestedVenue === "bor" || (requestedVenue === "auto" && bor.status !== null)) {
    const borActionStatus = bor.status ?? "closed";
    return {
      venue: "bor",
      headline:
        borActionStatus === "open"
          ? "BOR filing window is open now."
          : borActionStatus === "upcoming"
            ? "BOR window is upcoming; prepare now."
            : "BOR window is not currently open.",
      reasoning: [
        `Township routed to BOR calendar as ${township}.`,
        "BOR is the second-level appeal venue after or instead of the Assessor window.",
        "File by the township close date and submit evidence by the evidence deadline.",
      ],
      actionStatus: borActionStatus,
      deadline: bor.deadline,
      daysRemaining: bor.days,
      warnings,
      officialUrl: BOR_OFFICIAL_URL,
    };
  }

  return {
    venue: "closed",
    headline: "No configured CCAO or BOR filing window is currently actionable.",
    reasoning: [
      "Prepare evidence for the next township session.",
      "If you recently received a BOR decision, rerun with --bor-decision-date for PTAB.",
      "For prior-year factual errors or missed exemptions, evaluate Certificate of Error.",
    ],
    actionStatus: "closed",
    deadline: null,
    daysRemaining: null,
    warnings,
    officialUrl: CCAO_OFFICIAL_URL,
  };
}

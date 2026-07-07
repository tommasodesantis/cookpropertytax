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

export interface AppealStatusInput {
  assessorAppealFiled: boolean;
  assessorDecisionReceived: boolean | null;
  borAppealFiled: boolean;
  borDecisionReceived: boolean | null;
  borDecisionDate: string | null;
}

const DEFAULT_APPEAL_STATUS: AppealStatusInput = {
  assessorAppealFiled: false,
  assessorDecisionReceived: null,
  borAppealFiled: false,
  borDecisionReceived: null,
  borDecisionDate: null,
};

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
  appealStatus: AppealStatusInput = DEFAULT_APPEAL_STATUS,
): RouteResult {
  const township = canonicalTownship(townshipName);
  const warnings = [
    stalenessWarning(CCAO_CALENDAR, today),
    stalenessWarning(BOR_CALENDAR, today),
  ].filter((warning): warning is string => Boolean(warning));
  const status = { ...DEFAULT_APPEAL_STATUS, ...appealStatus };
  const suppliedBorDecisionDate = status.borDecisionDate ?? borDecisionDate;

  function ptabNeedsInput(): RouteResult {
    return {
      venue: "ptab",
      headline: "PTAB deadline cannot be computed without your BOR decision date.",
      reasoning: [
        "PTAB is only available after a BOR decision for the same tax year.",
        "The 30-day deadline is jurisdictional, so this tool refuses to guess.",
        "Answer the Step 1 BOR-decision question and enter the BOR decision date if you have the decision notice.",
      ],
      actionStatus: "needs_input",
      deadline: null,
      daysRemaining: null,
      warnings,
      officialUrl: PTAB_OFFICIAL_URL,
    };
  }

  function ptabFromDecisionDate(decisionDate: string): RouteResult {
    const deadline = addDays(decisionDate, 30);
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

  function routeBorAfterAssessorDecision(bor: {
    status: WindowStatus | null;
    deadline: string | null;
    days: number | null;
  }): RouteResult {
    if (bor.status === "open" || bor.status === "upcoming") {
      return {
        venue: "bor",
        headline:
          bor.status === "open"
            ? "BOR filing window is open now."
            : "BOR window is upcoming; prepare now.",
        reasoning: [
          "You reported that the Assessor appeal is complete for this year.",
          `Township routed to BOR calendar as ${township}.`,
          "File by the township close date and submit evidence by the evidence deadline.",
        ],
        actionStatus: bor.status,
        deadline: bor.deadline,
        daysRemaining: bor.days,
        warnings,
        officialUrl: BOR_OFFICIAL_URL,
      };
    }
    return closedRoute([
      "You reported that the Assessor appeal is complete for this year.",
      "No configured BOR filing window is currently open or upcoming for this township.",
      "Prepare evidence for the next available appeal path and double-check official deadlines.",
    ]);
  }

  function closedRoute(reasoning: string[]): RouteResult {
    return {
      venue: "closed",
      headline: "No configured CCAO or BOR filing window is currently actionable.",
      reasoning,
      actionStatus: "closed",
      deadline: null,
      daysRemaining: null,
      warnings,
      officialUrl: CCAO_OFFICIAL_URL,
    };
  }

  /*
   * Routing decision table for Step 1 status answers:
   * - no Assessor filed + no BOR filed: use current window logic (Assessor -> BOR -> closed).
   * - Assessor filed + no Assessor decision + no BOR filed: do not route back to Assessor;
   *   explain waiting for the decision and preparing BOR evidence.
   * - Assessor filed + Assessor decision + no BOR filed: route to BOR when open/upcoming,
   *   otherwise closed-prep.
   * - BOR filed + no BOR decision: explain waiting for BOR; PTAB comes later and no
   *   needs-input error is shown.
   * - BOR filed + BOR decision + date: compute the PTAB 30-day deadline.
   * - BOR filed + BOR decision + no date: refuse to guess the PTAB deadline.
   */

  const ccao = firstOpenOrUpcoming(ccaoWindowsForTownship(township), today);
  const bor = firstOpenOrUpcoming(borWindowsForTownship(township), today);

  if (status.borAppealFiled) {
    if (status.borDecisionReceived === false) {
      return {
        venue: "ptab",
        headline: "Wait for the BOR decision before starting PTAB.",
        reasoning: [
          "You reported that a BOR appeal has already been filed for this year.",
          "PTAB becomes available only after the BOR issues its written decision.",
          "Keep preparing evidence and keep this page available so you can enter the Step 1 BOR decision date when the notice arrives.",
        ],
        actionStatus: "upcoming",
        deadline: null,
        daysRemaining: null,
        warnings,
        officialUrl: PTAB_OFFICIAL_URL,
      };
    }
    if (status.borDecisionReceived === true) {
      return suppliedBorDecisionDate
        ? ptabFromDecisionDate(suppliedBorDecisionDate)
        : ptabNeedsInput();
    }
  }

  if (requestedVenue === "ptab" || suppliedBorDecisionDate !== null) {
    return suppliedBorDecisionDate
      ? ptabFromDecisionDate(suppliedBorDecisionDate)
      : ptabNeedsInput();
  }

  if (status.assessorAppealFiled && status.assessorDecisionReceived === false) {
    const actionStatus =
      bor.status === "open" || bor.status === "upcoming" ? bor.status : "upcoming";
    return {
      venue: "bor",
      headline: "Wait for the Assessor decision and prepare for BOR.",
      reasoning: [
        "You reported that an Assessor appeal has already been filed for this year.",
        "Do not file another Assessor appeal for the same year; wait for the decision notice.",
        "Use this time to prepare BOR evidence in case you need the second-level appeal.",
      ],
      actionStatus,
      deadline: bor.deadline,
      daysRemaining: bor.days,
      warnings,
      officialUrl: BOR_OFFICIAL_URL,
    };
  }

  if (status.assessorAppealFiled && status.assessorDecisionReceived === true) {
    return routeBorAfterAssessorDecision(bor);
  }

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

  return closedRoute([
    "Prepare evidence for the next township session.",
    "If you already received a BOR decision, answer the Step 1 BOR-decision question and enter the decision date so Appeal Compass can compute the PTAB deadline.",
    "For prior-year factual errors or missed exemptions, evaluate Certificate of Error.",
  ]);
}

import {
  ASSESSMENT_YEAR,
  BOR_PORTAL_URL,
  CCAO_OFFICIAL_URL,
  PTAB_EFILE_URL,
  PTAB_OFFICIAL_URL,
} from "./config";
import { isWithinYearsOf } from "./math";
import type {
  CaseFile,
  EvidenceSummary,
  PacketSection,
  ResolvedVenue,
  RouteResult,
} from "./models";

export interface VenueAdapter {
  venueKey: ResolvedVenue;
  venueName: string;
  officialUrl: string;
  checklist(caseFile: CaseFile): string[];
  sections(caseFile: CaseFile, evidence: EvidenceSummary, route: RouteResult): PacketSection[];
}

class AssessorAdapter implements VenueAdapter {
  venueKey = "assessor" as const;
  venueName = "Cook County Assessor Appeal";
  officialUrl = CCAO_OFFICIAL_URL;

  checklist(caseFile: CaseFile): string[] {
    const items = [
      "File during the township Assessor appeal window; verify at the official source.",
      "Attach comparable, sale, appraisal, condition, and factual-error evidence.",
      "If filing later at BOR, save the Assessor appeal confirmation and documents.",
      "For prior-year factual errors or missed exemptions, ask about Certificate of Error.",
    ];
    if (caseFile.userEvidence.actualSqft) {
      items.push(
        "Property-description correction: attach proof of actual square footage (appraisal, plans, survey, or other reliable documentation).",
      );
    }
    return items;
  }

  sections(caseFile: CaseFile): PacketSection[] {
    return [
      {
        title: "Assessor Filing Instructions",
        lines: [
          "Recommended venue: Cook County Assessor.",
          "Use this first-level appeal while the township window is open.",
          "Property-description errors are strongest here when documented.",
          `Official source: ${this.officialUrl}`,
        ],
      },
      { title: "Assessor Checklist", lines: this.checklist(caseFile) },
    ];
  }
}

class BoardOfReviewAdapter implements VenueAdapter {
  venueKey = "bor" as const;
  venueName = "Cook County Board of Review Appeal";
  officialUrl = "https://www.cookcountyboardofreview.com/";

  checklist(caseFile: CaseFile): string[] {
    const items = [
      "[Rule 1] Pro se packet is for an individual taxpayer. Entities need counsel.",
      `[Rule 5] File through the BOR portal: ${BOR_PORTAL_URL}`,
      "[Rule 7] File by the township close date; late complaints are not accepted.",
      "[Rule 13] Submit all evidence by the evidence deadline.",
      "[Rule 15] If you filed at the Assessor, attach Assessor appeal documents.",
      "[Rule 16] Sign and complete the complaint truthfully.",
      "[Rule 26] Re-review requests must be made promptly after the BOR decision letter.",
    ];
    const purchaseDate = caseFile.userEvidence.purchaseDate;
    if (purchaseDate && isWithinYearsOf(purchaseDate, `${ASSESSMENT_YEAR}-01-01`, 3)) {
      items.push(
        "[Rule 18] Purchase within three years of lien date: disclose price/date and attach closing statement, deed, or MyDec.",
      );
    }
    if (caseFile.userEvidence.appraisalValue) {
      items.push("[Rule 19] Appraisal evidence must include required property photos and PINs.");
    }
    if (caseFile.userEvidence.vacancyClaim) {
      items.push("[Rule 21] Vacancy claims require the BOR vacancy affidavit and proof.");
    }
    if (caseFile.userEvidence.demolitionClaim) {
      items.push("[Rule 22] Demolition claims require permits and before/after photos.");
    }
    return items;
  }

  sections(caseFile: CaseFile): PacketSection[] {
    return [
      {
        title: "BOR Filing Instructions",
        lines: [
          "Recommended venue: Cook County Board of Review.",
          "This is the second-level Cook County appeal forum.",
          "Use the close date and evidence deadline shown in the routing section.",
          `Official source: ${this.officialUrl}`,
        ],
      },
      { title: "BOR Rules Checklist", lines: this.checklist(caseFile) },
    ];
  }
}

class PtabAdapter implements VenueAdapter {
  venueKey = "ptab" as const;
  venueName = "Illinois Property Tax Appeal Board Appeal";
  officialUrl = PTAB_OFFICIAL_URL;

  checklist(): string[] {
    return [
      "Attach the BOR written decision notice. PTAB deadline is 30 days from that notice.",
      "Use the correct PTAB Residential Appeal form and include the subject PIN.",
      "State whether you are raising equity, sale, appraisal, or factual evidence.",
      "Taxes must be paid while PTAB is pending; refunds may follow if the appeal succeeds.",
      "PTAB can take a long time. Keep copies of all filings and notices.",
      "The board of review and taxing bodies may intervene.",
      `PTAB e-filing/source: ${PTAB_EFILE_URL}`,
    ];
  }

  sections(): PacketSection[] {
    return [
      {
        title: "PTAB Filing Instructions",
        lines: [
          "Recommended venue: Illinois Property Tax Appeal Board.",
          "PTAB is available only after a BOR decision for the same tax year.",
          "This packet computes a PTAB deadline only from your BOR decision date.",
          `Official source: ${this.officialUrl}`,
        ],
      },
      { title: "PTAB Checklist", lines: this.checklist() },
      {
        title: "PTAB Comparable Grid Public-Data Limits",
        lines: [
          "Public data may populate PIN, class, building sqft, year built, neighborhood, coordinates, land sqft, style, and assessment metrics when those fields are available.",
          "Not available from public data - supply from your property record card: property record cards or listing sheets for the subject and comparables.",
          "Not available from public data - supply from your property record card: verified condition, room-by-room details, photos, and any PTAB grid field not shown in this packet.",
          "Do not file the PTAB grid as complete unless you have supplied and checked the missing property-record-card fields yourself.",
        ],
      },
    ];
  }
}

class ClosedSessionAdapter implements VenueAdapter {
  venueKey = "closed" as const;
  venueName = "Cook County Appeal Preparation Packet";
  officialUrl = CCAO_OFFICIAL_URL;

  checklist(): string[] {
    return [
      "Verify whether any Assessor or BOR window has reopened or been corrected.",
      "Prepare comparable, sale, appraisal, condition, and factual-error evidence.",
      "If you already received a BOR decision, answer the Step 1 BOR-decision question and enter the decision date so Appeal Compass can compute the PTAB deadline.",
      "For prior-year factual errors or missed exemptions, ask about Certificate of Error.",
      "Check exemptions now; exemptions may be worth more than an assessment appeal.",
    ];
  }

  sections(): PacketSection[] {
    return [
      {
        title: "Closed-Window Preparation Instructions",
        lines: [
          "No configured current-year CCAO or BOR filing window is actionable.",
          "Use this for preparation, PTAB screening, and Certificate of Error review.",
          "Do not file this as a BOR packet unless BOR shows a valid window.",
          `Official source: ${this.officialUrl}`,
        ],
      },
      { title: "Closed-Window Checklist", lines: this.checklist() },
    ];
  }
}

export function adapterForVenue(venue: ResolvedVenue): VenueAdapter {
  if (venue === "assessor") {
    return new AssessorAdapter();
  }
  if (venue === "ptab") {
    return new PtabAdapter();
  }
  if (venue === "closed") {
    return new ClosedSessionAdapter();
  }
  return new BoardOfReviewAdapter();
}

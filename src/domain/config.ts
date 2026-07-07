import { parseMdyDate } from "./dateUtils";
import type { Jurisdiction } from "./models";

export const ASSESSMENT_YEAR = 2026;
export const STATE_EQUALIZER = 3.0163;
export const DEFAULT_TAX_RATE = 0.1;
export const ASSESSMENT_LEVEL = 0.1;

export const CCAO_OFFICIAL_URL =
  "https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines";
export const BOR_OFFICIAL_URL = "https://www.cookcountyboardofreview.com/";
export const BOR_PORTAL_URL = "https://appeals.cookcountyboardofreview.com/";
export const BOR_DATES_PDF_URL =
  "https://www.cookcountyboardofreview.com/sites/g/files/ywwepo261/files/document/file/2025-07/2025TOWNSHIPOPEN-CLOSE.pdf";
export const PTAB_OFFICIAL_URL = "https://ptab.illinois.gov/";
export const PTAB_EFILE_URL = "https://ptab.illinois.gov/";
export const SUPPORTED_JURISDICTIONS: Record<Jurisdiction, string> = {
  cook_county_il: "Cook County, Illinois",
};

export const NOT_LEGAL_ADVICE =
  "NOT LEGAL ADVICE. Appeal Compass supports only individual residential homeowners appealing their own home. Entity-owned properties, commercial properties, and association properties are not supported and generally require an attorney.";

export type WindowStatus = "upcoming" | "open" | "closed";

export interface FilingWindow {
  opens: string;
  closes: string;
  evidenceDeadline: string | null;
}

export interface CalendarConfig {
  venueLabel: string;
  sessionLabel: string;
  sessionEnd: string;
  sourceUrl: string;
  sourceNote: string;
}

export interface BorGroup {
  townships: string[];
  windows: FilingWindow[];
}

export function filingWindow(
  opens: string,
  closes: string,
  evidenceDeadline: string | null = null,
): FilingWindow {
  return {
    opens: parseMdyDate(opens),
    closes: parseMdyDate(closes),
    evidenceDeadline: evidenceDeadline ? parseMdyDate(evidenceDeadline) : null,
  };
}

export function windowStatusOn(
  window: FilingWindow,
  today: string,
): { status: WindowStatus; days: number | null } {
  if (today < window.opens) {
    return {
      status: "upcoming",
      days: daysBetween(today, window.opens),
    };
  }
  if (today <= window.closes) {
    return {
      status: "open",
      days: daysBetween(today, window.closes),
    };
  }
  return { status: "closed", days: null };
}

export function stalenessWarning(config: CalendarConfig, today: string): string | null {
  if (today > config.sessionEnd) {
    return `${config.venueLabel} configured calendar is past its session end (${config.sessionEnd}). Verify current deadlines at ${config.sourceUrl}.`;
  }
  return null;
}

export const CCAO_CALENDAR: CalendarConfig = {
  venueLabel: "Cook County Assessor",
  sessionLabel: "Tax Year 2026 Assessor Appeal Windows",
  sessionEnd: parseMdyDate("8/12/2026"),
  sourceUrl: CCAO_OFFICIAL_URL,
  sourceNote:
    "Manual authority file 'Assessment & Appeal Calendar _ Cook County Assessor's Office.pdf' extracted on 2026-07-06 from the official Assessor calendar page, which reported Last updated: 6/29/26. Direct shell automation still returned CloudFront 403, so manually verify at the official source before filing.",
};

export const CCAO_WINDOWS: Record<string, FilingWindow[]> = {
  Barrington: [],
  Berwyn: [filingWindow("5/20/2026", "7/6/2026")],
  Bloom: [],
  Bremen: [],
  Calumet: [],
  Cicero: [filingWindow("6/17/2026", "7/31/2026")],
  "Elk Grove": [filingWindow("6/22/2026", "8/4/2026")],
  Evanston: [filingWindow("4/22/2026", "6/4/2026")],
  Hanover: [],
  "Hyde Park": [],
  Jefferson: [],
  Lake: [],
  Lakeview: [filingWindow("5/28/2026", "7/13/2026")],
  Lemont: [],
  Leyden: [],
  Lyons: [],
  Maine: [filingWindow("6/5/2026", "7/21/2026")],
  "New Trier": [filingWindow("5/7/2026", "6/22/2026")],
  Niles: [],
  "North Chicago": [],
  Northfield: [],
  "Norwood Park": [filingWindow("4/13/2026", "5/26/2026")],
  "Oak Park": [filingWindow("5/6/2026", "6/18/2026")],
  Orland: [],
  Palatine: [],
  Palos: [filingWindow("6/3/2026", "7/17/2026")],
  Proviso: [],
  Rich: [],
  "River Forest": [filingWindow("4/20/2026", "6/2/2026")],
  Riverside: [filingWindow("4/24/2026", "6/8/2026")],
  "Rogers Park": [filingWindow("4/17/2026", "6/1/2026")],
  Schaumburg: [],
  "South Chicago": [],
  Stickney: [filingWindow("6/29/2026", "8/12/2026")],
  Thornton: [],
  "West Chicago": [],
  Wheeling: [],
  Worth: [],
};

export const BOR_CALENDAR: CalendarConfig = {
  venueLabel: "Cook County Board of Review",
  sessionLabel: "Tax Year 2025 - Cook County Board of Review 2025-26 Session",
  sessionEnd: parseMdyDate("6/3/2026"),
  sourceUrl: BOR_DATES_PDF_URL,
  sourceNote: "BOR 2025 township date PDF linked from the official Board of Review site.",
};

export const BOR_GROUPS: Record<string, BorGroup> = {
  "1": {
    townships: ["Berwyn", "Evanston", "Norwood Park", "River Forest", "Riverside", "Rogers Park"],
    windows: [
      filingWindow("7/7/2025", "8/5/2025", "8/15/2025"),
      filingWindow("12/3/2025", "12/12/2025", "12/22/2025"),
    ],
  },
  "2a": {
    townships: ["Cicero", "Oak Park", "Palos"],
    windows: [
      filingWindow("7/21/2025", "8/19/2025", "8/29/2025"),
      filingWindow("12/3/2025", "12/12/2025", "12/22/2025"),
    ],
  },
  "2b": {
    townships: ["Elk Grove", "Lakeview", "Lyons", "New Trier"],
    windows: [
      filingWindow("8/18/2025", "9/16/2025", "9/26/2025"),
      filingWindow("12/3/2025", "12/12/2025", "12/22/2025"),
    ],
  },
  "3": {
    townships: ["Barrington", "Maine", "Northfield", "Stickney", "West Chicago"],
    windows: [
      filingWindow("9/22/2025", "10/21/2025", "10/31/2025"),
      filingWindow("12/3/2025", "12/12/2025", "12/22/2025"),
    ],
  },
  "4": {
    townships: ["Bremen", "Calumet", "Hyde Park", "Lemont", "Leyden", "Worth"],
    windows: [
      filingWindow("10/23/2025", "11/21/2025", "12/1/2025"),
      filingWindow("12/3/2025", "12/12/2025", "12/22/2025"),
    ],
  },
  "5": {
    townships: ["Jefferson", "Proviso", "Wheeling"],
    windows: [filingWindow("11/20/2025", "12/19/2025", "12/29/2025")],
  },
  "6": {
    townships: ["Lake", "Orland", "Palatine", "Schaumburg", "Thornton"],
    windows: [filingWindow("1/5/2026", "2/3/2026", "2/13/2026")],
  },
  "7": {
    townships: ["Bloom", "Hanover", "Niles", "Rich", "North Chicago", "South Chicago"],
    windows: [filingWindow("1/20/2026", "2/18/2026", "2/28/2026")],
  },
};

export const TOWNSHIP_ALIASES: Record<string, string> = {
  "Lake View": "Lakeview",
};

export const TOWNSHIP_TO_BOR_GROUP: Record<string, string> = Object.fromEntries(
  Object.entries(BOR_GROUPS).flatMap(([group, info]) =>
    info.townships.map((township) => [township, group]),
  ),
);

export function canonicalTownship(name: string): string {
  const title = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return TOWNSHIP_ALIASES[title] ?? title;
}

export function borWindowsForTownship(townshipName: string): FilingWindow[] {
  const township = canonicalTownship(townshipName);
  const group = TOWNSHIP_TO_BOR_GROUP[township];
  if (!group) {
    return [];
  }
  return [...(BOR_GROUPS[group]?.windows ?? [])];
}

export function ccaoWindowsForTownship(townshipName: string): FilingWindow[] {
  return [...(CCAO_WINDOWS[canonicalTownship(townshipName)] ?? [])];
}

import { daysBetween } from "./dateUtils";

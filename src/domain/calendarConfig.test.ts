import { CCAO_CALENDAR, CCAO_WINDOWS, canonicalTownship } from "./config";
import { loadAuthorityCrosscheck } from "./testHelpers";

interface AuthorityRow {
  township: string;
  appeal_open_date: string | null;
  last_file_date: string | null;
}

interface AuthorityCrosscheck {
  ccao_session: {
    label: string;
    session_end: string;
  };
  ccao_rows: AuthorityRow[];
}

function authority(): AuthorityCrosscheck {
  return loadAuthorityCrosscheck() as AuthorityCrosscheck;
}

test("authority cross-check JSON matches CCAO config", () => {
  const raw = authority();
  expect(raw.ccao_rows).toHaveLength(38);
  expect(CCAO_CALENDAR.sessionLabel).toBe(raw.ccao_session.label);
  expect(CCAO_CALENDAR.sessionEnd).toBe(raw.ccao_session.session_end);

  for (const row of raw.ccao_rows) {
    const township = canonicalTownship(row.township);
    expect(CCAO_WINDOWS).toHaveProperty(township);
    const windows = CCAO_WINDOWS[township] ?? [];
    if (row.appeal_open_date && row.last_file_date) {
      expect(windows).toHaveLength(1);
      expect(windows[0]?.opens).toBe(row.appeal_open_date);
      expect(windows[0]?.closes).toBe(row.last_file_date);
    } else {
      expect(windows).toEqual([]);
    }
  }
});

test("CCAO config has full township coverage", () => {
  const authorityTownships = new Set(
    authority().ccao_rows.map((row) => canonicalTownship(row.township)),
  );
  expect(new Set(Object.keys(CCAO_WINDOWS))).toEqual(authorityTownships);
});

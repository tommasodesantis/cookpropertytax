import { numberValue } from "../domain/caseSerde";
import { ASSESSMENT_YEAR } from "../domain/config";
import { NotFoundError } from "../domain/errors";
import type { AssessmentHistoryRow, CaseFile, Comparable, Parcel, Sale } from "../domain/models";
import { defaultUserEvidence } from "../domain/models";
import { formatPin, normalizePin } from "../domain/pin";
import type { JsonRecord, SocrataClient, SocrataResponse, SocrataWarning } from "./socrataClient";

export interface CaseRepository {
  loadCaseByPin(pin: string): Promise<CaseFile>;
}

const SUBJECT_MAX_ROWS = 100;
const COMPARABLE_POOL_CAP = 500;

const PARCEL_SELECT = [
  "pin",
  "class",
  "township_name",
  "township_code",
  "nbhd_code",
  "tax_code",
  "lat",
  "lon",
  "year",
  "zip_code",
].join(",");

const RES_SELECT = [
  "pin",
  "class",
  "township_code",
  "year",
  "char_bldg_sf",
  "char_land_sf",
  "char_yrblt",
  "char_type_resd",
  "char_ext_wall",
  "char_cnst_qlty",
  "char_air",
  "char_beds",
  "char_fbath",
  "char_hbath",
  "char_frpl",
  "char_gar1_area",
  "char_gar1_size",
  "char_porch",
  "char_bsmt",
  "char_bsmt_fin",
].join(",");

const AV_SELECT = [
  "pin",
  "year",
  "mailed_tot",
  "certified_tot",
  "board_tot",
  "mailed_bldg",
  "certified_bldg",
  "board_bldg",
].join(",");

const SALES_SELECT = ["pin", "sale_date", "sale_price"].join(",");

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

function intValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function pick(row: JsonRecord, ...names: string[]): unknown {
  for (const name of names) {
    const value = row[name];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function rowYear(row: JsonRecord): number | null {
  return intValue(row.year ?? row.tax_year);
}

function latestRow(rows: JsonRecord[]): JsonRecord {
  return [...rows].sort((a, b) => (rowYear(a) ?? 0) - (rowYear(b) ?? 0))[rows.length - 1] ?? {};
}

function hasAssessmentValue(row: JsonRecord): boolean {
  const total = numberValue(pick(row, "board_tot", "certified_tot", "mailed_tot"));
  const improvement = numberValue(pick(row, "board_bldg", "certified_bldg", "mailed_bldg"));
  return (total !== null && total > 0) || (improvement !== null && improvement > 0);
}

function latestAssessmentValues(rows: JsonRecord[]): [number | null, number | null, number | null] {
  const valueRows = rows.filter(hasAssessmentValue);
  if (valueRows.length === 0) {
    return [null, null, null];
  }
  const row = latestRow(valueRows);
  return [
    numberValue(pick(row, "board_tot", "certified_tot", "mailed_tot")),
    numberValue(pick(row, "board_bldg", "certified_bldg", "mailed_bldg")),
    rowYear(row),
  ];
}

function styleKey(row: JsonRecord): string | null {
  const pieces = [
    pick(row, "char_type_resd"),
    pick(row, "char_ext_wall"),
    pick(row, "char_cnst_qlty"),
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value).trim());
  return pieces.length > 0 ? pieces.join("|") : null;
}

function amenityCount(row: JsonRecord): number {
  const names = [
    "char_air",
    "char_beds",
    "char_fbath",
    "char_hbath",
    "char_frpl",
    "char_gar1_area",
    "char_gar1_size",
    "char_porch",
    "char_bsmt",
    "char_bsmt_fin",
  ];
  return names.filter((name) => {
    const value = row[name];
    return value !== null && value !== undefined && value !== "" && value !== "0" && value !== 0;
  }).length;
}

function groupByPin(rows: JsonRecord[]): Map<string, JsonRecord[]> {
  const grouped = new Map<string, JsonRecord[]>();
  for (const row of rows) {
    const rawPin = row.pin;
    if (!rawPin) {
      continue;
    }
    try {
      const pin = normalizePin(String(rawPin));
      grouped.set(pin, [...(grouped.get(pin) ?? []), row]);
    } catch {}
  }
  return grouped;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function parseSaleDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (!match) {
    return null;
  }
  const [, month, day, year] = match;
  return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
}

function logInternalWarning(pin: string, warning: SocrataWarning): void {
  console.log(
    JSON.stringify({
      event: "appeal_compass.socrata_internal_warning",
      pin: formatPin(pin),
      dataset: warning.dataset,
      message: warning.message,
    }),
  );
}

function collectSocrataWarnings(response: SocrataResponse, warnings: string[], pin: string): void {
  for (const warning of response.warnings) {
    if (warning.audience === "internal") {
      logInternalWarning(pin, warning);
      continue;
    }
    warnings.push(warning.message);
  }
}

function responseRows(response: SocrataResponse, warnings: string[], pin: string): JsonRecord[] {
  collectSocrataWarnings(response, warnings, pin);
  return response.rows;
}

export class SocrataRepository implements CaseRepository {
  constructor(private readonly client: SocrataClient) {}

  async loadCaseByPin(pin: string): Promise<CaseFile> {
    const normalized = normalizePin(pin);
    const warnings: string[] = [];

    let parcelRows = responseRows(
      await this.client.fetchAll(
        "parcel_universe",
        {
          $select: PARCEL_SELECT,
          $where: `pin='${normalized}' AND year='${ASSESSMENT_YEAR}'`,
        },
        { maxRows: SUBJECT_MAX_ROWS },
      ),
      warnings,
      normalized,
    );
    if (parcelRows.length === 0) {
      parcelRows = responseRows(
        await this.client.fetchAll(
          "parcel_universe",
          { $select: PARCEL_SELECT, $where: `pin='${normalized}'` },
          { maxRows: SUBJECT_MAX_ROWS },
        ),
        warnings,
        normalized,
      );
      if (parcelRows.length > 0) {
        warnings.push(
          `We couldn't find ${ASSESSMENT_YEAR} parcel details for this property, so we're using the most recent available details (${
            rowYear(latestRow(parcelRows)) ?? "unknown"
          }). Double-check current property details at the official source.`,
        );
      }
    }
    if (parcelRows.length === 0) {
      throw new NotFoundError(`PIN ${formatPin(normalized)} was not found in the parcel universe.`);
    }
    const universe = latestRow(parcelRows);

    let charRows = responseRows(
      await this.client.fetchAll(
        "res_characteristics",
        {
          $select: RES_SELECT,
          $where: `pin='${normalized}' AND year='${ASSESSMENT_YEAR}'`,
        },
        { maxRows: SUBJECT_MAX_ROWS },
      ),
      warnings,
      normalized,
    );
    if (charRows.length === 0) {
      charRows = responseRows(
        await this.client.fetchAll(
          "res_characteristics",
          { $select: RES_SELECT, $where: `pin='${normalized}'` },
          { maxRows: SUBJECT_MAX_ROWS },
        ),
        warnings,
        normalized,
      );
      if (charRows.length > 0) {
        warnings.push(
          `We couldn't find ${ASSESSMENT_YEAR} residential characteristics for this property, so we're using the most recent available characteristics (${
            rowYear(latestRow(charRows)) ?? "unknown"
          }). Double-check current property characteristics at the official source.`,
        );
      }
    }
    const char = charRows.length > 0 ? latestRow(charRows) : {};
    if (charRows.length === 0) {
      warnings.push(
        "Residential characteristics were unavailable; square-foot and comparable analysis may be limited.",
      );
    }

    let avRows = responseRows(
      await this.client.fetchAll(
        "assessed_values",
        { $select: AV_SELECT, $where: `pin='${normalized}' AND year='${ASSESSMENT_YEAR}'` },
        { maxRows: SUBJECT_MAX_ROWS },
      ),
      warnings,
      normalized,
    );
    if (avRows.length === 0) {
      avRows = responseRows(
        await this.client.fetchAll(
          "assessed_values",
          { $select: AV_SELECT, $where: `pin='${normalized}'` },
          { maxRows: SUBJECT_MAX_ROWS },
        ),
        warnings,
        normalized,
      );
      if (avRows.length > 0) {
        warnings.push(
          `We couldn't find ${ASSESSMENT_YEAR} assessment values for this property, so we're using the most recent available values (${
            rowYear(latestRow(avRows)) ?? "unknown"
          }). Double-check current values at the official source.`,
        );
      }
    }
    let [current, currentImprovement, currentYear] = latestAssessmentValues(avRows);
    if (avRows.length > 0 && current === null && currentImprovement === null) {
      avRows = responseRows(
        await this.client.fetchAll(
          "assessed_values",
          { $select: AV_SELECT, $where: `pin='${normalized}'` },
          { maxRows: SUBJECT_MAX_ROWS },
        ),
        warnings,
        normalized,
      );
      [current, currentImprovement, currentYear] = latestAssessmentValues(avRows);
      if (current !== null || currentImprovement !== null) {
        warnings.push(
          `We found a ${ASSESSMENT_YEAR} assessment row, but it did not include usable assessed values, so we're using the most recent value-bearing year (${
            currentYear ?? "unknown"
          }). Double-check current values at the official source.`,
        );
      }
    }

    const parcel: Parcel = {
      pin: normalized,
      pinFormatted: formatPin(normalized),
      propertyClass: stringValue(pick(universe, "class")),
      townshipName: stringValue(pick(universe, "township_name")),
      address: "",
      city: "",
      zipCode: stringValue(pick(universe, "zip_code", "prop_address_zipcode_1")),
      neighborhood: nullableString(pick(universe, "nbhd_code", "nbhd", "town_nbhd")),
      townshipCode: nullableString(pick(universe, "township_code")),
      taxCode: nullableString(pick(universe, "tax_code")),
      buildingSqft: numberValue(pick(char, "char_bldg_sf", "bldg_sf")),
      landSqft: numberValue(pick(char, "char_land_sf", "land_sf")),
      yearBuilt: intValue(pick(char, "char_yrblt", "yrblt")),
      style: styleKey(char),
      amenityCount: amenityCount(char),
      beds: numberValue(pick(char, "char_beds")),
      fullBaths: numberValue(pick(char, "char_fbath")),
      lat: numberValue(pick(universe, "lat", "latitude")),
      lon: numberValue(pick(universe, "lon", "longitude")),
      currentAv: current,
      currentImprovementAv: currentImprovement,
      priorFinalAv: null,
    };
    if (current === null) {
      warnings.push(
        "Current assessed value was unavailable; savings and market-value estimates are limited.",
      );
    }

    const [comparables, comparableWarnings] = await this.loadComparables(parcel);
    warnings.push(...comparableWarnings);
    const [subjectSales, salesWarnings] = await this.loadSales(normalized);
    warnings.push(...salesWarnings);

    return {
      parcel,
      assessmentHistory: assessmentHistoryFromRows(avRows),
      comparables,
      subjectSales,
      userEvidence: defaultUserEvidence(),
      dataWarnings: unique(warnings),
    };
  }

  private async loadSales(pin: string): Promise<[Sale[], string[]]> {
    const response = await this.client.fetchAll(
      "parcel_sales",
      { $select: SALES_SELECT, $where: `pin='${pin}'` },
      { maxRows: SUBJECT_MAX_ROWS },
    );
    const warnings: string[] = [];
    collectSocrataWarnings(response, warnings, pin);
    const sales = response.rows
      .map((row) => {
        const saleDate = parseSaleDate(pick(row, "sale_date"));
        const salePrice = numberValue(pick(row, "sale_price"));
        if (!saleDate || salePrice === null || salePrice <= 1000) {
          return null;
        }
        return { saleDate, salePrice, source: "recorded sale" };
      })
      .filter((sale): sale is Sale => sale !== null)
      .sort((a, b) => b.saleDate.localeCompare(a.saleDate));
    return [sales, warnings];
  }

  private async loadComparables(parcel: Parcel): Promise<[Comparable[], string[]]> {
    const warnings: string[] = [];
    if (!parcel.townshipCode || !parcel.propertyClass) {
      return [
        [],
        ["Comparable search was skipped because township code or property class was unavailable."],
      ];
    }
    const where = `township_code='${parcel.townshipCode}' AND class='${parcel.propertyClass}'`;
    const yearWhere = `${where} AND year='${ASSESSMENT_YEAR}'`;

    let chars = responseRows(
      await this.client.fetchAll(
        "res_characteristics",
        { $select: RES_SELECT, $where: yearWhere },
        { maxRows: COMPARABLE_POOL_CAP },
      ),
      warnings,
      parcel.pin,
    );
    if (chars.length === 0) {
      chars = responseRows(
        await this.client.fetchAll(
          "res_characteristics",
          { $select: RES_SELECT, $where: where },
          { maxRows: COMPARABLE_POOL_CAP },
        ),
        warnings,
        parcel.pin,
      );
      if (chars.length > 0) {
        warnings.push(
          `We couldn't find ${ASSESSMENT_YEAR} comparable characteristics for this township/class, so we're using the most recent available comparable characteristics. Double-check current comparable property details at the official source.`,
        );
      }
    }

    let avs = responseRows(
      await this.client.fetchAll(
        "assessed_values",
        { $select: AV_SELECT, $where: yearWhere },
        { maxRows: COMPARABLE_POOL_CAP },
      ),
      warnings,
      parcel.pin,
    );
    if (avs.length > 0 && !avs.some(hasAssessmentValue)) {
      const priorYear = ASSESSMENT_YEAR - 1;
      const priorResponse = await this.client.fetchAll(
        "assessed_values",
        { $select: AV_SELECT, $where: `${where} AND year='${priorYear}'` },
        { maxRows: COMPARABLE_POOL_CAP },
      );
      collectSocrataWarnings(priorResponse, warnings, parcel.pin);
      if (priorResponse.rows.length > 0) {
        avs = priorResponse.rows;
        warnings.push(
          `We found ${ASSESSMENT_YEAR} comparable assessment rows, but they did not include usable assessed values, so we're using ${priorYear} value-bearing rows. Double-check current comparable values at the official source.`,
        );
      }
    }
    if (avs.length === 0) {
      avs = responseRows(
        await this.client.fetchAll(
          "assessed_values",
          { $select: AV_SELECT, $where: where },
          { maxRows: COMPARABLE_POOL_CAP },
        ),
        warnings,
        parcel.pin,
      );
      if (avs.length > 0) {
        warnings.push(
          `We couldn't find ${ASSESSMENT_YEAR} comparable assessment values for this township/class, so we're using the most recent available comparable values. Double-check current comparable values at the official source.`,
        );
      }
    }

    let universeRows = responseRows(
      await this.client.fetchAll(
        "parcel_universe",
        { $select: PARCEL_SELECT, $where: yearWhere },
        { maxRows: COMPARABLE_POOL_CAP },
      ),
      warnings,
      parcel.pin,
    );
    if (universeRows.length === 0) {
      universeRows = responseRows(
        await this.client.fetchAll(
          "parcel_universe",
          { $select: PARCEL_SELECT, $where: where },
          { maxRows: COMPARABLE_POOL_CAP },
        ),
        warnings,
        parcel.pin,
      );
      if (universeRows.length > 0) {
        warnings.push(
          `We couldn't find ${ASSESSMENT_YEAR} comparable parcel details for this township/class, so we're using the most recent available comparable parcel details. Double-check current comparable property details at the official source.`,
        );
      }
    }

    const avRowsByPin = groupByPin(avs);
    const universeByPin = groupByPin(universeRows);
    const comps: Comparable[] = [];
    for (const row of chars) {
      if (!row.pin) {
        continue;
      }
      const compPin = normalizePin(String(row.pin));
      const [totalAv, improvementAv, assessmentYear] = latestAssessmentValues(
        avRowsByPin.get(compPin) ?? [],
      );
      const universe = universeByPin.has(compPin)
        ? latestRow(universeByPin.get(compPin) ?? [])
        : {};
      comps.push({
        pin: compPin,
        pinFormatted: formatPin(compPin),
        address: "",
        buildingSqft: numberValue(pick(row, "char_bldg_sf", "bldg_sf")),
        yearBuilt: intValue(pick(row, "char_yrblt", "yrblt")),
        assessmentYear,
        av: totalAv,
        improvementAv,
        landSqft: numberValue(pick(row, "char_land_sf", "land_sf")),
        style: styleKey(row),
        amenityCount: amenityCount(row),
        neighborhood: nullableString(
          pick(universe, "nbhd_code", "nbhd", "town_nbhd") ?? pick(row, "nbhd"),
        ),
        lat: numberValue(pick(universe, "lat", "latitude")),
        lon: numberValue(pick(universe, "lon", "longitude")),
      });
    }
    if (comps.length === 0) {
      warnings.push(
        "No comparable characteristic rows were returned for the subject township/class.",
      );
    }
    return [comps, warnings];
  }
}

function assessmentHistoryFromRows(rows: JsonRecord[]): AssessmentHistoryRow[] {
  return rows
    .map((row) => ({
      year: rowYear(row) ?? 0,
      mailedAv: numberValue(pick(row, "mailed_tot")),
      certifiedAv: numberValue(pick(row, "certified_tot")),
      boardAv: numberValue(pick(row, "board_tot")),
      finalAv: numberValue(pick(row, "board_tot", "certified_tot", "mailed_tot")),
    }))
    .filter((row) => row.year > 0)
    .sort((a, b) => a.year - b.year);
}

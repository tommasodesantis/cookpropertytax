type CellValue = string | number | null;

interface StyledCell {
  value: CellValue;
  style?: number;
}

type CellInput = CellValue | StyledCell;
type RowInput = CellInput[];

interface WorkbookPayload {
  case: {
    parcel: {
      pin: string;
      pinFormatted: string;
      propertyClass: string;
      townshipName: string;
      buildingSqft: number | null;
      currentAv: number | null;
      currentImprovementAv: number | null;
    };
  };
  evidence: {
    impliedMarketValue: number | null;
    savingsAssumptions: {
      taxRate: number;
      taxRateSource: string;
      stateEqualizer: number;
      low: number;
      point: number;
      high: number;
    };
    comparableAnalysis: {
      profileKey: string;
      metricLabel: string;
      poolSize: number;
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
          assessmentYear: number | null;
          av: number | null;
          improvementAv: number | null;
        };
      }>;
    };
  };
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
  crc: number;
}

const encoder = new TextEncoder();

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeCell(input: CellInput): StyledCell {
  if (input && typeof input === "object" && "value" in input) {
    return input;
  }
  return { value: input };
}

function colName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellXml(input: CellInput, rowIndex: number, colIndex: number): string {
  const cell = normalizeCell(input);
  const ref = `${colName(colIndex)}${rowIndex}`;
  const style = cell.style === undefined ? "" : ` s="${cell.style}"`;
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  }
  const value = cell.value === null || cell.value === "" ? "Not available" : cell.value;
  return `<c r="${ref}" t="inlineStr"${style}><is><t>${xml(value)}</t></is></c>`;
}

function sheetXml(rows: RowInput[]): string {
  const rowXml = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, colIndex) => cellXml(cell, rowIndex + 1, colIndex))
          .join("")}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols><col min="1" max="8" width="22" customWidth="1"/></cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function workbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Comps" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFE3C1"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function metricValue(
  payload: WorkbookPayload,
  comp: { av: number | null; improvementAv: number | null },
) {
  const profile = payload.evidence.comparableAnalysis.profileKey;
  return profile === "bor" || profile === "ptab" ? comp.improvementAv : comp.av;
}

function rowsForPayload(payload: WorkbookPayload): RowInput[] {
  const parcel = payload.case.parcel;
  const comps = payload.evidence.comparableAnalysis;
  const savings = payload.evidence.savingsAssumptions;
  return [
    [{ value: "Subject Property Summary", style: 1 }],
    ["PIN", parcel.pinFormatted],
    ["Class / Township", `${parcel.propertyClass} / ${parcel.townshipName}`],
    ["Building Sqft", parcel.buildingSqft],
    ["Total AV", parcel.currentAv],
    ["Improvement AV", parcel.currentImprovementAv],
    ["Implied Market Value", payload.evidence.impliedMarketValue],
    [],
    [{ value: "Comparable Exhibit", style: 1 }],
    [
      { value: "PIN", style: 2 },
      { value: "Sqft", style: 2 },
      { value: "Built Year", style: 2 },
      { value: "Assessment Year", style: 2 },
      { value: "Metric", style: 2 },
      { value: "Metric/sqft", style: 2 },
      { value: "Distance km", style: 2 },
    ],
    ...comps.exhibit.map((item) => [
      item.comparable.pinFormatted,
      item.comparable.buildingSqft,
      item.comparable.yearBuilt,
      item.comparable.assessmentYear,
      metricValue(payload, item.comparable),
      item.avPerSqft,
      item.distanceKm,
    ]),
    [],
    [{ value: "Analysis Stats", style: 1 }],
    ["Pool size", comps.poolSize],
    ["Median metric/sqft", comps.medianAvPerSqft],
    ["Percentile", comps.percentile],
    ["Gap %", comps.gapPct],
    [],
    [{ value: "Savings Calculation", style: 1 }],
    ["State equalizer", savings.stateEqualizer],
    ["Assumed tax rate", savings.taxRate],
    ["Tax rate source", savings.taxRateSource],
    ["Low estimate", savings.low],
    ["Point estimate", savings.point],
    ["High estimate", savings.high],
    ["Formula", "estimated savings = Delta AV x E x r, shown as a +/-20% range; not a promise"],
  ];
}

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(output: number[], value: number): void {
  output.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(output: number[], value: number): void {
  output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function append(output: number[], data: Uint8Array): void {
  for (const byte of data) {
    output.push(byte);
  }
}

function zip(entries: Array<{ path: string; text: string }>): Uint8Array {
  const output: number[] = [];
  const central: number[] = [];
  const files: ZipEntry[] = entries.map((entry) => {
    const data = encoder.encode(entry.text);
    return { path: entry.path, data, crc: crc32(data) };
  });

  for (const file of files) {
    const offset = output.length;
    const name = encoder.encode(file.path);
    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, file.crc);
    writeUint32(output, file.data.length);
    writeUint32(output, file.data.length);
    writeUint16(output, name.length);
    writeUint16(output, 0);
    append(output, name);
    append(output, file.data);

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, file.crc);
    writeUint32(central, file.data.length);
    writeUint32(central, file.data.length);
    writeUint16(central, name.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    append(central, name);
  }

  const centralOffset = output.length;
  output.push(...central);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, central.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);
  return new Uint8Array(output);
}

export function comparableWorkbookFilename(payload: WorkbookPayload): string {
  return `appeal-compass-comps-${payload.case.parcel.pin}.xlsx`;
}

export function buildComparableWorkbook(payload: WorkbookPayload): Uint8Array {
  return zip([
    { path: "[Content_Types].xml", text: contentTypesXml() },
    { path: "_rels/.rels", text: rootRelsXml() },
    { path: "xl/workbook.xml", text: workbookXml() },
    { path: "xl/_rels/workbook.xml.rels", text: workbookRelsXml() },
    { path: "xl/styles.xml", text: stylesXml() },
    { path: "xl/worksheets/sheet1.xml", text: sheetXml(rowsForPayload(payload)) },
  ]);
}

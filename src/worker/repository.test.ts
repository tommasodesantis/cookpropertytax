import { SocrataRepository } from "./repository";
import type { SocrataResponse } from "./socrataClient";

function internalWarning(message: string): SocrataResponse["warnings"][number] {
  return {
    audience: "internal",
    dataset: "parcel_universe",
    message,
  };
}

class MissingAddressClient {
  async fetchAll(datasetKey: string, params: Record<string, string>): Promise<SocrataResponse> {
    const where = params.$where ?? "";
    if (datasetKey === "parcel_universe" && where.includes("pin='03000000000001'")) {
      return {
        rows: [
          {
            pin: "03000000000001",
            class: "203",
            township_name: "Barrington",
            township_code: "10",
            year: "2026",
          },
        ],
        warnings: [internalWarning("parcel pagination warning")],
      };
    }
    if (datasetKey === "res_characteristics" && where.includes("pin='03000000000001'")) {
      return { rows: [], warnings: [] };
    }
    if (datasetKey === "assessed_values" && where.includes("pin='03000000000001'")) {
      return { rows: [], warnings: [] };
    }
    if (
      datasetKey === "res_characteristics" ||
      datasetKey === "assessed_values" ||
      datasetKey === "parcel_sales"
    ) {
      return { rows: [], warnings: [] };
    }
    if (datasetKey === "parcel_universe") {
      return { rows: [], warnings: [] };
    }
    throw new Error(`Unexpected dataset ${datasetKey}`);
  }
}

test("SocrataRepository filters internal Socrata warnings and surfaces missing live fields", async () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const repo = new SocrataRepository(new MissingAddressClient() as never);
  try {
    const caseFile = await repo.loadCaseByPin("03-00-000-000-0001");
    const warnings = caseFile.dataWarnings.join("\n");
    expect(warnings).not.toContain("parcel pagination warning");
    expect(warnings).toContain("Residential characteristics were unavailable");
    expect(warnings).toContain("Current assessed value was unavailable");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("appeal_compass.socrata_internal_warning"),
    );
  } finally {
    logSpy.mockRestore();
  }
});

class EnrichedComparableClient {
  async fetchAll(datasetKey: string, params: Record<string, string>): Promise<SocrataResponse> {
    const where = params.$where ?? "";
    if (datasetKey === "parcel_universe" && where.includes("pin='03000000000001'")) {
      return {
        rows: [
          {
            pin: "03000000000001",
            class: "203",
            township_name: "Rogers Park",
            township_code: "01",
            nbhd_code: "0101",
            lat: "41.9901",
            lon: "-87.6971",
            year: "2026",
          },
        ],
        warnings: [],
      };
    }
    if (datasetKey === "res_characteristics" && where.includes("pin='03000000000001'")) {
      return {
        rows: [
          {
            pin: "03000000000001",
            class: "203",
            township_code: "01",
            char_bldg_sf: "1800",
            char_land_sf: "3750",
            char_yrblt: "1924",
            year: "2026",
          },
        ],
        warnings: [],
      };
    }
    if (datasetKey === "assessed_values" && where.includes("pin='03000000000001'")) {
      return {
        rows: [
          {
            pin: "03000000000001",
            year: "2025",
            mailed_tot: "60000",
            mailed_bldg: "50000",
          },
        ],
        warnings: [],
      };
    }
    if (datasetKey === "parcel_sales") {
      return { rows: [], warnings: [] };
    }
    if (datasetKey === "res_characteristics") {
      return {
        rows: [
          {
            pin: "03000000000002",
            class: "203",
            township_code: "01",
            char_bldg_sf: "1750",
            char_land_sf: "3700",
            char_yrblt: "1922",
            char_type_resd: "1 Story",
            char_ext_wall: "Frame",
            char_cnst_qlty: "Average",
            char_air: "Central A/C",
            year: "2026",
          },
        ],
        warnings: [],
      };
    }
    if (datasetKey === "assessed_values") {
      return {
        rows: [
          {
            pin: "03000000000002",
            year: "2025",
            mailed_tot: "40000",
            mailed_bldg: "32000",
          },
        ],
        warnings: [],
      };
    }
    if (datasetKey === "parcel_universe") {
      return {
        rows: [
          {
            pin: "03000000000002",
            class: "203",
            township_name: "Rogers Park",
            township_code: "01",
            nbhd_code: "0101",
            lat: "41.9902",
            lon: "-87.6972",
            year: "2026",
          },
        ],
        warnings: [],
      };
    }
    throw new Error(`Unexpected query ${datasetKey}: ${where}`);
  }
}

test("SocrataRepository enriches live comparables without address placeholders", async () => {
  const repo = new SocrataRepository(new EnrichedComparableClient() as never);
  const caseFile = await repo.loadCaseByPin("03-00-000-000-0001");
  expect(caseFile.parcel.currentImprovementAv).toBe(50000);
  expect(caseFile.comparables).not.toHaveLength(0);
  const comp = caseFile.comparables[0];
  expect(comp?.address).toBe("");
  expect(caseFile.dataWarnings.join("\n")).not.toContain("address");
  expect(comp?.neighborhood).toBe("0101");
  expect(comp?.lat).toBe(41.9902);
  expect(comp?.lon).toBe(-87.6972);
  expect(comp?.assessmentYear).toBe(2025);
  expect(comp?.improvementAv).toBe(32000);
  expect(comp?.landSqft).toBe(3700);
  expect(comp?.style).toBe("1 Story|Frame|Average");
  expect(comp?.amenityCount).toBe(1);
});

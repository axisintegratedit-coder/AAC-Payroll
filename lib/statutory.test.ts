import { describe, it, expect } from "vitest";
import {
  buildSSSBrackets,
  lookupSSSBracket,
  computeStatutory,
  SEED_EFFECTIVE_SSS_CONFIG,
  SEED_STATUTORY_SETTINGS,
} from "./statutory";

const sssConfig = SEED_EFFECTIVE_SSS_CONFIG;
const settings = SEED_STATUTORY_SETTINGS; // default settings — do not change to make tests pass

describe("SSS bracket table (5% EE, MSC-centered)", () => {
  it("produces the spec's MSC -> EE checkpoints", () => {
    // MSC 10,000 -> 500 ; 12,500 -> 625 ; 19,000 -> 950 ; 26,500 -> 1,325
    const ee = (msc: number) => buildSSSBrackets().find((b) => b.msc === msc)!.eeTotal;
    expect(ee(10000)).toBe(500);
    expect(ee(12500)).toBe(625);
    expect(ee(19000)).toBe(950);
    expect(ee(26500)).toBe(1325);
  });

  it("uses MSC-centered ranges (range_min = MSC-250, range_max = MSC+249.99)", () => {
    const b = buildSSSBrackets().find((x) => x.msc === 10500)!;
    expect(b.rangeMin).toBe(10250);
    expect(b.rangeMax).toBe(10749.99);
    // 10,400 lands in the 10,500 bracket -> EE 525 (Sample G net basic)
    expect(lookupSSSBracket(10400, sssConfig).msc).toBe(10500);
    expect(lookupSSSBracket(10400, sssConfig).eeTotal).toBe(525);
  });

  it("floors at 0 for the first bracket and caps at the ceiling for the last", () => {
    const brackets = buildSSSBrackets();
    expect(brackets[0].rangeMin).toBe(0);
    expect(brackets[brackets.length - 1].rangeMax).toBe(35000);
    expect(lookupSSSBracket(1, sssConfig).msc).toBe(5000);
    expect(lookupSSSBracket(999999, sssConfig).msc).toBe(35000);
  });
});

describe("computeStatutory — Boldr payslip regression (regular run, default settings)", () => {
  it("Sample B: grossBasic 12,250, no absence, no adj", () => {
    const r = computeStatutory({ grossBasic: 12250, hasAttendance: true, runType: "regular" }, settings, sssConfig);
    expect(r.sss).toBe(625.0);
    expect(r.philhealth).toBe(306.25);
    expect(r.pagibig).toBe(100.0);
  });

  it("Sample C: grossBasic 18,766.8, no absence, no adj", () => {
    const r = computeStatutory({ grossBasic: 18766.8, hasAttendance: true, runType: "regular" }, settings, sssConfig);
    expect(r.sss).toBe(950.0);
    expect(r.philhealth).toBe(469.17);
    expect(r.pagibig).toBe(100.0);
  });

  it("Sample D: grossBasic 10,150, absenceLateOnBasic 1,349.44, no adj (absence NOT netted)", () => {
    const r = computeStatutory(
      { grossBasic: 10150, absenceLateOnBasic: 1349.44, hasAttendance: true, runType: "regular" },
      settings,
      sssConfig
    );
    expect(r.sss).toBe(500.0); // gross MSC 10,000
    expect(r.philhealth).toBe(253.75);
    expect(r.pagibig).toBe(100.0);
  });

  it("Sample E: grossBasic 10,100, absenceLateOnBasic 1,044.83, no adj", () => {
    const r = computeStatutory(
      { grossBasic: 10100, absenceLateOnBasic: 1044.83, hasAttendance: true, runType: "regular" },
      settings,
      sssConfig
    );
    expect(r.sss).toBe(500.0);
    expect(r.philhealth).toBe(252.5);
    expect(r.pagibig).toBe(100.0);
  });

  it("Sample G: grossBasic 23,200, basicAdjustments -12,800 (adjustments netted)", () => {
    const r = computeStatutory(
      { grossBasic: 23200, basicAdjustments: -12800, hasAttendance: true, runType: "regular" },
      settings,
      sssConfig
    );
    expect(r.sss).toBe(525.0); // net 10,400 -> MSC 10,500
    expect(r.philhealth).toBe(580.0); // 2.5% of GROSS 23,200
    expect(r.pagibig).toBe(100.0);
  });

  it("Zero case: hasAttendance false -> all zero", () => {
    const r = computeStatutory({ grossBasic: 12250, hasAttendance: false }, settings, sssConfig);
    expect(r.sss).toBe(0);
    expect(r.philhealth).toBe(0);
    expect(r.pagibig).toBe(0);
  });

  it("Zero case: no positive basic -> all zero", () => {
    const r = computeStatutory({ grossBasic: 0, hasAttendance: true }, settings, sssConfig);
    expect(r.sss).toBe(0);
    expect(r.philhealth).toBe(0);
    expect(r.pagibig).toBe(0);
  });
});

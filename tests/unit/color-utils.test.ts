import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  rgbToLab,
  labToRgb,
  deltaE,
} from "@/lib/color-utils";

describe("hexToRgb", () => {
  it("converts #FFFFFF to [255, 255, 255]", () => {
    expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255]);
  });

  it("converts #000000 to [0, 0, 0]", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("handles lowercase hex", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  });

  it("handles hex without #", () => {
    expect(hexToRgb("FF0000")).toEqual([255, 0, 0]);
  });
});

describe("rgbToHex", () => {
  it("converts [255, 255, 255] to #ffffff", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });

  it("clamps values outside 0-255", () => {
    expect(rgbToHex(300, -10, 128)).toBe("#ff0080");
  });
});

describe("rgbToLab / labToRgb round-trip", () => {
  it("round-trips white", () => {
    const lab = rgbToLab(255, 255, 255);
    const rgb = labToRgb(...lab);
    expect(rgb[0]).toBeCloseTo(255, 0);
    expect(rgb[1]).toBeCloseTo(255, 0);
    expect(rgb[2]).toBeCloseTo(255, 0);
  });

  it("round-trips red", () => {
    const lab = rgbToLab(255, 0, 0);
    const rgb = labToRgb(...lab);
    expect(rgb[0]).toBeCloseTo(255, 0);
    expect(rgb[1]).toBeCloseTo(0, 0);
    expect(rgb[2]).toBeCloseTo(0, 0);
  });

  it("round-trips mid-gray", () => {
    const lab = rgbToLab(128, 128, 128);
    const rgb = labToRgb(...lab);
    expect(Math.abs(rgb[0] - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb[1] - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb[2] - 128)).toBeLessThanOrEqual(1);
  });
});

describe("deltaE", () => {
  it("returns 0 for identical colors", () => {
    const lab = rgbToLab(128, 64, 200);
    expect(deltaE(lab, lab)).toBe(0);
  });

  it("returns high value for black vs white", () => {
    const black = rgbToLab(0, 0, 0);
    const white = rgbToLab(255, 255, 255);
    expect(deltaE(black, white)).toBeGreaterThan(90);
  });
});

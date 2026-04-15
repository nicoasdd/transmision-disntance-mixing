import { describe, it, expect } from "vitest";
import {
  channelTransmittance,
  forwardModel,
  solveLayerHeights,
  type FilamentTD,
} from "@/lib/td-model";

describe("channelTransmittance", () => {
  it("returns 1.0 for zero thickness", () => {
    expect(channelTransmittance(128, 2.0, 0)).toBe(1.0);
  });

  it("returns the filament color at thickness=TD", () => {
    const result = channelTransmittance(128, 2.0, 2.0);
    expect(result).toBeCloseTo(128 / 255, 4);
  });

  it("returns 0 for black channel regardless of thickness", () => {
    expect(channelTransmittance(0, 2.0, 1.0)).toBe(0);
  });

  it("returns 1.0 for white channel at any reasonable thickness", () => {
    const result = channelTransmittance(255, 2.0, 5.0);
    expect(result).toBeCloseTo(1.0, 4);
  });
});

describe("forwardModel", () => {
  it("returns white for zero-height layers", () => {
    const filaments: FilamentTD[] = [
      { colorRgb: [128, 0, 0], td: 2.0 },
      { colorRgb: [0, 0, 128], td: 2.0 },
    ];
    const result = forwardModel(filaments, [0, 0]);
    expect(result).toEqual([255, 255, 255]);
  });

  it("produces darker color with more material", () => {
    const filament: FilamentTD = { colorRgb: [200, 50, 50], td: 2.0 };
    const thin = forwardModel([filament], [0.5]);
    const thick = forwardModel([filament], [3.0]);
    // Thicker layers should be darker (lower values)
    expect(thick[0]).toBeLessThan(thin[0]);
    expect(thick[1]).toBeLessThan(thin[1]);
    expect(thick[2]).toBeLessThan(thin[2]);
  });
});

describe("solveLayerHeights", () => {
  it("respects flat-top constraint (sum = totalHeight)", () => {
    const filaments: FilamentTD[] = [
      { colorRgb: [220, 40, 40], td: 1.6 },
      { colorRgb: [255, 255, 255], td: 4.0 },
    ];
    const totalHeight = 3.0;
    const result = solveLayerHeights(filaments, [180, 100, 100], totalHeight, 0.1, 0);
    const sum = result.heights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(totalHeight, 2);
  });

  it("returns reasonable ΔE for achievable colors", () => {
    const filaments: FilamentTD[] = [
      { colorRgb: [220, 40, 40], td: 1.6 },
      { colorRgb: [255, 255, 255], td: 4.0 },
    ];
    const result = solveLayerHeights(filaments, [230, 150, 150], 3.0, 0.1, 0);
    expect(result.deltaE).toBeLessThan(15);
  });

  it("handles single filament correctly", () => {
    const filaments: FilamentTD[] = [{ colorRgb: [128, 128, 128], td: 2.0 }];
    const result = solveLayerHeights(filaments, [128, 128, 128], 2.0, 0.1, 0);
    expect(result.heights).toHaveLength(1);
    expect(result.heights[0]).toBe(2.0);
  });
});

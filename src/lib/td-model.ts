/**
 * Transmission Distance (TD) color model.
 * Beer-Lambert per-channel exponential attenuation.
 * Pure functions, no DOM — safe for Web Workers.
 */

import { rgbToLab, deltaE } from "./color-utils";

export interface FilamentTD {
  colorRgb: [number, number, number];
  td: number;
}

/**
 * Per-channel transmittance for a single filament layer at thickness h.
 * T_c(h) = (color_c / 255) ^ (h / TD)
 */
export function channelTransmittance(
  colorComponent: number,
  td: number,
  thickness: number
): number {
  if (thickness <= 0) return 1.0;
  const normalized = colorComponent / 255;
  if (normalized <= 0) return 0;
  return Math.pow(normalized, thickness / td);
}

/**
 * Forward model: predict perceived RGB from a stack of N layers.
 * perceived_c = 255 × ∏(i=1..N) T_i_c(h_i)
 * Assumes white background (255, 255, 255).
 */
export function forwardModel(
  filaments: FilamentTD[],
  heights: number[]
): [number, number, number] {
  let tr = 1.0;
  let tg = 1.0;
  let tb = 1.0;

  for (let i = 0; i < filaments.length; i++) {
    const h = heights[i];
    if (h <= 0) continue;
    const f = filaments[i];
    tr *= channelTransmittance(f.colorRgb[0], f.td, h);
    tg *= channelTransmittance(f.colorRgb[1], f.td, h);
    tb *= channelTransmittance(f.colorRgb[2], f.td, h);
  }

  return [
    Math.max(0, Math.min(255, Math.round(255 * tr))),
    Math.max(0, Math.min(255, Math.round(255 * tg))),
    Math.max(0, Math.min(255, Math.round(255 * tb))),
  ];
}

/**
 * Precompute transmittance lookup table for a filament.
 * For each discrete height step, stores [T_r, T_g, T_b].
 * Avoids repeated Math.pow calls during grid search.
 */
export function buildTransmittanceLUT(
  filament: FilamentTD,
  maxHeight: number,
  step: number
): Float64Array {
  const steps = Math.ceil(maxHeight / step) + 1;
  const lut = new Float64Array(steps * 3);
  for (let i = 0; i < steps; i++) {
    const h = i * step;
    lut[i * 3 + 0] = channelTransmittance(filament.colorRgb[0], filament.td, h);
    lut[i * 3 + 1] = channelTransmittance(filament.colorRgb[1], filament.td, h);
    lut[i * 3 + 2] = channelTransmittance(filament.colorRgb[2], filament.td, h);
  }
  return lut;
}

function lutTransmittance(
  lut: Float64Array,
  heightIndex: number
): [number, number, number] {
  const base = heightIndex * 3;
  return [lut[base], lut[base + 1], lut[base + 2]];
}

/**
 * Inverse solver: find optimal per-layer heights for a target color.
 * Grid search over discretized heights, minimizing ΔE in CIELAB.
 *
 * For N=2: O(steps) since h2 = H - h1
 * For N=3: O(steps^2) since h3 = H - h1 - h2
 * For N=4+: O(steps^(N-1))
 *
 * Returns the heights array with minimum ΔE.
 */
export function solveLayerHeights(
  filaments: FilamentTD[],
  targetRgb: [number, number, number],
  totalHeight: number,
  step: number,
  minLayerHeight: number
): { heights: number[]; predictedColor: [number, number, number]; deltaE: number } {
  const N = filaments.length;
  const totalSteps = Math.floor(totalHeight / step);
  const targetLab = rgbToLab(...targetRgb);

  const luts = filaments.map((f) => buildTransmittanceLUT(f, totalHeight, step));

  let bestHeights = new Array<number>(N).fill(0);
  bestHeights[N - 1] = totalHeight;
  let bestDeltaE = Infinity;
  let bestColor: [number, number, number] = [0, 0, 0];

  if (N === 1) {
    const color = forwardModel(filaments, [totalHeight]);
    return {
      heights: [totalHeight],
      predictedColor: color,
      deltaE: deltaE(targetLab, rgbToLab(...color)),
    };
  }

  if (N === 2) {
    for (let s1 = 0; s1 <= totalSteps; s1++) {
      const s2 = totalSteps - s1;
      const [tr1, tg1, tb1] = lutTransmittance(luts[0], s1);
      const [tr2, tg2, tb2] = lutTransmittance(luts[1], s2);

      const pr = Math.round(255 * tr1 * tr2);
      const pg = Math.round(255 * tg1 * tg2);
      const pb = Math.round(255 * tb1 * tb2);

      const predLab = rgbToLab(
        Math.max(0, Math.min(255, pr)),
        Math.max(0, Math.min(255, pg)),
        Math.max(0, Math.min(255, pb))
      );
      const de = deltaE(targetLab, predLab);

      if (de < bestDeltaE) {
        bestDeltaE = de;
        bestHeights = [s1 * step, s2 * step];
        bestColor = [
          Math.max(0, Math.min(255, pr)),
          Math.max(0, Math.min(255, pg)),
          Math.max(0, Math.min(255, pb)),
        ];
      }
    }
  } else if (N === 3) {
    for (let s1 = 0; s1 <= totalSteps; s1++) {
      const [tr1, tg1, tb1] = lutTransmittance(luts[0], s1);
      const remaining = totalSteps - s1;
      for (let s2 = 0; s2 <= remaining; s2++) {
        const s3 = remaining - s2;
        const [tr2, tg2, tb2] = lutTransmittance(luts[1], s2);
        const [tr3, tg3, tb3] = lutTransmittance(luts[2], s3);

        const pr = Math.round(255 * tr1 * tr2 * tr3);
        const pg = Math.round(255 * tg1 * tg2 * tg3);
        const pb = Math.round(255 * tb1 * tb2 * tb3);

        const predLab = rgbToLab(
          Math.max(0, Math.min(255, pr)),
          Math.max(0, Math.min(255, pg)),
          Math.max(0, Math.min(255, pb))
        );
        const de = deltaE(targetLab, predLab);

        if (de < bestDeltaE) {
          bestDeltaE = de;
          bestHeights = [s1 * step, s2 * step, s3 * step];
          bestColor = [
            Math.max(0, Math.min(255, pr)),
            Math.max(0, Math.min(255, pg)),
            Math.max(0, Math.min(255, pb)),
          ];
        }
      }
    }
  } else {
    // Generic recursive for N >= 4 with coarser step to limit combinatorics
    const coarseStep = Math.max(step, totalHeight / 20);
    const coarseSteps = Math.floor(totalHeight / coarseStep);

    const searchRecursive = (
      layerIdx: number,
      remainingSteps: number,
      accTr: number,
      accTg: number,
      accTb: number,
      currentHeights: number[]
    ) => {
      if (layerIdx === N - 1) {
        const h = remainingSteps * coarseStep;
        const [tr, tg, tb] = lutTransmittance(
          luts[layerIdx],
          Math.min(Math.round(h / step), Math.floor(totalHeight / step))
        );
        const pr = Math.max(0, Math.min(255, Math.round(255 * accTr * tr)));
        const pg = Math.max(0, Math.min(255, Math.round(255 * accTg * tg)));
        const pb = Math.max(0, Math.min(255, Math.round(255 * accTb * tb)));

        const predLab = rgbToLab(pr, pg, pb);
        const de = deltaE(targetLab, predLab);
        if (de < bestDeltaE) {
          bestDeltaE = de;
          bestHeights = [...currentHeights, h];
          bestColor = [pr, pg, pb];
        }
        return;
      }

      for (let s = 0; s <= remainingSteps; s++) {
        const h = s * coarseStep;
        const lutIdx = Math.min(Math.round(h / step), Math.floor(totalHeight / step));
        const [tr, tg, tb] = lutTransmittance(luts[layerIdx], lutIdx);
        currentHeights[layerIdx] = h;
        searchRecursive(
          layerIdx + 1,
          remainingSteps - s,
          accTr * tr,
          accTg * tg,
          accTb * tb,
          currentHeights
        );
      }
    };

    searchRecursive(0, coarseSteps, 1, 1, 1, new Array(N).fill(0));
  }

  // Enforce minLayerHeight: redistribute from layers below min
  if (minLayerHeight > 0) {
    for (let i = 0; i < bestHeights.length; i++) {
      if (bestHeights[i] > 0 && bestHeights[i] < minLayerHeight) {
        bestHeights[i] = 0;
      }
    }
    const sum = bestHeights.reduce((a, b) => a + b, 0);
    if (sum < totalHeight) {
      const maxIdx = bestHeights.indexOf(Math.max(...bestHeights));
      bestHeights[maxIdx] += totalHeight - sum;
    }
  }

  return {
    heights: bestHeights,
    predictedColor: bestColor,
    deltaE: bestDeltaE,
  };
}

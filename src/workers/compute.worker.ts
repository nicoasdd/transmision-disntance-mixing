/**
 * Compute Web Worker: handles TD color solving, preview generation, and 3MF assembly.
 * Runs off the main thread to keep the UI responsive.
 */

import {
  solveLayerHeights,
  type FilamentTD,
} from "@/lib/td-model";
import { hexToRgb, rgbToHex } from "@/lib/color-utils";
import {
  adjustBrightness,
  adjustContrast,
  sampleImageGrid,
} from "@/lib/image-processing";
import { buildLayerMeshes, validateFlatTop } from "@/lib/mesh-builder";
import { assemble3MF, buildPackage } from "@/lib/threemf-writer";
import type {
  WorkerMessage,
  WorkerResponse,
  PreviewPayload,
  GeneratePayload,
  FilamentWorkerData,
} from "@/types/threemf";

function postResponse(msg: WorkerResponse) {
  self.postMessage(msg);
}

function toFilamentTD(f: FilamentWorkerData): FilamentTD {
  return { colorRgb: f.colorRgb, td: f.td };
}

const DEFAULT_MODEL_WIDTH_MM = 100;
const MAX_GRID_CELLS = 40000; // ~200×200 hard cap

function computeModelDimensions(imageWidth: number, imageHeight: number) {
  const aspect = imageHeight / imageWidth;
  const modelWidthMm = DEFAULT_MODEL_WIDTH_MM;
  const modelHeightMm = DEFAULT_MODEL_WIDTH_MM * aspect;
  return { modelWidthMm, modelHeightMm };
}

function clampResolution(
  xyResolution: number,
  modelWidthMm: number,
  modelHeightMm: number
): number {
  const gridW = Math.ceil(modelWidthMm / xyResolution);
  const gridH = Math.ceil(modelHeightMm / xyResolution);
  if (gridW * gridH <= MAX_GRID_CELLS) return xyResolution;
  // Increase resolution until grid fits
  const area = modelWidthMm * modelHeightMm;
  return Math.sqrt(area / MAX_GRID_CELLS);
}

function computePreview(payload: PreviewPayload) {
  const startTime = performance.now();
  const { imageData, width, height, filaments, totalHeight, xyResolution: rawRes, brightness, contrast, backgroundColor } = payload;

  const pixelData = new Uint8ClampedArray(imageData);

  const { modelWidthMm, modelHeightMm } = computeModelDimensions(width, height);
  const xyResolution = clampResolution(rawRes, modelWidthMm, modelHeightMm);

  const { grid, gridWidth, gridHeight } = sampleImageGrid(
    pixelData,
    width,
    height,
    xyResolution,
    modelWidthMm,
    modelHeightMm,
    backgroundColor
  );

  adjustBrightness(grid, brightness);
  adjustContrast(grid, contrast);

  const filamentTDs = filaments.map(toFilamentTD);
  const step = 0.1;

  const previewBuffer = new Uint8ClampedArray(gridWidth * gridHeight * 4);
  let totalDeltaE = 0;
  let maxDeltaE = 0;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = (gy * gridWidth + gx) * 3;
      const targetRgb: [number, number, number] = [grid[idx], grid[idx + 1], grid[idx + 2]];

      const result = solveLayerHeights(filamentTDs, targetRgb, totalHeight, step, 0);

      const pIdx = (gy * gridWidth + gx) * 4;
      previewBuffer[pIdx] = result.predictedColor[0];
      previewBuffer[pIdx + 1] = result.predictedColor[1];
      previewBuffer[pIdx + 2] = result.predictedColor[2];
      previewBuffer[pIdx + 3] = 255;

      totalDeltaE += result.deltaE;
      if (result.deltaE > maxDeltaE) maxDeltaE = result.deltaE;
    }
  }

  const computeTimeMs = performance.now() - startTime;
  const pixelCount = gridWidth * gridHeight;

  postResponse({
    type: "preview-result",
    payload: {
      previewData: previewBuffer.buffer,
      width: gridWidth,
      height: gridHeight,
      stats: {
        avgDeltaE: totalDeltaE / pixelCount,
        maxDeltaE,
        computeTimeMs,
      },
    },
  });
}

function generate3MF(payload: GeneratePayload) {
  const startTime = performance.now();
  const {
    imageData,
    width,
    height,
    filaments,
    totalHeight,
    xyResolution: rawRes,
    minLayerHeight,
    brightness,
    contrast,
    backgroundColor,
  } = payload;

  postResponse({ type: "generate-progress", payload: { phase: "td-compute", progress: 0 } });

  const pixelData = new Uint8ClampedArray(imageData);
  const { modelWidthMm, modelHeightMm } = computeModelDimensions(width, height);
  const xyResolution = clampResolution(rawRes, modelWidthMm, modelHeightMm);

  const { grid, gridWidth, gridHeight } = sampleImageGrid(
    pixelData,
    width,
    height,
    xyResolution,
    modelWidthMm,
    modelHeightMm,
    backgroundColor
  );

  adjustBrightness(grid, brightness);
  adjustContrast(grid, contrast);

  const filamentTDs = filaments.map(toFilamentTD);
  const step = 0.04;
  const layerCount = filaments.length;

  // Height maps: one Float32Array per layer
  const layerHeightMaps: Float32Array[] = [];
  for (let i = 0; i < layerCount; i++) {
    layerHeightMaps.push(new Float32Array(gridWidth * gridHeight));
  }

  const totalCells = gridWidth * gridHeight;
  let processedCells = 0;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = (gy * gridWidth + gx) * 3;
      const targetRgb: [number, number, number] = [grid[idx], grid[idx + 1], grid[idx + 2]];

      const result = solveLayerHeights(filamentTDs, targetRgb, totalHeight, step, minLayerHeight);

      const cellIdx = gy * gridWidth + gx;
      for (let li = 0; li < layerCount; li++) {
        layerHeightMaps[li][cellIdx] = result.heights[li];
      }

      processedCells++;
      if (processedCells % 1000 === 0) {
        postResponse({
          type: "generate-progress",
          payload: { phase: "td-compute", progress: processedCells / totalCells },
        });
      }
    }
  }

  postResponse({ type: "generate-progress", payload: { phase: "td-compute", progress: 1 } });

  // Validate flat-top
  const validation = validateFlatTop(layerHeightMaps, gridWidth, gridHeight, totalHeight);
  if (!validation.valid) {
    console.warn(`Flat-top deviation: max=${validation.maxDeviation.toFixed(4)}mm, failed=${validation.failedCells} cells`);
  }

  postResponse({ type: "generate-progress", payload: { phase: "mesh-generate", progress: 0 } });

  const materialIndices = filaments.map((_, i) => i);
  const meshObjects = buildLayerMeshes(
    layerHeightMaps,
    gridWidth,
    gridHeight,
    xyResolution,
    materialIndices,
    totalHeight
  );

  postResponse({ type: "generate-progress", payload: { phase: "mesh-generate", progress: 1 } });

  const materials = filaments.map((f) => ({
    name: `${f.brand} ${f.name}`,
    displayColor: f.colorHex.toUpperCase(),
  }));

  const pkg = buildPackage(meshObjects, materials, {
    Description: `TD Color Mix: ${gridWidth}x${gridHeight} cells, ${layerCount} layers`,
  });

  postResponse({ type: "generate-progress", payload: { phase: "xml-build", progress: 0.5 } });
  postResponse({ type: "generate-progress", payload: { phase: "zip-package", progress: 0 } });

  assemble3MF(pkg).then((blob) => {
    let vertexCount = 0;
    let triangleCount = 0;
    for (const obj of meshObjects) {
      vertexCount += obj.vertices.length;
      triangleCount += obj.triangles.length;
    }

    postResponse({
      type: "generate-result",
      payload: {
        blob,
        stats: {
          vertexCount,
          triangleCount,
          fileSizeBytes: blob.size,
          computeTimeMs: performance.now() - startTime,
        },
      },
    });
  });
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  try {
    const msg = e.data;
    switch (msg.type) {
      case "compute-preview":
        computePreview(msg.payload);
        break;
      case "generate-3mf":
        generate3MF(msg.payload);
        break;
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    postResponse({
      type: "error",
      payload: { code: "WORKER_ERROR", message: error.message },
    });
  }
};

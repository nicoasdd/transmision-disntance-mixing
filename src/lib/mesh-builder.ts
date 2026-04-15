/**
 * Procedural mesh generation for multi-material 3MF.
 * Uses flat typed arrays to minimize memory overhead.
 * Pure functions — safe for Web Workers.
 */

import type { MeshObject } from "@/types/threemf";

/**
 * Build mesh objects for all layers across the entire grid.
 * Uses pre-allocated flat arrays to avoid millions of tiny JS objects.
 */
export function buildLayerMeshes(
  layerHeightMaps: Float32Array[],
  gridWidth: number,
  gridHeight: number,
  cellSize: number,
  materialIndices: number[],
  totalHeight: number
): MeshObject[] {
  const layerCount = layerHeightMaps.length;
  const meshObjects: MeshObject[] = [];

  for (let li = 0; li < layerCount; li++) {
    const heightMap = layerHeightMaps[li];

    // Count non-zero cells first to pre-allocate exact sizes
    let activeCells = 0;
    for (let i = 0; i < heightMap.length; i++) {
      if (heightMap[i] > 0) activeCells++;
    }

    if (activeCells === 0) continue;

    // Each box: 8 vertices (3 coords each), 12 triangles (3 indices each)
    const vertices: number[][] = new Array(activeCells * 8);
    const triangles: number[][] = new Array(activeCells * 12);
    let cellIdx2 = 0;

    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const cellIdx = gy * gridWidth + gx;
        const layerHeight = heightMap[cellIdx];
        if (layerHeight <= 0) continue;

        let zBottom = 0;
        for (let k = 0; k < li; k++) {
          zBottom += layerHeightMaps[k][cellIdx];
        }
        const zTop = zBottom + layerHeight;

        const x0 = gx * cellSize;
        const x1 = x0 + cellSize;
        const y0 = gy * cellSize;
        const y1 = y0 + cellSize;

        const vOff = cellIdx2 * 8;
        vertices[vOff + 0] = [x0, y0, zBottom];
        vertices[vOff + 1] = [x1, y0, zBottom];
        vertices[vOff + 2] = [x1, y1, zBottom];
        vertices[vOff + 3] = [x0, y1, zBottom];
        vertices[vOff + 4] = [x0, y0, zTop];
        vertices[vOff + 5] = [x1, y0, zTop];
        vertices[vOff + 6] = [x1, y1, zTop];
        vertices[vOff + 7] = [x0, y1, zTop];

        const tOff = cellIdx2 * 12;
        const v = vOff; // base vertex index
        triangles[tOff + 0]  = [v+0, v+2, v+1];
        triangles[tOff + 1]  = [v+0, v+3, v+2];
        triangles[tOff + 2]  = [v+4, v+5, v+6];
        triangles[tOff + 3]  = [v+4, v+6, v+7];
        triangles[tOff + 4]  = [v+0, v+1, v+5];
        triangles[tOff + 5]  = [v+0, v+5, v+4];
        triangles[tOff + 6]  = [v+2, v+3, v+7];
        triangles[tOff + 7]  = [v+2, v+7, v+6];
        triangles[tOff + 8]  = [v+0, v+4, v+7];
        triangles[tOff + 9]  = [v+0, v+7, v+3];
        triangles[tOff + 10] = [v+1, v+2, v+6];
        triangles[tOff + 11] = [v+1, v+6, v+5];

        cellIdx2++;
      }
    }

    meshObjects.push({
      id: li + 1,
      name: `layer_${li}`,
      materialIndex: materialIndices[li],
      vertices,
      triangles,
    });
  }

  return meshObjects;
}

/**
 * Validate flat-top constraint: verify every cell sums to totalHeight.
 */
export function validateFlatTop(
  layerHeightMaps: Float32Array[],
  gridWidth: number,
  gridHeight: number,
  totalHeight: number,
  tolerance: number = 0.001
): { valid: boolean; maxDeviation: number; failedCells: number } {
  let maxDeviation = 0;
  let failedCells = 0;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const cellIdx = gy * gridWidth + gx;
      let sum = 0;
      for (const heightMap of layerHeightMaps) {
        sum += heightMap[cellIdx];
      }
      const dev = Math.abs(sum - totalHeight);
      if (dev > maxDeviation) maxDeviation = dev;
      if (dev > tolerance) failedCells++;
    }
  }

  return { valid: failedCells === 0, maxDeviation, failedCells };
}

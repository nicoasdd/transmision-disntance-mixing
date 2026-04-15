import { describe, it, expect } from "vitest";
import { buildLayerMeshes, validateFlatTop } from "@/lib/mesh-builder";

describe("buildLayerMeshes", () => {
  it("produces mesh objects for each layer with height > 0", () => {
    const gridWidth = 2;
    const gridHeight = 2;
    const cellSize = 1.0;
    const totalHeight = 3.0;

    // 2 layers, 2x2 grid: layer 0 = 1mm everywhere, layer 1 = 2mm everywhere
    const layer0 = new Float32Array([1, 1, 1, 1]);
    const layer1 = new Float32Array([2, 2, 2, 2]);

    const meshes = buildLayerMeshes(
      [layer0, layer1],
      gridWidth,
      gridHeight,
      cellSize,
      [0, 1],
      totalHeight
    );

    expect(meshes).toHaveLength(2);
    expect(meshes[0].name).toBe("layer_0");
    expect(meshes[1].name).toBe("layer_1");
    // Each cell = 8 vertices, 4 cells = 32 vertices per layer
    expect(meshes[0].vertices.length).toBe(32);
    // Each cell = 12 triangles, 4 cells = 48 triangles per layer
    expect(meshes[0].triangles.length).toBe(48);
  });

  it("skips cells with zero height", () => {
    const layer0 = new Float32Array([2, 0, 2, 0]);
    const layer1 = new Float32Array([1, 3, 1, 3]);

    const meshes = buildLayerMeshes(
      [layer0, layer1],
      2,
      2,
      1.0,
      [0, 1],
      3.0
    );

    // Layer 0: 2 cells with height > 0
    expect(meshes[0].vertices.length).toBe(16);
    // Layer 1: all 4 cells have height > 0
    expect(meshes[1].vertices.length).toBe(32);
  });
});

describe("validateFlatTop", () => {
  it("passes when all cells sum to totalHeight", () => {
    const layer0 = new Float32Array([1, 2, 0.5, 1.5]);
    const layer1 = new Float32Array([2, 1, 2.5, 1.5]);

    const result = validateFlatTop([layer0, layer1], 2, 2, 3.0);
    expect(result.valid).toBe(true);
    expect(result.failedCells).toBe(0);
  });

  it("fails when cells don't sum correctly", () => {
    const layer0 = new Float32Array([1, 2, 0.5, 1.5]);
    const layer1 = new Float32Array([2, 1, 2.0, 1.5]); // cell 2 sums to 2.5 not 3.0

    const result = validateFlatTop([layer0, layer1], 2, 2, 3.0);
    expect(result.valid).toBe(false);
    expect(result.failedCells).toBe(1);
  });
});

/**
 * Image processing utilities for pixel sampling and adjustments.
 * Pure functions operating on raw pixel data — safe for Web Workers.
 */

/**
 * Extract RGBA pixel data from an ImageBitmap using OffscreenCanvas or Canvas.
 * Returns a Uint8ClampedArray of RGBA values.
 */
export function getPixelData(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(targetWidth, targetHeight)
      : document.createElement("canvas");

  if ("width" in canvas) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  if (!ctx) throw new Error("Could not get 2D context");

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Sample image at configured XY resolution.
 * Returns a 2D grid of RGB colors, one per cell.
 */
export function sampleImageGrid(
  pixelData: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  xyResolution: number,
  modelWidthMm: number,
  modelHeightMm: number,
  backgroundColor: [number, number, number]
): { grid: Uint8Array; gridWidth: number; gridHeight: number } {
  const gridWidth = Math.ceil(modelWidthMm / xyResolution);
  const gridHeight = Math.ceil(modelHeightMm / xyResolution);
  const grid = new Uint8Array(gridWidth * gridHeight * 3);

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const px = Math.floor((gx / gridWidth) * imageWidth);
      const py = Math.floor((gy / gridHeight) * imageHeight);
      const idx = (py * imageWidth + px) * 4;

      const r = pixelData[idx];
      const g = pixelData[idx + 1];
      const b = pixelData[idx + 2];
      const a = pixelData[idx + 3];

      const alpha = a / 255;
      const outIdx = (gy * gridWidth + gx) * 3;

      grid[outIdx] = Math.round(r * alpha + backgroundColor[0] * (1 - alpha));
      grid[outIdx + 1] = Math.round(g * alpha + backgroundColor[1] * (1 - alpha));
      grid[outIdx + 2] = Math.round(b * alpha + backgroundColor[2] * (1 - alpha));
    }
  }

  return { grid, gridWidth, gridHeight };
}

/** Apply brightness adjustment (-100 to 100) to RGB values in-place */
export function adjustBrightness(
  grid: Uint8Array,
  brightness: number
): void {
  if (brightness === 0) return;
  const factor = (brightness / 100) * 255;
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.max(0, Math.min(255, Math.round(grid[i] + factor)));
  }
}

/** Apply contrast adjustment (-100 to 100) to RGB values in-place */
export function adjustContrast(grid: Uint8Array, contrast: number): void {
  if (contrast === 0) return;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.max(
      0,
      Math.min(255, Math.round(factor * (grid[i] - 128) + 128))
    );
  }
}

/**
 * Compute recommended downsampled dimensions for large images.
 * Returns null if no downsampling needed.
 */
export function computeDownsampleDimensions(
  width: number,
  height: number,
  maxDimension: number = 4096
): { width: number; height: number } | null {
  if (width <= maxDimension && height <= maxDimension) return null;
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

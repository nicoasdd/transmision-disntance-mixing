"use client";

import { useRef, useEffect } from "react";
import type { PreviewStats } from "@/types/threemf";

interface ColorPreviewProps {
  previewData: ArrayBuffer | null;
  previewWidth: number;
  previewHeight: number;
  stats: PreviewStats | null;
  isComputing: boolean;
  isConfigValid: boolean;
  onRefresh: () => void;
}

export function ColorPreview({
  previewData,
  previewWidth,
  previewHeight,
  stats,
  isComputing,
  isConfigValid,
  onRefresh,
}: ColorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!previewData || !canvasRef.current || previewWidth === 0) return;

    const canvas = canvasRef.current;
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = new ImageData(
      new Uint8ClampedArray(previewData),
      previewWidth,
      previewHeight
    );
    ctx.putImageData(imgData, 0, 0);
  }, [previewData, previewWidth, previewHeight]);

  if (!isConfigValid) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          TD Color Preview
        </label>
        <button
          onClick={onRefresh}
          disabled={isComputing}
          className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {isComputing ? "Computing..." : "Refresh Preview"}
        </button>
      </div>

      {previewData ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ imageRendering: "pixelated" }}
          />
          {stats && (
            <div className="flex gap-4 border-t border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
              <span>Avg ΔE: {stats.avgDeltaE.toFixed(1)}</span>
              <span>Max ΔE: {stats.maxDeltaE.toFixed(1)}</span>
              <span>Time: {(stats.computeTimeMs / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-8">
          <p className="text-xs text-gray-400">
            {isComputing
              ? "Computing preview..."
              : "Click \"Refresh Preview\" to see the predicted color output."}
          </p>
        </div>
      )}
    </div>
  );
}

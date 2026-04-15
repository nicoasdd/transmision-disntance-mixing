"use client";

import type { GenerateProgress } from "@/types/threemf";

interface GenerateButtonProps {
  disabled: boolean;
  isGenerating: boolean;
  progress: GenerateProgress | null;
  onGenerate: () => void;
  error: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  "td-compute": "Computing colors",
  "mesh-generate": "Building mesh",
  "xml-build": "Building XML",
  "zip-package": "Packaging 3MF",
};

export function GenerateButton({
  disabled,
  isGenerating,
  progress,
  onGenerate,
  error,
}: GenerateButtonProps) {
  const progressPercent = progress
    ? Math.round(progress.progress * 100)
    : 0;
  const phaseLabel = progress
    ? PHASE_LABELS[progress.phase] ?? progress.phase
    : "";

  return (
    <div className="space-y-2">
      <button
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
          disabled || isGenerating
            ? "cursor-not-allowed bg-gray-200 text-gray-400"
            : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
        }`}
      >
        {isGenerating ? "Generating..." : "Generate 3MF"}
      </button>

      {isGenerating && progress && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {phaseLabel} — {progressPercent}%
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!isGenerating && disabled && !error && (
        <p className="text-xs text-gray-400">
          Upload an image and select at least 2 filaments to generate.
        </p>
      )}
    </div>
  );
}

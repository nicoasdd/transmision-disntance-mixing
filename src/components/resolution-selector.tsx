"use client";

const RESOLUTIONS = [
  { value: 0.25, label: "0.25 mm (Fine)" },
  { value: 0.5, label: "0.50 mm (Default)" },
  { value: 1.0, label: "1.00 mm (Draft)" },
  { value: 2.0, label: "2.00 mm (Fast)" },
];

const MODEL_WIDTH_MM = 100;

interface ResolutionSelectorProps {
  value: number;
  onChange: (value: number) => void;
  imageWidth: number;
  imageHeight: number;
}

export function ResolutionSelector({
  value,
  onChange,
  imageWidth,
  imageHeight,
}: ResolutionSelectorProps) {
  const aspect = imageHeight > 0 ? imageHeight / imageWidth : 1;
  const gridWidth = imageWidth > 0 ? Math.ceil(MODEL_WIDTH_MM / value) : 0;
  const gridHeight = imageWidth > 0 ? Math.ceil((MODEL_WIDTH_MM * aspect) / value) : 0;
  const estimatedCells = gridWidth * gridHeight;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        XY Resolution
      </label>
      <select
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {RESOLUTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {imageWidth > 0 && (
        <p className="text-xs text-gray-400">
          Model: {MODEL_WIDTH_MM}×{Math.round(MODEL_WIDTH_MM * aspect)} mm
          — Grid: {gridWidth}×{gridHeight} = {estimatedCells.toLocaleString()} cells
        </p>
      )}
    </div>
  );
}

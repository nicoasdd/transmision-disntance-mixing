"use client";

interface HeightSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export function HeightSlider({
  value,
  onChange,
  min = 0.5,
  max = 10.0,
  step = 0.1,
  label = "Total Height",
}: HeightSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-mono text-gray-600">
          {value.toFixed(1)} mm
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min} mm</span>
        <span>{max} mm</span>
      </div>
    </div>
  );
}

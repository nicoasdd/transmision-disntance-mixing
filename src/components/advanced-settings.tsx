"use client";

import { HeightSlider } from "./height-slider";
import { ResolutionSelector } from "./resolution-selector";

interface AdvancedSettingsProps {
  xyResolution: number;
  brightness: number;
  contrast: number;
  minLayerHeight: number;
  imageWidth: number;
  imageHeight: number;
  onXyResolutionChange: (v: number) => void;
  onBrightnessChange: (v: number) => void;
  onContrastChange: (v: number) => void;
  onMinLayerHeightChange: (v: number) => void;
}

export function AdvancedSettings({
  xyResolution,
  brightness,
  contrast,
  minLayerHeight,
  imageWidth,
  imageHeight,
  onXyResolutionChange,
  onBrightnessChange,
  onContrastChange,
  onMinLayerHeightChange,
}: AdvancedSettingsProps) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none">
        Advanced Settings
      </summary>
      <div className="mt-3 space-y-4 border-t border-gray-100 pt-3">
        <ResolutionSelector
          value={xyResolution}
          onChange={onXyResolutionChange}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />

        <HeightSlider
          label="Min Layer Height"
          value={minLayerHeight}
          onChange={onMinLayerHeightChange}
          min={0}
          max={0.2}
          step={0.01}
        />

        <HeightSlider
          label="Brightness"
          value={brightness}
          onChange={onBrightnessChange}
          min={-100}
          max={100}
          step={1}
        />

        <HeightSlider
          label="Contrast"
          value={contrast}
          onChange={onContrastChange}
          min={-100}
          max={100}
          step={1}
        />
      </div>
    </details>
  );
}

"use client";

import { GenerationProvider, useGeneration } from "@/stores/generation-store";
import { ImageUploader } from "@/components/image-uploader";
import { FilamentStackEditor } from "@/components/filament-stack-editor";
import { HeightSlider } from "@/components/height-slider";
import { GenerateButton } from "@/components/generate-button";
import { ColorPreview } from "@/components/color-preview";
import { AdvancedSettings } from "@/components/advanced-settings";
import { ErrorBoundary } from "@/components/error-boundary";

function GeneratorContent() {
  const {
    state,
    isConfigValid,
    setImage,
    setFilamentStack,
    setTotalHeight,
    setXyResolution,
    setBrightness,
    setContrast,
    setMinLayerHeight,
    generate3MF,
    computePreview,
  } = useGeneration();

  const isGenerating = state.pipelineState === "GENERATING_3MF";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Left panel: Image + Preview */}
      <div className="space-y-6">
        <ImageUploader
          onImageLoad={setImage}
          currentImageUrl={state.imageObjectUrl}
        />

        <ColorPreview
          previewData={state.previewData}
          previewWidth={state.previewWidth}
          previewHeight={state.previewHeight}
          stats={state.previewStats}
          isComputing={state.pipelineState === "COMPUTING"}
          isConfigValid={isConfigValid}
          onRefresh={computePreview}
        />

        {state.generateStats && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
            <p className="font-medium text-green-800">3MF generated successfully!</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-green-700">
              <span>Vertices: {state.generateStats.vertexCount.toLocaleString()}</span>
              <span>Triangles: {state.generateStats.triangleCount.toLocaleString()}</span>
              <span>File size: {(state.generateStats.fileSizeBytes / 1024).toFixed(0)} KB</span>
              <span>Time: {(state.generateStats.computeTimeMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar: Controls */}
      <div className="space-y-6">
        <FilamentStackEditor
          stack={state.filamentStack}
          onChange={setFilamentStack}
        />

        <HeightSlider
          value={state.totalHeight}
          onChange={setTotalHeight}
        />

        <AdvancedSettings
          xyResolution={state.xyResolution}
          brightness={state.brightness}
          contrast={state.contrast}
          minLayerHeight={state.minLayerHeight}
          imageWidth={state.imageWidth}
          imageHeight={state.imageHeight}
          onXyResolutionChange={setXyResolution}
          onBrightnessChange={setBrightness}
          onContrastChange={setContrast}
          onMinLayerHeightChange={setMinLayerHeight}
        />

        <GenerateButton
          disabled={!isConfigValid}
          isGenerating={isGenerating}
          progress={state.progress}
          onGenerate={generate3MF}
          error={state.error}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ErrorBoundary>
      <GenerationProvider>
        <GeneratorContent />
      </GenerationProvider>
    </ErrorBoundary>
  );
}

import type { FilamentProfile } from "./filament";

export interface GenerationConfig {
  imageData: ImageBitmap | null;
  imageWidth: number;
  imageHeight: number;
  filamentStack: FilamentProfile[];
  totalHeight: number;
  xyResolution: number;
  layerCount: number;
  minLayerHeight: number;
  brightness: number;
  contrast: number;
  backgroundColor: string;
}

export interface LayerStack {
  cellX: number;
  cellY: number;
  heights: number[];
  filamentIds: string[];
  predictedColor: [number, number, number];
  deltaE: number;
}

export type PipelineState =
  | "IDLE"
  | "IMAGE_LOADED"
  | "CONFIGURED"
  | "COMPUTING"
  | "PREVIEW_READY"
  | "GENERATING_3MF"
  | "COMPLETE"
  | "ERROR";

export const DEFAULT_CONFIG: Omit<GenerationConfig, "imageData" | "imageWidth" | "imageHeight" | "filamentStack"> = {
  totalHeight: 3.0,
  xyResolution: 1.0,
  layerCount: 2,
  minLayerHeight: 0.04,
  brightness: 0,
  contrast: 0,
  backgroundColor: "#FFFFFF",
};

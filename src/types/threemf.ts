export interface BaseMaterial {
  name: string;
  displayColor: string;
}

export interface MeshObject {
  id: number;
  name: string;
  materialIndex: number;
  vertices: number[][];
  triangles: number[][];
}

export interface BuildItem {
  objectId: number;
  transform: string | null;
}

export interface ThreeMFPackage {
  materials: BaseMaterial[];
  objects: MeshObject[];
  buildItems: BuildItem[];
  metadata: Record<string, string>;
}

export interface MeshLayer {
  layerIndex: number;
  filamentId: string;
  vertices: Float32Array;
  triangles: Uint32Array;
  zBottom: Float32Array;
  zTop: Float32Array;
}

export interface GenerateProgress {
  phase: "td-compute" | "mesh-generate" | "xml-build" | "zip-package";
  progress: number;
}

export interface GenerateStats {
  vertexCount: number;
  triangleCount: number;
  fileSizeBytes: number;
  computeTimeMs: number;
}

export interface PreviewStats {
  avgDeltaE: number;
  maxDeltaE: number;
  computeTimeMs: number;
}

export type WorkerMessage =
  | { type: "compute-preview"; payload: PreviewPayload }
  | { type: "generate-3mf"; payload: GeneratePayload };

export type WorkerResponse =
  | { type: "preview-result"; payload: { previewData: ArrayBuffer; width: number; height: number; stats: PreviewStats } }
  | { type: "generate-progress"; payload: GenerateProgress }
  | { type: "generate-result"; payload: { blob: Blob; stats: GenerateStats } }
  | { type: "error"; payload: { code: string; message: string } };

export interface FilamentWorkerData {
  id: string;
  name: string;
  brand: string;
  colorHex: string;
  colorRgb: [number, number, number];
  td: number;
}

export interface PreviewPayload {
  imageData: ArrayBuffer;
  width: number;
  height: number;
  filaments: FilamentWorkerData[];
  totalHeight: number;
  xyResolution: number;
  brightness: number;
  contrast: number;
  backgroundColor: [number, number, number];
}

export interface GeneratePayload {
  imageData: ArrayBuffer;
  width: number;
  height: number;
  filaments: FilamentWorkerData[];
  totalHeight: number;
  xyResolution: number;
  minLayerHeight: number;
  brightness: number;
  contrast: number;
  backgroundColor: [number, number, number];
}

"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { saveAs } from "file-saver";
import type { FilamentProfile } from "@/types/filament";
import type {
  GenerateProgress,
  GenerateStats,
  PreviewStats,
  WorkerResponse,
  FilamentWorkerData,
} from "@/types/threemf";
import { hexToRgb } from "@/lib/color-utils";
import { DEFAULT_CONFIG } from "@/types/generation";
import type { PipelineState } from "@/types/generation";

interface GenerationState {
  imageObjectUrl: string | null;
  imageBitmap: ImageBitmap | null;
  imageWidth: number;
  imageHeight: number;
  filamentStack: FilamentProfile[];
  totalHeight: number;
  xyResolution: number;
  minLayerHeight: number;
  brightness: number;
  contrast: number;
  backgroundColor: string;
  pipelineState: PipelineState;
  progress: GenerateProgress | null;
  generateStats: GenerateStats | null;
  previewData: ArrayBuffer | null;
  previewWidth: number;
  previewHeight: number;
  previewStats: PreviewStats | null;
  error: string | null;
}

type Action =
  | { type: "SET_IMAGE"; payload: { bitmap: ImageBitmap; width: number; height: number; objectUrl: string } }
  | { type: "SET_FILAMENT_STACK"; payload: FilamentProfile[] }
  | { type: "SET_TOTAL_HEIGHT"; payload: number }
  | { type: "SET_XY_RESOLUTION"; payload: number }
  | { type: "SET_MIN_LAYER_HEIGHT"; payload: number }
  | { type: "SET_BRIGHTNESS"; payload: number }
  | { type: "SET_CONTRAST"; payload: number }
  | { type: "SET_PIPELINE_STATE"; payload: PipelineState }
  | { type: "SET_PROGRESS"; payload: GenerateProgress }
  | { type: "SET_GENERATE_RESULT"; payload: GenerateStats }
  | { type: "SET_PREVIEW_RESULT"; payload: { data: ArrayBuffer; width: number; height: number; stats: PreviewStats } }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

const initialState: GenerationState = {
  imageObjectUrl: null,
  imageBitmap: null,
  imageWidth: 0,
  imageHeight: 0,
  filamentStack: [],
  totalHeight: DEFAULT_CONFIG.totalHeight,
  xyResolution: DEFAULT_CONFIG.xyResolution,
  minLayerHeight: DEFAULT_CONFIG.minLayerHeight,
  brightness: DEFAULT_CONFIG.brightness,
  contrast: DEFAULT_CONFIG.contrast,
  backgroundColor: DEFAULT_CONFIG.backgroundColor,
  pipelineState: "IDLE",
  progress: null,
  generateStats: null,
  previewData: null,
  previewWidth: 0,
  previewHeight: 0,
  previewStats: null,
  error: null,
};

function reducer(state: GenerationState, action: Action): GenerationState {
  switch (action.type) {
    case "SET_IMAGE":
      return {
        ...state,
        imageBitmap: action.payload.bitmap,
        imageWidth: action.payload.width,
        imageHeight: action.payload.height,
        imageObjectUrl: action.payload.objectUrl,
        pipelineState: "IMAGE_LOADED",
        error: null,
      };
    case "SET_FILAMENT_STACK":
      return {
        ...state,
        filamentStack: action.payload,
        pipelineState: state.imageBitmap && action.payload.length >= 2 ? "CONFIGURED" : state.pipelineState,
      };
    case "SET_TOTAL_HEIGHT":
      return { ...state, totalHeight: action.payload };
    case "SET_XY_RESOLUTION":
      return { ...state, xyResolution: action.payload };
    case "SET_MIN_LAYER_HEIGHT":
      return { ...state, minLayerHeight: action.payload };
    case "SET_BRIGHTNESS":
      return { ...state, brightness: action.payload };
    case "SET_CONTRAST":
      return { ...state, contrast: action.payload };
    case "SET_PIPELINE_STATE":
      return { ...state, pipelineState: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "SET_GENERATE_RESULT":
      return { ...state, generateStats: action.payload, pipelineState: "COMPLETE", progress: null };
    case "SET_PREVIEW_RESULT":
      return {
        ...state,
        previewData: action.payload.data,
        previewWidth: action.payload.width,
        previewHeight: action.payload.height,
        previewStats: action.payload.stats,
        pipelineState: "PREVIEW_READY",
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, pipelineState: "ERROR", progress: null };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

interface GenerationContextValue {
  state: GenerationState;
  isConfigValid: boolean;
  setImage: (data: { imageBitmap: ImageBitmap; width: number; height: number; objectUrl: string }) => void;
  setFilamentStack: (stack: FilamentProfile[]) => void;
  setTotalHeight: (h: number) => void;
  setXyResolution: (r: number) => void;
  setMinLayerHeight: (h: number) => void;
  setBrightness: (b: number) => void;
  setContrast: (c: number) => void;
  generate3MF: () => void;
  computePreview: () => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

function filamentToWorkerData(f: FilamentProfile): FilamentWorkerData {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand,
    colorHex: f.colorHex,
    colorRgb: hexToRgb(f.colorHex),
    td: f.td,
  };
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/compute.worker.ts", import.meta.url)
      );
      workerRef.current.onerror = (e) => {
        console.error("Worker error:", e);
        dispatch({
          type: "SET_ERROR",
          payload: `Worker failed: ${e.message || "unknown error"}`,
        });
      };
      workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        switch (msg.type) {
          case "preview-result":
            dispatch({
              type: "SET_PREVIEW_RESULT",
              payload: {
                data: msg.payload.previewData,
                width: msg.payload.width,
                height: msg.payload.height,
                stats: msg.payload.stats,
              },
            });
            break;
          case "generate-progress":
            dispatch({ type: "SET_PROGRESS", payload: msg.payload });
            break;
          case "generate-result":
            dispatch({ type: "SET_GENERATE_RESULT", payload: msg.payload.stats });
            try {
              saveAs(msg.payload.blob, "flat-top-model.3mf");
            } catch (err) {
              console.error("saveAs failed:", err);
              const url = URL.createObjectURL(msg.payload.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "flat-top-model.3mf";
              a.click();
              URL.revokeObjectURL(url);
            }
            break;
          case "error":
            dispatch({ type: "SET_ERROR", payload: msg.payload.message });
            break;
        }
      };
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const isConfigValid =
    state.imageBitmap !== null && state.filamentStack.length >= 2;

  const getImageArrayBuffer = useCallback(async (): Promise<ArrayBuffer> => {
    if (!state.imageBitmap) throw new Error("No image loaded");
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(state.imageWidth, state.imageHeight)
        : document.createElement("canvas");

    if ("width" in canvas) {
      canvas.width = state.imageWidth;
      canvas.height = state.imageHeight;
    }

    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;

    if (!ctx) throw new Error("Could not get 2D context");
    ctx.drawImage(state.imageBitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, state.imageWidth, state.imageHeight);
    return imgData.data.buffer;
  }, [state.imageBitmap, state.imageWidth, state.imageHeight]);

  const bgRgb = hexToRgb(state.backgroundColor);

  const generate3MF = useCallback(async () => {
    if (!isConfigValid) return;
    dispatch({ type: "SET_PIPELINE_STATE", payload: "GENERATING_3MF" });
    try {
      const imageBuffer = await getImageArrayBuffer();
      const worker = getWorker();
      worker.postMessage(
        {
          type: "generate-3mf",
          payload: {
            imageData: imageBuffer,
            width: state.imageWidth,
            height: state.imageHeight,
            filaments: state.filamentStack.map(filamentToWorkerData),
            totalHeight: state.totalHeight,
            xyResolution: state.xyResolution,
            minLayerHeight: state.minLayerHeight,
            brightness: state.brightness,
            contrast: state.contrast,
            backgroundColor: bgRgb as [number, number, number],
          },
        },
        [imageBuffer]
      );
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err instanceof Error ? err.message : "Generation failed",
      });
    }
  }, [
    isConfigValid,
    getImageArrayBuffer,
    getWorker,
    state.imageWidth,
    state.imageHeight,
    state.filamentStack,
    state.totalHeight,
    state.xyResolution,
    state.minLayerHeight,
    state.brightness,
    state.contrast,
    bgRgb,
  ]);

  const computePreview = useCallback(async () => {
    if (!isConfigValid) return;
    dispatch({ type: "SET_PIPELINE_STATE", payload: "COMPUTING" });
    try {
      const imageBuffer = await getImageArrayBuffer();
      const worker = getWorker();
      worker.postMessage(
        {
          type: "compute-preview",
          payload: {
            imageData: imageBuffer,
            width: state.imageWidth,
            height: state.imageHeight,
            filaments: state.filamentStack.map(filamentToWorkerData),
            totalHeight: state.totalHeight,
            xyResolution: state.xyResolution,
            brightness: state.brightness,
            contrast: state.contrast,
            backgroundColor: bgRgb as [number, number, number],
          },
        },
        [imageBuffer]
      );
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err instanceof Error ? err.message : "Preview failed",
      });
    }
  }, [
    isConfigValid,
    getImageArrayBuffer,
    getWorker,
    state.imageWidth,
    state.imageHeight,
    state.filamentStack,
    state.totalHeight,
    state.xyResolution,
    state.brightness,
    state.contrast,
    bgRgb,
  ]);

  const value: GenerationContextValue = {
    state,
    isConfigValid,
    setImage: (data) => dispatch({ type: "SET_IMAGE", payload: { bitmap: data.imageBitmap, width: data.width, height: data.height, objectUrl: data.objectUrl } }),
    setFilamentStack: (stack) => dispatch({ type: "SET_FILAMENT_STACK", payload: stack }),
    setTotalHeight: (h) => dispatch({ type: "SET_TOTAL_HEIGHT", payload: h }),
    setXyResolution: (r) => dispatch({ type: "SET_XY_RESOLUTION", payload: r }),
    setMinLayerHeight: (h) => dispatch({ type: "SET_MIN_LAYER_HEIGHT", payload: h }),
    setBrightness: (b) => dispatch({ type: "SET_BRIGHTNESS", payload: b }),
    setContrast: (c) => dispatch({ type: "SET_CONTRAST", payload: c }),
    generate3MF,
    computePreview,
  };

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGeneration must be used within GenerationProvider");
  return ctx;
}

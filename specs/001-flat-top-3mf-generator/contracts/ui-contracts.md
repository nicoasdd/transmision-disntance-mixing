# UI Contracts: Flat-Top 3MF Generator

**Date**: 2026-04-15
**Feature**: 001-flat-top-3mf-generator

This document defines the interface contracts for the web application's
user-facing screens and the worker API that powers client-side computation.

---

## Pages / Routes

### `/` — Main Generator Page

Single-page application layout with three panels:

| Panel | Position | Content |
|-------|----------|---------|
| **Image Panel** | Left | Upload zone → image display → 2D color preview |
| **Controls Panel** | Right sidebar | Filament stack, height, resolution, generate button |
| **Advanced Panel** | Collapsible below controls | Brightness, contrast, layer count, min height |

**State flow**: Upload → Select filaments → (optional: tweak params) → Preview
updates live → Click "Generate 3MF" → Download triggered

### `/filaments` — Filament Library Page

CRUD interface for managing filament profiles.

| Section | Content |
|---------|---------|
| **Search/Filter bar** | Text search by name/brand, filter by material type |
| **Filament list** | Scrollable table/cards showing name, brand, color swatch, TD |
| **Add/Edit form** | Modal or inline form for filament CRUD |
| **Import/Export** | Buttons to import/export library as JSON |

---

## Component Contracts

### ImageUploader

**Input**: None (user drag-and-drop or file picker)
**Output**: `{ imageBitmap: ImageBitmap, width: number, height: number }`
**Accepts**: JPEG, PNG
**Max size**: 4096×4096 (downsample larger images with user confirmation)
**Error states**: Invalid format, file too large, decode failure

### FilamentStackEditor

**Input**: `{ availableFilaments: FilamentProfile[], maxLayers: number }`
**Output**: `{ stack: FilamentProfile[], layerCount: number }`
**Behavior**:
- Ordered list of selected filaments (drag to reorder)
- Add/remove filament slots (2-8 range)
- Each slot shows color swatch + name + TD value
- Changing the stack triggers preview recomputation

### ColorPreview

**Input**: `{ imageData: ImageData, generationConfig: GenerationConfig }`
**Output**: Visual 2D canvas showing predicted print result
**Performance**: Updates within 500ms for images up to 1024×1024
**Behavior**:
- Shows side-by-side: original image + predicted result
- Optionally highlights regions with high ΔE (poor color match)
- Zoom and pan supported

### GenerateButton

**Input**: `{ config: GenerationConfig, isValid: boolean }`
**Output**: Triggers worker pipeline; on completion emits `{ blob: Blob, filename: string }`
**States**: Idle → Generating (with progress %) → Complete (download) → Error
**Behavior**:
- Disabled when config is invalid (no image, <2 filaments, etc.)
- Shows progress bar during generation
- Triggers `saveAs(blob, "model.3mf")` on completion

### HeightSlider

**Input**: `{ min: number, max: number, step: number, default: number }`
**Output**: `{ value: number }`
**Range**: 0.5mm - 10.0mm, step 0.1mm, default 3.0mm

### ResolutionSelector

**Input**: `{ options: number[] }`
**Output**: `{ resolution: number }`
**Options**: 0.25mm, 0.5mm (default), 1.0mm, 2.0mm
**Display**: Shows estimated grid dimensions (e.g., "400×400 cells")

---

## Worker API Contract

### Main Thread → Worker Messages

#### `compute-preview`

```typescript
{
  type: 'compute-preview'
  payload: {
    imageData: ArrayBuffer    // RGBA pixel data (transferable)
    width: number
    height: number
    filaments: {
      id: string
      colorRgb: [number, number, number]
      td: number
    }[]
    totalHeight: number
    xyResolution: number
    brightness: number
    contrast: number
    backgroundColor: [number, number, number]
  }
}
```

#### `generate-3mf`

```typescript
{
  type: 'generate-3mf'
  payload: {
    imageData: ArrayBuffer    // RGBA pixel data (transferable)
    width: number
    height: number
    filaments: {
      id: string
      name: string
      brand: string
      colorHex: string
      colorRgb: [number, number, number]
      td: number
    }[]
    totalHeight: number
    xyResolution: number
    minLayerHeight: number
    brightness: number
    contrast: number
    backgroundColor: [number, number, number]
  }
}
```

### Worker → Main Thread Messages

#### `preview-result`

```typescript
{
  type: 'preview-result'
  payload: {
    previewData: ArrayBuffer   // RGBA pixel data (transferable)
    width: number
    height: number
    stats: {
      avgDeltaE: number
      maxDeltaE: number
      computeTimeMs: number
    }
  }
}
```

#### `generate-progress`

```typescript
{
  type: 'generate-progress'
  payload: {
    phase: 'td-compute' | 'mesh-generate' | 'xml-build' | 'zip-package'
    progress: number           // 0.0 - 1.0
  }
}
```

#### `generate-result`

```typescript
{
  type: 'generate-result'
  payload: {
    blob: Blob                 // The .3mf file
    stats: {
      vertexCount: number
      triangleCount: number
      fileSizeBytes: number
      computeTimeMs: number
    }
  }
}
```

#### `error`

```typescript
{
  type: 'error'
  payload: {
    code: 'INVALID_IMAGE' | 'COMPUTATION_FAILED' | 'MEMORY_EXCEEDED' | 'UNKNOWN'
    message: string
  }
}
```

---

## Filament Data Import/Export Format

### JSON Schema (for import/export)

```json
{
  "version": 1,
  "exportedAt": "2026-04-15T12:00:00Z",
  "filaments": [
    {
      "name": "Galaxy Black",
      "brand": "Polymaker",
      "material": "PLA",
      "colorHex": "#1A1A2E",
      "td": 0.4
    }
  ]
}
```

- `id`, `isDefault`, `createdAt`, `updatedAt` are NOT included in exports
  (regenerated on import).
- Duplicate detection on import: match by `name + brand + colorHex`.

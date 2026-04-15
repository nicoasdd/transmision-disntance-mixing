# Transmission Distance Color Mixing — Flat-Top 3MF Generator

> **Status: Prototype / Abandoned** — The core TD color model and UI work, but the 3MF output does not import correctly into BambuStudio (geometry, materials, and flat-top structure are not recognized properly). The 3MF writer needs significant rework — ideally reverse-engineering a known-good BambuStudio multi-material 3MF to match its exact structure.

## What This Is

A web app that generates multi-material 3MF files for 3D printing using **Transmission Distance (TD)** color mixing. The idea: stack translucent filament layers at varying thicknesses to reproduce a source image's colors, with a perfectly flat top surface (the "flat-top invariant").

### Core Concept

- Upload an image
- Select 2+ filaments with known TD values
- The TD solver computes per-pixel layer heights that best reproduce each pixel's color
- All layer heights sum to a constant total (flat top)
- Output: a multi-material 3MF file for BambuStudio / AMS printers

## What Works

- **TD color model** (`src/lib/td-model.ts`) — Beer-Lambert forward model, LUT-based inverse solver with grid search, flat-top height constraint
- **Color utilities** (`src/lib/color-utils.ts`) — sRGB↔CIELAB conversions, CIE76 ΔE distance
- **Image processing** (`src/lib/image-processing.ts`) — pixel sampling, brightness/contrast, downsampling
- **Mesh builder** (`src/lib/mesh-builder.ts`) — per-cell box geometry generation
- **Filament library** — IndexedDB persistence via Dexie, CRUD, JSON import/export
- **Web Worker pipeline** — TD computation and mesh generation run off the main thread
- **UI** — image upload, filament stack editor, height slider, live TD color preview, advanced settings
- **24 unit tests passing** (color-utils, td-model, mesh-builder)

## What Doesn't Work

- **3MF output** (`src/lib/threemf-writer.ts`) — generates a structurally valid 3MF ZIP, but BambuStudio does not correctly interpret the geometry, materials, or object structure. The multi-body approach (one `<object>` per layer with `basematerials` + `pid/pindex`) doesn't match what BambuStudio expects.
- **Memory usage** — large images or fine resolutions (0.25mm) can exhaust browser memory due to the per-cell box mesh approach

## Tech Stack

- **Next.js 16** (static export)
- **TypeScript** (strict mode)
- **Tailwind CSS 4**
- **Dexie** (IndexedDB wrapper)
- **JSZip** + manual XML for 3MF generation
- **Vitest** for testing

## Setup

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static export to out/
npm run test      # unit tests
npm run typecheck # TypeScript check
```

## Project Structure

```
src/
├── app/                  # Next.js pages (generator + filament library)
├── components/           # React components
├── data/                 # Default filament database
├── lib/                  # Pure computation libraries (TD model, color, mesh, 3MF)
├── stores/               # State management (generation context, filament store)
├── types/                # TypeScript type definitions
└── workers/              # Web Worker for off-thread computation
tests/
├── unit/                 # Unit tests for core libraries
specs/                    # Feature specification and design documents
.specify/                 # Spec Kit project configuration
```

## Known Issues & Next Steps (if resuming)

1. **Reverse-engineer BambuStudio 3MF** — Export a multi-material model from BambuStudio, unzip the 3MF, and study the exact XML structure, metadata files, and material assignment format it expects
2. **Memory optimization** — Replace per-cell box meshes with a shared heightfield mesh (fewer vertices, less memory)
3. **3MF validation** — Test against the official 3MF conformance tools before targeting any specific slicer

## Design Documents

- [Specification](specs/001-flat-top-3mf-generator/spec.md)
- [Implementation Plan](specs/001-flat-top-3mf-generator/plan.md)
- [Research](specs/001-flat-top-3mf-generator/research.md)
- [Data Model](specs/001-flat-top-3mf-generator/data-model.md)
- [Tasks](specs/001-flat-top-3mf-generator/tasks.md)

# Implementation Plan: Flat-Top 3MF Generator

**Branch**: `001-flat-top-3mf-generator` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-flat-top-3mf-generator/spec.md`

## Summary

Build a client-side web application that converts raster images into
multi-material 3MF files using Transmission Distance (TD) color modeling. The
key differentiator from HueForge is that the top surface is always flat; color
variation is achieved by modulating the bottom layer height while keeping the
total stack height constant. The app uses Next.js (static export), Web Workers
for computation, and generates 3MF files with one mesh object per filament
layer, conforming to the 3MF Core + Materials Extension specs.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15.x, React 19.x, Tailwind CSS 4.x, shadcn/ui, JSZip 3.10.x, fast-xml-parser 5.x, Dexie 4.x, file-saver 2.0.x
**Storage**: IndexedDB (Dexie) for filament library; localStorage for user preferences
**Testing**: Vitest for unit/integration tests
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge — latest 2 versions), desktop-first (>=1280px)
**Project Type**: Web application (static export, single deployment)
**Performance Goals**: Preview update <500ms for 1024×1024 images; 3MF generation <30s for 200×200mm at 0.5mm resolution
**Constraints**: All computation client-side; no server-side processing; offline-capable after initial load
**Scale/Scope**: Single-page app with 2 routes, ~15 components, ~10 core library modules, 2 Web Workers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Flat-Top Invariant | ✅ PASS | `LayerStack` enforces `sum(heights) = totalHeight` invariant. Mesh builder anchors top face at constant Z. Unit tests validate flat-top constraint. |
| II | TD Color Fidelity | ✅ PASS | Beer-Lambert per-channel model in `td-model.ts`. Error bounds documented in research.md (R2). ΔE metrics exposed in preview stats. |
| III | 3MF Output Compliance (BambuStudio-Primary) | ✅ PASS | One `<object>` per layer with `basematerials`, assembled via `<components>`. Classic Core packaging. BambuStudio is primary validation target; filament order maps to AMS slots. See research.md R4. |
| IV | Web-First Delivery | ✅ PASS | Next.js `output: 'export'` produces static files. All computation in Web Workers. No API routes or server functions. |
| V | Real-Time Visual Feedback | ✅ PASS | Worker-based preview pipeline. 500ms target for 1024×1024. Precomputed transmittance lookup tables. |
| VI | Simplicity & Accessibility | ✅ PASS | Sensible defaults (3mm height, 0.5mm resolution). Advanced options behind collapsible panel. shadcn/ui for accessible components. |

No violations. Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-flat-top-3mf-generator/
├── plan.md              # This file
├── research.md          # Phase 0: technology research and decisions
├── data-model.md        # Phase 1: entity definitions and relationships
├── quickstart.md        # Phase 1: setup and development guide
├── contracts/
│   └── ui-contracts.md  # Phase 1: page layouts, component contracts, worker API
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout with navigation
│   ├── page.tsx                # Main generator page
│   └── filaments/
│       └── page.tsx            # Filament library management
├── components/                 # React UI components
│   ├── image-uploader.tsx      # Drag-and-drop + file picker
│   ├── filament-stack-editor.tsx  # Ordered filament selector
│   ├── color-preview.tsx       # Live 2D TD preview canvas
│   ├── generate-button.tsx     # Generate + download trigger
│   ├── height-slider.tsx       # Total height control
│   ├── resolution-selector.tsx # XY resolution picker
│   └── ui/                     # shadcn/ui primitives
├── workers/                    # Web Worker scripts
│   ├── td-solver.worker.ts     # TD computation + preview generation
│   └── generator.worker.ts     # Full mesh + 3MF packaging
├── lib/                        # Core logic (worker-compatible, no DOM)
│   ├── td-model.ts             # Beer-Lambert forward model
│   ├── color-utils.ts          # RGB ↔ Lab, ΔE calculation
│   ├── mesh-builder.ts         # Height field → triangle mesh
│   ├── threemf-writer.ts       # Mesh + materials → 3MF XML + ZIP
│   └── image-processing.ts     # Pixel sampling, brightness/contrast
├── data/
│   └── default-filaments.json  # Bundled TD database (~50-100 filaments)
├── stores/                     # State management
│   ├── filament-store.ts       # Dexie-backed filament CRUD
│   └── generation-store.ts     # In-memory generation config
└── types/                      # TypeScript type definitions
    ├── filament.ts
    ├── generation.ts
    └── threemf.ts

tests/
├── unit/
│   ├── td-model.test.ts
│   ├── color-utils.test.ts
│   ├── mesh-builder.test.ts
│   └── threemf-writer.test.ts
└── integration/
    └── pipeline.test.ts

public/
└── sample-images/              # Example test images
```

**Structure Decision**: Single Next.js project with App Router. No
backend/frontend split needed because all computation is client-side. The
`lib/` directory contains pure TypeScript modules with no DOM dependencies,
making them importable from both the main thread and Web Workers. The
`workers/` directory contains the worker entry points that orchestrate the
`lib/` modules.

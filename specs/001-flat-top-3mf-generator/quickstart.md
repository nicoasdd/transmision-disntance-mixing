# Quickstart: Flat-Top 3MF Generator

**Date**: 2026-04-15
**Feature**: 001-flat-top-3mf-generator

## Prerequisites

- Node.js 20.x or later
- npm 10.x or later (or pnpm/yarn equivalent)
- A modern browser (Chrome, Firefox, Safari, or Edge — latest 2 versions)
- A multi-material slicer for testing output: PrusaSlicer 2.7+, OrcaSlicer,
  or BambuStudio

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd transmision-disntance-mixing

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Development Commands

```bash
npm run dev        # Start Next.js dev server with hot reload
npm run build      # Build static export to out/
npm run start      # Serve the static export locally
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking (strict)
npm run test       # Run unit tests
npm run test:watch # Run tests in watch mode
```

## Project Structure

```text
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Main generator page (/)
│   ├── filaments/
│   │   └── page.tsx        # Filament library page (/filaments)
│   └── layout.tsx          # Root layout with navigation
├── components/             # React components
│   ├── image-uploader.tsx
│   ├── filament-stack-editor.tsx
│   ├── color-preview.tsx
│   ├── generate-button.tsx
│   ├── height-slider.tsx
│   ├── resolution-selector.tsx
│   └── ui/                 # shadcn/ui primitives
├── workers/                # Web Worker scripts
│   ├── td-solver.worker.ts # TD computation + preview
│   └── generator.worker.ts # Mesh generation + 3MF packaging
├── lib/                    # Core logic (shared between main thread and workers)
│   ├── td-model.ts         # Beer-Lambert forward model
│   ├── color-utils.ts      # RGB ↔ Lab conversion, ΔE calculation
│   ├── mesh-builder.ts     # Height field → triangle mesh
│   ├── threemf-writer.ts   # Mesh + materials → 3MF XML + ZIP
│   └── image-processing.ts # Pixel sampling, brightness/contrast
├── data/                   # Static data
│   └── default-filaments.json  # Bundled TD database
├── stores/                 # Client state management
│   ├── filament-store.ts   # Dexie-backed filament persistence
│   └── generation-store.ts # In-memory generation config (Zustand or context)
└── types/                  # TypeScript type definitions
    ├── filament.ts
    ├── generation.ts
    └── threemf.ts

tests/
├── unit/
│   ├── td-model.test.ts         # Forward model accuracy
│   ├── color-utils.test.ts      # Color space conversions
│   ├── mesh-builder.test.ts     # Mesh geometry correctness
│   └── threemf-writer.test.ts   # 3MF XML structure validation
└── integration/
    └── pipeline.test.ts         # End-to-end: image → 3MF → parse → validate

public/
├── sample-images/          # Example images for testing
└── favicon.ico
```

## Basic Usage Flow

1. Open the app in your browser
2. Upload a JPEG or PNG image (drag-and-drop or file picker)
3. Select 2-8 filaments from the default library
4. Adjust total model height (default: 3.0mm)
5. Observe the live color preview
6. Click "Generate 3MF"
7. Wait for generation to complete (progress bar shown)
8. Download the `.3mf` file
9. Open in your slicer, assign filaments to material slots, and slice

## Testing the Output

After generating a `.3mf` file:

1. Open PrusaSlicer, OrcaSlicer, or BambuStudio
2. Import the `.3mf` file
3. Verify:
   - Multiple objects appear (one per color layer)
   - Each object has a material assignment
   - The top surface is flat across all objects
   - The bottom surface varies in height
4. Assign your physical filaments to the material slots
5. Slice and inspect the layer preview

## Environment Variables

No environment variables are required for local development. The application
runs entirely client-side.

For deployment, configure your static host to serve the `out/` directory with
appropriate cache headers.

## Key Configuration Files

- `next.config.ts` — Next.js config with `output: 'export'`
- `tsconfig.json` — Strict TypeScript configuration
- `tailwind.config.ts` — Tailwind CSS configuration
- `.eslintrc.json` — ESLint rules

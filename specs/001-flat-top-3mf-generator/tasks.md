# Tasks: Flat-Top 3MF Generator

**Input**: Design documents from `/specs/001-flat-top-3mf-generator/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization, dependency installation, and base configuration

- [x] T001 Initialize Next.js 15.x project with TypeScript strict mode, App Router, and `output: 'export'` in `next.config.ts`
- [x] T002 Install core dependencies: `tailwindcss@4`, `jszip@3.10`, `fast-xml-parser@5`, `dexie@4`, `file-saver@2`, and their type packages
- [x] T003 [P] Configure Tailwind CSS 4.x and initialize shadcn/ui in `src/components/ui/`
- [x] T004 [P] Configure Vitest for unit and integration testing in `vitest.config.ts`
- [x] T005 [P] Create TypeScript type definitions for FilamentProfile in `src/types/filament.ts`, GenerationConfig and LayerStack in `src/types/generation.ts`, and ThreeMFPackage/MeshLayer/BaseMaterial/MeshObject/BuildItem in `src/types/threemf.ts`
- [x] T006 Create project directory structure per plan.md: `src/app/`, `src/components/`, `src/workers/`, `src/lib/`, `src/data/`, `src/stores/`, `src/types/`, `tests/unit/`, `tests/integration/`, `public/sample-images/`
- [x] T007 [P] Create root layout with navigation header (Home / Filament Library links) in `src/app/layout.tsx`
- [ ] T008 [P] Add sample test images to `public/sample-images/` (a simple gradient JPEG and a color-block PNG for development testing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core computation libraries that ALL user stories depend on. No UI — pure TypeScript modules with no DOM dependencies so they work in both main thread and Web Workers.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Implement Beer-Lambert forward color model in `src/lib/td-model.ts`: per-channel transmittance function `T_c(h) = (color_c / 255) ^ (h / TD)`, stack forward model computing perceived RGB from N layers, and precomputed transmittance lookup table generator for discretized height values
- [x] T010 [P] Implement color utility functions in `src/lib/color-utils.ts`: RGB to CIELAB conversion, CIELAB to RGB conversion, ΔE (CIE76) distance calculation, and hex string to/from RGB array conversion
- [x] T011 Implement TD inverse solver in `src/lib/td-model.ts`: given target RGB, N filaments (ordered), and total height H, find optimal per-layer heights minimizing ΔE using grid search over discretized heights (quantized to 0.04mm), enforcing `sum(heights) = totalHeight` invariant and `heights[i] >= 0` constraint
- [x] T012 [P] Implement image processing utilities in `src/lib/image-processing.ts`: pixel sampling from ImageData at configurable XY resolution, brightness/contrast adjustment, large image downsampling with user-configurable max dimension, and PNG transparency handling (map to background color)
- [x] T013 Implement mesh builder in `src/lib/mesh-builder.ts`: convert 2D height-field grid into per-layer triangle meshes (MeshLayer[]), anchor top face at constant `totalHeight` Z, vary bottom face per cell, generate manifold geometry with consistent winding, and produce vertices/triangles as typed arrays (Float32Array / Uint32Array)
- [x] T014 Implement 3MF writer in `src/lib/threemf-writer.ts`: assemble `[Content_Types].xml`, `_rels/.rels`, and `/3D/3dmodel.model` using fast-xml-parser XMLBuilder; generate `<basematerials>` with filament names including material type (e.g., "PLA Galaxy Black") and accurate hex `displaycolor`; create one `<object>` per layer with `pid`/`pindex` referencing basematerials; compose via `<components>` into assembly object; order materials to match intended AMS slot mapping; package as ZIP using JSZip; return Blob
- [x] T015 Implement Dexie database schema and filament store in `src/stores/filament-store.ts`: define `filaments` table with indexes on `id` and `brand`, implement CRUD operations (getAll, getById, add, update, delete), implement first-load seed logic that imports `src/data/default-filaments.json` into IndexedDB if table is empty
- [x] T016 [P] Curate default filament database in `src/data/default-filaments.json`: 50-100 entries sourced from community TD databases (HueForge community sheets), each with name, brand, material type, colorHex, and TD value; focus on Bambu Lab, Polymaker, Hatchbox, eSUN, and Prusament brands

**Checkpoint**: All core libraries ready. User story implementation can now begin.

---

## Phase 3: User Story 1 — Generate a Flat-Top 3MF from an Image (Priority: P1) MVP

**Goal**: A user uploads an image, selects filaments, and downloads a valid 3MF file with flat top surface and correct multi-material assignment for BambuStudio.

**Independent Test**: Upload a gradient image, select 2-3 filaments, generate 3MF, open in BambuStudio, verify flat top + correct materials + AMS slot mapping.

### Implementation for User Story 1

- [x] T017 [US1] Create ImageUploader component in `src/components/image-uploader.tsx`: drag-and-drop zone + file picker button, accept JPEG/PNG only, decode via `createImageBitmap`, downsample images >4096px with confirmation dialog, display uploaded image, emit `{ imageBitmap, width, height }` on success, show error states for invalid format/decode failure
- [x] T018 [US1] Create FilamentStackEditor component in `src/components/filament-stack-editor.tsx`: load available filaments from filament store, ordered list of selected filaments (2-8 slots), drag-to-reorder support, each slot displays color swatch + name + TD value, add/remove slot buttons, emit `{ stack: FilamentProfile[], layerCount: number }` on change
- [x] T019 [US1] Create HeightSlider component in `src/components/height-slider.tsx`: range input 0.5mm–10.0mm, step 0.1mm, default 3.0mm, display current value with "mm" unit label
- [x] T020 [US1] Create GenerateButton component in `src/components/generate-button.tsx`: disabled when config invalid (no image or <2 filaments), shows progress bar during generation (phases: td-compute → mesh-generate → xml-build → zip-package with percentage), triggers `saveAs(blob, "model.3mf")` via file-saver on completion, error state display
- [x] T021 [US1] Implement generation Web Worker in `src/workers/compute.worker.ts`: accept `generate-3mf` message with image ArrayBuffer + filament data + config, run TD solver on full grid (using `src/lib/td-model.ts`), run mesh builder (using `src/lib/mesh-builder.ts`), run 3MF writer (using `src/lib/threemf-writer.ts`), post `generate-progress` messages at each phase, post `generate-result` with Blob on completion, post `error` on failure
- [x] T022 [US1] Create generation state management in `src/stores/generation-store.tsx`: React context or Zustand store holding GenerationConfig state (image, filament stack, totalHeight, xyResolution, layerCount, minLayerHeight, brightness, contrast, backgroundColor), generation pipeline state (IDLE → IMAGE_LOADED → CONFIGURED → COMPUTING → GENERATING_3MF → COMPLETE), worker instance management (create, terminate, message handling), validation logic (isConfigValid computed property)
- [x] T023 [US1] Build main generator page in `src/app/page.tsx`: three-panel layout per UI contract (Image Panel left, Controls Panel right sidebar, Advanced Panel collapsible), compose ImageUploader + FilamentStackEditor + HeightSlider + GenerateButton, wire all components to generation store, handle worker lifecycle (instantiate on mount, terminate on unmount)

**Checkpoint**: User Story 1 complete. Users can upload an image, select filaments, generate and download a valid flat-top 3MF file. Open in BambuStudio to verify.

---

## Phase 4: User Story 2 — Live Preview of TD Color Result (Priority: P2)

**Goal**: Users see a real-time 2D color preview approximating the printed result as they adjust parameters.

**Independent Test**: Upload an image, select filaments, observe preview. Change filament order or total height and verify preview updates within 500ms.

### Implementation for User Story 2

- [x] T024 [US2] Implement preview Web Worker in `src/workers/compute.worker.ts`: accept `compute-preview` message with image ArrayBuffer + filament data + config, run TD forward model per pixel at configured XY resolution, generate preview RGBA ArrayBuffer (transferable), compute stats (avgDeltaE, maxDeltaE, computeTimeMs), post `preview-result` message, post `error` on failure
- [x] T025 [US2] Create ColorPreview component in `src/components/color-preview.tsx`: side-by-side canvas layout showing original image + predicted TD result, render preview ArrayBuffer from worker onto canvas, zoom and pan support via mouse drag + scroll wheel, optional ΔE heatmap overlay highlighting poor color match regions, display stats (avg ΔE, compute time)
- [x] T026 [US2] Integrate preview into generation store in `src/stores/generation-store.tsx`: add preview worker instance management, add PREVIEW_READY state to pipeline, trigger preview recomputation on any config change (debounced 200ms), add preview result data (ArrayBuffer, stats) to store state
- [x] T027 [US2] Wire ColorPreview into main page in `src/app/page.tsx`: add ColorPreview component to Image Panel (below/alongside uploaded image), connect to generation store preview state, show loading spinner during preview computation, show "Preview unavailable" when config is incomplete

**Checkpoint**: User Stories 1 AND 2 both work. Users see live preview and can generate 3MF files.

---

## Phase 5: User Story 3 — Filament Library Management (Priority: P3)

**Goal**: Users manage a persistent personal filament library with CRUD operations and import/export.

**Independent Test**: Add a custom filament, close browser, reopen, verify persistence. Edit TD value, generate 3MF, confirm output reflects the update.

### Implementation for User Story 3

- [x] T028 [US3] Build filament library page in `src/app/filaments/page.tsx`: search/filter bar (text search by name/brand, dropdown filter by material type), scrollable filament list as table/cards (name, brand, color swatch, TD value, edit/delete actions), "Add Filament" button opening modal form
- [x] T029 [US3] Create filament add/edit form component in `src/components/filament-form.tsx`: modal dialog with fields for name, brand, material type dropdown (PLA/PETG/ABS/ASA/TPU/Other), color hex input with color picker, TD value numeric input with validation (>0), save/cancel buttons, form validation with error messages
- [x] T030 [P] [US3] Implement filament import/export in `src/components/filament-import-export.tsx`: "Export Library" button generating JSON file per export schema (version, exportedAt, filaments array without internal fields), "Import Library" button with file picker accepting .json, parse and validate import data, duplicate detection by name+brand+colorHex, merge prompt for duplicates, trigger download via file-saver for export
- [x] T031 [US3] Wire filament CRUD to Dexie store: connect filament library page to `src/stores/filament-store.ts`, implement add → Dexie put, edit → Dexie update, delete → Dexie delete with confirmation dialog, refresh list reactively on mutations

**Checkpoint**: All user stories 1-3 work independently. Filament library persists and feeds into generation.

---

## Phase 6: User Story 4 — Advanced Parameter Configuration (Priority: P4)

**Goal**: Power users access advanced settings: XY resolution, layer count, min layer height, brightness/contrast.

**Independent Test**: Change XY resolution to 0.25mm, generate, verify finer mesh. Adjust brightness, verify preview + output reflect the change.

### Implementation for User Story 4

- [x] T032 [US4] Create ResolutionSelector component in `src/components/resolution-selector.tsx`: dropdown with options 0.25mm, 0.5mm (default), 1.0mm, 2.0mm, display estimated grid dimensions (e.g., "400×400 cells" based on image size / resolution)
- [x] T033 [US4] Create advanced settings panel in `src/components/advanced-settings.tsx`: collapsible panel (hidden by default), brightness slider (-100 to 100, default 0), contrast slider (-100 to 100, default 0), layer count selector (2-8, default matching filament stack length), min layer height input (0.00-0.20mm, default 0.04mm), background color picker for PNG transparency
- [x] T034 [US4] Wire advanced settings into generation store and main page: connect ResolutionSelector and advanced panel to `src/stores/generation-store.ts`, integrate brightness/contrast into image processing pipeline (applied before TD computation in both preview and generation workers), update preview and generation workers to accept all advanced parameters

**Checkpoint**: All 4 user stories independently functional. Full parameter control available.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality improvements affecting multiple user stories

- [x] T035 [P] Add edge case handling for single-filament selection in `src/lib/td-model.ts`: produce valid single-material flat slab, skip TD computation, generate uniform-height 3MF
- [x] T036 [P] Add edge case handling for negative layer heights in `src/lib/td-model.ts`: clamp to zero when target color requires more TD than total height allows, flag affected cells with high ΔE
- [x] T037 [P] Add large image warning in `src/components/image-uploader.tsx`: detect images >4096px, show confirmation dialog with estimated processing time, offer downsampling options
- [x] T038 [P] Add loading and error states across all pages: skeleton loaders during filament store initialization, error boundaries for worker failures, user-friendly error messages for all failure modes
- [x] T039 Perform BambuStudio import validation: generate 3MF files with 2, 3, 4, and 8 filaments, import each into BambuStudio, verify correct object count, material assignments, AMS slot mapping, and flat-top geometry
- [x] T040 [P] Add responsive layout adjustments in `src/app/layout.tsx` and `src/app/page.tsx`: ensure usable layout at 1280px minimum width, proper panel sizing and scrolling at various desktop resolutions
- [x] T041 Run `npm run build` static export and verify the `out/` directory serves correctly from a simple static server, confirming all worker bundles load, filament DB initializes, and full generation pipeline works in production build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion (project initialized, deps installed, types defined) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (all core libs ready)
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; can run in parallel with US1 but preview is more useful after US1 UI exists
- **User Story 3 (Phase 5)**: Depends on Phase 2 (filament store); can run in parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on US1 (main page exists) + US2 (preview exists)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 foundational libs — no other story dependencies
- **US2 (P2)**: Depends on Phase 2 foundational libs — independent from US1 but integrates into same page
- **US3 (P3)**: Depends on Phase 2 filament store — fully independent page
- **US4 (P4)**: Depends on US1 main page layout + US2 preview pipeline existing

### Within Each User Story

- Components before page composition
- Store updates before component wiring
- Workers before components that use them

### Parallel Opportunities

**Phase 1**:
- T003 (Tailwind/shadcn), T004 (Vitest), T005 (types), T007 (layout), T008 (sample images) — all parallel

**Phase 2**:
- T009 (td-model forward) and T010 (color-utils) — parallel (different files)
- T010 (color-utils) and T012 (image-processing) and T016 (filament data) — all parallel
- T011 (td-model inverse) depends on T009 + T010
- T013 (mesh-builder) depends on T011
- T014 (3mf-writer) depends on T013
- T015 (filament-store) and T016 (filament data) — parallel with each other and with T009-T014

**Phase 3 (US1)**:
- T017 (ImageUploader), T018 (FilamentStackEditor), T019 (HeightSlider), T020 (GenerateButton) — all parallel (different component files)
- T021 (generator worker) depends on Phase 2 libs
- T022 (generation store) can parallel with T017-T020
- T023 (main page) depends on T017-T022

**Phase 5 (US3)**:
- Can run entirely in parallel with Phase 3/4 (separate page, separate components)

**Phase 7**:
- T035, T036, T037, T038, T040 — all parallel (different files/concerns)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Generate 3MF, open in BambuStudio, verify flat-top + materials
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test in BambuStudio → Deploy (MVP!)
3. Add US2 → Live preview working → Deploy
4. Add US3 → Filament management → Deploy
5. Add US4 → Advanced controls → Deploy
6. Polish → Edge cases, validation, production build → Release v1.0

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- All core `lib/` modules have NO DOM dependencies — importable from Web Workers
- BambuStudio is the primary 3MF validation target; test every generated file there

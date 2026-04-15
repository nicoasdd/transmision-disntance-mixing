# Feature Specification: Flat-Top 3MF Generator

**Feature Branch**: `001-flat-top-3mf-generator`
**Created**: 2026-04-15
**Status**: Draft
**Input**: User description: "Web-based project to generate HueForge-like files in 3MF format with a flat top layer. Uses Transmission Distance (TD) to generate a range of colors, but the top layer stays at a uniform height while the initial (bottom) layer compensates with varying heights. Must be 3MF because each layer contains multiple colors (impossible with STL). Prefers Next.js for single deployment. All computation must run client-side."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a Flat-Top 3MF from an Image (Priority: P1)

A user uploads a raster image (photo, illustration, or graphic) and selects filaments from a list. The system analyzes the image pixel-by-pixel, maps each pixel's color to a filament stack using TD values, and produces a downloadable 3MF file where the top surface is perfectly flat and the bottom surface varies in height to achieve the desired color mixing.

**Why this priority**: This is the core value proposition of the entire application. Without this, nothing else matters. A user who can upload an image and get a valid 3MF file has a complete, usable tool.

**Independent Test**: Upload a simple gradient image, select 2-3 filaments, click generate, open the resulting 3MF in PrusaSlicer/OrcaSlicer/BambuStudio, and verify that (a) the top surface is flat, (b) different regions show different bottom-layer heights, and (c) material assignments are correct per layer.

**Acceptance Scenarios**:

1. **Given** a user on the main page, **When** they upload a JPEG/PNG image, **Then** the image is displayed in the workspace and the system is ready for filament selection.
2. **Given** an uploaded image and at least two filaments selected, **When** the user clicks "Generate 3MF", **Then** the system computes the layer geometry entirely in the browser and produces a downloadable `.3mf` file.
3. **Given** a generated 3MF file, **When** opened in PrusaSlicer, OrcaSlicer, or BambuStudio, **Then** it imports without errors, shows correct material assignments, and the top surface is at a uniform Z height across the entire model.
4. **Given** a generated 3MF file, **When** the user inspects the model in a slicer, **Then** each XY position has a total stack height equal to the user-defined constant, with the bottom layer height varying to produce the intended color through TD.

---

### User Story 2 - Live Preview of TD Color Result (Priority: P2)

As a user adjusts parameters (filament selection, layer count, total height, image crop/scale), they see a real-time 2D color preview showing the approximate printed result based on the TD model. This allows iterative tuning before committing to a 3MF generation.

**Why this priority**: Without a preview, users must generate, download, open in a slicer, and visually inspect every time they tweak a setting. This feedback loop is too slow. A live preview dramatically reduces wasted iterations.

**Independent Test**: Upload an image, select filaments, and observe that changing filament order or total height immediately updates the color preview. Verify the preview approximates the expected printed colors (comparing against known TD values).

**Acceptance Scenarios**:

1. **Given** an uploaded image and selected filaments, **When** the user views the workspace, **Then** a 2D color preview is displayed showing the expected printed appearance based on the current TD calculations.
2. **Given** the preview is visible, **When** the user changes the filament order or swaps a filament, **Then** the preview updates within 500ms for images up to 1024x1024 pixels.
3. **Given** the preview is visible, **When** the user adjusts the total model height, **Then** the preview recalculates TD-based colors and updates in real time, reflecting how height changes affect color intensity.

---

### User Story 3 - Filament Library Management (Priority: P3)

A user manages a personal filament library containing filament names, brands, colors, and TD values. They can add filaments manually, edit existing entries, and delete unused ones. The library persists across sessions so users do not need to re-enter data.

**Why this priority**: The system needs filament TD data to function, but for the MVP a hardcoded default set suffices. A full management interface adds convenience and personalization but is not blocking for core functionality.

**Independent Test**: Add a custom filament with specific TD value and color, close and reopen the browser, verify the filament persists. Edit its TD value, generate a 3MF, and confirm the output reflects the updated value.

**Acceptance Scenarios**:

1. **Given** the filament library page, **When** a user adds a new filament with name, brand, color, and TD value, **Then** the filament appears in the library and is available for selection during generation.
2. **Given** an existing filament in the library, **When** the user edits its TD value, **Then** subsequent generations and previews use the updated value.
3. **Given** a filament library with entries, **When** the user closes the browser and returns later, **Then** all previously saved filaments are still present.

---

### User Story 4 - Advanced Parameter Configuration (Priority: P4)

A power user accesses advanced settings to fine-tune the generation process: XY resolution (mm per pixel), number of color layers, minimum/maximum layer heights, and brightness/contrast adjustments on the source image before TD computation.

**Why this priority**: Defaults should work for most cases, but experienced users need control for edge cases (very detailed images, unusual filament combinations, specific printer capabilities). This is progressive disclosure — available but not required.

**Independent Test**: Change XY resolution from default to a finer value, generate 3MF, and verify the output mesh has more triangles/detail. Adjust brightness and confirm the preview and generated file reflect the change.

**Acceptance Scenarios**:

1. **Given** an uploaded image, **When** the user opens advanced settings and changes XY resolution to 0.25mm, **Then** the generated 3MF has approximately 4x the geometric detail compared to the default 0.5mm resolution.
2. **Given** an uploaded image, **When** the user adjusts brightness/contrast sliders, **Then** the preview updates to reflect the adjusted image before TD computation is applied.
3. **Given** advanced settings open, **When** the user modifies the number of color layers, **Then** the system recalculates the layer stack and updates both the preview and the 3MF output accordingly.

---

### Edge Cases

- What happens when the uploaded image is extremely large (e.g., 8000x8000 pixels)? The system MUST either downsample to a manageable resolution or warn the user about expected processing time.
- How does the system handle an image region where no filament combination can match the target color? The system MUST select the closest achievable color and optionally highlight these regions in the preview.
- What happens if the user selects only one filament? The system MUST still produce a valid 3MF — effectively a single-material flat slab with uniform bottom height (no TD color variation possible).
- What happens if the computed bottom layer height would be negative (target color requires more TD than the total height allows)? The system MUST clamp to zero and flag the affected regions.
- How does the system handle transparent or semi-transparent areas in PNG images? The system MUST treat transparency as "no print" or map to a user-configurable background color.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept raster image uploads in JPEG and PNG formats, with dimensions up to at least 4096x4096 pixels.
- **FR-002**: System MUST allow the user to select between 2 and 8 filaments from a library for a single generation job.
- **FR-003**: System MUST compute, for each pixel/cell in the discretized image, the optimal filament layer stack that best reproduces the target color using a TD-based color model.
- **FR-004**: System MUST generate a 3MF file where the top surface of the model is at a uniform Z height across all XY positions.
- **FR-005**: System MUST generate a 3MF file where each color layer is represented as a separate object with correct material assignment using the 3MF Materials and Properties Extension.
- **FR-006**: System MUST perform all image processing, TD computation, and 3MF file assembly entirely in the browser without server-side computation.
- **FR-007**: System MUST provide a real-time 2D color preview that approximates the printed result based on current TD calculations and selected filaments.
- **FR-008**: System MUST allow users to define the total model height (the constant Z value for the flat top surface).
- **FR-009**: System MUST persist the user's filament library across browser sessions.
- **FR-010**: System MUST ship with a default filament database containing TD values for commonly available filament brands and colors.
- **FR-011**: System MUST allow users to add, edit, and delete custom filament entries (name, brand, hex color, TD value).
- **FR-012**: System MUST support configurable XY resolution (mm per pixel) for the generated mesh.
- **FR-013**: Generated 3MF files MUST import without errors in PrusaSlicer, OrcaSlicer, and BambuStudio.
- **FR-014**: System MUST handle edge cases where no filament combination can match a target color by selecting the closest achievable match.
- **FR-015**: System MUST allow the user to configure the number of color layers in the stack.

### Key Entities

- **Filament Profile**: Represents a physical filament spool. Attributes: name, brand, hex color (as seen when printed thin/thick), TD value (mm), opacity characteristics. A filament profile is the fundamental input for TD calculations.
- **Generation Job**: Represents a single image-to-3MF conversion session. Attributes: source image, selected filaments (ordered stack), total model height, XY resolution, number of color layers, output 3MF. A job references multiple filament profiles.
- **Layer Stack**: For each discretized XY cell, the computed arrangement of filament layers from bottom to top. Attributes: per-layer filament assignment, per-layer height. The bottom layer height varies; the sum of all layer heights equals the constant total height.
- **3MF Package**: The output artifact. Contains one mesh object per color layer, material definitions, and build metadata conforming to the 3MF specification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no prior experience with the tool can upload an image, select filaments, and download a valid 3MF file within 5 minutes of first visit.
- **SC-002**: Generated 3MF files import without errors in PrusaSlicer, OrcaSlicer, and BambuStudio for 100% of test cases.
- **SC-003**: The color preview updates within 500ms of any parameter change for images up to 1024x1024 pixels on a mid-range device.
- **SC-004**: 3MF generation for a 200x200mm model at 0.5mm XY resolution completes within 30 seconds on a mid-range device.
- **SC-005**: The top surface of every generated model is verifiably flat (Z-height variance < 0.001mm across all vertices) when inspected in a slicer.
- **SC-006**: Color accuracy of the TD model matches reference prints within a Delta-E of 10 for standard filament combinations (validated against physical test prints).
- **SC-007**: The filament library persists correctly across 100% of browser restart cycles without data loss.

## Assumptions

- Target users are hobbyist 3D printer owners who are familiar with concepts like filaments, slicing, and multi-color printing, but have no CAD or programming expertise.
- Users have a multi-material-capable 3D printer (e.g., Bambu Lab AMS, Prusa MMU, Palette) or are printing with manual filament swaps.
- The application will be built with Next.js to enable single-deployment hosting (static export or serverless), as explicitly requested by the user.
- All heavy computation (image processing, TD color mapping, mesh generation, 3MF packaging) runs client-side in the browser; the server only serves static assets.
- Initial filament TD data will be sourced from community databases (e.g., HueForge community TD sheets) and bundled as a default dataset.
- Mobile support is not a priority for v1; the application targets desktop browsers with screens >= 1280px wide.
- No user accounts or authentication are needed for v1; all data (filament library, settings) is stored in browser local storage.
- The 3MF output targets FDM printers; resin/SLA workflows are out of scope.
- WebP and SVG image formats are out of scope for v1; only JPEG and PNG are supported.

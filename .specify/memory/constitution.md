<!--
## Sync Impact Report
- **Version change**: 1.0.0 → 1.1.0
- **Modified principles**:
  - III. 3MF Output Compliance → BambuStudio-primary target added
- **Added sections**: None
- **Removed sections**: None
- **Templates requiring updates**:
  - `.specify/templates/plan-template.md` — ✅ No updates needed (generic)
  - `.specify/templates/spec-template.md` — ✅ No updates needed (generic)
  - `.specify/templates/tasks-template.md` — ✅ No updates needed (generic)
- **Follow-up TODOs**: None
-->

# TD Color Mixing Constitution

## Core Principles

### I. Flat-Top Invariant (NON-NEGOTIABLE)

The generated 3D model MUST maintain a perfectly flat top surface across the
entire print. Color variation is achieved exclusively by modulating the height
of the bottom (initial) layer. The total stack height at every XY coordinate
MUST equal a single, user-defined constant. Any algorithm that produces
varying top-surface heights is a defect.

**Rationale**: This is the core differentiator from HueForge. A flat top
surface enables use cases like signage, coasters, and panels where surface
uniformity is required. Violating this invariant defeats the project's purpose.

### II. TD Color Fidelity

All color calculations MUST be grounded in a physically plausible Transmission
Distance (TD) model. The system MUST use filament TD values (sourced from
community databases or user-provided measurements) to compute the expected
perceived color for a given layer stack. Approximations are acceptable only
when documented and their error bounds are stated.

**Rationale**: Inaccurate TD modeling leads to prints that don't match the
preview, wasting filament and time. Users trust the tool to predict outcomes.

### III. 3MF Output Compliance (BambuStudio-Primary)

All generated files MUST conform to the 3MF Core Specification (version 1.x)
and the 3MF Materials and Properties Extension. **BambuStudio is the primary
target slicer**; the output MUST import without errors and map cleanly to AMS
filament slots in BambuStudio. Compatibility with PrusaSlicer and OrcaSlicer
is desirable but MUST NOT compromise BambuStudio workflows. Multi-body
assembly via `<components>` with `basematerials` `pid`/`pindex` is the
required approach for material assignment. Proprietary attributes (e.g.,
`paint_color`) MUST NOT be used.

**Rationale**: The primary user runs a Bambu Lab printer with AMS. Optimizing
for BambuStudio's import behavior, filament slot mapping, and AMS workflow
produces the best first-use experience. The 3MF Core + Materials Extension
approach is natively supported by BambuStudio and remains compatible with
other slicers. BambuStudio's Color Mixing feature (V2.5.3+) is complementary
— it blends filaments on vertical walls, while our TD approach handles top
surfaces. Future versions MAY integrate with mixed filament slots to expand
the achievable color gamut.

### IV. Web-First Delivery

The application MUST run entirely in the browser with no server-side
processing required for file generation. All image processing, TD computation,
and 3MF assembly MUST execute client-side. A server MAY be used for hosting
static assets and optional features (e.g., filament database sync), but the
core pipeline MUST work offline after initial load.

**Rationale**: Client-side execution removes infrastructure costs, latency,
and privacy concerns about user images. It also enables offline use and
simpler deployment.

### V. Real-Time Visual Feedback

The UI MUST provide a live preview that approximates the final printed result
as the user adjusts parameters (image, filament selection, layer count, total
height). Preview updates MUST complete within 500ms for images up to
1024x1024 pixels on a mid-range device. The preview MUST visually
distinguish the flat top surface from the varying bottom geometry.

**Rationale**: Iterative tuning is essential for good results. Without fast
feedback, users resort to trial-and-error printing, which is slow and
wasteful.

### VI. Simplicity & Accessibility

The interface MUST be usable by someone who understands basic 3D printing
concepts (layers, filament, slicing) but has no programming or CAD
experience. Default settings MUST produce a reasonable result for common
use cases. Advanced options (custom TD values, resolution overrides, manual
layer mapping) MUST be available but hidden behind progressive disclosure.

**Rationale**: The target audience is hobbyist 3D printer owners, not
software engineers. A steep learning curve limits adoption.

## Technical Constraints

- **Stack**: TypeScript with a modern frontend framework (React, Svelte, or
  Vue). 3MF generation via client-side libraries (JSZip for packaging,
  XML builder for 3MF model data).
- **Image Processing**: Canvas API or WebAssembly-based pipeline for pixel
  sampling and TD computation. WebGL/WebGPU MAY be used for preview
  rendering.
- **3MF Structure**: Each color layer MUST be represented as a separate
  object or build item within the 3MF package. Material assignments MUST
  use the Materials and Properties Extension `<basematerials>` element.
- **Filament Data**: The system MUST ship with a default TD database for
  common filaments. Users MUST be able to add, edit, and export custom
  filament profiles. Filament data format MUST be JSON for portability.
- **Performance**: 3MF generation for a 200x200mm model at 0.5mm XY
  resolution MUST complete within 30 seconds on a mid-range device.
- **Browser Support**: Latest two major versions of Chrome, Firefox, Safari,
  and Edge.

## Development Workflow

- **Branching**: Feature branches off `main`; merged via pull request.
- **Code Quality**: Linting and formatting enforced in CI. Type-checking
  MUST pass with strict TypeScript configuration.
- **Testing**: Unit tests for TD calculations and 3MF output validation.
  Integration tests MUST verify generated 3MF files parse correctly.
  Visual regression tests for preview rendering are recommended but not
  mandatory for v1.
- **Releases**: Semantic versioning. Each release MUST include a CHANGELOG
  entry. Breaking changes to exported 3MF structure require a MAJOR bump.
- **Documentation**: A quickstart guide MUST be maintained. API/internal
  docs are encouraged but not gated.

## Governance

This constitution is the authoritative guide for architectural and process
decisions in the TD Color Mixing project. All pull requests and code reviews
MUST verify compliance with the Core Principles. Deviations require explicit
justification documented in the PR description and approved by a maintainer.

Amendments to this constitution follow semantic versioning:
- **MAJOR**: Removing or fundamentally redefining a principle.
- **MINOR**: Adding a new principle or materially expanding guidance.
- **PATCH**: Clarifications, typo fixes, non-semantic refinements.

Every amendment MUST update the version, date, and Sync Impact Report.

**Version**: 1.1.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15

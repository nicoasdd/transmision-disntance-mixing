# Research: Flat-Top 3MF Generator

**Date**: 2026-04-15
**Feature**: 001-flat-top-3mf-generator

## R1: 3MF Multi-Material File Structure

### Decision
Use the **3MF Core Specification + Materials and Properties Extension** with
**one `<object>` per color layer** (multi-body approach), packaged as a
standard OPC ZIP with `basematerials` for material assignment.

### Rationale
- Multi-body (separate `<object>` per layer) is the **most portable** approach
  for slicer MMU/AMS material assignment. Slicers treat each object as a
  separate printable body with its own material slot.
- Triangle-level `pid`/`p1` works in some slicers but is less universally
  supported for filament-level assignment — better suited for "paint" workflows.
- `basematerials` is simpler and more reliable than `multiproperties` or
  `colorgroup` across all target slicers.

### Alternatives Considered
- **Single mesh with per-triangle materials**: Works in PrusaSlicer paint mode
  but less intuitive for MMU workflows. Rejected because our model has clear
  layer boundaries that map naturally to separate bodies.
- **3MF Production Extension**: Used by BambuStudio by default. Rejected as
  primary format because PrusaSlicer/OrcaSlicer support varies; we use classic
  single-root Core packaging for maximum interoperability.

### Key Technical Details
- Package structure: `[Content_Types].xml`, `_rels/.rels`,
  `/3D/3dmodel.model`
- Root element: `<model>` with core namespace + materials namespace
- `<resources>`: `<basematerials id="1">` with one `<base>` per filament
- `<resources>`: N `<object>` elements, each with a `<mesh>`, each referencing
  its material via `pid`/`pindex`
- `<build>`: One `<item>` per object with optional `transform` for Z stacking
- All meshes MUST be manifold with consistent winding
- Always set object-level `pid`/`pindex` as fallback

### Libraries
- **JSZip** (3.10.x): OPC ZIP container assembly
- **fflate** (0.8.x): Alternative if performance profiling shows ZIP is a
  bottleneck
- **fast-xml-parser** (5.x): `XMLBuilder` for emitting 3MF XML
- No 3MF-specific client-side generation library is mature enough; custom XML
  assembly via fast-xml-parser is the most reliable path

### Slicer Compatibility Notes
- **BambuStudio (PRIMARY)**: Reads Core format natively. Multi-body +
  `basematerials` maps directly to per-part filament assignment and AMS
  slots. See R4 for detailed BambuStudio behavior.
- **PrusaSlicer 2.7.2+**: Multi-object import behavior changed; users may need
  to group objects. Secondary target — test but don't compromise BambuStudio.
- **OrcaSlicer**: Fork of PrusaSlicer; behaves similarly. Secondary target.
- Avoid Unicode/punctuation in metadata names (breaks some parsers).

---

## R4: BambuStudio 3MF Deep Dive — Multi-Material & AMS

**Date**: 2026-04-15

### 1. BambuStudio's 3MF Production Extension

BambuStudio (since v1.8.3) defaults to the **3MF Production Extension** (v1.2)
from the 3MF Consortium instead of the 3MF Core single-file layout.

**Key difference from Core**: Instead of one `3D/3dmodel.model` containing all
geometry, the Production Extension splits actual mesh data into separate files
under `3D/Objects/`, with the root model file containing only metadata,
references, and build items.

**Root model file** (`3D/3dmodel.model`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"
  xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"
  requiredextensions="p">
 <metadata name="Application">BambuStudio-02.00.01.50</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="CreationDate">2026-04-15</metadata>
 <!-- ... other metadata ... -->
 <resources>
  <!-- Top-level objects reference sub-objects in external files via components -->
  <object id="20" type="model">
   <components>
    <component objectid="1" p:path="/3D/Objects/object_104.model"
      transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
    <component objectid="2" p:path="/3D/Objects/object_104.model"
      transform="..."/>
    <!-- Each component references a sub-object in a separate model file -->
   </components>
  </object>
 </resources>
 <build>
  <item objectid="20" p:UUID="..." transform="..."/>
 </build>
</model>
```

**External model files** (`3D/Objects/object_N.model`): Contain the actual
mesh data — `<vertices>` and `<triangles>` — for sub-objects. Each sub-object
has its own `<object id="N" type="model|other">` element with a `<mesh>`.

**Key XML attributes from Production Extension**:
- `p:path` on `<component>` — references an external model file
- `p:UUID` on `<item>` and `<object>` — unique identifiers for build items
- Namespace: `http://schemas.microsoft.com/3dmanufacturing/production/2015/06`
- `requiredextensions="p"` on root `<model>` — declares dependency

**Performance benefit**: Multiple model files can be read/written in parallel,
significantly faster for complex multi-plate projects.

**Compatibility impact**: PrusaSlicer merged Production Extension support in
March 2024. Cura patch was submitted but unmerged as of 2025. Our generator
should use Core (single file) for maximum compatibility but understand
Production Extension for future optimization.

### 2. Multi-Material Assignment in BambuStudio

BambuStudio supports **three mechanisms** for assigning filaments/materials,
used in combination:

#### A. Per-Object / Per-Part Filament Assignment (primary)
Each `ModelObject` and each `ModelVolume` (part/body) can be assigned an
**extruder index** (1-based, maps to filament slot). This is the primary
method for multi-material printing.

In the internal data model:
- `ModelObject::config` stores `extruder` key (1-based filament index)
- `ModelVolume::config` stores per-volume `extruder` override

In the 3MF, this is stored in `Metadata/model_settings.config`:
```xml
<config>
 <object id="2">
  <metadata key="name" value="part_name.stl"/>
  <metadata key="extruder" value="2"/>
  <part id="0" subtype="normal_part">
   <metadata key="name" value="body_1"/>
   <metadata key="extruder" value="1"/>
  </part>
  <part id="1" subtype="normal_part">
   <metadata key="name" value="body_2"/>
   <metadata key="extruder" value="3"/>
  </part>
 </object>
</config>
```

The extruder value is a **1-based index** into the project's filament list.

#### B. Per-Triangle Color Painting
BambuStudio's **Color Painting tool** uses a triangle subdivision approach
(inherited from PrusaSlicer) that splits mesh triangles and assigns a filament
index per sub-triangle. This data is stored as a `paint_color` attribute on
`<triangle>` elements in the model XML:

```xml
<triangle v1="0" v2="1" v3="2" paint_color="2"/>
```

**Critical compatibility note**: BambuStudio uses `paint_color` **without** an
XML namespace prefix, which technically violates the 3MF spec requirement that
extensions use namespace prefixes. PrusaSlicer uses the spec-compliant
`slic3rpe:mmu_segmentation` attribute for the same purpose. These are
**incompatible** — each slicer only reads its own attribute name.

The underlying serialization format is documented in PrusaSlicer's
`TriangleSelector::serialize()` / `deserialize()` methods — it encodes a tree
of triangle subdivisions with material indices.

#### C. Component-Based Multi-Body (what we should use)
The most robust approach: separate `<object>` elements (each with its own
mesh) composed into an assembly via `<components>`. Each object carries its
own `pid`/`pindex` material reference. BambuStudio treats each component as
an independently colorable body in the object tree.

**Recommendation for our generator**: Use approach **A + C** — multiple
`<object>` elements (one per color layer), each assigned a `basematerials`
material via `pid`/`pindex`, assembled via `<components>`. This maps cleanly
to BambuStudio's per-part extruder assignment and avoids the non-standard
`paint_color` attribute.

### 3. AMS Filament Slot Mapping

When sending a print to a Bambu Lab printer, BambuStudio maps project
filament slots to physical AMS slots using a **priority-based algorithm**:

1. **Filament type matching (first priority)**: Major category (PLA, PETG,
   ABS, etc.) and specific model (e.g., PLA Basic vs PLA Matte) must match.
   Different models have different flow rates and temperature requirements.

2. **Color matching (second priority)**: After confirming types match, the
   system compares hex color codes — first seeking exact matches, then
   approximate color families.

**How filament slots work in the 3MF**:
- The project filament list is stored as parallel arrays in
  `Metadata/project_settings.config` (JSON):
  ```json
  {
    "filament_colour": ["#D1B2EC", "#443089", "#A03CF7", "#FFFFFF"],
    "filament_type": ["PLA", "PLA", "PLA", "PLA"],
    "filament_cost": ["24.52", "24.52", "29.99", "24.15"]
  }
  ```
- Each array index = filament slot (0-based in JSON, but extruder references
  in model config are 1-based).
- Object extruder assignment (`"extruder": "2"`) maps to `filament_colour[1]`
  (the second color).

**Best practices for clean AMS mapping**:
- Use **distinct filament types** per slot when possible (don't put two
  identical PLA types in different slots expecting the mapper to distinguish)
- Set **accurate hex color codes** — the mapper uses these for matching
- Set **filament type** correctly — this is the primary matching criterion
- When generating 3MF files, define filaments in the order they should map
  to AMS slots (slot 1 = index 0, slot 2 = index 1, etc.)

**Known issues**:
- Multiple AMS slots with identical type+color: BambuStudio may default to
  the first matching slot regardless of the intended assignment
- Manual remapping is sometimes required on the print submission screen
- If multi-device management is enabled, automatic mapping is disabled

### 4. Filament Mixing / Blending

**BambuStudio does NOT support filament mixing or blending.**

There is no:
- API for defining mixed colors from multiple AMS slots
- 3MF extension for mixing ratios
- Half-tone / dithering / alternating-layer color blending feature

A feature request exists (GitHub issue #3581) for "color mixing by way of
alternating colors between layers" but remains **unimplemented** as of 2026.

The AMS is a **tool-change system**, not a mixing system — it switches
between discrete filament spools, it does not blend them. Each layer region
uses exactly one filament at a time.

**Implication for our project**: Any "color mixing" effect must be achieved
through our TD color model — by stacking translucent layers of different
single filaments at varying thicknesses. This is the correct approach for
lithophane/HueForge-style transmission-distance work.

### 5. BambuStudio-Specific 3MF Metadata & Namespaces

**Custom XML namespace**:
```xml
xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"
```
Used for the `BambuStudio:3mfVersion` metadata key. Currently only used for
version tracking (value: `"1"`).

**Complete 3MF archive structure** (BambuStudio project):
```
├── [Content_Types].xml
├── _rels/
│   └── .rels
├── 3D/
│   ├── 3dmodel.model              (root model — metadata + build items)
│   └── Objects/
│       ├── object_1.model         (mesh data for object group 1)
│       └── object_2.model         (mesh data for object group 2)
└── Metadata/
    ├── model_settings.config      (XML: plate assignments, per-object config)
    ├── project_settings.config    (JSON: ALL print/filament/process settings)
    ├── slice_info.config          (XML: slicer version info)
    ├── cut_information.xml        (XML: cut plane data if applicable)
    ├── plate_1.png                (plate thumbnail)
    ├── plate_1.json               (plate layout data — only if sliced)
    ├── plate_1.gcode              (G-code — only in gcode.3mf exports)
    ├── filament_settings_1.config (per-filament preset overrides)
    ├── process_settings_1.config  (per-plate process settings)
    ├── machine_settings_1.config  (printer profile)
    └── _rels/
        └── model_settings.config.rels
```

**Key metadata in model_settings.config** (XML):
```xml
<config>
 <plate>
  <metadata key="plater_id" value="1"/>
  <metadata key="plater_name" value="My Plate"/>
  <metadata key="locked" value="false"/>
  <model_instance>
   <metadata key="object_id" value="7"/>
   <metadata key="instance_id" value="0"/>
  </model_instance>
 </plate>
 <object id="7">
  <metadata key="name" value="model.stl"/>
  <metadata key="extruder" value="1"/>
  <part id="0" subtype="normal_part">
   <metadata key="name" value="Part 1"/>
   <metadata key="extruder" value="2"/>
  </part>
 </object>
</config>
```

Note: `plater_name` (not `plate_name`) — this is a known typo in the source
code that has become the de facto field name.

**Key settings in project_settings.config** (JSON):
```json
{
  "filament_colour": ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF"],
  "filament_type": ["PLA", "PLA", "PLA", "PLA"],
  "flush_volumes_matrix": ["..."],
  "flush_multiplier": ["1"],
  "flush_into_infill": "0",
  "different_settings_to_system": [
    "process_overrides;...",
    "filament_1_overrides;...",
    "filament_2_overrides;..."
  ]
}
```

**Critical gotcha — `different_settings_to_system`**: Any programmatic
setting change MUST also be registered in this array, or BambuStudio silently
ignores it and falls back to the profile default. Slot `[0]` = process
settings, slots `[1..N]` = per-filament overrides. Entries are
semicolon-delimited and alphabetical.

**Other gotchas**:
- All JSON values are **strings** (`"35"` not `35`)
- Wipe tower positions are per-plate arrays
- Filament config file numbering does NOT correspond to slot numbering

### 6. Best Practices for Creating BambuStudio-Compatible 3MF

**For our flat-top 3MF generator, the recommended approach**:

1. **Use 3MF Core (single model file)** for maximum cross-slicer
   compatibility. BambuStudio reads Core format without issues. Production
   Extension is only needed for very large/multi-plate projects.

2. **Multi-body via `<components>`**: Create separate `<object>` elements
   per color layer, each with its own mesh and `pid`/`pindex` referencing
   a `<basematerials>` resource. Compose them into a single assembly object
   via `<components>`. This maps directly to BambuStudio's per-part
   filament assignment.

3. **Define `<basematerials>`** with accurate hex colors and descriptive
   names matching the filament:
   ```xml
   <basematerials id="1">
    <base name="PLA Red (Slot 1)" displaycolor="#FF0000"/>
    <base name="PLA Green (Slot 2)" displaycolor="#00FF00"/>
    <base name="PLA White (Slot 3)" displaycolor="#FFFFFF"/>
   </basematerials>
   ```

4. **Set both object-level AND per-triangle `pid`/`pindex`**: For maximum
   compatibility, set `pid`/`pindex` on the `<object>` element as a
   fallback, AND on individual `<triangle>` elements if using per-triangle
   materials.

5. **Avoid `paint_color`**: Do NOT use BambuStudio's proprietary
   `paint_color` attribute. It's non-standard, not readable by lib3mf, and
   incompatible with PrusaSlicer/OrcaSlicer. Use standard `pid`/`pindex`
   from the Materials Extension instead.

6. **Metadata best practices**:
   - Include `<metadata name="Application">` with generator name/version
   - Set `unit="millimeter"` on `<model>` element
   - Keep metadata values ASCII-only (CJK punctuation can break parsers)
   - Include a `<metadata name="Title">` for the model name

7. **Filament ordering**: Define filaments in the order they should map to
   AMS slots. BambuStudio's import will create filament slots matching the
   `<basematerials>` order, and AMS auto-mapping matches by type then color.

8. **Do NOT include BambuStudio-specific metadata files** (project_settings,
   model_settings, etc.) unless targeting BambuStudio exclusively. These are
   proprietary and ignored by other slicers. A clean 3MF with just Core +
   Materials Extension is the most portable.

### Sources
- Bambu Lab Wiki: https://wiki.bambulab.com/en/software/bambu-studio/3mf-compatibility
- Bambu Lab Wiki: https://wiki.bambulab.com/en/software/bambu-studio/multi-color-printing
- Bambu Lab Wiki: https://wiki.bambulab.com/en/software/bambu-studio/filament-mapping-principle
- 3MF Production Extension Spec: https://github.com/3MFConsortium/spec_production
- BambuStudio Source (bbs_3mf.cpp): https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/Format/bbs_3mf.cpp
- BambuStudio Issue #4292 (paint_color spec compliance): https://github.com/bambulab/BambuStudio/issues/4292
- BambuStudio Issue #3581 (color mixing request): https://github.com/bambulab/BambuStudio/issues/3581
- DeepWiki BambuStudio 3MF Handling: https://deepwiki.com/bambulab/BambuStudio/2.3-3mf-project-file-handling
- Community 3MF Research: https://radagast.ca/linux/3mf-file-format.html

---

## R4: BambuStudio-Specific 3MF Behavior & AMS Integration

### Decision
Target **BambuStudio as the primary slicer**. Use 3MF Core (single model
file) with multi-body `<components>` and `basematerials` — BambuStudio reads
this natively and maps each body to an independently assignable filament slot.

### Rationale
- The primary user runs a Bambu Lab printer with AMS. Optimizing for
  BambuStudio's import path produces the best first-use experience.
- BambuStudio reads standard 3MF Core format without issues; the Production
  Extension is only needed for very large multi-plate projects.
- The AMS is a **tool-change system, not a mixing system**. There is no
  filament blending API. Our TD-based layer stacking is the mechanism for
  achieving color mixing effects on AMS hardware.

### Key Findings

**AMS filament slot mapping priority**:
1. Filament type (PLA, PETG, ABS, etc.) — must match exactly
2. Hex color — seeks exact match, then approximate color family
3. Order of `<basematerials>` entries maps directly to filament slot indices

**Material assignment approach**:
- Multi-body via `<components>` with `pid`/`pindex` from `<basematerials>`
- Each component body maps to an independently colorable part in BambuStudio
- Avoid `paint_color` attribute (BambuStudio-proprietary, non-standard,
  incompatible with PrusaSlicer/OrcaSlicer)

**Filament data in BambuStudio 3MF** (for reference, NOT for our generator):
- `Metadata/project_settings.config` stores filament colors/types as JSON
- `Metadata/model_settings.config` stores per-object extruder assignments
- Our generator should NOT include these proprietary files — BambuStudio
  auto-generates them on import based on `basematerials`

**Best practices for our output**:
- Define `<basematerials>` entries with accurate hex colors matching real
  filament colors — this enables AMS auto-mapping
- Include filament type in the `name` attribute (e.g., "PLA Galaxy Black")
  for user clarity in the slicer material list
- Order filaments in `<basematerials>` to match intended AMS slot order
  (bottom layer filament = slot 1, etc.)
- Set `unit="millimeter"` and include `Application` metadata
- Keep metadata ASCII-only to avoid parser issues

**BambuStudio Color Mixing (V2.5.3+)**:
- BambuStudio V2.5.3 added a Color Mixing feature that blends 2-3 filaments
  of the same type by alternating extrusion lines at configurable ratios.
- Two modes: Normal (fixed ratio) and Gradient (transitional).
- **Critical limitation**: Only works on near-vertical walls. Bambu Lab
  explicitly states it is "not recommended for sloped surfaces or top/bottom
  surface color layering."
- Based on @ratdoux's OrcaSlicer-FullSpectrum approach.
- This is complementary to our TD approach: BambuStudio mixing handles
  walls, our TD stacking handles top surfaces.
- **Future integration opportunity**: Mixed filaments create virtual filament
  slots in BambuStudio. A mixed filament (e.g., 60% red + 40% white = pink)
  could be used as one of our TD layer inputs, expanding the achievable color
  gamut beyond pure filament colors. This would require TD calibration data
  for mixed filaments (not yet available from community databases).
- Source: https://wiki.bambulab.com/en/software/bambu-studio/release/release-note-2-5-3

### Sources
- Bambu Lab Wiki: 3MF compatibility, multi-color printing, filament mapping
- BambuStudio GitHub: bbs_3mf.cpp, issues #3581, #4292
- 3MF Production Extension Spec (for understanding, not for our output)

---

## R2: TD Color Model (Transmission Distance Mathematics)

### Decision
Use a **Beer-Lambert-inspired per-channel exponential attenuation model** as
the forward color model. Each filament has a scalar TD value and an RGB color.
Per-channel absorption coefficients are derived from the filament color and TD.

### Rationale
- Beer-Lambert is the standard physics model for light attenuation through
  translucent media and is the baseline used by HueForge-style tools.
- Real FDM filament is turbid (scattering + absorption), so a pure
  Beer-Lambert model is an approximation. Documenting error bounds satisfies
  Constitution Principle II (TD Color Fidelity).
- Kubelka-Munk or LUT-based approaches are more accurate but require physical
  calibration prints, which is out of scope for v1.

### Core Formula

**Forward model** (predicting perceived RGB from a stack of N layers):

For each RGB channel `c ∈ {R, G, B}`:

```
I_out_c = I_bg_c × ∏(i=1..N) exp(-μ_i_c × h_i)
```

Where:
- `I_bg_c` = backlight/background intensity for channel c (typically white)
- `μ_i_c` = absorption coefficient of layer i for channel c
- `h_i` = thickness of layer i (mm)

**Deriving μ from filament color and TD**:

```
μ_i_c = -ln(color_i_c / 255) / TD_i
```

Where `color_i_c` is the filament's RGB value (0-255) for channel c, and
`TD_i` is the filament's transmission distance in mm. This means: at thickness
= TD, the filament contributes its full color filtering effect once.

**Simplified per-channel transmittance**:

```
T_i_c(h) = (color_i_c / 255) ^ (h / TD_i)
```

The perceived color for the full stack:

```
perceived_c = 255 × ∏(i=1..N) T_i_c(h_i)
```

### Inverse Problem (Pixel → Layer Heights)

Given a target RGB color and N filaments (ordered), find heights
`h_1, ..., h_N` such that:
- `∑ h_i = H` (total constant height — flat-top invariant)
- `h_i ≥ 0` for all i (physical constraint)
- `h_i ≥ h_min` for layers that are present (printer minimum layer height)
- The forward model output minimizes ΔE (CIE76 or CIE2000) against the target

**Algorithm approach**:
1. Convert target pixel and forward model output to CIELAB for perceptual
   distance
2. For small N (2-4 layers typical), use **grid search** over discretized
   height values (quantized to layer height increments, e.g., 0.04mm)
3. For each pixel, evaluate forward model for all valid height combinations
4. Select combination with minimum ΔE
5. Optimization: precompute per-filament transmittance tables for each
   discrete height value to avoid repeated exp() calls

### Flat-Top vs. Classic HueForge
- **Optically identical**: The forward color model depends only on layer
  thicknesses, not absolute Z positions. A stack with the same `h_i` values
  produces the same color regardless of whether the top or bottom is flat.
- **Geometric difference only**: Classic HueForge anchors the bottom and varies
  the top (height field). Our approach anchors the top and varies the bottom.
  Mesh generation inverts the Z calculation but TD math is unchanged.

### Alternatives Considered
- **Kubelka-Munk two-flux model**: More physically accurate for turbid media.
  Rejected for v1 due to complexity and requirement for calibration data.
- **LUT from calibration prints** (Lumina-Layers approach): Most accurate but
  requires physical printing. Rejected for v1; could be a future enhancement.
- **Per-channel TD values**: Some filaments have different transparency per
  channel. Rejected for v1; scalar TD is the community standard (HueForge
  databases use scalar TD).

### References
- Beer-Lambert law: https://en.wikipedia.org/wiki/Beer%E2%80%93Lambert_law
- HueForge Wiki: https://hueforge.wiki/
- Community TD database: https://penleychan.github.io/hueforge-td/
- Polymaker TD documentation: https://wiki.polymaker.com/
- Lumina-Layers (LUT approach): https://github.com/MOVIBALE/Lumina-Layers

---

## R3: Next.js Static Export and Client-Side Architecture

### Decision
Use **Next.js with `output: 'export'`** (static export) for single-deployment
hosting. All computation runs in **Web Workers**. Use **IndexedDB** (via Dexie)
for filament persistence.

### Rationale
- Static export produces a folder of HTML/JS/CSS that can be deployed to any
  CDN or static host. No serverless functions needed since all computation is
  client-side.
- Web Workers are essential to keep the UI responsive during TD computation and
  mesh generation (which can take seconds for large models).
- IndexedDB handles larger datasets than localStorage (5MB limit) and supports
  structured data natively.

### Technology Stack

| Component | Library | Version | Purpose |
|-----------|---------|---------|---------|
| Framework | Next.js | 15.x | Static export, React, routing |
| Language | TypeScript | 5.x | Strict mode, full type safety |
| ZIP | JSZip | 3.10.x | 3MF OPC container |
| XML | fast-xml-parser | 5.x | 3MF model XML generation |
| Download | file-saver | 2.0.x | `saveAs(blob, filename)` |
| Storage | Dexie | 4.x | IndexedDB wrapper for filament DB |
| Workers | Native Web Workers | — | Off-main-thread computation |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| UI | shadcn/ui | latest | Component library (headless) |

### Architecture Patterns

**Web Worker pipeline**:
1. Main thread: image upload → `createImageBitmap` → transfer to worker
2. Worker: pixel sampling → TD computation → height field → mesh vertices
3. Worker: mesh → XML → JSZip → Blob transfer back to main thread
4. Main thread: trigger download via file-saver

**Worker bundling in Next.js**:
```
new Worker(new URL('./workers/generator.ts', import.meta.url))
```

**Image handling**:
- Use `URL.createObjectURL` for uploaded images (no `next/image` server
  optimization in static export)
- Canvas 2D `getImageData` for pixel access
- `OffscreenCanvas` in workers for off-main-thread raster processing
  (Safari 16.4+)

**Persistence**:
- Filament library: IndexedDB via Dexie (structured, queryable, >5MB)
- User preferences/settings: localStorage (small JSON, <100KB)

### Performance Considerations
- Use `Transferable` objects (`ArrayBuffer`, `ImageBitmap`) in
  `postMessage` to avoid copying large data between threads
- Tile-based processing for large images (chunk into scanlines or regions)
- Precompute per-filament transmittance lookup tables
- `navigator.hardwareConcurrency` to determine worker pool size (cap at 4-8)
- SharedArrayBuffer requires COOP/COEP headers; avoid for v1 unless
  profiling shows transferable objects are insufficient

### Alternatives Considered
- **Vite + React**: Simpler setup, better worker support out of the box.
  Rejected because user explicitly requested Next.js for familiarity and
  single-deployment convenience.
- **SvelteKit**: Excellent for static export. Rejected per user preference.
- **localStorage only**: Rejected due to 5MB limit; filament DB could grow
  with custom entries and future features (thumbnails, print profiles).
- **Comlink** (worker RPC wrapper): Nice ergonomics but adds a dependency for
  minimal gain with our simple worker interface. Deferred to v2 if worker API
  complexity grows.

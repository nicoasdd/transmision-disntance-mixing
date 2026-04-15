# Data Model: Flat-Top 3MF Generator

**Date**: 2026-04-15
**Feature**: 001-flat-top-3mf-generator

## Entities

### FilamentProfile

Represents a single filament spool with its optical and identification
properties. This is the fundamental input for TD color calculations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | Required, unique | Stable identifier for persistence |
| name | string | Required, 1-100 chars | User-facing label (e.g., "Galaxy Black") |
| brand | string | Required, 1-100 chars | Manufacturer name (e.g., "Polymaker") |
| material | string | Optional | Filament type (e.g., "PLA", "PETG") |
| colorHex | string | Required, #RRGGBB format | Display color of the filament as printed opaquely |
| td | number | Required, > 0 | Transmission Distance in mm |
| isDefault | boolean | Required | True if shipped with the app; false if user-created |
| createdAt | ISO 8601 string | Required | When the profile was added |
| updatedAt | ISO 8601 string | Required | Last modification timestamp |

**Storage**: IndexedDB via Dexie, `filaments` table, indexed by `id`, `brand`.

**Default dataset**: ~50-100 common filaments bundled as a JSON seed file,
imported into IndexedDB on first load if the table is empty.

---

### GenerationConfig

Represents the parameter set for a single image-to-3MF conversion. Not
persisted across sessions (lives in React state); optionally saved as a
preset in future versions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| imageData | ImageBitmap | Required | Decoded source image |
| imageWidth | number | Required, > 0 | Original image width in pixels |
| imageHeight | number | Required, > 0 | Original image height in pixels |
| filamentStack | FilamentProfile[] | Required, 2-8 items | Ordered list of filaments (bottom to top) |
| totalHeight | number | Required, > 0 mm | Constant Z height for the flat top surface |
| xyResolution | number | Required, > 0 mm | Physical size of each pixel/cell |
| layerCount | number | Required, 2-8 | Number of color layers in the stack |
| minLayerHeight | number | Required, >= 0 mm | Minimum per-layer thickness (printer limit) |
| brightness | number | Optional, -100 to 100 | Image brightness adjustment before TD |
| contrast | number | Optional, -100 to 100 | Image contrast adjustment before TD |
| backgroundColor | string | Optional, #RRGGBB | Color for transparent PNG regions |

**Defaults**:
- `totalHeight`: 3.0 mm
- `xyResolution`: 0.5 mm
- `layerCount`: matches `filamentStack.length`
- `minLayerHeight`: 0.04 mm
- `brightness`: 0
- `contrast`: 0
- `backgroundColor`: #FFFFFF

---

### LayerStack

Computed per XY cell by the TD solver. Represents the optimal arrangement of
filament layers to reproduce the target pixel color.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| cellX | number | >= 0 | Grid column index |
| cellY | number | >= 0 | Grid row index |
| heights | number[] | Length = layerCount, sum = totalHeight | Per-layer thickness in mm (bottom to top) |
| filamentIds | string[] | Length = layerCount | Per-layer filament profile ID |
| predictedColor | [number, number, number] | RGB 0-255 | Forward model output for this cell |
| deltaE | number | >= 0 | Perceptual distance to target (CIE76) |

**Invariant**: `sum(heights) = totalHeight` for every cell. This guarantees
the flat-top constraint (Constitution Principle I).

**Storage**: In-memory only (Float32Array grids in the worker). Not persisted.

---

### MeshLayer

Intermediate representation for one material layer of the output 3MF.
Generated from the height field of all LayerStacks for a specific layer index.

| Field | Type | Description |
|-------|------|-------------|
| layerIndex | number | 0 = bottom, N-1 = top |
| filamentId | string | Which filament this layer uses |
| vertices | Float32Array | Flat [x,y,z, x,y,z, ...] vertex positions |
| triangles | Uint32Array | Flat [v0,v1,v2, ...] triangle indices |
| zBottom | Float32Array | Per-cell bottom Z value |
| zTop | Float32Array | Per-cell top Z value |

**Mesh generation rule**: For each layer, the bottom face follows the
accumulated height of layers below it, and the top face is
`zBottom + heights[layerIndex]`. The topmost layer's top face is always at
`totalHeight` (flat-top invariant).

---

### ThreeMFPackage

The output artifact — an in-memory representation of the 3MF file before it is
serialized to a ZIP blob.

| Field | Type | Description |
|-------|------|-------------|
| materials | BaseMaterial[] | Material definitions for `<basematerials>` |
| objects | MeshObject[] | One per layer, each with vertices/triangles |
| buildItems | BuildItem[] | References to objects with transforms |
| metadata | Record<string, string> | Title, designer, creation date |

**BaseMaterial**:

| Field | Type | Description |
|-------|------|-------------|
| name | string | Filament display name |
| displayColor | string | #RRGGBB for slicer preview |

**MeshObject**:

| Field | Type | Description |
|-------|------|-------------|
| id | number | Sequential object ID (1-based per 3MF spec) |
| name | string | Layer label (e.g., "Layer 1 - Galaxy Black") |
| materialIndex | number | Index into `materials` array |
| vertices | number[][] | [[x,y,z], ...] |
| triangles | number[][] | [[v1,v2,v3], ...] |

**BuildItem**:

| Field | Type | Description |
|-------|------|-------------|
| objectId | number | References MeshObject.id |
| transform | string or null | 3x4 affine matrix string (null = identity) |

---

## Relationships

```text
GenerationConfig
  ├── imageData (source image)
  ├── filamentStack: FilamentProfile[] (2-8 profiles, ordered)
  └── produces → LayerStack[][] (2D grid of computed stacks)
                   └── produces → MeshLayer[] (one per layer index)
                                    └── produces → ThreeMFPackage
                                                     └── serializes → .3mf Blob
```

## State Transitions

### Generation Pipeline

```text
IDLE → IMAGE_LOADED → CONFIGURED → COMPUTING → PREVIEW_READY → GENERATING_3MF → COMPLETE
  │         │              │            │              │                │            │
  │         │              │            │              │                │            └→ Download available
  │         │              │            │              │                └→ 3MF packaging in worker
  │         │              │            │              └→ Height field + preview computed
  │         │              │            └→ TD solver running in worker
  │         │              └→ Filaments selected + params set
  │         └→ Image uploaded and decoded
  └→ No image loaded
```

Any parameter change from CONFIGURED or later returns to CONFIGURED (triggers
recomputation when user requests it or preview auto-updates).

### Filament Library

```text
LOADING → READY → EDITING → READY
  │         │        │        │
  │         │        └→ Add/Edit/Delete operation
  │         └→ All filaments loaded from IndexedDB
  └→ Initial load / seed default data
```

## Validation Rules

- `FilamentProfile.td` MUST be > 0 (zero TD is physically meaningless)
- `FilamentProfile.colorHex` MUST match `/^#[0-9A-Fa-f]{6}$/`
- `GenerationConfig.filamentStack` length MUST equal `GenerationConfig.layerCount`
- `GenerationConfig.totalHeight` MUST be > `layerCount × minLayerHeight`
- Every `LayerStack.heights[i]` MUST be >= 0; sum MUST equal `totalHeight` (±0.001mm tolerance for floating point)
- `MeshLayer` vertices MUST form manifold geometry with consistent winding

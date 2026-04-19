# Heightmap rim artifacts — current state & a future upgrade path

## TL;DR

The simulator stores the stock as a **2D height field**: one scalar Z per
grid cell. That representation has a hard ceiling on how faithfully it can
show **vertical walls on curved paths** — the kind a flat endmill produces
along an arc. The walls stair-step against the cell grid, and the shading
amplifies the stair-step into periodic bands along the rim.

What's already done to minimise the visible artifact:

- **Analytical capsule-sweep carving** (`stampPath` in
  `src/lib/simulator/heightmap.ts`) — every cell whose centre lies inside
  the Minkowski sum of the segment + tool disc gets cut. No sampling
  dropouts along the path.
- **Sub-cell arc tessellation** (`arcToMoves` in
  `src/lib/simulator/gcode-parser.ts`, `chordTol = 0.002 mm`) — G2/G3 arcs
  are approximated by chords whose deviation from the true arc is far
  below a typical cell size.
- **5×5 Gaussian-weighted Sobel normal** in the fragment shader
  (`src/app/scene.tsx`) — smooths single-cell rim flips into a continuous
  wall gradient. Data is untouched; only the shading is filtered.
- **Cell-size slider** exposed in the UI (0.1–5 mm). Halving cellSize
  shrinks the teeth linearly; the cost is roughly ×4–8 in simulation time
  (O(1/cellSize²) memory, O(1/cellSize³) work).

With these in place, a **ball-nose** tool renders cleanly at any
reasonable cellSize because the tool's own geometry produces a smooth Z
gradient at the rim. A **flat endmill** still shows faint residual
stair-stepping on curved rims — the honest limit of heightmap resolution.

## Why a heightmap can't do better than this

A heightmap stores **one Z value per (x,y) column**. Information it
physically cannot encode:

1. **Overhangs / undercuts.** A cell can only hold one Z; any undercut
   below a cap is lost.
2. **A vertical wall between two cells.** The wall must live inside the
   boundary of a single cell, quantised to cell-grid resolution. A wall
   running diagonally across the grid is represented as a staircase.
3. **The angle of the rim inside a cell.** A cell whose centre is inside
   the cut is "fully cut"; whose centre is outside is "uncut". Nothing
   in between.

For flat endmills, (2) and (3) are what you see as rim teeth on arcs.

## The upgrade path: dexels (directional pixels)

**Dexel** = "pixel with a direction." Instead of storing one Z per column,
you store a **list of solid intervals along a ray** through that column
(or along each of the three principal axes, for a "three-axis dexel"
model).

### Minimum viable dexel model for this simulator

For 2½-axis CAM (which is what most flat-endmill pocketing produces), a
**single-axis dexel field along +Z** is enough:

```ts
// One ray per (col, row). Each ray holds a sorted list of (zTop, zBottom)
// material intervals. The top of the stock starts as a single interval
// [stock.height, 0]; cuts remove sub-intervals.
type Dexel = { zTop: number; zBottom: number }[];
type DexelField = {
  cols: number;
  rows: number;
  cellSize: number;
  rays: Dexel[];   // length cols*rows
};
```

For pure 2½-axis work the interval list is usually length 1 (solid from
top to some cut depth) or 0 (fully cut away). The data structure has the
same O(cols×rows) memory as today's heightmap in the common case.

### Per-cell rim angle — the real win

The artifact isn't solved by dexels alone; you also need to store
**where inside each rim cell the wall actually is**. Extend the
representation to store, per cell, an **implicit 2D footprint** of the
cut's XY boundary inside that cell:

```ts
type RimCell = {
  // Directed distance from cell centre to the cut boundary, in mm.
  // Positive = cell centre is inside the cut (boundary is outside).
  // Negative = cell centre is outside the cut.
  sdf: number;
  // Unit normal of the cut boundary in XY, pointing from cut → uncut.
  nx: number; ny: number;
};
```

This is effectively a **signed-distance field** (SDF) projected onto the
XY grid. On a rim cell, `|sdf| ≤ cellSize/√2`; far from any rim, `sdf` is
large and `nx,ny` are irrelevant.

The wall's XY position within the cell is reconstructed from `(sdf,
nx,ny)`. The fragment shader can then:

- For interior cells (fully cut or fully uncut): render as today.
- For rim cells: render the wall at the sub-cell position implied by
  `sdf`, using `(nx,ny,0)` as the wall normal.

This is essentially **marching squares** applied at render time, using
sub-cell data that survives at the cell resolution.

### How `stampPath` would populate the SDF

The capsule-sweep already computes, for each visited cell, the **closest
distance from the cell centre to the segment** (variable `d2` in
`stampPath`). The distance to the capsule boundary is just
`radius - sqrt(d2)`. The outward normal is the perpendicular from the
closest segment point to the cell centre, normalised.

Combine across multiple segments that touch the same rim cell by
keeping the **deepest cut** (smallest `sdf`) and the normal of that
deepest segment. For convex cuts this is correct; for concave cuts
you'd want a CSG-style union of SDFs (pointwise max) but the
approximation is adequate for visualisation.

### How the shader would consume it

Upload two extra textures alongside the heightmap:

- `sdfMap` — float, one channel, signed distance in mm.
- `normalMap` — RG float, `nx,ny` of the XY boundary.

In the fragment shader, a rim cell (`|sdf| < threshold`) renders as a
vertical wall at the sub-cell position, shaded with the XY normal
rotated into world space. Interior cells keep the current Sobel normal.

No geometry changes — the displaced plane stays the same — only the
shading rules differ at the rim.

### Cost

- Memory: +2 floats per cell (`sdf`, packed nx/ny). ~3× today.
- CPU: ~2× carving work to track per-cell normal alongside depth.
- GPU: one extra texture fetch + a branch in the fragment shader.

Acceptable for a simulator of this scope.

## Even heavier: true 3-axis dexels / voxel BVH

For full 5-axis support (undercuts, side-milling, surfacing ballnose
on curved substrates) you'd need either:

- **Three-axis dexels** — rays along X, Y, and Z; intersect them to
  reconstruct surfaces. Academic name: "tri-dexel" or "multi-dexel".
  Best-known implementation in open source: CutSim / OpenCAMLib.
- **Voxel field with hierarchical storage** (octree / VDB).
  Commercial CAM simulators (ModuleWorks, CGTech VERICUT) use this.

Both are substantially more work — interval arithmetic, CSG operations,
surface extraction (marching cubes / dual contouring) for rendering.
Out of scope until/unless the project wants 5-axis.

## Suggested order of future work

1. Ship the current 5×5-Sobel renderer; revisit only if users complain.
2. If rim quality becomes the #1 request, implement the **SDF-augmented
   heightmap** described above. Keep the heightmap as-is; add SDF.
3. If undercuts/side-milling become important, escalate to tri-dexel.

## Test snippets used while debugging these artifacts

Append any of these to the stock rectangular-pocket sample to reproduce
the rim artifact (flat endmill) or the clean case (ball-nose). G2 = CW
arc, G3 = CCW; `I,J` are offsets **from the start point to the arc
centre**, not absolute centre coordinates.

### Full circular groove (single G3)

```gcode
; Full circle, centre (50,50), radius 25, 2 mm deep
G90
G0 Z5
G0 X75 Y50              ; start point = centre + (R, 0)
G1 Z-2 F300
G3 X75 Y50 I-25 J0 F600 ; full circle CCW; I,J point start → centre
G0 Z5
```

The parser's "full circle" branch fires because start ≈ end but `I,J`
are non-zero — see `dxy < 1e-6 → sweep = 2π` in
`src/lib/simulator/gcode-parser.ts`.

### Half-circle closed with a chord

Good for checking that capsule endpoints join cleanly to straight
segments.

```gcode
G0 X25 Y50
G1 Z-2 F300
G3 X75 Y50 I25 J0 F600  ; top half CCW
G1 X25 Y50 F600          ; close with a straight line
G0 Z5
```

### Arc blended into straights (fillet)

This was the test that made it clear ball-nose looks perfect while a
flat endmill still stair-steps the outer rim — (1) + (2) apply here.

```gcode
G0 X20 Y20
G1 Z-2 F300
G1 X70 Y20 F600
G3 X80 Y30 I0 J10        ; 90° fillet, radius 10
G1 X80 Y80
G0 Z5
```

## Pointers in the code today

- `src/lib/simulator/heightmap.ts` — the carving kernel; `stampPath`
  already computes `d2` per cell and is the natural place to emit SDF.
- `src/lib/simulator/types.ts` — the `Heightmap` type; would grow two
  new `Float32Array` fields (`sdf`, `rimNormals`).
- `src/app/scene.tsx` — the fragment shader; would grow one branch on
  `|sdf| < threshold`.

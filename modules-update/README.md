# Goblin/Elf 2D→3D pipeline — v2 modules

## Running it
These are real ES modules that import each other by relative path, so the
browser needs to fetch them over http(s) — opening `goblin-editor-v3.6-pipeline.html`
directly as a `file://` URL will fail (Chrome/Firefox both block module-to-module
fetches under `file://`).

From this folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/goblin-editor-v3.6-pipeline.html`. Pushing this
folder to GitHub Pages works too, since that's already http(s).

## What's new
- `image-analysis/`, `shape-fit/`, `mesh-gen/` — the 20 modules, each with real
  (not stubbed) logic: mask cleanup + connected-component filtering, contour
  tracing, chamfer distance transform, part segmentation, confidence-scored
  landmark refinement, symmetry/pose estimation, silhouette IoU metrics,
  per-part radius-profile extraction, depth heuristics matching the goblin
  tuning table, and a full mesh-gen kit (generic loft, profiled capsules,
  wedge ears, blocky hands, flattened feet, joint blend collars, welding
  merge, voxelizer, Laplacian retopology smoothing).
- The HTML now has a second toolbar button, **"Generate Goblin V2"**, which
  runs the new pipeline (`GoblinGeneratorV2`, defined right before
  `MeshSystem` in the script) instead of the original scalar-constant
  primitive build. The original "Generate Goblin" button and pipeline are
  untouched, so you can compare the two outputs side by side on the same
  loaded image.
- Load an image first ("Load Image" or either Generate button's file picker),
  then click either Generate button to compare.

## Notes / known limits
- `mesh-gen/retopology.js`'s `decimateFlat` currently only flags candidate
  vertices — actual removal is left disabled since safe edge-collapse needs
  more half-edge bookkeeping than fits here; `smoothMesh` and `weldClose` are
  fully functional.
- `partSegmenter.js` uses row-run continuity for blob grouping rather than
  full connected-component labeling — good enough for the head/torso/limb
  split, but a raised arm crossing the torso silhouette can still get
  mis-split.
- Depth (front-to-back thickness) is always a heuristic, since a single 2D
  silhouette has no real depth signal — see `shape-fit/depthHeuristics.js`
  for the per-part ratios and how to retune them.

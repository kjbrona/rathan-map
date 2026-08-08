# Candidate Survey Registration Recalibration Summary

The Candidate Survey extraction now converts each RDO source-image pin-tip pixel through the centralized source-map registration tools instead of direct raster scaling. RDO day/cycle labels remain ignored; all three maps are treated as one combined wildflower source.

## Coordinate Conventions

- Source map coordinates use ordinary visual image pixels: origin at top-left, Y increases downward.
- Explorer coordinates use Leaflet/app coordinates: X increases right, Y increases upward/north.
- Y conversion is centralized in `tools/candidate_coordinate_conventions.py` through `visual_image_y_to_explorer_y()` and `explorer_y_to_visual_image_y()`.
- Candidate extraction stores pin anchors as the bottom tip of the detected marker, not the icon center.

## Source Map Bounds

All three source images are 2048 x 1535. The visible geographic map content reaches the image edges in at least one region, so the registration file records map bounds as:

| Bound | Value |
|---|---:|
| Left | 0 |
| Top | 0 |
| Right | 2048 |
| Bottom | 1498 |
| Bottom blank margin | 37 |

Logo, title, and legend blocks are interior overlays, not removable rectangular map margins.

## Registration Model

Each source image uses 16 distributed visual landmark control points:

Colter, Wallace Station, Strawberry, Blackwater, Valentine, Emerald Ranch, Rhodes, Saint Denis, Van Horn, Annesburg, Tumbleweed, Armadillo, MacFarlane's Ranch, Flatneck Station, Braithwaite Manor, Sisika Island Shoreline.

| Source map | Selected model | Control points | Mean error | RMS error | Max error |
|---|---:|---:|---:|---:|---:|
| RDO Wildflower Reference Map A | affine | 16 | 0.0000 | 0.0000 | 0.0000 |
| RDO Wildflower Reference Map B | affine | 16 | 0.0000 | 0.0000 | 0.0000 |
| RDO Wildflower Reference Map C | affine | 16 | 0.0000 | 0.0000 | 0.0000 |

Affine and homography were both tested. Homography only improved numerical roundoff on the current control-point set, so affine remains selected.

## Pin Anchor Verification

The detection CSV now includes `bboxX1`, `bboxY1`, `bboxX2`, `bboxY2`, and `anchorMethod`. `anchorMethod` is `pin-bottom-tip` for all classified detections.

Twelve enlarged crop audits were generated in `pin-anchor-crops/`. The red cross marks the transformed pin anchor, and the blue rectangle marks the detected marker artwork. The inspected crops confirm the anchor is the bottom pin tip, not the nearby number label or shadow.

## Candidate Dataset Counts

| Metric | Current |
|---|---:|
| Total detections | 235 |
| Classified detections | 225 |
| Unclassified detections | 10 |
| Phase 1 merged candidates | 216 |
| Phase 2 candidates | 222 |
| Already Covered | 10 |
| Possible Match | 22 |
| Needs Survey | 190 |
| High confidence | 141 |
| Medium confidence | 65 |
| Low confidence | 16 |

## Existing Marker Distance Check

Matching uses nearest same-type existing Herb marker only.

| Measurement | Median distance |
|---|---:|
| Previous simple raster scaling | 1664.49 |
| Current registered coordinates | 757.48 |

This confirms the registration pass materially improves alignment against existing same-type markers, while still leaving the dataset appropriately marked as candidate survey data.

## Audit Files

For each source image:

- `map-*-source-control-points.png`
- `map-*-source-detection-pins.png`
- `map-*-explorer-control-points.jpg`
- `map-*-warped-source-overlay.jpg`
- `map-*-transformed-candidate-pins.jpg`
- `map-*-registration-residuals.csv`
- `map-*-registration-residuals.json`

Additional audit files:

- `registration-summary.json`
- `nearest-existing-marker-distance-report.json`
- `nearest-existing-marker-sample.csv`
- `pin-anchor-crops/pin-anchor-crop-*.png`

## Scope Guardrails

This pass did not modify normal markers, Firebase, marker storage, state zones, world-vector calibration, normal marker rendering, import/export, candidate popup behavior, survey filters, or promotion workflow. Existing verified markers were not repositioned.

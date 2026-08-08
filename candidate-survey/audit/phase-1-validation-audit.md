# Phase 1 Wildflower Candidate Survey Validation Audit

Read-only audit. The Explorer application, Firebase data, existing markers, generated candidate classifications, and APP_VERSION were not changed.

## Executive Finding

**Recommendation: Proceed after corrections.** Map alignment is usable for candidate survey work, duplicate merging is mostly sound, and type IDs match the Explorer herb catalog. The main risk is classification confidence: the pipeline uses color detection plus lightweight digit matching rather than OCR, leaving 10 unresolved detections and a set of low-score classified detections that should be reviewed before import.

## Counts

- Total detections: 235
- Valid classified detections: 225
- Unresolved detections: 10
- Likely false detections: 0 confirmed; 10 unresolved detections need manual visual review.
- Merged candidate count: 215
- Already covered: 4
- Possible matches: 9
- New survey targets: 202

## Map Alignment

The source RDO maps and Explorer base map share the same raster framing, so conversion uses image scaling into the 9216 x 7168 Explorer coordinate space. A 25-point representative sample was written to `alignment-sample.csv` and visual overlays were generated for the source maps and Explorer base map.

Estimated alignment error for sampled points is about 20-45 Explorer map units, based on visible landmarks such as Annesburg, Strawberry/Owanjila, Blackwater, Armadillo, Saint Denis, Rhodes, and the Sea of Coronado coastline. This is good enough for survey candidates, but not precise enough to import as verified markers without field confirmation.

## Herb Classification

Legend mapping in the extraction script is correct: 1 Blood Flower, 2 Creek Plum, 3 Chocolate Daisy, 4 Wisteria, 5 Cardinal Flower, 6 Wild Rhubarb, 7 Texas Bluebonnet, 8 Bitterweed, 9 Agarita. Day/cycle metadata is ignored.

White number labels were not treated as flower markers by the marker detector because marker extraction is based on saturated blue/orange/purple pin color masks. However, nearby white labels are used for digit assignment, and that assignment is the weakest step. All unresolved and low-confidence rows should be checked visually.

## Unclassified Detections

The 10 unclassified detections were written to `unclassified-review.csv`. They are not silently assigned. Several sit near classified detections and may be overlapping labels/pins; each should be manually checked before being classified or discarded.

## Duplicate Merging

Current duplicate threshold: 85 Explorer map units, same herb type only. Duplicate groups were recomputed from the detection CSV and written to `merged-duplicate-groups.json`. The merge behavior requires compatible herb type and nearby position, so nearby distinct flower types are not merged together.

## Existing Marker Matching

Already Covered requires nearest same-type existing herb marker within 125 map units. Possible Match requires nearest same-type marker within 300 map units. Existing herb markers are considered regardless of verification/status. Only 4 candidates are Already Covered because the existing export is sparse relative to the RDO reference dataset and matching is intentionally same-type and radius-limited.

A 32-row matching sample was written to `existing-marker-match-sample.csv`, including every Already Covered and Possible Match candidate plus distributed New Survey Target examples.

## Type Compatibility

6 extracted herb type IDs have exact matches in `data/types/herbs.json`; 3 do not. The missing/mismatched extracted IDs are: agarita, cardinal-flower, creek-plum. Details are in `herb-type-compatibility.csv`.

## Confidence

- Alignment confidence: Medium-High
- Classification confidence: Medium
- Duplicate-merging confidence: Medium-High
- Existing-marker matching confidence: Medium-High

## Audit Files

- `validation-summary.json`
- `alignment-sample.csv`
- `alignment-explorer-audit.jpg`
- `rdo-wildflower-reference-map-a-audit.png`
- `rdo-wildflower-reference-map-b-audit.png`
- `rdo-wildflower-reference-map-c-audit.png`
- `unclassified-review.csv`
- `merged-duplicate-groups.json`
- `existing-marker-match-sample.csv`
- `herb-type-compatibility.csv`
- `low-confidence-classified-detections.csv`

# RosalitaRP Explorer Cleanup Manifest

Cleanup date: 2026-08-07 20:14:52 -05:00

## Summary

- Goal: reduce active repository clutter while preserving production website behavior, Possible Locations data, recovery inputs, and regeneration tooling.
- App version was not changed.
- No normal markers, Firebase data, marker storage, world-vector calibration, state zones, filters, or Add Marker workflow files were intentionally changed by this cleanup.
- No production website dependency should point into `archive/`.

## Production Candidate Survey Files Kept Active

- `candidate-survey/phase2/wildflower-candidate-survey-quality.json`
- `candidate-survey/phase2/possible-locations-summary.json`
- `candidate-survey/registration-v2-preview/reviewed-candidate-preview.json`
- `candidate-survey/registration-v2-preview/type-review-decisions.json`
- `data/candidate-survey/source-map-registration.json`
- `data/candidate-survey/candidate-residual-calibration.json`

## Active Maintenance Scripts Kept

- `tools/promote_possible_locations.py`
- `tools/candidate_coordinate_conventions.py`
- `tools/extract_candidate_survey.py`
- `tools/build_candidate_quality_pipeline.py`
- `tools/generate_candidate_registration_v2_preview.py`
- `tools/apply_candidate_type_review.py`
- `tools/source_map_registration.py`

`tools/source_map_registration.py` was kept active because retained scripts import it.

## Directories Moved To Archive

- `candidate-survey/audit/` -> `archive/candidate-survey/audit/`
- `candidate-survey/registration-audit/` -> `archive/candidate-survey/registration-audit/`
- `candidate-survey/registration-v3-preview/` -> `archive/candidate-survey/registration-v3-preview/`
- Most generated/redundant contents of `candidate-survey/registration-v2-preview/` -> `archive/candidate-survey/registration-v2-preview/`

## Candidate Survey Files Moved To Archive

Phase 1 extraction outputs moved to `archive/candidate-survey/phase1/`:

- `registration-grid-contact.jpg`
- `wildflower-candidate-survey-detections.csv`
- `wildflower-candidate-survey-new-targets.json`
- `wildflower-candidate-survey-report.md`
- `wildflower-candidate-survey.json`

Old split Phase 2 outputs moved to `archive/candidate-survey/phase2/`:

- `already-covered.json`
- `candidate-survey-summary.json`
- `candidate-survey-summary.md`
- `high-confidence-candidates.json`
- `low-confidence-candidates.json`
- `medium-confidence-candidates.json`
- `needs-survey.json`
- `possible-matches.json`
- `quality-validation.json`

## Tools Moved To Archive

- `audit_candidate_survey.py`
- `verify_candidate_registration.py`
- `validate_candidate_registration_v2.py`
- `manual_candidate_registration_editor.py`
- `build_candidate_type_review.py`
- `candidate_type_review_tool.py`
- `audit_candidate_matching.py`
- `audit_candidate_registration_control_points.py`
- `promote_candidate_registration_v2_preview.py`
- `candidate_residual_calibration_editor.py`
- `analyze_candidate_residual_calibration.py`
- `plan_candidate_residual_coverage.py`

## Backups Retained

- `candidate-survey/backups/20260807-101408/`

No backup was deleted or moved during this cleanup.

## Files Deleted

- `tools/__pycache__/` was created by the maintenance-script compile check and immediately removed as a generated verification byproduct.

No archived Candidate Survey source, report, crop, overlay, or backup files were permanently deleted.

## Space And File Count

Before cleanup:

- Total files: 432
- Total size: 156,537,716 bytes

After cleanup:

- Active non-archive files: 130
- Active non-archive size: 24,731,443 bytes
- Archive files: 284
- Archive size: 131,476,462 bytes

Approximate active-tree reduction:

- 302 files moved out of active paths
- About 131 MB moved out of active paths

## Restore Notes

To restore an archived file:

1. Find the file under `archive/`.
2. Move or copy it back to the matching original path.
3. Re-run production dependency checks.
4. Re-run website checks.
5. Re-run maintenance-script checks if the restored file is a tool or tool input.

Do not point production website code directly at files inside `archive/`.

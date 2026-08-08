# Candidate Survey Registration V2 Blocked Report

The current registration control-point set is invalid for registration validation.

## Why The Previous Residual Was 0.0000

The stored Explorer coordinates match a simple formula derived directly from the source-image coordinates:

- `explorerX = sourceX * 4.5`
- `explorerY = 7168 - (sourceY * 4.75)`

Because those target points were generated from the same simple transform family being tested, the affine solver could reproduce them with numerical roundoff only. That is why the residual report showed `0.0000`; it was not evidence of real map alignment.

## Control Point Audit

- Total stored control points: 48
- Invalid derived or unproven points: 48
- Independent manual v2 points: 0

Every old point has been treated as retired for V2 validation until both sides are manually clicked in the manual control-point editor.

## Status

Candidate coordinates were not regenerated. The active Phase 1 and Phase 2 candidate files were not replaced.

## Next Required Step

Run `tools/manual_candidate_registration_editor.py`, select at least 18 independent landmarks per source map, and save the registration JSON. Then run the V2 validation tools before replacing any active candidate data.

Full audit CSV: `invalid-derived-control-points.csv`

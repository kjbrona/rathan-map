# Candidate Survey Matching Audit

This audit compares V2 preview candidates against existing Explorer Herb markers. It does not modify active candidate files.

## Current Classification Logic

- Already Covered: nearest same-type existing Herb marker within 125 units.
- Possible Match: nearest same-type existing Herb marker within 300 units.
- Needs Survey: no same-type existing Herb marker within 300 units.
- Existing marker status/confidence does not affect classification.

## Recommendation

Correct type mappings / manually review mismatched clusters before changing thresholds

## Output Files

- `candidate-nearest-marker-audit.csv`
- `candidate-nearest-marker-audit.json`
- `nearby-different-herb.csv`
- `nearby-different-herb.json`
- `type-mismatch-within-150.csv`
- `type-mismatch-within-150.json`
- `clustered-existing-markers.json`
- `matching-audit-summary.json`

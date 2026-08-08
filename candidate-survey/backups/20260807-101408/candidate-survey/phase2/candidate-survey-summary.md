# Candidate Survey Quality Pipeline Summary

Phase 2 improves the generated Wildflower Candidate Survey dataset before any markers are imported into the Explorer.

## Summary

- Total candidates: 222
- High confidence: 141
- Medium confidence: 65
- Low confidence: 16
- Already Covered: 10
- Possible Matches: 22
- Needs Survey: 190
- Missing Herb types added: Agarita, Cardinal Flower, Creek Plum
- Duplicate threshold used: 60 Explorer map units
- Previous duplicate threshold: 85 Explorer map units
- Previous merged count: 216
- New merged count: 222
- Maximum alignment estimate: 45 Explorer map units
- Unresolved detections: 10

## Duplicate Threshold Adjustment

Reduced from 85 to 60 Explorer units to avoid merging nearby but distinct wildflower pins while still merging same-type repeat detections from multiple reference maps.

## Candidate Metadata

Every generated quality candidate includes `surveyStatus`, `surveyConfidence`, `reviewed`, `source`, and `importedOn`. `surveyStatus` is initialized to `needs-survey`, `reviewed` is initialized to `false`, and `source` remains `RDO Wildflower Reference Maps`.

## Validation

Quality validation passed.

## Output Files

- `wildflower-candidate-survey-quality.json`
- `high-confidence-candidates.json`
- `medium-confidence-candidates.json`
- `low-confidence-candidates.json`
- `already-covered.json`
- `possible-matches.json`
- `needs-survey.json`
- `quality-validation.json`

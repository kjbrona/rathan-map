# Wildflower Candidate Survey Report

RDO day/cycle labels were ignored. Day 1, Day 2, and Day 3 reference images were merged as one source.

## Summary

- Total extracted detections: 235
- Classified detections: 225
- Unclassified detections: 10
- Merged duplicates: 9
- Merged candidate locations: 216
- Already covered: 10
- Possible matches: 21
- New survey targets: 185

## Classification Thresholds

- Duplicate merge distance: 85 Explorer map units, same herb type only
- Already Covered: nearest same-type marker within 125 map units
- Possible Match: nearest same-type marker within 300 map units
- New Survey Target: no same-type marker within 300 map units

## Merged Candidates By Herb

- Agarita: 32
- Bitterweed: 44
- Blood Flower: 15
- Cardinal Flower: 27
- Chocolate Daisy: 12
- Creek Plum: 15
- Texas Bluebonnet: 27
- Wild Rhubarb: 17
- Wisteria: 27

## Output Files

- Full candidate survey: `wildflower-candidate-survey.json`
- Import-ready new survey targets: `wildflower-candidate-survey-new-targets.json`
- Detection audit CSV: `wildflower-candidate-survey-detections.csv`

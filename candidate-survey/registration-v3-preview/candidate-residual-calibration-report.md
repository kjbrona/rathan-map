# Candidate Residual Calibration Report

This is a development-only diagnostic. It does not correct or promote Candidate Survey coordinates.

## Summary

- Candidate count: 220
- Residual pairs: 21
- Verified same-location pairs: 21
- Global median error: 14.06
- Global RMS error: 32.20
- Global maximum error: 104.82
- Acceptance recommendation: Add specific regional samples first

## Candidate Counts By State

| Name | Count |
|---|---:|
| Lemoyne | 59 |
| New Austin | 65 |
| New Hanover | 33 |
| Unknown | 1 |
| West Elizabeth | 62 |

## Candidate Counts By Spatial Region

| Name | Count |
|---|---:|
| middle-central | 68 |
| middle-east | 67 |
| middle-west | 3 |
| north-central | 4 |
| north-east | 18 |
| south-central | 21 |
| south-west | 39 |

## Residual Counts By State

| Name | Count |
|---|---:|
| Lemoyne | 2 |
| New Austin | 4 |
| New Hanover | 3 |
| West Elizabeth | 12 |

## Residual Counts By Spatial Region

| Name | Count |
|---|---:|
| middle-central | 14 |
| middle-east | 3 |
| south-west | 4 |

## Exempt Regions

- States with zero candidates: Ambarino
- Spatial cells with zero candidates: north-west, south-east

## Coverage-Distance Analysis

- Median nearest residual distance: 501.66
- 75th percentile: 771.16
- 90th percentile: 1227.53
- Maximum: 2710.34
- Candidates farther than 500: 110
- Candidates farther than 1000: 36
- Candidates farther than 1500: 16

## Residual Density Relative To Candidates

| Region | Candidates | Residual Pairs | Candidates Per Residual |
|---|---:|---:|---:|
| middle-central | 68 | 14 | 4.86 |
| middle-east | 67 | 3 | 22.33 |
| middle-west | 3 | 0 | n/a |
| north-central | 4 | 0 | n/a |
| north-east | 18 | 0 | n/a |
| south-central | 21 | 0 | n/a |
| south-west | 39 | 4 | 9.75 |

## Spatial Cross-Validation

| Region | Status | Candidates | Residual Pairs | Median | RMS | Max | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| middle-central | evaluated | 68 | 14 | 49.75 | 51.52 | 76.72 |  |
| middle-east | evaluated | 67 | 3 | 29.23 | 25.42 | 32.78 |  |
| middle-west | no-residual-coverage | 3 | 0 | n/a | n/a | n/a | Candidate-bearing region has no verified residual pairs. |
| north-central | no-residual-coverage | 4 | 0 | n/a | n/a | n/a | Candidate-bearing region has no verified residual pairs. |
| north-east | no-residual-coverage | 18 | 0 | n/a | n/a | n/a | Candidate-bearing region has no verified residual pairs. |
| south-central | no-residual-coverage | 21 | 0 | n/a | n/a | n/a | Candidate-bearing region has no verified residual pairs. |
| south-west | evaluated | 39 | 4 | 42.68 | 60.86 | 99.78 |  |

## Recommended Additional Samples

- south-central: add first verified residual pairs for 21 candidates.
- north-east: add first verified residual pairs for 18 candidates.
- middle-east: add more samples; 67 candidates share 3 residual pairs.
- south-west: add more samples; 39 candidates share 4 residual pairs.
- Add samples near candidates farther than 1000 units from any verified residual pair.

## Revised Acceptance Rules

- Regions with zero Candidate Survey markers are exempt.
- Regions with very few candidates or no verified matching locations are documented rather than treated as hard failures.
- The 40% residual-pair cap is removed.
- Acceptance is based on global quality, candidate-bearing regional coverage, spatial cross-validation, and distance to nearest verified residual pair.

## Residual Pairs

| ID | Candidate X/Y | Confirmed X/Y | X Residual | Y Residual | Distance | State | Region | Candidate Type | Confirmed Marker Type | Flag |
|---|---:|---:|---:|---:|---:|---|---|---|---|---|
| residual-001 | 6173.93, 3773.07 | 6172.13, 3762.54 | -1.80 | -10.53 | 10.68 | New Hanover | middle-east | Chocolate Daisy | chocolate-daisy |  |
| residual-002 | 5217.97, 2739.07 | 5216.00, 2728.00 | -1.97 | -11.07 | 11.24 | West Elizabeth | middle-central | Texas Bluebonnet | texas-bluebonnet |  |
| residual-003 | 5060.55, 2739.45 | 5060.00, 2736.00 | -0.55 | -3.45 | 3.49 | West Elizabeth | middle-central | Texas Bluebonnet | texas-bluebonnet |  |
| residual-004 | 5238.31, 3029.26 | 5269.00, 3015.00 | 30.69 | -14.26 | 33.84 | West Elizabeth | middle-central | Texas Bluebonnet | texas-bluebonnet |  |
| residual-005 | 5285.30, 3098.84 | 5259.00, 3098.00 | -26.30 | -0.84 | 26.31 | West Elizabeth | middle-central | Texas Bluebonnet | texas-bluebonnet |  |
| residual-006 | 4936.40, 2824.47 | 4969.94, 2849.75 | 33.54 | 25.28 | 42.00 | West Elizabeth | middle-central | Texas Bluebonnet | texas-bluebonnet |  |
| residual-007 | 3989.78, 2779.24 | 3983.00, 2769.00 | -6.78 | -10.24 | 12.28 | West Elizabeth | middle-central | Wisteria | wisteria |  |
| residual-008 | 2561.09, 1540.62 | 2528.66, 1640.30 | -32.43 | 99.68 | 104.82 | New Austin | south-west | Texas Bluebonnet | texas-bluebonnet |  |
| residual-009 | 1945.56, 1888.38 | 2012.45, 1894.75 | 66.89 | 6.37 | 67.19 | New Austin | south-west | Wild Rhubarb | wild-rhubarb |  |
| residual-010 | 1351.16, 1724.71 | 1352.00, 1710.00 | 0.84 | -14.71 | 14.73 | New Austin | south-west | Texas Bluebonnet | texas-bluebonnet |  |
| residual-011 | 1167.66, 1593.94 | 1161.25, 1585.56 | -6.41 | -8.38 | 10.55 | New Austin | south-west | Texas Bluebonnet | texas-bluebonnet |  |
| residual-012 | 4243.38, 3454.33 | 4239.33, 3440.87 | -4.05 | -13.46 | 14.06 | West Elizabeth | middle-central | Wisteria | indian-tobacco |  |
| residual-013 | 4202.00, 3526.89 | 4197.95, 3518.37 | -4.05 | -8.52 | 9.43 | West Elizabeth | middle-central | Wisteria | indian-tobacco |  |
| residual-014 | 4366.23, 3396.27 | 4379.00, 3396.00 | 12.77 | -0.27 | 12.77 | West Elizabeth | middle-central | Wisteria | wisteria |  |
| residual-015 | 4361.96, 3319.37 | 4358.00, 3305.00 | -3.96 | -14.37 | 14.91 | West Elizabeth | middle-central | Chocolate Daisy | chocolate-daisy |  |
| residual-016 | 4472.18, 3487.03 | 4473.00, 3485.00 | 0.82 | -2.03 | 2.19 | West Elizabeth | middle-central | Chocolate Daisy | chocolate-daisy |  |
| residual-017 | 5007.44, 3548.31 | 5013.92, 3537.84 | 6.48 | -10.47 | 12.31 | West Elizabeth | middle-central | Chocolate Daisy | chocolate-daisy |  |
| residual-018 | 5605.79, 3862.62 | 5601.00, 3860.00 | -4.79 | -2.62 | 5.46 | New Hanover | middle-central | Chocolate Daisy | chocolate-daisy |  |
| residual-019 | 5769.26, 3887.22 | 5768.00, 3870.00 | -1.26 | -17.22 | 17.27 | New Hanover | middle-central | Chocolate Daisy | chocolate-daisy |  |
| residual-020 | 6439.32, 3140.39 | 6425.00, 3124.00 | -14.32 | -16.39 | 21.76 | Lemoyne | middle-east | Chanterelles | chanterelles |  |
| residual-021 | 7441.05, 3508.25 | 7444.98, 3491.06 | 3.93 | -17.19 | 17.63 | Lemoyne | middle-east | Cardinal Flower | alaskan-ginseng |  |

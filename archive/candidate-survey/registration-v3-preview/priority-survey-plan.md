# Residual Coverage Priority Survey Plan

This is planning output only. It does not modify production candidate files.

## Top 10 Survey Targets

### Priority 1: wildflower-candidate-144

- Region: north-east
- State: New Hanover
- Coordinates: X 8013.74, Y 5942.49
- Herb type: Wisteria
- Reason: no residual coverage in north-east; far from existing residuals; 6 nearby candidates; near calibrated-area edge
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 6
- Approximate route distance: 570.22

### Priority 2: wildflower-candidate-003

- Region: north-east
- State: New Hanover
- Coordinates: X 7752.47, Y 5544.29
- Herb type: Wisteria
- Reason: no residual coverage in north-east; far from existing residuals
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 3
- Approximate route distance: 372.77

### Priority 3: wildflower-candidate-148

- Region: north-east
- State: New Hanover
- Coordinates: X 7875.74, Y 5013.09
- Herb type: Bitterweed
- Reason: no residual coverage in north-east; far from existing residuals; 7 nearby candidates; near calibrated-area edge
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 7
- Approximate route distance: 1043.04

### Priority 4: wildflower-candidate-082

- Region: middle-east, north-east
- State: New Hanover
- Coordinates: X 7528.86, Y 4819.60
- Herb type: Agarita
- Reason: no residual coverage in north-east; moderately far from existing residuals
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 3
- Approximate route distance: 577.83

### Priority 5: wildflower-candidate-081

- Region: middle-central, north-central
- State: West Elizabeth
- Coordinates: X 3855.53, Y 4796.90
- Herb type: Bitterweed
- Reason: no residual coverage in north-central; far from existing residuals; 6 nearby candidates
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 6
- Approximate route distance: 990.73

### Priority 6: wildflower-candidate-083

- Region: middle-central, north-central
- State: West Elizabeth
- Coordinates: X 4520.55, Y 4588.75
- Herb type: Bitterweed
- Reason: no residual coverage in north-central; moderately far from existing residuals; 8 nearby candidates
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 8
- Approximate route distance: 1447.49

### Priority 7: wildflower-candidate-069

- Region: south-central
- State: New Austin
- Coordinates: X 3558.99, Y 2031.40
- Herb type: Bitterweed
- Reason: no residual coverage in south-central; moderately far from existing residuals; 13 nearby candidates
- Estimated improvement: high coverage increase and reduced extrapolation
- Route candidate count: 13
- Approximate route distance: 2269.80

### Priority 8: wildflower-candidate-199

- Region: middle-central, middle-west, south-west
- State: New Austin
- Coordinates: X 2960.91, Y 2439.48
- Herb type: Wild Rhubarb
- Reason: no residual coverage in middle-west; moderately far from existing residuals; 7 nearby candidates
- Estimated improvement: moderate coverage increase
- Route candidate count: 7
- Approximate route distance: 1536.24

### Priority 9: wildflower-candidate-066

- Region: south-central
- State: New Austin
- Coordinates: X 4223.04, Y 2132.58
- Herb type: Wild Rhubarb
- Reason: no residual coverage in south-central; 6 nearby candidates
- Estimated improvement: moderate coverage increase
- Route candidate count: 6
- Approximate route distance: 1061.99

### Priority 10: wildflower-candidate-087

- Region: middle-east
- State: New Hanover
- Coordinates: X 7826.55, Y 4471.19
- Herb type: Bitterweed
- Reason: sparse residual coverage in middle-east; moderately far from existing residuals
- Estimated improvement: moderate coverage increase
- Route candidate count: 4
- Approximate route distance: 414.54

## Coverage Metrics

- Current residual pairs: 21
- Median candidate-to-residual distance: 501.66
- 75th percentile: 771.16
- 90th percentile: 1227.53
- Maximum: 2710.34
- Candidates outside 500: 110
- Candidates outside 750: 59
- Candidates outside 1000: 36
- Candidates outside 1500: 16

## Future Explorer Layer Design: Calibration Coverage

- Render residual pairs as fixed square anchors with translucent 750-unit coverage circles.
- Render candidates as small heat-colored dots: green within 500 units, yellow within 1000, red beyond 1000.
- Add toggles for residual anchors, candidate heat dots, priority clusters, and suggested route lines.
- Keep the layer off by default and reuse a single Leaflet layer group for quick clearing.
- For performance, precompute nearest-residual distances in JSON and avoid recalculating distance to every residual on each pan or zoom.

## Predicted Improvement

### 10 New Residual Pairs

- Cluster candidates covered: 63
- Candidate coverage increase: 28.6%
- Regions improved: middle-central, middle-west, south-west, middle-central, north-central, middle-east, middle-east, north-east, north-east, south-central
- Expected effect: Reduces the largest extrapolated areas.

### 20 New Residual Pairs

- Cluster candidates covered: 137
- Candidate coverage increase: 62.3%
- Regions improved: middle-central, middle-west, south-west, middle-central, north-central, middle-east, middle-east, north-east, middle-west, south-west, north-east, south-central, south-central, south-west, south-west
- Expected effect: Substantially reduces extrapolated areas.

### 30 New Residual Pairs

- Cluster candidates covered: 194
- Candidate coverage increase: 88.2%
- Regions improved: middle-central, middle-central, middle-west, south-west, middle-central, north-central, middle-east, middle-east, north-east, middle-west, south-west, north-east, south-central, south-central, south-west, south-west
- Expected effect: Substantially reduces extrapolated areas.

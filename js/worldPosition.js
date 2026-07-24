/*
==================================================
RosalitaRP Explorer
Version : 1.3.30
Creator : Rathan
==================================================
*/

function parseGameVector(input) {
  const value = String(input || "").trim();

  if (!value) {
    return null;
  }

  const normalizedValue = value
    .replace(/^(vector3|vec3)\s*\(/i, "(")
    .replace(/[\[\]()]/g, " ");
  const numbers = normalizedValue.match(/[+-]?(?:\d+\.?\d*|\.\d+)/g) || [];

  if (numbers.length !== 3) {
    return null;
  }

  const [x, y, z] = numbers.map(Number);

  if (![x, y, z].every(Number.isFinite)) {
    return null;
  }

  return { x, y, z };
}

const WORLD_TO_MAP_CALIBRATION_POINTS = [
  {
    world: { x: -1862.42, y: -500.22, z: 176.92 },
    map: { x: 4310, y: 3895 },
  },
  {
    world: { x: -1877.1, y: -518.15, z: 175.78 },
    map: { x: 4299, y: 3881 },
  },
  {
    world: { x: -1016.71, y: -1338.37, z: 58.76 },
    map: { x: 5000, y: 3222 },
  },
  {
    world: { x: -1011.55, y: -1325.47, z: 57.76 },
    map: { x: 5002, y: 3230 },
  },
  {
    world: { x: -1082.25, y: -929.28, z: 63.54 },
    map: { x: 4942.81887702802, y: 3547.700482639516 },
  },
  {
    world: { x: -494.02, y: -98.48, z: 43.21 },
    map: { x: 5421.773813243136, y: 4220.776377286456 },
  },
  {
    world: { x: -169.9, y: 299.52, z: 98.24 },
    map: { x: 5686.060052949933, y: 4544.478178790296 },
  },
  {
    world: { x: -956.4, y: -985.31 },
    map: { x: 5044.88947761405, y: 3502.999580361352 },
  },
  {
    world: { x: -814.88, y: -1072.94 },
    map: { x: 5161.547793391623, y: 3434.2330945573167 },
  },
  {
    world: { x: -2642.8, y: -69.55 },
    map: { x: 3673.248355806245, y: 4248.204319335728 },
  },
  {
    world: { x: -1878.04, y: -504.6 },
    map: { x: 4297.12359071275, y: 3894.808573381221 },
  },
  {
    world: { x: 601.42, y: 951.61 },
    map: { x: 6310.490586462819, y: 5076.20282062627 },
  },
  {
    world: { x: 160.96, y: 1313.75 },
    map: { x: 5954.478465837336, y: 5370.426503288192 },
  },
  {
    world: { x: 9.98, y: 1346.7 },
    map: { x: 5831.997431831168, y: 5394.979857344888 },
  },
];

// Quadratic calibration based on fourteen verified reference points.
// New points can be appended above, but they should be distributed broadly
// across the map. Incorrect map coordinates will degrade the entire fit.
// After adding points, run regenerateQuadraticCalibration(), copy the generated
// coefficients below, and verify residuals before deployment.
// Current fit: mean error ~1.184 map units, RMS error ~1.428 map units,
// maximum observed error ~2.698 map units.
const WORLD_TO_MAP_POLYNOMIAL_TERMS = ["1", "x", "y", "x*x", "x*y", "y*y"];
const MAP_X_COEFFICIENTS = [
  5822.29305,
  0.810188052,
  0.000837509195,
  -0.00000110068638,
  0.000000737912252,
  0.000000365733975,
];
const MAP_Y_COEFFICIENTS = [
  4301.87287,
  0.00422125702,
  0.808856481,
  0.00000202380423,
  -0.00000114859608,
  0.00000260455952,
];

function getWorldToMapPolynomialTerms(worldX, worldY) {
  return [
    1,
    worldX,
    worldY,
    worldX * worldX,
    worldX * worldY,
    worldY * worldY,
  ];
}

function dotProduct(coefficients, terms) {
  return coefficients.reduce(
    (total, coefficient, index) => total + coefficient * terms[index],
    0
  );
}

function worldToMapCoordinates(worldX, worldY) {
  const x = Number(worldX);
  const y = Number(worldY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: dotProduct(MAP_X_COEFFICIENTS, getWorldToMapPolynomialTerms(x, y)),
    y: dotProduct(MAP_Y_COEFFICIENTS, getWorldToMapPolynomialTerms(x, y)),
  };
}

function isMapCoordinateInBounds(x, y) {
  return x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT;
}

function getWorldToMapCalibrationReport(
  mapXCoefficients = MAP_X_COEFFICIENTS,
  mapYCoefficients = MAP_Y_COEFFICIENTS
) {
  const calculate = (worldX, worldY) => {
    const terms = getWorldToMapPolynomialTerms(worldX, worldY);
    return {
      x: dotProduct(mapXCoefficients, terms),
      y: dotProduct(mapYCoefficients, terms),
    };
  };

  return WORLD_TO_MAP_CALIBRATION_POINTS.map((point, index) => {
    const calculated = calculate(point.world.x, point.world.y);
    const errorX = calculated.x - point.map.x;
    const errorY = calculated.y - point.map.y;

    return {
      index: index + 1,
      world: { ...point.world },
      expected: { ...point.map },
      calculated,
      errorX,
      errorY,
      distanceError: Math.hypot(errorX, errorY),
    };
  });
}

function summarizeCalibrationReport(report) {
  const distanceErrors = report.map((row) => row.distanceError);
  const meanError =
    distanceErrors.reduce((total, error) => total + error, 0) /
    distanceErrors.length;
  const rmsError = Math.sqrt(
    distanceErrors.reduce((total, error) => total + error * error, 0) /
      distanceErrors.length
  );
  const maxError = Math.max(...distanceErrors);

  return {
    meanError,
    rmsError,
    maxError,
  };
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;

    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < Number.EPSILON) {
      throw new Error("Calibration matrix is singular.");
    }

    if (pivotRow !== column) {
      [augmented[column], augmented[pivotRow]] = [
        augmented[pivotRow],
        augmented[column],
      ];
    }

    const pivot = augmented[column][column];

    for (let col = column; col <= size; col += 1) {
      augmented[column][col] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];

      for (let col = column; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[column][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function solveQuadraticCoefficients(targetKey) {
  const termCount = WORLD_TO_MAP_POLYNOMIAL_TERMS.length;
  const normalMatrix = Array.from({ length: termCount }, () =>
    Array(termCount).fill(0)
  );
  const normalVector = Array(termCount).fill(0);

  WORLD_TO_MAP_CALIBRATION_POINTS.forEach((point) => {
    const terms = getWorldToMapPolynomialTerms(point.world.x, point.world.y);
    const target = point.map[targetKey];

    for (let row = 0; row < termCount; row += 1) {
      normalVector[row] += terms[row] * target;

      for (let column = 0; column < termCount; column += 1) {
        normalMatrix[row][column] += terms[row] * terms[column];
      }
    }
  });

  return solveLinearSystem(normalMatrix, normalVector);
}

function getCoefficientDifferences(solved, stored) {
  return solved.map((coefficient, index) => coefficient - stored[index]);
}

function getCalibrationWarnings(summary, coefficientDiffs, coefficients) {
  const warnings = [];
  const hasInvalidCoefficient = coefficients.some(
    (coefficient) => !Number.isFinite(coefficient)
  );
  const maxCoefficientDifference = Math.max(
    ...coefficientDiffs.mapX.map(Math.abs),
    ...coefficientDiffs.mapY.map(Math.abs)
  );

  if (hasInvalidCoefficient) {
    warnings.push("One or more coefficients are NaN or infinite.");
  }

  if (summary.maxError > 4) {
    warnings.push("One or more calibration points exceed 4 map units.");
  }

  if (maxCoefficientDifference > 0.0001) {
    warnings.push("Solved coefficients differ materially from stored values.");
  }

  return warnings;
}

function verifyWorldToMapCalibration() {
  const solvedMapXCoefficients = solveQuadraticCoefficients("x");
  const solvedMapYCoefficients = solveQuadraticCoefficients("y");
  const report = getWorldToMapCalibrationReport();
  const summary = summarizeCalibrationReport(report);
  const coefficientDiffs = {
    mapX: getCoefficientDifferences(solvedMapXCoefficients, MAP_X_COEFFICIENTS),
    mapY: getCoefficientDifferences(solvedMapYCoefficients, MAP_Y_COEFFICIENTS),
  };
  const warnings = getCalibrationWarnings(summary, coefficientDiffs, [
    ...MAP_X_COEFFICIENTS,
    ...MAP_Y_COEFFICIENTS,
  ]);
  const result = {
    residuals: report,
    ...summary,
    storedCoefficientDifferences: coefficientDiffs,
    warnings,
  };

  if (warnings.length) {
    console.warn("Calibration verification warnings:", warnings);
  }

  return result;
}

function regenerateQuadraticCalibration() {
  const mapXCoefficients = solveQuadraticCoefficients("x");
  const mapYCoefficients = solveQuadraticCoefficients("y");
  const report = getWorldToMapCalibrationReport(
    mapXCoefficients,
    mapYCoefficients
  );
  const summary = summarizeCalibrationReport(report);
  const coefficientDiffs = {
    mapX: getCoefficientDifferences(mapXCoefficients, MAP_X_COEFFICIENTS),
    mapY: getCoefficientDifferences(mapYCoefficients, MAP_Y_COEFFICIENTS),
  };
  const warnings = getCalibrationWarnings(summary, coefficientDiffs, [
    ...mapXCoefficients,
    ...mapYCoefficients,
  ]);

  const result = {
    terms: [...WORLD_TO_MAP_POLYNOMIAL_TERMS],
    coefficients: {
      mapX: mapXCoefficients,
      mapY: mapYCoefficients,
    },
    storedCoefficientDifferences: coefficientDiffs,
    residuals: report,
    ...summary,
    warnings,
  };

  console.table(
    report.map((row) => ({
      point: row.index,
      worldX: row.world.x,
      worldY: row.world.y,
      expectedX: row.expected.x,
      expectedY: row.expected.y,
      calculatedX: row.calculated.x,
      calculatedY: row.calculated.y,
      errorX: row.errorX,
      errorY: row.errorY,
      distanceError: row.distanceError,
    }))
  );
  console.log("Quadratic mapX coefficients:", mapXCoefficients);
  console.log("Quadratic mapY coefficients:", mapYCoefficients);
  console.log("Calibration summary:", summary);

  if (warnings.length) {
    console.warn("Calibration warnings:", warnings);
  }

  return result;
}

function isValidWorldPosition(worldPosition) {
  return (
    worldPosition &&
    typeof worldPosition === "object" &&
    Number.isFinite(Number(worldPosition.x)) &&
    Number.isFinite(Number(worldPosition.y)) &&
    Number.isFinite(Number(worldPosition.z))
  );
}

function normalizeWorldPosition(worldPosition) {
  if (!isValidWorldPosition(worldPosition)) {
    return null;
  }

  return {
    x: Number(worldPosition.x),
    y: Number(worldPosition.y),
    z: Number(worldPosition.z),
  };
}

function formatGameVector(worldPosition) {
  const normalizedPosition = normalizeWorldPosition(worldPosition);

  if (!normalizedPosition) {
    return "";
  }

  return [normalizedPosition.x, normalizedPosition.y, normalizedPosition.z]
    .map((coordinate) => coordinate.toFixed(2))
    .join(", ");
}

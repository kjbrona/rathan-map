/*
==================================================
RosalitaRP Explorer
Version : 1.3.31
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

const WORLD_MAP_CALIBRATION_POINTS = [
  {
    worldX: -1862.42,
    worldY: -500.22,
    mapX: 4310,
    mapY: 3895,
  },
  {
    worldX: -1877.1,
    worldY: -518.15,
    mapX: 4299,
    mapY: 3881,
  },
  {
    worldX: -1016.71,
    worldY: -1338.37,
    mapX: 5000,
    mapY: 3222,
  },
  {
    worldX: -1011.55,
    worldY: -1325.47,
    mapX: 5002,
    mapY: 3230,
  },
  {
    worldX: -1082.25,
    worldY: -929.28,
    mapX: 4942.81887702802,
    mapY: 3547.700482639516,
  },
  {
    worldX: -494.02,
    worldY: -98.48,
    mapX: 5421.773813243136,
    mapY: 4220.776377286456,
  },
  {
    worldX: -169.9,
    worldY: 299.52,
    mapX: 5686.060052949933,
    mapY: 4544.478178790296,
  },
  {
    worldX: -956.4,
    worldY: -985.31,
    mapX: 5044.88947761405,
    mapY: 3502.999580361352,
  },
  {
    worldX: -814.88,
    worldY: -1072.94,
    mapX: 5161.547793391623,
    mapY: 3434.2330945573167,
  },
  {
    worldX: -2642.8,
    worldY: -69.55,
    mapX: 3673.248355806245,
    mapY: 4248.204319335728,
  },
  {
    worldX: -1878.04,
    worldY: -504.6,
    mapX: 4297.12359071275,
    mapY: 3894.808573381221,
  },
  {
    worldX: 601.42,
    worldY: 951.61,
    mapX: 6310.490586462819,
    mapY: 5076.20282062627,
  },
  {
    worldX: 160.96,
    worldY: 1313.75,
    mapX: 5954.478465837336,
    mapY: 5370.426503288192,
  },
  {
    worldX: 9.98,
    worldY: 1346.7,
    mapX: 5831.997431831168,
    mapY: 5394.979857344888,
  },
  {
    worldX: 1732.24,
    worldY: -1068.42,
    mapX: 7229.988130142574,
    mapY: 3432.0726296750454,
  },
  {
    worldX: 1742.88,
    worldY: -1075.31,
    mapX: 7242.987426299615,
    mapY: 3429.0733021720366,
  },
  {
    worldX: 2000.41,
    worldY: -1002.11,
    mapX: 7444.979765239721,
    mapY: 3491.06265430301,
  },
];

// Quadratic calibration based on seventeen verified reference points.
// Update workflow:
// 1. Add verified entries to WORLD_MAP_CALIBRATION_POINTS using precise world
//    X/Y values and manually corrected Explorer map X/Y positions.
// 2. Distribute points broadly across the map; avoid clusters unless they are
//    needed to confirm local accuracy.
// 3. Run regenerateQuadraticCalibration(), review residuals for bad points,
//    and copy the generated coefficients into the constants below.
// 4. Run verifyStoredCalibrationConstants() before deployment.
// Adding points without regenerating these constants does not affect runtime
// placement, and one incorrect point can degrade placement across the map.
// Current fit: mean error ~1.852 map units, RMS error ~2.113 map units,
// maximum observed error ~3.724 map units.
const WORLD_TO_MAP_POLYNOMIAL_TERMS = ["1", "x", "y", "x*x", "x*y", "y*y"];
const CALIBRATION_RESIDUAL_THRESHOLD = 4;
const COEFFICIENT_ABSOLUTE_TOLERANCE = 1e-7;
const COEFFICIENT_RELATIVE_TOLERANCE = 1e-9;
const MAP_X_COEFFICIENTS = [
  5823.154897840979,
  0.811282831465505,
  -0.0005226942601421602,
  -0.0000006534982302020235,
  -0.0000013133501556007826,
  0.0000009544682652969938,
];
const MAP_Y_COEFFICIENTS = [
  4300.110864366256,
  0.0010112583137612268,
  0.8115985827620629,
  0.0000007438733443848256,
  0.000002233843361543519,
  0.000001695871407241305,
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

  return WORLD_MAP_CALIBRATION_POINTS.map((point, index) => {
    const calculated = calculate(point.worldX, point.worldY);
    const errorX = calculated.x - point.mapX;
    const errorY = calculated.y - point.mapY;

    return {
      index: index + 1,
      world: {
        x: point.worldX,
        y: point.worldY,
      },
      expected: {
        x: point.mapX,
        y: point.mapY,
      },
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
  const maxErrorPoint = report.find((row) => row.distanceError === maxError);

  return {
    pointCount: report.length,
    meanError,
    rmsError,
    maxError,
    maxErrorPoint: maxErrorPoint ? maxErrorPoint.index : null,
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
  if (WORLD_MAP_CALIBRATION_POINTS.length < WORLD_TO_MAP_POLYNOMIAL_TERMS.length) {
    throw new Error("At least six calibration points are required.");
  }

  const termCount = WORLD_TO_MAP_POLYNOMIAL_TERMS.length;
  const normalMatrix = Array.from({ length: termCount }, () =>
    Array(termCount).fill(0)
  );
  const normalVector = Array(termCount).fill(0);

  WORLD_MAP_CALIBRATION_POINTS.forEach((point) => {
    const terms = getWorldToMapPolynomialTerms(point.worldX, point.worldY);
    const target = point[targetKey];

    for (let row = 0; row < termCount; row += 1) {
      normalVector[row] += terms[row] * target;

      for (let column = 0; column < termCount; column += 1) {
        normalMatrix[row][column] += terms[row] * terms[column];
      }
    }
  });

  return solveLinearSystem(normalMatrix, normalVector);
}

function getCoefficientComparisons(regenerated, stored) {
  return regenerated.map((regeneratedCoefficient, index) => {
    const storedCoefficient = stored[index];
    const difference = storedCoefficient - regeneratedCoefficient;
    const tolerance =
      COEFFICIENT_ABSOLUTE_TOLERANCE +
      COEFFICIENT_RELATIVE_TOLERANCE * Math.abs(regeneratedCoefficient);

    return {
      index,
      stored: storedCoefficient,
      regenerated: regeneratedCoefficient,
      difference,
      tolerance,
      withinTolerance: Math.abs(difference) <= tolerance,
    };
  });
}

function getCalibrationWarnings(summary, coefficientComparisons, coefficients) {
  const warnings = [];
  const hasInvalidCoefficient = coefficients.some(
    (coefficient) => !Number.isFinite(coefficient)
  );

  const hasMaterialCoefficientDifference = [
    ...coefficientComparisons.mapX,
    ...coefficientComparisons.mapY,
  ].some((comparison) => !comparison.withinTolerance);

  if (WORLD_MAP_CALIBRATION_POINTS.length < WORLD_TO_MAP_POLYNOMIAL_TERMS.length) {
    warnings.push("At least six calibration points are required.");
  }

  if (
    WORLD_MAP_CALIBRATION_POINTS.some(
      (point) =>
        !Number.isFinite(point.worldX) ||
        !Number.isFinite(point.worldY) ||
        !Number.isFinite(point.mapX) ||
        !Number.isFinite(point.mapY)
    )
  ) {
    warnings.push("One or more calibration points contain invalid numbers.");
  }

  if (coefficients.some((coefficient) => !Number.isFinite(coefficient))) {
    warnings.push("One or more coefficients are NaN or infinite.");
  }

  if (summary.maxError > CALIBRATION_RESIDUAL_THRESHOLD) {
    warnings.push("One or more calibration points exceed 4 map units.");
  }

  if (hasInvalidCoefficient) {
    warnings.push("One or more stored or regenerated coefficients are invalid.");
  }

  if (hasMaterialCoefficientDifference) {
    warnings.push("Solved coefficients differ materially from stored values.");
  }

  return warnings;
}

function formatCoefficientBlock(mapXCoefficients, mapYCoefficients) {
  const formatArray = (name, coefficients) =>
    `const ${name} = [\n${coefficients
      .map((coefficient) => `  ${coefficient.toPrecision(17)},`)
      .join("\n")}\n];`;

  return [
    formatArray("MAP_X_COEFFICIENTS", mapXCoefficients),
    formatArray("MAP_Y_COEFFICIENTS", mapYCoefficients),
  ].join("\n");
}

function verifyStoredCalibrationConstants() {
  const solvedMapXCoefficients = solveQuadraticCoefficients("mapX");
  const solvedMapYCoefficients = solveQuadraticCoefficients("mapY");
  const report = getWorldToMapCalibrationReport();
  const summary = summarizeCalibrationReport(report);
  const coefficientComparisons = {
    mapX: getCoefficientComparisons(solvedMapXCoefficients, MAP_X_COEFFICIENTS),
    mapY: getCoefficientComparisons(solvedMapYCoefficients, MAP_Y_COEFFICIENTS),
  };
  const warnings = getCalibrationWarnings(summary, coefficientComparisons, [
    ...MAP_X_COEFFICIENTS,
    ...MAP_Y_COEFFICIENTS,
    ...solvedMapXCoefficients,
    ...solvedMapYCoefficients,
  ]);
  const result = {
    residuals: report,
    ...summary,
    coefficientComparisons,
    warnings,
  };

  if (warnings.length) {
    console.warn("Calibration verification warnings:", warnings);
  }

  return result;
}

function verifyWorldToMapCalibration() {
  return verifyStoredCalibrationConstants();
}

function regenerateQuadraticCalibration() {
  const mapXCoefficients = solveQuadraticCoefficients("mapX");
  const mapYCoefficients = solveQuadraticCoefficients("mapY");
  const report = getWorldToMapCalibrationReport(
    mapXCoefficients,
    mapYCoefficients
  );
  const summary = summarizeCalibrationReport(report);
  const coefficientComparisons = {
    mapX: getCoefficientComparisons(mapXCoefficients, MAP_X_COEFFICIENTS),
    mapY: getCoefficientComparisons(mapYCoefficients, MAP_Y_COEFFICIENTS),
  };
  const warnings = getCalibrationWarnings(summary, coefficientComparisons, [
    ...mapXCoefficients,
    ...mapYCoefficients,
    ...MAP_X_COEFFICIENTS,
    ...MAP_Y_COEFFICIENTS,
  ]);
  const copyPasteConstants = formatCoefficientBlock(
    mapXCoefficients,
    mapYCoefficients
  );

  const result = {
    terms: [...WORLD_TO_MAP_POLYNOMIAL_TERMS],
    coefficients: {
      mapX: mapXCoefficients,
      mapY: mapYCoefficients,
    },
    coefficientComparisons,
    copyPasteConstants,
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
  console.log("Copy/paste-ready constants:\n" + copyPasteConstants);
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

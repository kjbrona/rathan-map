/*
==================================================
RosalitaRP Explorer
Version : 1.3.34
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

const WORLD_MAP_CALIBRATION_URL = `data/calibration/world-map-calibration.json?v=${encodeURIComponent(
  APP_VERSION
)}`;
const ACTIVE_WORLD_TO_MAP_MODEL = "quadratic";
const CALIBRATION_RESIDUAL_THRESHOLD = 5;
const COEFFICIENT_ABSOLUTE_TOLERANCE = 1e-7;
const COEFFICIENT_RELATIVE_TOLERANCE = 1e-9;

// Calibration workflow:
// 1. Add a verified point to data/calibration/world-map-calibration.json.
// 2. Keep points distributed across the map; clustered points can overweight
//    one region, and one incorrect point can degrade placement everywhere.
// 3. Run regenerateQuadraticCalibration().
// 4. Review residuals, especially the worst five points.
// 5. Investigate unusually high residuals before trusting the new fit.
// 6. Copy the generated production coefficients into the active model below.
// 7. Run verifyStoredCalibrationConstants().
// 8. Deploy after the stored constants match the regenerated constants.
// Adding calibration points without regenerating the production constants does
// not change normal runtime placement.
const MAP_X_COEFFICIENTS = [
  5822.8052572682182,
  0.81214533384018861,
  -0.00036808178124017273,
  -0.00000029281008996157244,
  -0.00000021135276124776037,
  0.00000079928807969281808,
];
const MAP_Y_COEFFICIENTS = [
  4301.314238184159,
  -0.001440100560670778,
  0.8111650477879162,
  -0.00000029915142309581134,
  -0.00000094383662391171952,
  0.0000019511209082346792,
];

const WORLD_TO_MAP_MODELS = {
  quadratic: {
    terms: ["1", "x", "y", "x*x", "x*y", "y*y"],
    getTerms(worldX, worldY) {
      return [
        1,
        worldX,
        worldY,
        worldX * worldX,
        worldX * worldY,
        worldY * worldY,
      ];
    },
    mapXCoefficients: MAP_X_COEFFICIENTS,
    mapYCoefficients: MAP_Y_COEFFICIENTS,
  },
};

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

  const model = WORLD_TO_MAP_MODELS[ACTIVE_WORLD_TO_MAP_MODEL];
  const terms = model.getTerms(x, y);

  return {
    x: dotProduct(model.mapXCoefficients, terms),
    y: dotProduct(model.mapYCoefficients, terms),
  };
}

function isMapCoordinateInBounds(x, y) {
  return x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT;
}

async function loadWorldMapCalibrationPoints() {
  const response = await fetch(WORLD_MAP_CALIBRATION_URL);

  if (!response.ok) {
    throw new Error(`Unable to load calibration data: ${response.status}`);
  }

  return normalizeCalibrationPoints(await response.json());
}

function normalizeCalibrationPoints(points) {
  if (!Array.isArray(points)) {
    throw new Error("Calibration data must be an array.");
  }

  return points.map((point, index) => {
    const id = Number(point.id);
    const worldX = Number(point.world && point.world.x);
    const worldY = Number(point.world && point.world.y);
    const worldZ =
      point.world && point.world.z !== null && point.world.z !== undefined
        ? Number(point.world.z)
        : null;
    const mapX = Number(point.map && point.map.x);
    const mapY = Number(point.map && point.map.y);

    return {
      id: Number.isFinite(id) ? id : index + 1,
      name: String(point.name || `Calibration Point ${index + 1}`),
      world: {
        x: worldX,
        y: worldY,
        z: Number.isFinite(worldZ) ? worldZ : null,
      },
      map: {
        x: mapX,
        y: mapY,
      },
      verified: point.verified === true,
      notes: String(point.notes || ""),
    };
  });
}

function getDuplicateValues(points, getKey) {
  const counts = new Map();

  points.forEach((point) => {
    const key = getKey(point);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function getCalibrationDataWarnings(points) {
  const warnings = [];
  const duplicateIds = getDuplicateValues(points, (point) => String(point.id));
  const duplicateWorldCoordinates = getDuplicateValues(
    points,
    (point) => `${point.world.x},${point.world.y}`
  );
  const duplicateMapCoordinates = getDuplicateValues(
    points,
    (point) => `${point.map.x},${point.map.y}`
  );
  const unverifiedPoints = points.filter((point) => !point.verified);

  if (duplicateIds.length) {
    warnings.push(`Duplicate calibration IDs: ${duplicateIds.join(", ")}`);
  }

  if (duplicateWorldCoordinates.length) {
    warnings.push(
      `Duplicate world coordinates: ${duplicateWorldCoordinates.join("; ")}`
    );
  }

  if (duplicateMapCoordinates.length) {
    warnings.push(
      `Duplicate map coordinates: ${duplicateMapCoordinates.join("; ")}`
    );
  }

  if (unverifiedPoints.length) {
    warnings.push(
      `Unverified calibration points: ${unverifiedPoints
        .map((point) => `#${point.id}`)
        .join(", ")}`
    );
  }

  if (
    points.some(
      (point) =>
        !Number.isFinite(point.world.x) ||
        !Number.isFinite(point.world.y) ||
        !Number.isFinite(point.map.x) ||
        !Number.isFinite(point.map.y)
    )
  ) {
    warnings.push("One or more calibration points contain invalid numbers.");
  }

  return warnings;
}

function calculateWithCalibrationModel(model, worldX, worldY) {
  const terms = model.getTerms(worldX, worldY);

  return {
    x: dotProduct(model.mapXCoefficients, terms),
    y: dotProduct(model.mapYCoefficients, terms),
  };
}

function getWorldToMapCalibrationReport(
  points,
  model = WORLD_TO_MAP_MODELS[ACTIVE_WORLD_TO_MAP_MODEL]
) {
  return points.map((point) => {
    const calculated = calculateWithCalibrationModel(
      model,
      point.world.x,
      point.world.y
    );
    const errorX = calculated.x - point.map.x;
    const errorY = calculated.y - point.map.y;

    return {
      id: point.id,
      name: point.name,
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
  const maxErrorPoint = report.find((row) => row.distanceError === maxError);
  const worstFivePoints = [...report]
    .sort((a, b) => b.distanceError - a.distanceError)
    .slice(0, 5);

  return {
    pointCount: report.length,
    meanError,
    rmsError,
    maxError,
    maxErrorPoint: maxErrorPoint ? maxErrorPoint.id : null,
    worstFivePoints,
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

function solveQuadraticCoefficients(points, targetKey) {
  const model = WORLD_TO_MAP_MODELS.quadratic;

  if (points.length < model.terms.length) {
    throw new Error("At least six calibration points are required.");
  }

  const termCount = model.terms.length;
  const normalMatrix = Array.from({ length: termCount }, () =>
    Array(termCount).fill(0)
  );
  const normalVector = Array(termCount).fill(0);

  points.forEach((point) => {
    const terms = model.getTerms(point.world.x, point.world.y);
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

  if (coefficients.some((coefficient) => !Number.isFinite(coefficient))) {
    warnings.push("One or more coefficients are NaN or infinite.");
  }

  if (summary.maxError > CALIBRATION_RESIDUAL_THRESHOLD) {
    warnings.push(
      `One or more calibration points exceed ${CALIBRATION_RESIDUAL_THRESHOLD} map units.`
    );
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
    `export const ${name} = [\n${coefficients
      .map((coefficient) => `  ${coefficient.toPrecision(17)},`)
      .join("\n")}\n];`;

  return [
    formatArray("MAP_X_COEFFICIENTS", mapXCoefficients),
    formatArray("MAP_Y_COEFFICIENTS", mapYCoefficients),
  ].join("\n");
}

async function verifyStoredCalibrationConstants() {
  const points = await loadWorldMapCalibrationPoints();
  const solvedMapXCoefficients = solveQuadraticCoefficients(points, "x");
  const solvedMapYCoefficients = solveQuadraticCoefficients(points, "y");
  const report = getWorldToMapCalibrationReport(points);
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
  warnings.push(...getCalibrationDataWarnings(points));

  const result = {
    residuals: report,
    ...summary,
    coefficientComparisons,
    warnings,
  };

  printCalibrationReport(result, "Stored Calibration Verification");

  return result;
}

function verifyWorldToMapCalibration() {
  return verifyStoredCalibrationConstants();
}

async function regenerateQuadraticCalibration() {
  const points = await loadWorldMapCalibrationPoints();
  const mapXCoefficients = solveQuadraticCoefficients(points, "x");
  const mapYCoefficients = solveQuadraticCoefficients(points, "y");
  const model = {
    ...WORLD_TO_MAP_MODELS.quadratic,
    mapXCoefficients,
    mapYCoefficients,
  };
  const report = getWorldToMapCalibrationReport(points, model);
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
  warnings.push(...getCalibrationDataWarnings(points));

  const copyPasteConstants = formatCoefficientBlock(
    mapXCoefficients,
    mapYCoefficients
  );

  const result = {
    terms: [...WORLD_TO_MAP_MODELS.quadratic.terms],
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

  printCalibrationReport(result, "Regenerated Quadratic Calibration");
  console.log("Copy/paste-ready constants:\n" + copyPasteConstants);

  return result;
}

function printCalibrationReport(result, title) {
  console.log(title);
  console.table(
    result.residuals.map((row) => ({
      id: row.id,
      name: row.name,
      expectedX: row.expected.x,
      expectedY: row.expected.y,
      calculatedX: row.calculated.x,
      calculatedY: row.calculated.y,
      errorX: row.errorX,
      errorY: row.errorY,
      distanceError: row.distanceError,
    }))
  );
  console.log("Calibration Summary", {
    totalPoints: result.pointCount,
    meanError: result.meanError,
    rmsError: result.rmsError,
    maximumError: result.maxError,
    maximumErrorPoint: result.maxErrorPoint,
    worstFivePoints: result.worstFivePoints.map(
      (row) => `#${row.id} ${row.distanceError.toFixed(2)} px`
    ),
  });

  if (result.warnings.length) {
    console.warn("Calibration warnings:", result.warnings);
  }

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

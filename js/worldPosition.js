/*
==================================================
RosalitaRP Explorer
Version : 1.3.29
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
];

const WORLD_TO_MAP_CALIBRATION = {
  // Based on seven verified world/vector-to-map reference points.
  // Current average calibration error is approximately 1.36 map units.
  // Maximum observed error is approximately 3 map units. Additional widely
  // distributed calibration points may refine this affine transform further.
  mapX: {
    worldX: 0.812851249,
    worldY: -0.000700411,
    offset: 5823.75532,
  },
  mapY: {
    worldX: 0.00179219,
    worldY: 0.807158004,
    offset: 4302.05021,
  },
};

function worldToMapCoordinates(worldX, worldY) {
  const x = Number(worldX);
  const y = Number(worldY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x:
      WORLD_TO_MAP_CALIBRATION.mapX.worldX * x +
      WORLD_TO_MAP_CALIBRATION.mapX.worldY * y +
      WORLD_TO_MAP_CALIBRATION.mapX.offset,
    y:
      WORLD_TO_MAP_CALIBRATION.mapY.worldX * x +
      WORLD_TO_MAP_CALIBRATION.mapY.worldY * y +
      WORLD_TO_MAP_CALIBRATION.mapY.offset,
  };
}

function isMapCoordinateInBounds(x, y) {
  return x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT;
}

function getWorldToMapCalibrationReport() {
  return WORLD_TO_MAP_CALIBRATION_POINTS.map((point, index) => {
    const calculated = worldToMapCoordinates(point.world.x, point.world.y);
    const xError = calculated.x - point.map.x;
    const yError = calculated.y - point.map.y;

    return {
      index: index + 1,
      world: { ...point.world },
      expected: { ...point.map },
      calculated,
      xError,
      yError,
      distanceError: Math.hypot(xError, yError),
    };
  });
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

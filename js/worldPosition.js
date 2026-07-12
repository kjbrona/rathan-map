/*
==================================================
RosalitaRP Explorer
Version : 1.3.28
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

const WORLD_TO_MAP_CALIBRATION = {
  // Based on four verified world/vector-to-map reference points. These
  // affine coefficients are centralized so the transform can be refined later.
  mapX: {
    worldX: 0.7641999688424812,
    worldY: -0.051814779077236306,
    offset: 5706.986099656074,
  },
  mapY: {
    worldX: -0.040141921479222686,
    worldY: 0.7628829230834919,
    offset: 4201.391339084458,
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

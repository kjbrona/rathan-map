from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
REGISTRATION_PATH = ROOT / "data" / "candidate-survey" / "source-map-registration.json"


def load_source_map_registration(path: Path = REGISTRATION_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def solve_affine_transform(control_points: list[dict]) -> np.ndarray:
    if len(control_points) < 3:
        raise ValueError("At least three control points are required for affine registration.")

    matrix_rows = []
    target_values = []

    for point in control_points:
        sx = float(point["sourceVisual"]["x"])
        sy = float(point["sourceVisual"]["y"])
        ex = float(point["explorerVisual"]["x"])
        ey = float(point["explorerVisual"]["y"])
        matrix_rows.append([sx, sy, 1, 0, 0, 0])
        matrix_rows.append([0, 0, 0, sx, sy, 1])
        target_values.extend([ex, ey])

    coefficients, *_ = np.linalg.lstsq(
        np.array(matrix_rows, dtype=float),
        np.array(target_values, dtype=float),
        rcond=None,
    )

    return coefficients.reshape(2, 3)


def normalize_points(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    centroid = points.mean(axis=0)
    centered = points - centroid
    mean_distance = np.sqrt((centered * centered).sum(axis=1)).mean()
    scale = math.sqrt(2) / mean_distance if mean_distance else 1.0
    transform = np.array(
        [
            [scale, 0, -scale * centroid[0]],
            [0, scale, -scale * centroid[1]],
            [0, 0, 1],
        ],
        dtype=float,
    )
    homogeneous = np.column_stack([points, np.ones(len(points))])
    normalized = (transform @ homogeneous.T).T[:, :2]
    return normalized, transform


def solve_homography_transform(control_points: list[dict]) -> np.ndarray:
    if len(control_points) < 4:
        raise ValueError("At least four control points are required for homography registration.")

    source_points = np.array(
        [
            [float(point["sourceVisual"]["x"]), float(point["sourceVisual"]["y"])]
            for point in control_points
        ],
        dtype=float,
    )
    explorer_points = np.array(
        [
            [float(point["explorerVisual"]["x"]), float(point["explorerVisual"]["y"])]
            for point in control_points
        ],
        dtype=float,
    )
    normalized_source, source_transform = normalize_points(source_points)
    normalized_target, target_transform = normalize_points(explorer_points)
    rows = []

    for (sx, sy), (ex, ey) in zip(normalized_source, normalized_target):
        rows.append([-sx, -sy, -1, 0, 0, 0, ex * sx, ex * sy, ex])
        rows.append([0, 0, 0, -sx, -sy, -1, ey * sx, ey * sy, ey])

    _, _, vh = np.linalg.svd(np.array(rows, dtype=float))
    normalized_homography = vh[-1].reshape(3, 3)
    homography = np.linalg.inv(target_transform) @ normalized_homography @ source_transform

    return homography / homography[2, 2]


def transform_source_to_explorer(
    source_x: float,
    source_y: float,
    transform: np.ndarray,
) -> tuple[float, float]:
    source_vector = np.array([float(source_x), float(source_y), 1.0])

    if transform.shape == (2, 3):
        result = transform @ source_vector
        return float(result[0]), float(result[1])

    result = transform @ source_vector
    return float(result[0] / result[2]), float(result[1] / result[2])


def solve_source_map_registration(map_config: dict) -> dict:
    control_points = get_valid_control_points(map_config)
    model = map_config.get("model", "affine")

    if model == "homography":
        transform = solve_homography_transform(control_points)
    elif model == "affine":
        transform = solve_affine_transform(control_points)
    else:
        raise ValueError(f"Unsupported registration model: {model}")

    return {
        "model": model,
        "transform": transform,
    }


def compare_source_map_registration_models(map_config: dict) -> dict:
    control_points = get_valid_control_points(map_config)
    affine = {
        "model": "affine",
        "transform": solve_affine_transform(control_points),
    }
    homography = {
        "model": "homography",
        "transform": solve_homography_transform(control_points),
    }

    return {
        "affine": verify_source_map_registration(map_config, affine),
        "homography": verify_source_map_registration(map_config, homography),
    }


def verify_source_map_registration(map_config: dict, solved: dict | None = None) -> dict:
    solved = solved or solve_source_map_registration(map_config)
    transform = solved["transform"]
    control_points = get_valid_control_points(map_config)
    residuals = []

    for point in control_points:
        calculated_x, calculated_y = transform_source_to_explorer(
            point["sourceVisual"]["x"],
            point["sourceVisual"]["y"],
            transform,
        )
        expected_x = float(point["explorerVisual"]["x"])
        expected_y = float(point["explorerVisual"]["y"])
        x_error = calculated_x - expected_x
        y_error = calculated_y - expected_y
        distance_error = math.hypot(x_error, y_error)
        residuals.append(
            {
                "name": point["name"],
                "sourceX": point["sourceVisual"]["x"],
                "sourceY": point["sourceVisual"]["y"],
                "expectedX": expected_x,
                "expectedY": expected_y,
                "calculatedX": calculated_x,
                "calculatedY": calculated_y,
                "xResidual": x_error,
                "yResidual": y_error,
                "distanceError": distance_error,
            }
        )

    errors = [residual["distanceError"] for residual in residuals]
    mean_error = sum(errors) / len(errors) if errors else 0
    rms_error = math.sqrt(sum(error * error for error in errors) / len(errors)) if errors else 0
    max_error = max(errors) if errors else 0
    worst_points = sorted(residuals, key=lambda item: item["distanceError"], reverse=True)[:5]

    return {
        "model": solved["model"],
        "controlPointCount": len(residuals),
        "transform": transform.tolist(),
        "meanError": mean_error,
        "rmsError": rms_error,
        "maxError": max_error,
        "worstPoints": worst_points,
        "residuals": residuals,
    }


def get_valid_control_points(map_config: dict) -> list[dict]:
    points = [
        point
        for point in map_config.get("controlPoints", [])
        if not point.get("retired")
        and point.get("selection") == "independent-manual"
        and point.get("sourceCoordinateMethod") == "manual-click"
        and point.get("explorerCoordinateMethod") == "manual-click"
        and "sourceVisual" in point
        and "explorerVisual" in point
    ]

    if len(points) < 3:
        raise ValueError(
            f"{map_config.get('name', '<unknown map>')} does not have enough independent visual control points."
        )

    return points


def summarize_errors(residuals: list[dict]) -> dict:
    errors = [residual["distanceError"] for residual in residuals]
    if not errors:
        return {
            "meanError": None,
            "medianError": None,
            "rmsError": None,
            "maxError": None,
            "worstPoints": [],
        }

    sorted_errors = sorted(errors)
    middle = len(sorted_errors) // 2
    median_error = (
        sorted_errors[middle]
        if len(sorted_errors) % 2
        else (sorted_errors[middle - 1] + sorted_errors[middle]) / 2
    )
    return {
        "meanError": sum(errors) / len(errors),
        "medianError": median_error,
        "rmsError": math.sqrt(sum(error * error for error in errors) / len(errors)),
        "maxError": max(errors),
        "worstPoints": sorted(residuals, key=lambda item: item["distanceError"], reverse=True)[:5],
    }


def leave_one_out_validation(map_config: dict, model: str) -> dict:
    points = get_valid_control_points(map_config)
    minimum = 4 if model == "homography" else 3
    if len(points) <= minimum:
        raise ValueError(f"At least {minimum + 1} points are required for {model} leave-one-out validation.")

    residuals = []
    for index, excluded in enumerate(points):
        training = points[:index] + points[index + 1 :]
        transform = (
            solve_homography_transform(training)
            if model == "homography"
            else solve_affine_transform(training)
        )
        calculated_x, calculated_y = transform_source_to_explorer(
            excluded["sourceVisual"]["x"],
            excluded["sourceVisual"]["y"],
            transform,
        )
        expected_x = float(excluded["explorerVisual"]["x"])
        expected_y = float(excluded["explorerVisual"]["y"])
        x_error = calculated_x - expected_x
        y_error = calculated_y - expected_y
        residuals.append(
            {
                "name": excluded["name"],
                "sourceX": excluded["sourceVisual"]["x"],
                "sourceY": excluded["sourceVisual"]["y"],
                "expectedX": expected_x,
                "expectedY": expected_y,
                "calculatedX": calculated_x,
                "calculatedY": calculated_y,
                "xResidual": x_error,
                "yResidual": y_error,
                "distanceError": math.hypot(x_error, y_error),
            }
        )

    return {
        "model": model,
        "controlPointCount": len(points),
        "residuals": residuals,
        **summarize_errors(residuals),
    }


def get_registration_by_source_name(source_name: str) -> tuple[str, dict, dict]:
    registration = load_source_map_registration()

    for map_id, map_config in registration["maps"].items():
        if map_config["name"] == source_name:
            solved = solve_source_map_registration(map_config)
            return map_id, map_config, solved

    raise KeyError(f"No source-map registration exists for {source_name}")

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np

from candidate_coordinate_conventions import (
    EXPLORER_MAP_HEIGHT,
    EXPLORER_MAP_WIDTH,
    explorer_y_to_visual_image_y,
)
from source_map_registration import (
    compare_source_map_registration_models,
    load_source_map_registration,
    solve_source_map_registration,
    transform_source_to_explorer,
    verify_source_map_registration,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "candidate-survey" / "registration-audit"
BASE_MAP_PATH = ROOT / "images" / "rdr2-map.jpg"
DETECTIONS_PATH = ROOT / "candidate-survey" / "wildflower-candidate-survey-detections.csv"
QUALITY_CANDIDATES_PATH = (
    ROOT / "candidate-survey" / "phase2" / "wildflower-candidate-survey-quality.json"
)
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"
PIN_CROP_DIR = OUTPUT_DIR / "pin-anchor-crops"


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def draw_source_control_points(map_id: str, map_config: dict) -> Path:
    image = Image.open(map_config["sourceImage"]).convert("RGB")
    draw = ImageDraw.Draw(image)

    for index, point in enumerate(map_config["controlPoints"], start=1):
        x = point["sourceVisual"]["x"]
        y = point["sourceVisual"]["y"]
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill="#ff2f2f", outline="white", width=2)
        draw.text((x + 10, y - 10), f"{index} {point['name']}", fill="#ff2f2f")

    path = OUTPUT_DIR / f"{map_id}-source-control-points.png"
    image.save(path)
    return path


def draw_explorer_control_points(map_id: str, map_config: dict, transform, base: Image.Image) -> Path:
    width = 1800
    height = round(base.height * width / base.width)
    scale_x = width / base.width
    scale_y = height / base.height
    image = base.resize((width, height), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)

    for index, point in enumerate(map_config["controlPoints"], start=1):
        expected_x = point["explorer"]["x"]
        expected_y = point["explorer"]["y"]
        calculated_x, calculated_y = transform_source_to_explorer(
            point["sourceVisual"]["x"], point["sourceVisual"]["y"], transform
        )
        ex = expected_x * scale_x
        ey = explorer_y_to_visual_image_y(expected_y, base.height) * scale_y
        cx = calculated_x * scale_x
        cy = explorer_y_to_visual_image_y(calculated_y, base.height) * scale_y
        draw.ellipse((ex - 5, ey - 5, ex + 5, ey + 5), fill="#2dd36f", outline="white", width=1)
        draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill="#ff2f2f")
        draw.line((ex, ey, cx, cy), fill="#ff2f2f", width=1)
        draw.text((ex + 7, ey - 7), f"{index} {point['name']}", fill="#ffffff")

    path = OUTPUT_DIR / f"{map_id}-explorer-control-points.jpg"
    image.save(path, quality=92)
    return path


def draw_warped_overlay(map_id: str, map_config: dict, transform, base: Image.Image) -> Path:
    if transform.shape != (2, 3):
        raise ValueError("Warped audit overlay currently supports affine registration only.")

    width = 1800
    height = round(base.height * width / base.width)
    base_thumb = base.resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    source = Image.open(map_config["sourceImage"]).convert("RGBA")
    scale_x = width / base.width
    scale_y = height / base.height

    # The registration transform returns Explorer app Y. Convert it back to
    # top-left visual Y before drawing onto a raster audit image.
    visual_transform = np.array(
        [
            [
                transform[0, 0] * scale_x,
                transform[0, 1] * scale_x,
                transform[0, 2] * scale_x,
            ],
            [
                -transform[1, 0] * scale_y,
                -transform[1, 1] * scale_y,
                (EXPLORER_MAP_HEIGHT - transform[1, 2]) * scale_y,
            ],
            [0, 0, 1],
        ],
        dtype=float,
    )
    inverse = np.linalg.inv(visual_transform)
    coeffs = (
        inverse[0, 0],
        inverse[0, 1],
        inverse[0, 2],
        inverse[1, 0],
        inverse[1, 1],
        inverse[1, 2],
    )
    warped = source.transform(
        (width, height),
        Image.Transform.AFFINE,
        coeffs,
        resample=Image.Resampling.BILINEAR,
    )
    warped.putalpha(110)
    combined = Image.alpha_composite(base_thumb, warped)
    path = OUTPUT_DIR / f"{map_id}-warped-source-overlay.jpg"
    combined.convert("RGB").save(path, quality=92)
    return path


def load_detections_by_source() -> dict[str, list[dict]]:
    detections: dict[str, list[dict]] = {}

    if not DETECTIONS_PATH.exists():
        return detections

    with DETECTIONS_PATH.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row.get("status") != "classified":
                continue

            detections.setdefault(row["source"], []).append(
                {
                    "imageX": float(row["imageX"]),
                    "imageY": float(row["imageY"]),
                    "type": row.get("type", ""),
                    "bboxX1": float(row.get("bboxX1") or 0),
                    "bboxY1": float(row.get("bboxY1") or 0),
                    "bboxX2": float(row.get("bboxX2") or 0),
                    "bboxY2": float(row.get("bboxY2") or 0),
                }
            )

    return detections


def draw_candidate_overlay(
    map_id: str,
    map_config: dict,
    transform,
    base: Image.Image,
    detections_by_source: dict[str, list[dict]],
) -> Path:
    width = 1800
    height = round(base.height * width / base.width)
    scale_x = width / base.width
    scale_y = height / base.height
    image = base.resize((width, height), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)

    for detection in detections_by_source.get(map_config["name"], []):
        x, y = transform_source_to_explorer(
            detection["imageX"], detection["imageY"], transform
        )
        tx = x * scale_x
        ty = explorer_y_to_visual_image_y(y, base.height) * scale_y
        draw.ellipse((tx - 4, ty - 4, tx + 4, ty + 4), fill="#00a6ff", outline="white", width=1)

    path = OUTPUT_DIR / f"{map_id}-transformed-candidate-pins.jpg"
    image.save(path, quality=92)
    return path


def draw_source_detection_overlay(
    map_id: str,
    map_config: dict,
    detections_by_source: dict[str, list[dict]],
) -> Path:
    image = Image.open(map_config["sourceImage"]).convert("RGB")
    draw = ImageDraw.Draw(image)

    for index, detection in enumerate(detections_by_source.get(map_config["name"], []), start=1):
        x = detection["imageX"]
        y = detection["imageY"]
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill="#00a6ff", outline="white", width=1)
        if index % 8 == 1:
            draw.text((x + 7, y - 8), str(index), fill="#00324d")

    path = OUTPUT_DIR / f"{map_id}-source-detection-pins.png"
    image.save(path)
    return path


def create_pin_anchor_crops(
    map_configs: dict[str, dict],
    detections_by_source: dict[str, list[dict]],
) -> list[Path]:
    PIN_CROP_DIR.mkdir(parents=True, exist_ok=True)
    generated = []
    selected: list[tuple[str, dict, dict]] = []

    for map_id, map_config in map_configs.items():
        detections = detections_by_source.get(map_config["name"], [])
        if not detections:
            continue

        step = max(1, len(detections) // 4)
        for detection in detections[::step][:4]:
            selected.append((map_id, map_config, detection))

    selected = selected[:12]

    for index, (map_id, map_config, detection) in enumerate(selected, start=1):
        source = Image.open(map_config["sourceImage"]).convert("RGB")
        x = detection["imageX"]
        y = detection["imageY"]
        margin = 42
        crop_box = (
            max(0, int(detection["bboxX1"]) - margin),
            max(0, int(detection["bboxY1"]) - margin),
            min(source.width, int(detection["bboxX2"]) + margin),
            min(source.height, int(detection["bboxY2"]) + margin),
        )
        crop = source.crop(crop_box)
        scale = 4
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.NEAREST)
        draw = ImageDraw.Draw(crop)
        bx1 = (detection["bboxX1"] - crop_box[0]) * scale
        by1 = (detection["bboxY1"] - crop_box[1]) * scale
        bx2 = (detection["bboxX2"] - crop_box[0]) * scale
        by2 = (detection["bboxY2"] - crop_box[1]) * scale
        tx = (x - crop_box[0]) * scale
        ty = (y - crop_box[1]) * scale
        draw.rectangle((bx1, by1, bx2, by2), outline="#00a6ff", width=3)
        draw.line((tx - 12, ty, tx + 12, ty), fill="#ff2f2f", width=3)
        draw.line((tx, ty - 12, tx, ty + 12), fill="#ff2f2f", width=3)

        solved = solve_source_map_registration(map_config)
        explorer_x, explorer_y = transform_source_to_explorer(x, y, solved["transform"])
        label = (
            f"{map_config['name']} | {detection['type']} | "
            f"tip ({x:.1f}, {y:.1f}) -> Explorer ({explorer_x:.1f}, {explorer_y:.1f})"
        )
        draw.rectangle((0, 0, crop.width, 22), fill="#000000")
        draw.text((6, 5), label, fill="#ffffff")
        path = PIN_CROP_DIR / f"pin-anchor-crop-{index:02d}-{map_id}.png"
        crop.save(path)
        generated.append(path)

    return generated


def load_existing_herb_markers() -> list[dict]:
    data = json.loads(EXPORT_PATH.read_text(encoding="utf-8"))
    markers = data.get("markers", data if isinstance(data, list) else [])
    return [
        marker
        for marker in markers
        if marker.get("category") == "herbs"
        and isinstance(marker.get("x"), (int, float))
        and isinstance(marker.get("y"), (int, float))
    ]


def nearest_same_type_distance(candidate: dict, markers: list[dict]) -> float | None:
    distances = [
        math.hypot(float(marker["x"]) - float(candidate["x"]), float(marker["y"]) - float(candidate["y"]))
        for marker in markers
        if marker.get("type") == candidate.get("type")
    ]
    return min(distances) if distances else None


def median(values: list[float]) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    middle = len(sorted_values) // 2
    if len(sorted_values) % 2:
        return sorted_values[middle]
    return (sorted_values[middle - 1] + sorted_values[middle]) / 2


def simple_raster_scaled_candidate(row: dict, source_image: Image.Image) -> dict:
    return {
        "type": row["type"],
        "x": float(row["imageX"]) * EXPLORER_MAP_WIDTH / source_image.width,
        "y": float(row["imageY"]) * EXPLORER_MAP_HEIGHT / source_image.height,
    }


def write_existing_marker_distance_report(registration: dict) -> dict:
    markers = load_existing_herb_markers()
    current_candidates = json.loads(QUALITY_CANDIDATES_PATH.read_text(encoding="utf-8"))
    current_distances = [
        distance
        for candidate in current_candidates
        if (distance := nearest_same_type_distance(candidate, markers)) is not None
    ]

    source_images = {
        config["name"]: Image.open(config["sourceImage"])
        for config in registration["maps"].values()
    }
    previous_rows = []
    with DETECTIONS_PATH.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row.get("status") != "classified":
                continue
            previous_rows.append(simple_raster_scaled_candidate(row, source_images[row["source"]]))

    previous_distances = [
        distance
        for candidate in previous_rows
        if (distance := nearest_same_type_distance(candidate, markers)) is not None
    ]
    current_sample = []

    for candidate in current_candidates[:30]:
        nearest = candidate.get("nearestExistingMarker")
        current_sample.append(
            {
                "candidateId": candidate["candidateId"],
                "type": candidate["type"],
                "x": round(candidate["x"], 2),
                "y": round(candidate["y"], 2),
                "nearestExistingId": nearest.get("id", "") if nearest else "",
                "nearestExistingName": nearest.get("name", "") if nearest else "",
                "nearestDistance": round(nearest["distance"], 2) if nearest else "",
                "classification": candidate["classification"],
            }
        )

    sample_path = OUTPUT_DIR / "nearest-existing-marker-sample.csv"
    write_csv(sample_path, current_sample)
    report = {
        "matchingRule": "Nearest same-type existing Herb marker only.",
        "alreadyCoveredRadius": 125,
        "possibleMatchRadius": 300,
        "previousSimpleRasterScalingMedianDistance": median(previous_distances),
        "currentRegistrationMedianDistance": median(current_distances),
        "currentSameTypeCandidateCount": len(current_distances),
        "samplePath": str(sample_path),
    }
    report_path = OUTPUT_DIR / "nearest-existing-marker-distance-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    registration = load_source_map_registration()
    base = Image.open(BASE_MAP_PATH).convert("RGB")
    detections_by_source = load_detections_by_source()
    summary = {}
    generated_files = []

    for map_id, map_config in registration["maps"].items():
        solved = solve_source_map_registration(map_config)
        transform = solved["transform"]
        verification = verify_source_map_registration(map_config, solved)
        model_comparison = compare_source_map_registration_models(map_config)
        residual_rows = [
            {
                **row,
                "expectedX": round(row["expectedX"], 4),
                "expectedY": round(row["expectedY"], 4),
                "calculatedX": round(row["calculatedX"], 4),
                "calculatedY": round(row["calculatedY"], 4),
                "xResidual": round(row["xResidual"], 4),
                "yResidual": round(row["yResidual"], 4),
                "distanceError": round(row["distanceError"], 4),
            }
            for row in verification["residuals"]
        ]
        residual_csv = OUTPUT_DIR / f"{map_id}-registration-residuals.csv"
        residual_json = OUTPUT_DIR / f"{map_id}-registration-residuals.json"
        write_csv(residual_csv, residual_rows)
        residual_json.write_text(json.dumps(verification, indent=2), encoding="utf-8")
        generated_files.extend(
            [
                residual_csv,
                residual_json,
                draw_source_control_points(map_id, map_config),
                draw_explorer_control_points(map_id, map_config, transform, base),
                draw_warped_overlay(map_id, map_config, transform, base),
                draw_candidate_overlay(
                    map_id,
                    map_config,
                    transform,
                    base,
                    detections_by_source,
                ),
                draw_source_detection_overlay(
                    map_id,
                    map_config,
                    detections_by_source,
                ),
            ]
        )
        summary[map_id] = {
            "name": map_config["name"],
            "model": verification["model"],
            "geographicBounds": map_config.get("geographicBounds"),
            "blankMargins": map_config.get("blankMargins"),
            "controlPointSelection": map_config.get("controlPointSelection", ""),
            "controlPointCount": verification["controlPointCount"],
            "controlPointNames": [
                point["name"] for point in map_config["controlPoints"]
            ],
            "meanError": verification["meanError"],
            "rmsError": verification["rmsError"],
            "maxError": verification["maxError"],
            "worstPoints": verification["worstPoints"],
            "modelComparison": {
                model: {
                    "meanError": report["meanError"],
                    "rmsError": report["rmsError"],
                    "maxError": report["maxError"],
                }
                for model, report in model_comparison.items()
            },
        }

    summary_path = OUTPUT_DIR / "registration-summary.json"
    generated_files.extend(create_pin_anchor_crops(registration["maps"], detections_by_source))
    distance_report = write_existing_marker_distance_report(registration)
    summary["existingMarkerDistanceReport"] = distance_report
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    generated_files.append(summary_path)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

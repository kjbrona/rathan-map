from __future__ import annotations

import csv
import json
import math
import shutil
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from candidate_coordinate_conventions import (
    EXPLORER_MAP_HEIGHT,
    EXPLORER_MAP_WIDTH,
    explorer_visual_to_leaflet_coordinates,
    leaflet_to_explorer_visual_coordinates,
)
from source_map_registration import (
    get_valid_control_points,
    leave_one_out_validation,
    solve_affine_transform,
    solve_homography_transform,
    transform_source_to_explorer,
    verify_source_map_registration,
)


ROOT = Path(__file__).resolve().parents[1]
SURVEY_DIR = ROOT / "candidate-survey"
PREVIEW_DIR = SURVEY_DIR / "registration-v2-preview"
DETECTIONS_PATH = SURVEY_DIR / "wildflower-candidate-survey-detections.csv"
ACTIVE_QUALITY_PATH = SURVEY_DIR / "phase2" / "wildflower-candidate-survey-quality.json"
REGISTRATION_PATH = ROOT / "data" / "candidate-survey" / "source-map-registration.json"
BASE_MAP_PATH = ROOT / "images" / "rdr2-map.jpg"
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"

MERGE_DISTANCE = 60.0
ALREADY_COVERED_DISTANCE = 125.0
POSSIBLE_MATCH_DISTANCE = 300.0

TYPE_NAME_BY_ID = {
    "agarita": "Agarita",
    "bitterweed": "Bitterweed",
    "blood-flower": "Blood Flower",
    "cardinal-flower": "Cardinal Flower",
    "chocolate-daisy": "Chocolate Daisy",
    "creek-plum": "Creek Plum",
    "texas-bluebonnet": "Texas Bluebonnet",
    "wild-rhubarb": "Wild Rhubarb",
    "wisteria": "Wisteria",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def summarize_errors(report: dict) -> dict:
    return {
        "meanError": report["meanError"],
        "medianError": report.get("medianError"),
        "rmsError": report["rmsError"],
        "maxError": report["maxError"],
        "worstPoints": report["worstPoints"],
    }


def accepted(training: dict, loo: dict) -> bool:
    return (
        training["meanError"] < 12
        and training["rmsError"] < 18
        and training["maxError"] < 40
        and loo["meanError"] < 20
        and loo["rmsError"] < 28
        and loo["maxError"] < 60
    )


def choose_model(map_config: dict) -> dict:
    points = get_valid_control_points(map_config)
    if len(points) < 18:
        raise RuntimeError(
            f"{map_config['name']} has {len(points)} independent control points; 18 are required."
        )

    candidates = {}
    for model in ("affine", "homography"):
        transform = (
            solve_homography_transform(points)
            if model == "homography"
            else solve_affine_transform(points)
        )
        training = verify_source_map_registration(
            map_config,
            {"model": model, "transform": transform},
        )
        loo = leave_one_out_validation(map_config, model)
        candidates[model] = {
            "model": model,
            "transform": transform,
            "training": training,
            "leaveOneOut": loo,
            "accepted": accepted(training, loo),
        }

    if not candidates["affine"]["accepted"] and not candidates["homography"]["accepted"]:
        raise RuntimeError(
            f"{map_config['name']} did not meet registration acceptance criteria."
        )

    selected = candidates["affine"]
    homography = candidates["homography"]
    if homography["accepted"]:
        affine_loo_rms = selected["leaveOneOut"]["rmsError"]
        homography_loo_rms = homography["leaveOneOut"]["rmsError"]
        affine_loo_max = selected["leaveOneOut"]["maxError"]
        homography_loo_max = homography["leaveOneOut"]["maxError"]
        materially_better = (
            homography_loo_rms <= affine_loo_rms * 0.9
            and homography_loo_max <= affine_loo_max
        )
        if materially_better:
            selected = homography

    return {
        "selected": selected,
        "models": candidates,
    }


def source_inside_bounds(row: dict, map_config: dict) -> tuple[bool, str]:
    bounds = map_config.get("geographicBoundsVisual")
    if not bounds:
        return False, "source geographic bounds are not set"
    x = float(row["imageX"])
    y = float(row["imageY"])
    if x < bounds["left"] or x > bounds["right"] or y < bounds["top"] or y > bounds["bottom"]:
        return False, "source pin is outside source geographic content bounds"
    return True, ""


def load_detections() -> list[dict]:
    with DETECTIONS_PATH.open(newline="", encoding="utf-8") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def load_existing_herb_markers() -> list[dict]:
    data = read_json(EXPORT_PATH)
    markers = data.get("markers", data if isinstance(data, list) else [])
    return [
        marker
        for marker in markers
        if marker.get("category") == "herbs"
        and isinstance(marker.get("x"), (int, float))
        and isinstance(marker.get("y"), (int, float))
    ]


def nearest_same_type(candidate: dict, markers: list[dict]) -> dict | None:
    nearest = None
    for marker in markers:
        if marker.get("type") != candidate["type"]:
            continue
        distance = math.hypot(float(marker["x"]) - candidate["x"], float(marker["y"]) - candidate["y"])
        if nearest is None or distance < nearest["distance"]:
            nearest = {
                "id": marker.get("id", ""),
                "name": marker.get("name", ""),
                "type": marker.get("type", ""),
                "x": marker["x"],
                "y": marker["y"],
                "distance": distance,
            }
    return nearest


def classify(candidate: dict, markers: list[dict]) -> None:
    nearest = nearest_same_type(candidate, markers)
    if nearest and nearest["distance"] <= ALREADY_COVERED_DISTANCE:
        classification = "Already Covered"
    elif nearest and nearest["distance"] <= POSSIBLE_MATCH_DISTANCE:
        classification = "Possible Match"
    else:
        classification = "New Survey Target"
    candidate["classification"] = classification
    candidate["nearestExistingMarker"] = nearest


def merge_candidates(candidates: list[dict]) -> list[dict]:
    merged: list[dict] = []
    for candidate in candidates:
        match = None
        for existing in merged:
            if existing["type"] != candidate["type"]:
                continue
            if math.hypot(existing["x"] - candidate["x"], existing["y"] - candidate["y"]) <= MERGE_DISTANCE:
                match = existing
                break
        if match is None:
            merged.append({**candidate, "sourceDetections": 1, "detections": [candidate["detectionId"]]})
            continue
        total = match["sourceDetections"] + 1
        match["x"] = (match["x"] * match["sourceDetections"] + candidate["x"]) / total
        match["y"] = (match["y"] * match["sourceDetections"] + candidate["y"]) / total
        match["sourceDetections"] = total
        match["detections"].append(candidate["detectionId"])
        match["sourceImages"] = sorted(set(match["sourceImages"] + candidate["sourceImages"]))
    return merged


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * pct
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def median(values: list[float]) -> float | None:
    return percentile(values, 0.5)


def load_active_candidates_by_id() -> dict[str, dict]:
    if not ACTIVE_QUALITY_PATH.exists():
        return {}
    return {item["candidateId"]: item for item in read_json(ACTIVE_QUALITY_PATH)}


def draw_candidate_overlay(path: Path, candidates: list[dict], title: str) -> None:
    base = Image.open(BASE_MAP_PATH).convert("RGB")
    width = 1800
    height = round(base.height * width / base.width)
    image = base.resize((width, height), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    sx = width / EXPLORER_MAP_WIDTH
    sy = height / EXPLORER_MAP_HEIGHT
    for candidate in candidates:
        visual_x, visual_y = leaflet_to_explorer_visual_coordinates(candidate["x"], candidate["y"])
        x = visual_x * sx
        y = visual_y * sy
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#00a6ff", outline="#ffffff", width=1)
    draw.rectangle((0, 0, width, 28), fill="#000000")
    draw.text((8, 8), title, fill="#ffffff")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, quality=92)


def draw_warped_overlay(path: Path, map_config: dict, transform: np.ndarray) -> None:
    if transform.shape != (2, 3):
        return
    base = Image.open(BASE_MAP_PATH).convert("RGBA")
    source = Image.open(map_config["sourceImage"]).convert("RGBA")
    width = 1800
    height = round(base.height * width / base.width)
    base_thumb = base.resize((width, height), Image.Resampling.LANCZOS)
    scale_x = width / EXPLORER_MAP_WIDTH
    scale_y = height / EXPLORER_MAP_HEIGHT
    visual_transform = np.array(
        [
            [transform[0, 0] * scale_x, transform[0, 1] * scale_x, transform[0, 2] * scale_x],
            [transform[1, 0] * scale_y, transform[1, 1] * scale_y, transform[1, 2] * scale_y],
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
    warped = source.transform((width, height), Image.Transform.AFFINE, coeffs, Image.Resampling.BILINEAR)
    warped.putalpha(105)
    Image.alpha_composite(base_thumb, warped).convert("RGB").save(path, quality=92)


def generate() -> dict:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    registration = read_json(REGISTRATION_PATH)
    detections = load_detections()
    active_by_id = load_active_candidates_by_id()
    existing_markers = load_existing_herb_markers()
    registrations = {}

    for map_id, map_config in registration["maps"].items():
        result = choose_model(map_config)
        selected = result["selected"]
        registrations[map_config["name"]] = {
            "mapId": map_id,
            "config": map_config,
            "model": selected["model"],
            "transform": selected["transform"],
            "models": result["models"],
        }
        draw_warped_overlay(
            PREVIEW_DIR / f"{map_id}-v2-warped-overlay.jpg",
            map_config,
            selected["transform"],
        )

    valid = []
    rejected = []
    for index, row in enumerate(detections, start=1):
        detection_id = f"D{index:03d}"
        if row.get("status") != "classified":
            rejected.append({**row, "detectionId": detection_id, "rejectionReason": "unclassified detection"})
            continue
        registration_info = registrations[row["source"]]
        inside, reason = source_inside_bounds(row, registration_info["config"])
        if not inside:
            rejected.append({**row, "detectionId": detection_id, "rejectionReason": reason})
            continue
        explorer_visual_x, explorer_visual_y = transform_source_to_explorer(
            float(row["imageX"]),
            float(row["imageY"]),
            registration_info["transform"],
        )
        if not (0 <= explorer_visual_x <= EXPLORER_MAP_WIDTH and 0 <= explorer_visual_y <= EXPLORER_MAP_HEIGHT):
            rejected.append({**row, "detectionId": detection_id, "rejectionReason": "transformed point is outside Explorer image bounds"})
            continue
        leaflet_x, leaflet_y = explorer_visual_to_leaflet_coordinates(explorer_visual_x, explorer_visual_y)
        valid.append(
            {
                "detectionId": detection_id,
                "category": "herbs",
                "type": row["type"],
                "typeName": TYPE_NAME_BY_ID[row["type"]],
                "x": leaflet_x,
                "y": leaflet_y,
                "status": "candidate",
                "surveyStatus": "needs-survey",
                "surveyConfidence": "medium",
                "reviewed": False,
                "source": "RDO Wildflower Reference Maps",
                "sourceImages": [row["source"]],
                "registrationModel": registration_info["model"],
                "sourceDetection": {
                    "imageX": float(row["imageX"]),
                    "imageY": float(row["imageY"]),
                    "bboxX1": float(row.get("bboxX1") or 0),
                    "bboxY1": float(row.get("bboxY1") or 0),
                    "bboxX2": float(row.get("bboxX2") or 0),
                    "bboxY2": float(row.get("bboxY2") or 0),
                    "anchorMethod": row.get("anchorMethod", "pin-bottom-tip"),
                },
            }
        )

    merged = merge_candidates(valid)
    imported_on = datetime.now().astimezone().isoformat(timespec="seconds")
    old_vs_new = []

    for index, candidate in enumerate(merged, start=1):
        candidate["candidateId"] = f"wildflower-candidate-{index:03d}"
        candidate["importedOn"] = imported_on
        classify(candidate, existing_markers)
        old = active_by_id.get(candidate["candidateId"])
        if old:
            movement = math.hypot(float(old["x"]) - candidate["x"], float(old["y"]) - candidate["y"])
            old_nearest = old.get("nearestExistingMarker") or {}
            new_nearest = candidate.get("nearestExistingMarker") or {}
            old_vs_new.append(
                {
                    "candidateId": candidate["candidateId"],
                    "type": candidate["type"],
                    "oldX": old["x"],
                    "oldY": old["y"],
                    "newX": candidate["x"],
                    "newY": candidate["y"],
                    "movementDistance": movement,
                    "oldClassification": old.get("classification", ""),
                    "newClassification": candidate["classification"],
                    "oldNearestSameTypeDistance": old_nearest.get("distance", ""),
                    "newNearestSameTypeDistance": new_nearest.get("distance", ""),
                }
            )

    distances = [
        candidate["nearestExistingMarker"]["distance"]
        for candidate in merged
        if candidate.get("nearestExistingMarker")
    ]
    summary = {
        "generatedOn": imported_on,
        "totalDetections": len(detections),
        "candidatesInsideValidGeographicBounds": len(valid),
        "rejectedCandidates": len(rejected),
        "mergedPreviewCandidates": len(merged),
        "alreadyCovered": sum(1 for item in merged if item["classification"] == "Already Covered"),
        "possibleMatches": sum(1 for item in merged if item["classification"] == "Possible Match"),
        "needsSurvey": sum(1 for item in merged if item["classification"] == "New Survey Target"),
        "medianNearestSameTypeDistance": median(distances),
        "p75NearestSameTypeDistance": percentile(distances, 0.75),
        "within125SameTypeMarkers": sum(1 for distance in distances if distance <= ALREADY_COVERED_DISTANCE),
        "within300SameTypeMarkers": sum(1 for distance in distances if distance <= POSSIBLE_MATCH_DISTANCE),
        "selectedModels": {
            info["mapId"]: info["model"] for info in registrations.values()
        },
    }

    write_json(PREVIEW_DIR / "valid-candidates.json", valid)
    write_json(PREVIEW_DIR / "rejected-out-of-bounds-candidates.json", rejected)
    write_json(PREVIEW_DIR / "wildflower-candidate-survey-quality.preview.json", merged)
    write_json(PREVIEW_DIR / "old-vs-new-candidate-coordinates.json", old_vs_new)
    write_json(PREVIEW_DIR / "preview-statistics.json", summary)
    write_json(
        PREVIEW_DIR / "registration-model-report.json",
        {
            info["mapId"]: {
                "selectedModel": info["model"],
                "models": {
                    name: {
                        "accepted": model["accepted"],
                        "training": summarize_errors(model["training"]),
                        "leaveOneOut": summarize_errors(model["leaveOneOut"]),
                    }
                    for name, model in info["models"].items()
                },
            }
            for info in registrations.values()
        },
    )
    draw_candidate_overlay(PREVIEW_DIR / "preview-candidate-overlay.jpg", merged, "V2 Preview Candidate Positions")

    report = [
        "# Candidate Survey V2 Preview",
        "",
        "This is a preview only. Active Candidate Survey production files were not replaced.",
        "",
        f"- Total detections: {summary['totalDetections']}",
        f"- Candidates inside valid geographic bounds: {summary['candidatesInsideValidGeographicBounds']}",
        f"- Rejected candidates: {summary['rejectedCandidates']}",
        f"- Merged preview candidates: {summary['mergedPreviewCandidates']}",
        f"- Already Covered: {summary['alreadyCovered']}",
        f"- Possible Match: {summary['possibleMatches']}",
        f"- Needs Survey: {summary['needsSurvey']}",
        f"- Median nearest same-type marker distance: {summary['medianNearestSameTypeDistance']}",
        f"- 75th percentile nearest same-type marker distance: {summary['p75NearestSameTypeDistance']}",
        f"- Candidates within 125 units: {summary['within125SameTypeMarkers']}",
        f"- Candidates within 300 units: {summary['within300SameTypeMarkers']}",
        "",
        "Review `preview-candidate-overlay.jpg`, `registration-model-report.json`, and `old-vs-new-candidate-coordinates.json` before promoting.",
    ]
    (PREVIEW_DIR / "preview-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    summary = generate()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

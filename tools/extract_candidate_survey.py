from __future__ import annotations

import csv
import json
import math
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from source_map_registration import (
    get_registration_by_source_name,
    transform_source_to_explorer,
)


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
OUTPUT_DIR = ROOT / "candidate-survey"

REFERENCE_IMAGES = [
    {
        "path": DOWNLOADS / "Day1.png",
        "name": "RDO Wildflower Reference Map A",
        "hue": "blue",
    },
    {
        "path": DOWNLOADS / "Day2.png",
        "name": "RDO Wildflower Reference Map B",
        "hue": "orange",
    },
    {
        "path": DOWNLOADS / "Day3.png",
        "name": "RDO Wildflower Reference Map C",
        "hue": "purple",
    },
]

EXPORT_PATH = DOWNLOADS / "RosalitaRPExplorer_2026-08-04_1041.json"

TYPE_BY_NUMBER = {
    1: "blood-flower",
    2: "creek-plum",
    3: "chocolate-daisy",
    4: "wisteria",
    5: "cardinal-flower",
    6: "wild-rhubarb",
    7: "texas-bluebonnet",
    8: "bitterweed",
    9: "agarita",
}

TYPE_NAME_BY_ID = {
    "blood-flower": "Blood Flower",
    "creek-plum": "Creek Plum",
    "chocolate-daisy": "Chocolate Daisy",
    "wisteria": "Wisteria",
    "cardinal-flower": "Cardinal Flower",
    "wild-rhubarb": "Wild Rhubarb",
    "texas-bluebonnet": "Texas Bluebonnet",
    "bitterweed": "Bitterweed",
    "agarita": "Agarita",
}

SOURCE_NAME = "RDO Wildflower Reference Maps"
MERGE_DISTANCE = 85
ALREADY_COVERED_DISTANCE = 125
POSSIBLE_MATCH_DISTANCE = 300


@dataclass
class Component:
    area: int
    x1: int
    y1: int
    x2: int
    y2: int
    mask: np.ndarray | None = None

    @property
    def width(self) -> int:
        return self.x2 - self.x1 + 1

    @property
    def height(self) -> int:
        return self.y2 - self.y1 + 1

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)


def connected_components(mask: np.ndarray, keep_masks: bool = False) -> list[Component]:
    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    components: list[Component] = []

    for y in range(height):
        xs = np.where(mask[y] & ~seen[y])[0]
        for x0 in xs:
            if seen[y, x0] or not mask[y, x0]:
                continue

            queue = deque([(int(x0), int(y))])
            seen[y, x0] = True
            points: list[tuple[int, int]] = []

            while queue:
                x, current_y = queue.pop()
                points.append((x, current_y))

                for next_y in range(current_y - 1, current_y + 2):
                    for next_x in range(x - 1, x + 2):
                        if (
                            next_x < 0
                            or next_y < 0
                            or next_x >= width
                            or next_y >= height
                            or seen[next_y, next_x]
                            or not mask[next_y, next_x]
                        ):
                            continue

                        seen[next_y, next_x] = True
                        queue.append((next_x, next_y))

            xs2 = [point[0] for point in points]
            ys2 = [point[1] for point in points]
            x1, x2 = min(xs2), max(xs2)
            y1, y2 = min(ys2), max(ys2)
            component_mask = None

            if keep_masks:
                component_mask = np.zeros((y2 - y1 + 1, x2 - x1 + 1), dtype=bool)
                for point_x, point_y in points:
                    component_mask[point_y - y1, point_x - x1] = True

            components.append(
                Component(len(points), x1, y1, x2, y2, component_mask)
            )

    return components


def get_marker_mask(image: Image.Image, hue: str) -> np.ndarray:
    arr = np.array(image.convert("RGB"))
    r = arr[:, :, 0].astype(float) / 255
    g = arr[:, :, 1].astype(float) / 255
    b = arr[:, :, 2].astype(float) / 255
    maxc = np.maximum.reduce([r, g, b])
    minc = np.minimum.reduce([r, g, b])
    saturation = (maxc - minc) / (maxc + 1e-6)

    if hue == "blue":
        mask = (saturation > 0.35) & (b > 0.45) & (g > 0.35) & (r < 0.45)
    elif hue == "orange":
        mask = (saturation > 0.35) & (r > 0.55) & (g > 0.35) & (b < 0.28)
    elif hue == "purple":
        mask = (saturation > 0.25) & (r > 0.45) & (b > 0.45) & (g < 0.58)
    else:
        raise ValueError(f"Unsupported hue: {hue}")

    # Exclude non-map decoration and legend markers.
    mask[:220, :500] = False
    mask[1100:, 1600:] = False
    return mask


def detect_marker_components(image: Image.Image, hue: str) -> list[Component]:
    components = []
    for component in connected_components(get_marker_mask(image, hue)):
        if (
            70 <= component.area <= 1300
            and 8 <= component.width <= 48
            and 12 <= component.height <= 58
        ):
            components.append(component)
    return components


def get_white_digit_components(image: Image.Image) -> list[Component]:
    arr = np.array(image.convert("RGB"))
    mask = (arr[:, :, 0] > 210) & (arr[:, :, 1] > 210) & (arr[:, :, 2] > 210)
    components = []

    for component in connected_components(mask, keep_masks=True):
        if (
            30 <= component.area <= 180
            and 3 <= component.width <= 16
            and 10 <= component.height <= 25
        ):
            components.append(component)

    return components


def get_digit_templates(image: Image.Image) -> dict[int, np.ndarray]:
    legend_digits = []
    for component in get_white_digit_components(image):
        if 1650 <= component.x1 <= 1685 and 1090 <= component.y1 <= 1465:
            legend_digits.append(component)

    legend_digits.sort(key=lambda component: component.y1)

    if len(legend_digits) < 9:
        raise RuntimeError("Could not read the nine legend number templates.")

    return {
        number: normalize_digit_mask(component.mask)
        for number, component in enumerate(legend_digits[:9], start=1)
    }


def normalize_digit_mask(mask: np.ndarray, size: tuple[int, int] = (16, 24)) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255, mode="L")
    image = image.resize(size, Image.Resampling.NEAREST)
    return np.array(image) > 0


def score_digit(candidate: Component, templates: dict[int, np.ndarray]) -> tuple[int, float]:
    candidate_mask = normalize_digit_mask(candidate.mask)
    best_number = 0
    best_score = -1.0

    for number, template in templates.items():
        intersection = np.logical_and(candidate_mask, template).sum()
        union = np.logical_or(candidate_mask, template).sum()
        score = intersection / union if union else 0

        if score > best_score:
            best_number = number
            best_score = score

    return best_number, best_score


def get_white_mask(image: Image.Image) -> np.ndarray:
    arr = np.array(image.convert("RGB"))
    return (arr[:, :, 0] > 205) & (arr[:, :, 1] > 205) & (arr[:, :, 2] > 205)


def scan_digit_template(region: np.ndarray, template: np.ndarray) -> float:
    region_height, region_width = region.shape
    template_height, template_width = template.shape

    if region_height < template_height or region_width < template_width:
        return 0.0

    template_pixels = template.sum()

    if template_pixels == 0:
        return 0.0

    best_score = 0.0

    for y in range(region_height - template_height + 1):
        for x in range(region_width - template_width + 1):
            window = region[y : y + template_height, x : x + template_width]
            intersection = np.logical_and(window, template).sum()
            extra_white = np.logical_and(window, ~template).sum()
            score = (intersection - 0.15 * extra_white) / template_pixels
            best_score = max(best_score, score)

    return best_score


def assign_marker_number(
    marker: Component,
    white_mask: np.ndarray,
    templates: dict[int, np.ndarray],
) -> tuple[int | None, float]:
    search_mask = np.zeros_like(white_mask)
    y1 = max(0, marker.y1 - 8)
    y2 = min(white_mask.shape[0], marker.y1 + 30)
    left_x1 = max(0, marker.x1 - 28)
    left_x2 = max(0, marker.x1 - 2)
    right_x1 = min(white_mask.shape[1], marker.x2 + 2)
    right_x2 = min(white_mask.shape[1], marker.x2 + 28)
    search_mask[y1:y2, left_x1:left_x2] = white_mask[y1:y2, left_x1:left_x2]
    search_mask[y1:y2, right_x1:right_x2] = white_mask[y1:y2, right_x1:right_x2]
    candidates = []

    for component in connected_components(search_mask, keep_masks=True):
        if not (
            30 <= component.area <= 180
            and 3 <= component.width <= 16
            and 10 <= component.height <= 25
        ):
            continue

        number, score = score_digit(component, templates)
        component_cx, component_cy = component.center
        marker_cx, marker_cy = marker.center
        distance = math.hypot(component_cx - marker_cx, component_cy - marker_cy)
        candidates.append((score, -distance, number))

    if not candidates:
        return None, 0.0

    score, _, number = max(candidates)

    if score < 0.42:
        return None, 0.0

    return number, score


def extract_candidates() -> tuple[list[dict], dict]:
    extracted = []
    debug_rows = []

    for reference in REFERENCE_IMAGES:
        image = Image.open(reference["path"])
        registration_id, _, registration = get_registration_by_source_name(
            reference["name"]
        )
        transform = registration["transform"]
        templates = get_digit_templates(image)
        white_mask = get_white_mask(image)
        marker_components = detect_marker_components(image, reference["hue"])

        for marker in marker_components:
            number, digit_score = assign_marker_number(
                marker, white_mask, templates
            )

            if number not in TYPE_BY_NUMBER:
                debug_rows.append(
                    {
                        "source": reference["name"],
                        "imageX": round((marker.x1 + marker.x2) / 2, 2),
                        "imageY": marker.y2,
                        "bboxX1": marker.x1,
                        "bboxY1": marker.y1,
                        "bboxX2": marker.x2,
                        "bboxY2": marker.y2,
                        "anchorMethod": "pin-bottom-tip",
                        "assignedNumber": "",
                        "digitScore": round(digit_score, 3),
                        "status": "unclassified",
                    }
                )
                continue

            image_x = (marker.x1 + marker.x2) / 2
            image_y = marker.y2
            explorer_x, explorer_y = transform_source_to_explorer(
                image_x, image_y, transform
            )
            type_id = TYPE_BY_NUMBER[number]

            extracted.append(
                {
                    "category": "herbs",
                    "type": type_id,
                    "typeName": TYPE_NAME_BY_ID[type_id],
                    "x": explorer_x,
                    "y": explorer_y,
                    "status": "candidate",
                    "confidence": "guess",
                    "source": SOURCE_NAME,
                    "sourceImages": [reference["name"]],
                    "sourceDetections": 1,
                    "extraction": {
                        "referenceImage": reference["path"].name,
                        "registrationId": registration_id,
                        "imageX": image_x,
                        "imageY": image_y,
                        "bboxX1": marker.x1,
                        "bboxY1": marker.y1,
                        "bboxX2": marker.x2,
                        "bboxY2": marker.y2,
                        "anchorMethod": "pin-bottom-tip",
                        "legendNumber": number,
                        "digitScore": digit_score,
                    },
                }
            )
            debug_rows.append(
                {
                    "source": reference["name"],
                    "imageX": round(image_x, 2),
                    "imageY": image_y,
                    "bboxX1": marker.x1,
                    "bboxY1": marker.y1,
                    "bboxX2": marker.x2,
                    "bboxY2": marker.y2,
                    "anchorMethod": "pin-bottom-tip",
                    "assignedNumber": number,
                    "type": type_id,
                    "digitScore": round(digit_score, 3),
                    "explorerX": round(explorer_x, 2),
                    "explorerY": round(explorer_y, 2),
                    "status": "classified",
                }
            )

    return extracted, {"rows": debug_rows}


def merge_duplicate_candidates(candidates: list[dict]) -> tuple[list[dict], int]:
    merged: list[dict] = []
    duplicate_count = 0

    for candidate in candidates:
        match = None
        for existing in merged:
            if existing["type"] != candidate["type"]:
                continue

            distance = math.hypot(existing["x"] - candidate["x"], existing["y"] - candidate["y"])
            if distance <= MERGE_DISTANCE:
                match = existing
                break

        if not match:
            merged.append(candidate.copy())
            continue

        duplicate_count += 1
        total = match["sourceDetections"] + candidate["sourceDetections"]
        match["x"] = (
            match["x"] * match["sourceDetections"]
            + candidate["x"] * candidate["sourceDetections"]
        ) / total
        match["y"] = (
            match["y"] * match["sourceDetections"]
            + candidate["y"] * candidate["sourceDetections"]
        ) / total
        match["sourceDetections"] = total
        match["sourceImages"] = sorted(
            set(match["sourceImages"] + candidate["sourceImages"])
        )

    return merged, duplicate_count


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


def classify_candidates(candidates: list[dict], existing_markers: list[dict]) -> None:
    for candidate in candidates:
        same_type_markers = [
            marker for marker in existing_markers if marker.get("type") == candidate["type"]
        ]
        nearest = None

        for marker in same_type_markers:
            distance = math.hypot(marker["x"] - candidate["x"], marker["y"] - candidate["y"])
            if nearest is None or distance < nearest["distance"]:
                nearest = {
                    "id": marker.get("id", ""),
                    "name": marker.get("name", ""),
                    "x": marker["x"],
                    "y": marker["y"],
                    "distance": distance,
                }

        if nearest and nearest["distance"] <= ALREADY_COVERED_DISTANCE:
            classification = "Already Covered"
        elif nearest and nearest["distance"] <= POSSIBLE_MATCH_DISTANCE:
            classification = "Possible Match"
        else:
            classification = "New Survey Target"

        candidate["classification"] = classification
        candidate["nearestExistingMarker"] = nearest


def compact_candidate(candidate: dict) -> dict:
    return {
        "category": candidate["category"],
        "type": candidate["type"],
        "x": round(candidate["x"], 2),
        "y": round(candidate["y"], 2),
        "status": "candidate",
        "confidence": "guess",
        "source": SOURCE_NAME,
    }


def write_outputs(candidates: list[dict], debug: dict, duplicate_count: int) -> dict:
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_path = OUTPUT_DIR / "wildflower-candidate-survey.json"
    new_targets_path = OUTPUT_DIR / "wildflower-candidate-survey-new-targets.json"
    report_path = OUTPUT_DIR / "wildflower-candidate-survey-report.md"
    debug_path = OUTPUT_DIR / "wildflower-candidate-survey-detections.csv"

    all_payload = {
        "name": "RosalitaRP Explorer Wildflower Candidate Survey",
        "source": SOURCE_NAME,
        "notes": "RDO day/cycle labels intentionally ignored. All reference maps are treated as one combined candidate source.",
        "thresholds": {
            "mergeDistance": MERGE_DISTANCE,
            "alreadyCoveredDistance": ALREADY_COVERED_DISTANCE,
            "possibleMatchDistance": POSSIBLE_MATCH_DISTANCE,
        },
        "candidates": [
            {
                **compact_candidate(candidate),
                "classification": candidate["classification"],
                "typeName": candidate["typeName"],
                "sourceDetections": candidate["sourceDetections"],
                "sourceImages": candidate["sourceImages"],
                "nearestExistingMarker": candidate["nearestExistingMarker"],
            }
            for candidate in candidates
        ],
    }

    new_targets = [
        compact_candidate(candidate)
        for candidate in candidates
        if candidate["classification"] == "New Survey Target"
    ]

    counts = {
        "totalExtracted": len(debug["rows"]),
        "classifiedExtracted": sum(1 for row in debug["rows"] if row["status"] == "classified"),
        "unclassifiedExtracted": sum(1 for row in debug["rows"] if row["status"] == "unclassified"),
        "mergedDuplicates": duplicate_count,
        "mergedCandidates": len(candidates),
        "alreadyCovered": sum(1 for candidate in candidates if candidate["classification"] == "Already Covered"),
        "possibleMatches": sum(1 for candidate in candidates if candidate["classification"] == "Possible Match"),
        "newSurveyTargets": len(new_targets),
    }

    all_path.write_text(json.dumps(all_payload, indent=2), encoding="utf-8")
    new_targets_path.write_text(json.dumps(new_targets, indent=2), encoding="utf-8")

    with debug_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=sorted(debug["rows"][0].keys()))
        writer.writeheader()
        writer.writerows(debug["rows"])

    by_type = {}
    for candidate in candidates:
        by_type.setdefault(candidate["typeName"], 0)
        by_type[candidate["typeName"]] += 1

    report_lines = [
        "# Wildflower Candidate Survey Report",
        "",
        "RDO day/cycle labels were ignored. Day 1, Day 2, and Day 3 reference images were merged as one source.",
        "",
        "## Summary",
        "",
        f"- Total extracted detections: {counts['totalExtracted']}",
        f"- Classified detections: {counts['classifiedExtracted']}",
        f"- Unclassified detections: {counts['unclassifiedExtracted']}",
        f"- Merged duplicates: {counts['mergedDuplicates']}",
        f"- Merged candidate locations: {counts['mergedCandidates']}",
        f"- Already covered: {counts['alreadyCovered']}",
        f"- Possible matches: {counts['possibleMatches']}",
        f"- New survey targets: {counts['newSurveyTargets']}",
        "",
        "## Classification Thresholds",
        "",
        f"- Duplicate merge distance: {MERGE_DISTANCE} Explorer map units, same herb type only",
        f"- Already Covered: nearest same-type marker within {ALREADY_COVERED_DISTANCE} map units",
        f"- Possible Match: nearest same-type marker within {POSSIBLE_MATCH_DISTANCE} map units",
        f"- New Survey Target: no same-type marker within {POSSIBLE_MATCH_DISTANCE} map units",
        "",
        "## Merged Candidates By Herb",
        "",
    ]

    for type_name in sorted(by_type):
        report_lines.append(f"- {type_name}: {by_type[type_name]}")

    report_lines.extend(
        [
            "",
            "## Output Files",
            "",
            f"- Full candidate survey: `{all_path.name}`",
            f"- Import-ready new survey targets: `{new_targets_path.name}`",
            f"- Detection audit CSV: `{debug_path.name}`",
        ]
    )

    report_path.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    return {
        "counts": counts,
        "paths": {
            "all": str(all_path),
            "newTargets": str(new_targets_path),
            "report": str(report_path),
            "debug": str(debug_path),
        },
        "byType": by_type,
    }


def main() -> None:
    extracted, debug = extract_candidates()
    merged, duplicate_count = merge_duplicate_candidates(extracted)
    classify_candidates(merged, load_existing_herb_markers())
    summary = write_outputs(merged, debug, duplicate_count)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

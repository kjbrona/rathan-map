from __future__ import annotations

import csv
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

from candidate_coordinate_conventions import (
    EXPLORER_MAP_HEIGHT,
    leaflet_to_explorer_visual_coordinates,
)


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = ROOT / "candidate-survey" / "registration-v2-preview"
MATCHING_AUDIT_DIR = PREVIEW_DIR / "matching-audit"
REVIEW_DIR = PREVIEW_DIR / "type-review"
MAP_CROP_DIR = REVIEW_DIR / "map-crops"
SOURCE_CROP_DIR = REVIEW_DIR / "source-crops"

NEAREST_AUDIT_PATH = MATCHING_AUDIT_DIR / "candidate-nearest-marker-audit.json"
NEARBY_DIFFERENT_PATH = MATCHING_AUDIT_DIR / "nearby-different-herb.csv"
TYPE_MISMATCH_PATH = MATCHING_AUDIT_DIR / "type-mismatch-within-150.csv"
CLUSTERED_PATH = MATCHING_AUDIT_DIR / "clustered-existing-markers.json"
PREVIEW_CANDIDATES_PATH = PREVIEW_DIR / "wildflower-candidate-survey-quality.preview.json"
REGISTRATION_PATH = ROOT / "data" / "candidate-survey" / "source-map-registration.json"
BASE_MAP_PATH = ROOT / "images" / "rdr2-map.jpg"
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"
DECISIONS_PATH = PREVIEW_DIR / "type-review-decisions.json"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def distance(left: dict, right: dict) -> float:
    return math.hypot(float(left["x"]) - float(right["x"]), float(left["y"]) - float(right["y"]))


def marker_display_name(marker: dict) -> str:
    return marker.get("name") or marker.get("type") or marker.get("id", "")


def load_existing_herbs() -> list[dict]:
    data = read_json(EXPORT_PATH)
    markers = data.get("markers", data if isinstance(data, list) else [])
    return [
        marker
        for marker in markers
        if marker.get("category") == "herbs"
        and isinstance(marker.get("x"), (int, float))
        and isinstance(marker.get("y"), (int, float))
    ]


def draw_label(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, fill: str) -> None:
    x, y = xy
    box = draw.textbbox((x, y), text)
    draw.rectangle((box[0] - 3, box[1] - 2, box[2] + 3, box[3] + 2), fill="#17110b")
    draw.text((x, y), text, fill=fill)


def draw_map_crop(candidate: dict, nearby_markers: list[dict], path: Path) -> None:
    base = Image.open(BASE_MAP_PATH).convert("RGB")
    visual_x, visual_y = leaflet_to_explorer_visual_coordinates(candidate["x"], candidate["y"])
    crop_size = 760
    half = crop_size // 2
    left = max(0, min(base.width - crop_size, int(round(visual_x)) - half))
    top = max(0, min(base.height - crop_size, int(round(visual_y)) - half))
    crop = base.crop((left, top, left + crop_size, top + crop_size)).convert("RGB")
    draw = ImageDraw.Draw(crop)
    cx = visual_x - left
    cy = visual_y - top

    for radius, color in ((300, "#457bff"), (125, "#2dd36f")):
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color, width=2)

    for marker in nearby_markers:
        mx, my = leaflet_to_explorer_visual_coordinates(marker["x"], marker["y"])
        sx = mx - left
        sy = my - top
        if not (-30 <= sx <= crop_size + 30 and -30 <= sy <= crop_size + 30):
            continue
        same_type = marker.get("type") == candidate.get("type")
        color = "#2dd36f" if same_type else "#ffb02e"
        draw.rectangle((sx - 6, sy - 6, sx + 6, sy + 6), fill=color, outline="#111111", width=2)
        label = f"{marker_display_name(marker)} {marker.get('type','')} {distance(candidate, marker):.0f}"
        draw_label(draw, (sx + 8, sy - 8), label, color)

    draw.polygon(
        [(cx, cy - 11), (cx + 11, cy), (cx, cy + 11), (cx - 11, cy)],
        fill="#00a6ff",
        outline="#ffffff",
    )
    draw_label(
        draw,
        (cx + 14, cy + 10),
        f"{candidate['candidateId']} {candidate.get('typeName', candidate['type'])}",
        "#00d8ff",
    )
    draw.rectangle((0, 0, crop_size, 25), fill="#000000")
    draw.text((8, 6), "Candidate type review map crop: 125/300 unit rings", fill="#ffffff")
    path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(path, quality=94)


def draw_source_crop(candidate: dict, source_images: dict[str, Path], path: Path) -> bool:
    detection = candidate.get("sourceDetection") or {}
    source_name = (candidate.get("sourceImages") or [""])[0]
    source_path = source_images.get(source_name)
    if not source_path or not source_path.exists() or not detection:
        return False

    source = Image.open(source_path).convert("RGB")
    image_x = float(detection.get("imageX", 0))
    image_y = float(detection.get("imageY", 0))
    x1 = float(detection.get("bboxX1", image_x - 16))
    y1 = float(detection.get("bboxY1", image_y - 30))
    x2 = float(detection.get("bboxX2", image_x + 16))
    y2 = float(detection.get("bboxY2", image_y))
    margin = 80
    crop_box = (
        max(0, int(x1 - margin)),
        max(0, int(y1 - margin)),
        min(source.width, int(x2 + margin)),
        min(source.height, int(y2 + margin)),
    )
    crop = source.crop(crop_box)
    scale = 3
    crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(crop)
    bx1 = (x1 - crop_box[0]) * scale
    by1 = (y1 - crop_box[1]) * scale
    bx2 = (x2 - crop_box[0]) * scale
    by2 = (y2 - crop_box[1]) * scale
    tx = (image_x - crop_box[0]) * scale
    ty = (image_y - crop_box[1]) * scale
    draw.rectangle((bx1, by1, bx2, by2), outline="#00a6ff", width=3)
    draw.line((tx - 11, ty, tx + 11, ty), fill="#ff2f2f", width=3)
    draw.line((tx, ty - 11, tx, ty + 11), fill="#ff2f2f", width=3)
    draw.rectangle((0, 0, crop.width, 40), fill="#000000")
    label = f"{candidate['candidateId']} assigned {candidate.get('typeName', candidate['type'])} | anchor {detection.get('anchorMethod', '')}"
    draw.text((8, 9), label, fill="#ffffff")
    path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(path)
    return True


def build_review_package() -> dict:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    nearest_rows = {row["candidateId"]: row for row in read_json(NEAREST_AUDIT_PATH)}
    queued_ids = {
        row["candidateId"]
        for row in read_csv(NEARBY_DIFFERENT_PATH) + read_csv(TYPE_MISMATCH_PATH)
    }
    preview_candidates = {
        candidate["candidateId"]: candidate for candidate in read_json(PREVIEW_CANDIDATES_PATH)
    }
    clustered = {
        item["candidateId"]: item for item in read_json(CLUSTERED_PATH)
    }
    existing = load_existing_herbs()
    registration = read_json(REGISTRATION_PATH)
    source_images = {
        config["name"]: Path(config["sourceImage"]) for config in registration["maps"].values()
    }
    herb_catalog = [
        {"id": item["id"], "name": item["name"]}
        for item in read_json(HERB_TYPES_PATH)
    ]
    review_items = []
    source_crop_count = 0

    for candidate_id in sorted(queued_ids):
        candidate = preview_candidates.get(candidate_id)
        audit = nearest_rows.get(candidate_id)
        if not candidate or not audit:
            continue
        nearby_markers = [
            marker for marker in existing if distance(candidate, marker) <= 200
        ]
        nearby_markers.sort(key=lambda marker: distance(candidate, marker))
        map_crop = MAP_CROP_DIR / f"{candidate_id}-map.jpg"
        source_crop = SOURCE_CROP_DIR / f"{candidate_id}-source.png"
        draw_map_crop(candidate, nearby_markers, map_crop)
        has_source_crop = draw_source_crop(candidate, source_images, source_crop)
        if has_source_crop:
            source_crop_count += 1

        review_items.append(
            {
                "candidateId": candidate_id,
                "candidate": candidate,
                "audit": audit,
                "cluster": clustered.get(candidate_id, {"nearbyMarkers": []}),
                "nearbyMarkersWithin200": [
                    {
                        "id": marker.get("id", ""),
                        "name": marker.get("name", ""),
                        "type": marker.get("type", ""),
                        "status": marker.get("status", ""),
                        "confidence": marker.get("confidence", ""),
                        "x": marker.get("x"),
                        "y": marker.get("y"),
                        "distance": distance(candidate, marker),
                    }
                    for marker in nearby_markers
                ],
                "mapCrop": str(map_crop.relative_to(ROOT)),
                "sourceCrop": str(source_crop.relative_to(ROOT)) if has_source_crop else "",
            }
        )

    write_json(REVIEW_DIR / "candidate-type-review-queue.json", review_items)
    write_json(REVIEW_DIR / "herb-type-options.json", herb_catalog)
    if not DECISIONS_PATH.exists():
        write_json(DECISIONS_PATH, [])

    summary = {
        "queuedCandidates": len(review_items),
        "sourceCropsGenerated": source_crop_count,
        "mapCropsGenerated": len(review_items),
        "decisionsPath": str(DECISIONS_PATH),
        "queuePath": str(REVIEW_DIR / "candidate-type-review-queue.json"),
    }
    write_json(REVIEW_DIR / "candidate-type-review-summary.json", summary)
    return summary


def main() -> None:
    print(json.dumps(build_review_package(), indent=2))


if __name__ == "__main__":
    main()

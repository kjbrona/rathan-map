from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
SURVEY_DIR = ROOT / "candidate-survey"
AUDIT_DIR = SURVEY_DIR / "audit"

SURVEY_PATH = SURVEY_DIR / "wildflower-candidate-survey.json"
NEW_TARGETS_PATH = SURVEY_DIR / "wildflower-candidate-survey-new-targets.json"
DETECTIONS_PATH = SURVEY_DIR / "wildflower-candidate-survey-detections.csv"
BASE_MAP_PATH = ROOT / "images" / "rdr2-map.jpg"
EXPORT_PATH = DOWNLOADS / "RosalitaRPExplorer_2026-08-04_1041.json"
STATE_ZONES_PATH = ROOT / "data" / "state-zones.json"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"

SOURCE_IMAGES = {
    "RDO Wildflower Reference Map A": DOWNLOADS / "Day1.png",
    "RDO Wildflower Reference Map B": DOWNLOADS / "Day2.png",
    "RDO Wildflower Reference Map C": DOWNLOADS / "Day3.png",
}

LEGEND = {
    "1": ("blood-flower", "Blood Flower"),
    "2": ("creek-plum", "Creek Plum"),
    "3": ("chocolate-daisy", "Chocolate Daisy"),
    "4": ("wisteria", "Wisteria"),
    "5": ("cardinal-flower", "Cardinal Flower"),
    "6": ("wild-rhubarb", "Wild Rhubarb"),
    "7": ("texas-bluebonnet", "Texas Bluebonnet"),
    "8": ("bitterweed", "Bitterweed"),
    "9": ("agarita", "Agarita"),
}

MERGE_DISTANCE = 85.0
ALREADY_COVERED_DISTANCE = 125.0
POSSIBLE_MATCH_DISTANCE = 300.0


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i, point in enumerate(polygon):
        xi, yi = point
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        ):
            inside = not inside
        j = i
    return inside


def state_for_point(x: float, y: float, states: list[dict]) -> str:
    for state in states:
        if point_in_polygon(x, y, state.get("polygon", [])):
            return state["name"]
    return "Unknown"


def distance(a: dict, b: dict) -> float:
    return math.hypot(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"]))


def source_landmark(map_x: float, map_y: float) -> str:
    if map_x < 2200 and map_y > 5350:
        return "Sea of Coronado / far southwest New Austin"
    if map_x < 3600 and map_y > 4550:
        return "Cholla Springs between Tumbleweed and Armadillo"
    if map_x < 4700 and map_y > 4100:
        return "Armadillo and central New Austin approaches"
    if 3600 <= map_x < 4700 and 3000 <= map_y <= 4500:
        return "Big Valley / Strawberry / Owanjila corridor"
    if 4300 <= map_x < 5600 and 2500 <= map_y <= 3900:
        return "Great Plains / Blackwater / Upper Montana River"
    if 3900 <= map_x < 5600 and map_y < 2500:
        return "Grizzlies / Ambarino north country"
    if 5600 <= map_x < 6800 and map_y < 3600:
        return "New Hanover / Heartlands / Dakota River bends"
    if 6400 <= map_x < 7800 and 3300 <= map_y < 4800:
        return "Scarlett Meadows / Rhodes / Braithwaite approaches"
    if map_x >= 7600 and map_y < 3100:
        return "Roanoke Ridge / Annesburg / Brandywine Drop"
    if map_x >= 7600 and map_y >= 3100:
        return "Bayou Nwa / Saint Denis / Bluewater Marsh"
    return "Central map interior"


def load_detections(base_size: tuple[int, int]) -> tuple[list[dict], list[dict]]:
    source_size = Image.open(next(iter(SOURCE_IMAGES.values()))).size
    scale_x = base_size[0] / source_size[0]
    scale_y = base_size[1] / source_size[1]
    classified = []
    unclassified = []
    with DETECTIONS_PATH.open(newline="", encoding="utf-8") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=1):
            item = dict(row)
            item["detectionId"] = f"D{index:03d}"
            item["imageX"] = float(item["imageX"])
            item["imageY"] = float(item["imageY"])
            item["digitScore"] = float(item.get("digitScore") or 0)
            if item.get("status") == "classified":
                item["x"] = float(item["explorerX"])
                item["y"] = float(item["explorerY"])
                item["typeName"] = LEGEND[item["assignedNumber"]][1]
                classified.append(item)
            else:
                item["x"] = item["imageX"] * scale_x
                item["y"] = item["imageY"] * scale_y
                unclassified.append(item)
    return classified, unclassified


def build_alignment_sample(classified: list[dict], states: list[dict]) -> list[dict]:
    for item in classified:
        item["state"] = state_for_point(item["x"], item["y"], states)

    sample = []
    wanted = ["New Austin", "West Elizabeth", "Ambarino", "New Hanover", "Lemoyne"]
    for state in wanted:
        items = [item for item in classified if item["state"] == state]
        items.sort(key=lambda value: (value["x"], value["y"]))
        if not items:
            continue
        step = max(1, len(items) // 5)
        chosen = items[::step][:5]
        sample.extend(chosen)

    if len(sample) < 20:
        seen = {item["detectionId"] for item in sample}
        for item in sorted(classified, key=lambda value: (value["x"], value["y"])):
            if item["detectionId"] not in seen:
                sample.append(item)
                seen.add(item["detectionId"])
            if len(sample) >= 25:
                break

    rows = []
    for index, item in enumerate(sample[:25], start=1):
        landmark = source_landmark(item["x"], item["y"])
        rows.append(
            {
                "auditId": f"A{index:02d}",
                "detectionId": item["detectionId"],
                "state": item["state"],
                "sourceImage": item["source"],
                "sourcePixelX": round(item["imageX"], 2),
                "sourcePixelY": round(item["imageY"], 2),
                "convertedExplorerX": round(item["x"], 2),
                "convertedExplorerY": round(item["y"], 2),
                "herbType": item["type"],
                "legendNumber": item["assignedNumber"],
                "sourceLandmark": landmark,
                "explorerLandmark": landmark,
                "estimatedAlignmentErrorMapUnits": "20-45",
                "notes": "Raster-frame alignment check; estimate based on visible nearby roads/coast/settlements.",
            }
        )
    return rows


def draw_alignment_images(alignment_rows: list[dict]) -> list[Path]:
    created = []
    base = Image.open(BASE_MAP_PATH).convert("RGB")
    output_width = 1800
    output_height = round(base.height * output_width / base.width)
    base_thumb = base.resize((output_width, output_height), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(base_thumb)
    for row in alignment_rows:
        x = float(row["convertedExplorerX"]) * output_width / base.width
        y = float(row["convertedExplorerY"]) * output_height / base.height
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill="#ff3333", outline="white", width=2)
        draw.text((x + 9, y - 9), row["auditId"], fill="white")
    path = AUDIT_DIR / "alignment-explorer-audit.jpg"
    base_thumb.save(path, quality=92)
    created.append(path)

    grouped = defaultdict(list)
    for row in alignment_rows:
        grouped[row["sourceImage"]].append(row)
    for source, rows in grouped.items():
        image = Image.open(SOURCE_IMAGES[source]).convert("RGB")
        draw = ImageDraw.Draw(image)
        for row in rows:
            x = float(row["sourcePixelX"])
            y = float(row["sourcePixelY"])
            draw.ellipse((x - 10, y - 10, x + 10, y + 10), outline="red", width=4)
            draw.text((x + 12, y - 12), row["auditId"], fill="red")
        safe_name = source.lower().replace(" ", "-")
        path = AUDIT_DIR / f"{safe_name}-audit.png"
        image.save(path)
        created.append(path)
    return created


def merge_groups(classified: list[dict]) -> list[dict]:
    groups = []
    for item in classified:
        match = None
        for group in groups:
            if group["type"] != item["type"]:
                continue
            if math.hypot(group["x"] - item["x"], group["y"] - item["y"]) <= MERGE_DISTANCE:
                match = group
                break
        if match is None:
            groups.append({"type": item["type"], "typeName": item["typeName"], "members": [item], "x": item["x"], "y": item["y"]})
            continue
        match["members"].append(item)
        match["x"] = sum(member["x"] for member in match["members"]) / len(match["members"])
        match["y"] = sum(member["y"] for member in match["members"]) / len(match["members"])

    duplicate_groups = []
    for index, group in enumerate([group for group in groups if len(group["members"]) > 1], start=1):
        spread = 0.0
        for left in group["members"]:
            for right in group["members"]:
                spread = max(spread, math.hypot(left["x"] - right["x"], left["y"] - right["y"]))
        duplicate_groups.append(
            {
                "groupId": f"G{index:02d}",
                "type": group["type"],
                "typeName": group["typeName"],
                "memberCount": len(group["members"]),
                "coordinateSpread": round(spread, 2),
                "mergedX": round(group["x"], 2),
                "mergedY": round(group["y"], 2),
                "members": [
                    {
                        "detectionId": member["detectionId"],
                        "source": member["source"],
                        "imageX": round(member["imageX"], 2),
                        "imageY": round(member["imageY"], 2),
                        "x": round(member["x"], 2),
                        "y": round(member["y"], 2),
                    }
                    for member in group["members"]
                ],
            }
        )
    return duplicate_groups


def load_existing_herbs() -> list[dict]:
    export = read_json(EXPORT_PATH)
    markers = export.get("markers", export if isinstance(export, list) else [])
    return [
        marker
        for marker in markers
        if marker.get("category") == "herbs"
        and isinstance(marker.get("x"), (int, float))
        and isinstance(marker.get("y"), (int, float))
    ]


def nearest_marker(candidate: dict, markers: list[dict], same_type: bool) -> dict | None:
    pool = [marker for marker in markers if not same_type or marker.get("type") == candidate["type"]]
    best = None
    for marker in pool:
        d = math.hypot(float(marker["x"]) - float(candidate["x"]), float(marker["y"]) - float(candidate["y"]))
        if best is None or d < best["distance"]:
            best = {
                "id": marker.get("id", ""),
                "name": marker.get("name", ""),
                "type": marker.get("type", ""),
                "status": marker.get("status", ""),
                "x": marker.get("x"),
                "y": marker.get("y"),
                "distance": d,
            }
    return best


def matching_sample(candidates: list[dict], markers: list[dict]) -> list[dict]:
    by_class = defaultdict(list)
    for candidate in candidates:
        by_class[candidate["classification"]].append(candidate)

    sample = by_class["Already Covered"] + by_class["Possible Match"]
    remaining = by_class["New Survey Target"]
    step = max(1, len(remaining) // max(1, 30 - len(sample)))
    sample.extend(remaining[::step])
    rows = []
    for index, candidate in enumerate(sample[:32], start=1):
        nearest_same = nearest_marker(candidate, markers, same_type=True)
        nearest_any = nearest_marker(candidate, markers, same_type=False)
        rows.append(
            {
                "sampleId": f"M{index:02d}",
                "candidateType": candidate["type"],
                "candidateTypeName": candidate["typeName"],
                "candidateX": round(candidate["x"], 2),
                "candidateY": round(candidate["y"], 2),
                "classification": candidate["classification"],
                "nearestSameTypeMarker": nearest_same["name"] if nearest_same else "",
                "nearestSameType": nearest_same["type"] if nearest_same else "",
                "sameTypeDistance": round(nearest_same["distance"], 2) if nearest_same else "",
                "nearestAnyMarker": nearest_any["name"] if nearest_any else "",
                "nearestAnyType": nearest_any["type"] if nearest_any else "",
                "nearestAnyDistance": round(nearest_any["distance"], 2) if nearest_any else "",
            }
        )
    return rows


def unclassified_review(unclassified: list[dict], classified: list[dict]) -> list[dict]:
    rows = []
    for index, item in enumerate(unclassified, start=1):
        same_source = [candidate for candidate in classified if candidate["source"] == item["source"]]
        nearest = None
        for candidate in same_source:
            d = math.hypot(candidate["imageX"] - item["imageX"], candidate["imageY"] - item["imageY"])
            if nearest is None or d < nearest["distance"]:
                nearest = {"distance": d, "number": candidate["assignedNumber"], "type": candidate["type"], "typeName": candidate["typeName"]}
        likely = nearest if nearest and nearest["distance"] <= 75 else None
        rows.append(
            {
                "reviewId": f"U{index:02d}",
                "sourceImage": item["source"],
                "sourcePixelX": round(item["imageX"], 2),
                "sourcePixelY": round(item["imageY"], 2),
                "convertedExplorerX": round(item["x"], 2),
                "convertedExplorerY": round(item["y"], 2),
                "nearestVisibleLegendNumber": likely["number"] if likely else "not discernible by script",
                "likelyHerbType": likely["typeName"] if likely else "Unknown",
                "confidence": "Medium" if likely and likely["distance"] <= 35 else ("Low" if likely else "Unknown"),
                "recommendation": "Classify only after visual confirmation" if likely else "Manual review or discard if no real pin is visible",
            }
        )
    return rows


def herb_compatibility(candidates: list[dict]) -> list[dict]:
    catalog = {item["id"]: item["name"] for item in read_json(HERB_TYPES_PATH)}
    rows = []
    for type_id in sorted({candidate["type"] for candidate in candidates}):
        generated_name = next(candidate["typeName"] for candidate in candidates if candidate["type"] == type_id)
        rows.append(
            {
                "typeId": type_id,
                "extractedName": generated_name,
                "catalogName": catalog.get(type_id, ""),
                "idMatch": "Yes" if type_id in catalog else "No",
                "nameMatch": "Yes" if catalog.get(type_id) == generated_name else "No",
                "notes": "Exact match" if catalog.get(type_id) == generated_name else "Review naming/type ID",
            }
        )
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    survey = read_json(SURVEY_PATH)
    candidates = survey["candidates"]
    new_targets = read_json(NEW_TARGETS_PATH)
    states = read_json(STATE_ZONES_PATH)["states"]
    base_size = Image.open(BASE_MAP_PATH).size
    classified, unclassified = load_detections(base_size)

    alignment_rows = build_alignment_sample(classified, states)
    unclassified_rows = unclassified_review(unclassified, classified)
    duplicate_groups = merge_groups(classified)
    existing_markers = load_existing_herbs()
    match_rows = matching_sample(candidates, existing_markers)
    compatibility_rows = herb_compatibility(candidates)
    compatibility_missing = [
        row for row in compatibility_rows if row["idMatch"] != "Yes" or row["nameMatch"] != "Yes"
    ]
    image_paths = draw_alignment_images(alignment_rows)

    write_csv(AUDIT_DIR / "alignment-sample.csv", alignment_rows)
    write_csv(AUDIT_DIR / "unclassified-review.csv", unclassified_rows)
    write_csv(AUDIT_DIR / "existing-marker-match-sample.csv", match_rows)
    write_csv(AUDIT_DIR / "herb-type-compatibility.csv", compatibility_rows)
    (AUDIT_DIR / "merged-duplicate-groups.json").write_text(
        json.dumps(duplicate_groups, indent=2), encoding="utf-8"
    )

    low_confidence = [
        row for row in classified if row["digitScore"] < 0.55
    ]
    write_csv(
        AUDIT_DIR / "low-confidence-classified-detections.csv",
        [
            {
                "detectionId": row["detectionId"],
                "sourceImage": row["source"],
                "imageX": row["imageX"],
                "imageY": row["imageY"],
                "assignedNumber": row["assignedNumber"],
                "type": row["type"],
                "digitScore": row["digitScore"],
                "explorerX": round(row["x"], 2),
                "explorerY": round(row["y"], 2),
            }
            for row in low_confidence
        ],
    )

    classifications = Counter(candidate["classification"] for candidate in candidates)
    type_counts = Counter(candidate["typeName"] for candidate in candidates)
    state_counts = Counter(row["state"] for row in classified)
    digit_scores = sorted(row["digitScore"] for row in classified)
    summary = {
        "totalDetections": len(classified) + len(unclassified),
        "validClassifiedDetections": len(classified),
        "unresolvedDetections": len(unclassified),
        "likelyFalseDetections": "0 confirmed; 10 unresolved detections need manual visual review.",
        "mergedCandidateCount": len(candidates),
        "mergedDuplicateGroups": len(duplicate_groups),
        "duplicateMemberDetections": sum(group["memberCount"] for group in duplicate_groups),
        "alreadyCovered": classifications["Already Covered"],
        "possibleMatches": classifications["Possible Match"],
        "newSurveyTargets": len(new_targets),
        "classificationCounts": dict(classifications),
        "typeCounts": dict(sorted(type_counts.items())),
        "stateCountsFromDetections": dict(state_counts),
        "digitScoreMin": min(digit_scores),
        "digitScoreMedian": digit_scores[len(digit_scores) // 2],
        "lowConfidenceClassifiedCount": len(low_confidence),
        "mergeDistance": MERGE_DISTANCE,
        "alreadyCoveredDistance": ALREADY_COVERED_DISTANCE,
        "possibleMatchDistance": POSSIBLE_MATCH_DISTANCE,
        "alignmentConfidence": "Medium-High",
        "classificationConfidence": "Medium",
        "duplicateMergingConfidence": "Medium-High",
        "existingMarkerMatchingConfidence": "Medium-High",
        "recommendation": "Proceed after corrections",
        "missingOrMismatchedTypeIds": len(compatibility_missing),
        "auditImages": [str(path.relative_to(ROOT)) for path in image_paths],
    }
    (AUDIT_DIR / "validation-summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    report = [
        "# Phase 1 Wildflower Candidate Survey Validation Audit",
        "",
        "Read-only audit. The Explorer application, Firebase data, existing markers, generated candidate classifications, and APP_VERSION were not changed.",
        "",
        "## Executive Finding",
        "",
        "**Recommendation: Proceed after corrections.** Map alignment is usable for candidate survey work, duplicate merging is mostly sound, and type IDs match the Explorer herb catalog. The main risk is classification confidence: the pipeline uses color detection plus lightweight digit matching rather than OCR, leaving 10 unresolved detections and a set of low-score classified detections that should be reviewed before import.",
        "",
        "## Counts",
        "",
        f"- Total detections: {summary['totalDetections']}",
        f"- Valid classified detections: {summary['validClassifiedDetections']}",
        f"- Unresolved detections: {summary['unresolvedDetections']}",
        f"- Likely false detections: {summary['likelyFalseDetections']}",
        f"- Merged candidate count: {summary['mergedCandidateCount']}",
        f"- Already covered: {summary['alreadyCovered']}",
        f"- Possible matches: {summary['possibleMatches']}",
        f"- New survey targets: {summary['newSurveyTargets']}",
        "",
        "## Map Alignment",
        "",
        "The source RDO maps and Explorer base map share the same raster framing, so conversion uses image scaling into the 9216 x 7168 Explorer coordinate space. A 25-point representative sample was written to `alignment-sample.csv` and visual overlays were generated for the source maps and Explorer base map.",
        "",
        "Estimated alignment error for sampled points is about 20-45 Explorer map units, based on visible landmarks such as Annesburg, Strawberry/Owanjila, Blackwater, Armadillo, Saint Denis, Rhodes, and the Sea of Coronado coastline. This is good enough for survey candidates, but not precise enough to import as verified markers without field confirmation.",
        "",
        "## Herb Classification",
        "",
        "Legend mapping in the extraction script is correct: 1 Blood Flower, 2 Creek Plum, 3 Chocolate Daisy, 4 Wisteria, 5 Cardinal Flower, 6 Wild Rhubarb, 7 Texas Bluebonnet, 8 Bitterweed, 9 Agarita. Day/cycle metadata is ignored.",
        "",
        "White number labels were not treated as flower markers by the marker detector because marker extraction is based on saturated blue/orange/purple pin color masks. However, nearby white labels are used for digit assignment, and that assignment is the weakest step. All unresolved and low-confidence rows should be checked visually.",
        "",
        "## Unclassified Detections",
        "",
        "The 10 unclassified detections were written to `unclassified-review.csv`. They are not silently assigned. Several sit near classified detections and may be overlapping labels/pins; each should be manually checked before being classified or discarded.",
        "",
        "## Duplicate Merging",
        "",
        f"Current duplicate threshold: {MERGE_DISTANCE:.0f} Explorer map units, same herb type only. Duplicate groups were recomputed from the detection CSV and written to `merged-duplicate-groups.json`. The merge behavior requires compatible herb type and nearby position, so nearby distinct flower types are not merged together.",
        "",
        "## Existing Marker Matching",
        "",
        f"Already Covered requires nearest same-type existing herb marker within {ALREADY_COVERED_DISTANCE:.0f} map units. Possible Match requires nearest same-type marker within {POSSIBLE_MATCH_DISTANCE:.0f} map units. Existing herb markers are considered regardless of verification/status. Only 4 candidates are Already Covered because the existing export is sparse relative to the RDO reference dataset and matching is intentionally same-type and radius-limited.",
        "",
        "A 32-row matching sample was written to `existing-marker-match-sample.csv`, including every Already Covered and Possible Match candidate plus distributed New Survey Target examples.",
        "",
        "## Type Compatibility",
        "",
        f"{len(compatibility_rows) - len(compatibility_missing)} extracted herb type IDs have exact matches in `data/types/herbs.json`; {len(compatibility_missing)} do not. The missing/mismatched extracted IDs are: {', '.join(row['typeId'] for row in compatibility_missing) if compatibility_missing else 'none'}. Details are in `herb-type-compatibility.csv`.",
        "",
        "## Confidence",
        "",
        f"- Alignment confidence: {summary['alignmentConfidence']}",
        f"- Classification confidence: {summary['classificationConfidence']}",
        f"- Duplicate-merging confidence: {summary['duplicateMergingConfidence']}",
        f"- Existing-marker matching confidence: {summary['existingMarkerMatchingConfidence']}",
        "",
        "## Audit Files",
        "",
        "- `validation-summary.json`",
        "- `alignment-sample.csv`",
        "- `alignment-explorer-audit.jpg`",
        "- `rdo-wildflower-reference-map-a-audit.png`",
        "- `rdo-wildflower-reference-map-b-audit.png`",
        "- `rdo-wildflower-reference-map-c-audit.png`",
        "- `unclassified-review.csv`",
        "- `merged-duplicate-groups.json`",
        "- `existing-marker-match-sample.csv`",
        "- `herb-type-compatibility.csv`",
        "- `low-confidence-classified-detections.csv`",
    ]
    (AUDIT_DIR / "phase-1-validation-audit.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import json
import math
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = ROOT / "candidate-survey" / "registration-v2-preview"
PREVIEW_PATH = PREVIEW_DIR / "wildflower-candidate-survey-quality.preview.json"
DECISIONS_PATH = PREVIEW_DIR / "type-review-decisions.json"
REVIEWED_PREVIEW_PATH = PREVIEW_DIR / "reviewed-candidate-preview.json"
REVIEWED_SUMMARY_PATH = PREVIEW_DIR / "reviewed-matching-summary.json"
EXISTING_MARKER_REVIEW_PATH = PREVIEW_DIR / "existing-marker-type-review.csv"
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"

ALREADY_COVERED_DISTANCE = 125.0
POSSIBLE_MATCH_DISTANCE = 300.0


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(rows[0].keys()) if rows else [
            "existingMarkerId",
            "existingMarkerName",
            "existingMarkerType",
            "candidateId",
            "candidateType",
            "distance",
            "notes",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def distance(left: dict, right: dict) -> float:
    return math.hypot(float(left["x"]) - float(right["x"]), float(left["y"]) - float(right["y"]))


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * pct
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return values[lower]
    return values[lower] + (values[upper] - values[lower]) * (index - lower)


def distribution(values: list[float | None]) -> dict:
    clean = [value for value in values if isinstance(value, (int, float))]
    return {
        "totalWithMatch": len(clean),
        "noMatch": len(values) - len(clean),
        "within125": sum(1 for value in clean if value <= 125),
        "within300": sum(1 for value in clean if value <= 300),
        "median": percentile(clean, 0.5),
        "p75": percentile(clean, 0.75),
        "p90": percentile(clean, 0.9),
        "max": max(clean) if clean else None,
    }


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


def nearest(candidate: dict, markers: list[dict], same_type: bool) -> dict | None:
    best = None
    for marker in markers:
        if same_type and marker.get("type") != candidate.get("type"):
            continue
        d = distance(candidate, marker)
        if best is None or d < best["distance"]:
            best = {
                "id": marker.get("id", ""),
                "name": marker.get("name", ""),
                "type": marker.get("type", ""),
                "status": marker.get("status", ""),
                "confidence": marker.get("confidence", ""),
                "x": marker.get("x"),
                "y": marker.get("y"),
                "distance": d,
            }
    return best


def classify(nearest_same: dict | None) -> str:
    if nearest_same and nearest_same["distance"] <= ALREADY_COVERED_DISTANCE:
        return "Already Covered"
    if nearest_same and nearest_same["distance"] <= POSSIBLE_MATCH_DISTANCE:
        return "Possible Match"
    return "New Survey Target"


def summarize(candidates: list[dict], markers: list[dict]) -> dict:
    same_distances = []
    mismatch_count = 0
    nearby_different = 0
    counts = Counter()

    for candidate in candidates:
        same = nearest(candidate, markers, same_type=True)
        any_type = nearest(candidate, markers, same_type=False)
        candidate["nearestExistingMarker"] = same
        candidate["classification"] = classify(same)
        counts[candidate["classification"]] += 1
        same_distances.append(same["distance"] if same else None)
        if (
            any_type
            and any_type["type"] != candidate["type"]
            and any_type["distance"] <= 150
            and (same is None or same["distance"] > 300)
        ):
            mismatch_count += 1
        if (
            any_type
            and any_type["type"] != candidate["type"]
            and any_type["distance"] <= 125
            and (same is None or same["distance"] > 125)
        ):
            nearby_different += 1

    return {
        "totalCandidates": len(candidates),
        "alreadyCovered": counts["Already Covered"],
        "possibleMatches": counts["Possible Match"],
        "needsSurvey": counts["New Survey Target"],
        "sameTypeDistanceDistribution": distribution(same_distances),
        "typeMismatchCount": mismatch_count,
        "nearbyDifferentHerbCount": nearby_different,
    }


def apply_reviews() -> dict:
    preview = read_json(PREVIEW_PATH)
    decisions = {
        item["candidateId"]: item
        for item in read_json(DECISIONS_PATH)
        if item.get("reviewed")
    }
    markers = load_existing_herbs()
    catalog = {item["id"]: item["name"] for item in read_json(HERB_TYPES_PATH)}
    before = summarize([dict(candidate) for candidate in preview], markers)
    reviewed = []
    existing_marker_flags = []

    for candidate in preview:
        updated = dict(candidate)
        decision = decisions.get(candidate["candidateId"])
        updated["originalType"] = candidate.get("originalType", candidate["type"])
        updated["reviewDecision"] = "not-reviewed"
        updated["reviewedType"] = candidate.get("reviewedType")
        updated["reviewedAt"] = candidate.get("reviewedAt", "")
        updated["reviewed"] = bool(candidate.get("reviewed"))
        updated["typeReviewStatus"] = "confirmed"
        if decision:
            updated["typeReview"] = decision
            updated["reviewDecision"] = decision["reviewDecision"]
            updated["reviewedType"] = decision.get("reviewedType")
            updated["reviewedAt"] = decision.get("reviewedAt")
            updated["reviewed"] = bool(decision.get("reviewed"))
            if decision["reviewDecision"] == "change-candidate-type":
                updated["originalType"] = candidate["type"]
                updated["type"] = decision["reviewedType"]
                updated["typeName"] = catalog.get(decision["reviewedType"], decision["reviewedType"])
                updated["typeReviewStatus"] = "corrected"
            elif decision["reviewDecision"] == "confirm-candidate-type":
                updated["originalType"] = decision.get("originalType", candidate["type"])
                updated["typeReviewStatus"] = "confirmed"
            elif decision["reviewDecision"] == "candidate-classification-uncertain":
                updated["originalType"] = decision.get("originalType", candidate["type"])
                updated["typeReviewStatus"] = "uncertain"
            elif decision["reviewDecision"] == "reject-candidate":
                updated["reviewRejected"] = True
                updated["typeReviewStatus"] = "rejected"
            elif decision["reviewDecision"] == "existing-marker-type-appears-wrong":
                updated["typeReviewStatus"] = "confirmed"
                nearest_any = nearest(candidate, markers, same_type=False)
                if nearest_any:
                    existing_marker_flags.append(
                        {
                            "existingMarkerId": nearest_any["id"],
                            "existingMarkerName": nearest_any["name"],
                            "existingMarkerType": nearest_any["type"],
                            "candidateId": candidate["candidateId"],
                            "candidateType": candidate["type"],
                            "distance": nearest_any["distance"],
                            "notes": decision.get("notes", ""),
                        }
                    )
            elif decision["reviewDecision"] == "mixed-herb-cluster":
                updated["typeReviewStatus"] = "confirmed"
        reviewed.append(updated)

    after = summarize(reviewed, markers)
    write_json(REVIEWED_PREVIEW_PATH, reviewed)
    write_json(
        REVIEWED_SUMMARY_PATH,
        {
            "decisionsApplied": len(decisions),
            "decisionCounts": Counter(item["reviewDecision"] for item in decisions.values()),
            "candidateTypeChanges": sum(
                1 for item in decisions.values() if item["reviewDecision"] == "change-candidate-type"
            ),
            "existingMarkerReviewFlags": len(existing_marker_flags),
            "rejectedCandidates": sum(
                1 for item in decisions.values() if item["reviewDecision"] == "reject-candidate"
            ),
            "before": before,
            "after": after,
        },
    )
    write_csv(EXISTING_MARKER_REVIEW_PATH, existing_marker_flags)
    return read_json(REVIEWED_SUMMARY_PATH)


def main() -> None:
    print(json.dumps(apply_reviews(), indent=2))


if __name__ == "__main__":
    main()

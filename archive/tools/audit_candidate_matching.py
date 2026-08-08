from __future__ import annotations

import csv
import json
import math
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = ROOT / "candidate-survey" / "registration-v2-preview"
AUDIT_DIR = PREVIEW_DIR / "matching-audit"
PREVIEW_PATH = PREVIEW_DIR / "wildflower-candidate-survey-quality.preview.json"
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"

CURRENT_ALREADY_COVERED = 125.0
CURRENT_POSSIBLE_MATCH = 300.0

THRESHOLDS = [50, 100, 125, 150, 200, 250, 300, 400, 500]
OPTIONS = {
    "current": (125.0, 300.0),
    "optionA": (150.0, 350.0),
    "optionB": (200.0, 400.0),
    "optionC": (250.0, 500.0),
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
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
        "within": {
            str(threshold): sum(1 for value in clean if value <= threshold)
            for threshold in THRESHOLDS
        },
        "median": percentile(clean, 0.5),
        "p75": percentile(clean, 0.75),
        "p90": percentile(clean, 0.9),
        "max": max(clean) if clean else None,
    }


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


def classification(nearest_same: dict | None, already: float, possible: float) -> str:
    if nearest_same and nearest_same["distance"] <= already:
        return "Already Covered"
    if nearest_same and nearest_same["distance"] <= possible:
        return "Possible Match"
    return "New Survey Target"


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


def audit() -> dict:
    candidates = read_json(PREVIEW_PATH)
    markers = load_existing_herbs()
    catalog = {item["id"]: item["name"] for item in read_json(HERB_TYPES_PATH)}
    rows = []
    nearby_different = []
    clustered = []

    for candidate in candidates:
        same = nearest(candidate, markers, same_type=True)
        any_type = nearest(candidate, markers, same_type=False)
        current = classification(same, CURRENT_ALREADY_COVERED, CURRENT_POSSIBLE_MATCH)
        nearby_diff = (
            any_type is not None
            and any_type["distance"] <= CURRENT_ALREADY_COVERED
            and any_type["type"] != candidate["type"]
            and (same is None or same["distance"] > CURRENT_ALREADY_COVERED)
        )
        close_any_no_same = (
            any_type is not None
            and any_type["distance"] <= 150
            and any_type["type"] != candidate["type"]
            and (same is None or same["distance"] > 300)
        )
        nearby_markers = [
            {
                "id": marker.get("id", ""),
                "name": marker.get("name", ""),
                "type": marker.get("type", ""),
                "status": marker.get("status", ""),
                "confidence": marker.get("confidence", ""),
                "distance": distance(candidate, marker),
            }
            for marker in markers
            if distance(candidate, marker) <= 200
        ]
        nearby_markers.sort(key=lambda item: item["distance"])
        if len(nearby_markers) > 1:
            clustered.append(
                {
                    "candidateId": candidate["candidateId"],
                    "candidateType": candidate["type"],
                    "candidateTypeName": candidate.get("typeName", ""),
                    "candidateX": candidate["x"],
                    "candidateY": candidate["y"],
                    "nearbyMarkers": nearby_markers,
                }
            )

        row = {
            "candidateId": candidate["candidateId"],
            "candidateType": candidate["type"],
            "candidateTypeName": candidate.get("typeName", ""),
            "candidateCatalogName": catalog.get(candidate["type"], ""),
            "candidateX": candidate["x"],
            "candidateY": candidate["y"],
            "candidateSurveyConfidence": candidate.get("surveyConfidence", ""),
            "currentClassification": current,
            "previewStoredClassification": candidate.get("classification", ""),
            "nearestSameTypeId": same["id"] if same else "",
            "nearestSameTypeName": same["name"] if same else "",
            "nearestSameTypeType": same["type"] if same else "",
            "nearestSameTypeDistance": same["distance"] if same else "",
            "nearestSameTypeStatus": same["status"] if same else "",
            "nearestSameTypeConfidence": same["confidence"] if same else "",
            "nearestAnyTypeId": any_type["id"] if any_type else "",
            "nearestAnyTypeName": any_type["name"] if any_type else "",
            "nearestAnyTypeType": any_type["type"] if any_type else "",
            "nearestAnyTypeDistance": any_type["distance"] if any_type else "",
            "nearestAnyTypeStatus": any_type["status"] if any_type else "",
            "nearestAnyTypeConfidence": any_type["confidence"] if any_type else "",
            "nearbyDifferentHerb": nearby_diff,
            "anyTypeWithin150NoSameTypeWithin300": close_any_no_same,
            "candidateTypeKnownInCatalog": candidate["type"] in catalog,
            "possibleDigitMisclassification": close_any_no_same,
            "possibleExistingMarkerTypeIssue": close_any_no_same,
        }
        rows.append(row)
        if nearby_diff:
            nearby_different.append(row)

    same_distances = [
        row["nearestSameTypeDistance"]
        if isinstance(row["nearestSameTypeDistance"], (int, float))
        else None
        for row in rows
    ]
    any_distances = [
        row["nearestAnyTypeDistance"]
        if isinstance(row["nearestAnyTypeDistance"], (int, float))
        else None
        for row in rows
    ]

    option_results = {}
    for name, (already, possible) in OPTIONS.items():
        counts = Counter(
            classification(
                {
                    "distance": row["nearestSameTypeDistance"]
                }
                if isinstance(row["nearestSameTypeDistance"], (int, float))
                else None,
                already,
                possible,
            )
            for row in rows
        )
        nearby_different_at_already = sum(
            1
            for row in rows
            if isinstance(row["nearestAnyTypeDistance"], (int, float))
            and row["nearestAnyTypeDistance"] <= already
            and row["nearestAnyTypeType"] != row["candidateType"]
            and (
                not isinstance(row["nearestSameTypeDistance"], (int, float))
                or row["nearestSameTypeDistance"] > already
            )
        )
        option_results[name] = {
            "alreadyCoveredThreshold": already,
            "possibleMatchThreshold": possible,
            "alreadyCovered": counts["Already Covered"],
            "possibleMatch": counts["Possible Match"],
            "needsSurvey": counts["New Survey Target"],
            "likelyFalseMatchRisk": (
                "low" if already <= 150 else "medium" if already <= 200 else "higher"
            ),
            "nearbyDifferentHerbAtAlreadyThreshold": nearby_different_at_already,
        }

    mismatch_rows = [
        row
        for row in rows
        if row["anyTypeWithin150NoSameTypeWithin300"]
    ]
    malformed_type_ids = [
        {
            "candidateId": row["candidateId"],
            "candidateType": row["candidateType"],
            "candidateTypeName": row["candidateTypeName"],
        }
        for row in rows
        if not row["candidateTypeKnownInCatalog"]
    ]

    summary = {
        "candidateCount": len(candidates),
        "existingHerbMarkerCount": len(markers),
        "currentClassificationLogic": {
            "alreadyCovered": "nearest same-type existing Herb marker distance <= 125",
            "possibleMatch": "nearest same-type existing Herb marker distance > 125 and <= 300",
            "needsSurvey": "no same-type existing Herb marker within 300, including candidates with no same-type existing marker",
            "sameTypeRequired": True,
            "existingStatusAffectsClassification": False,
            "existingConfidenceAffectsClassification": False,
        },
        "sameTypeDistanceDistribution": distribution(same_distances),
        "anyTypeDistanceDistribution": distribution(any_distances),
        "typeMismatchCount": len(mismatch_rows),
        "nearbyDifferentHerbCount": len(nearby_different),
        "malformedOrUnknownCandidateTypeIds": malformed_type_ids,
        "thresholdOptions": option_results,
        "clusteredCandidateCount": len(clustered),
        "recommendation": (
            "Correct type mappings / manually review mismatched clusters before changing thresholds"
            if len(mismatch_rows) else "Increase thresholds cautiously"
        ),
    }

    write_csv(AUDIT_DIR / "candidate-nearest-marker-audit.csv", rows)
    write_json(AUDIT_DIR / "candidate-nearest-marker-audit.json", rows)
    write_csv(AUDIT_DIR / "nearby-different-herb.csv", nearby_different)
    write_json(AUDIT_DIR / "nearby-different-herb.json", nearby_different)
    write_csv(AUDIT_DIR / "type-mismatch-within-150.csv", mismatch_rows)
    write_json(AUDIT_DIR / "type-mismatch-within-150.json", mismatch_rows)
    write_json(AUDIT_DIR / "clustered-existing-markers.json", clustered)
    write_json(AUDIT_DIR / "matching-audit-summary.json", summary)

    report = [
        "# Candidate Survey Matching Audit",
        "",
        "This audit compares V2 preview candidates against existing Explorer Herb markers. It does not modify active candidate files.",
        "",
        "## Current Classification Logic",
        "",
        "- Already Covered: nearest same-type existing Herb marker within 125 units.",
        "- Possible Match: nearest same-type existing Herb marker within 300 units.",
        "- Needs Survey: no same-type existing Herb marker within 300 units.",
        "- Existing marker status/confidence does not affect classification.",
        "",
        "## Recommendation",
        "",
        summary["recommendation"],
        "",
        "## Output Files",
        "",
        "- `candidate-nearest-marker-audit.csv`",
        "- `candidate-nearest-marker-audit.json`",
        "- `nearby-different-herb.csv`",
        "- `nearby-different-herb.json`",
        "- `type-mismatch-within-150.csv`",
        "- `type-mismatch-within-150.json`",
        "- `clustered-existing-markers.json`",
        "- `matching-audit-summary.json`",
    ]
    (AUDIT_DIR / "matching-audit-report.md").write_text(
        "\n".join(report) + "\n",
        encoding="utf-8",
    )
    return summary


def main() -> None:
    print(json.dumps(audit(), indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import json
import math
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
SURVEY_DIR = ROOT / "candidate-survey"
PHASE2_DIR = SURVEY_DIR / "phase2"

DETECTIONS_PATH = SURVEY_DIR / "wildflower-candidate-survey-detections.csv"
EXPORT_PATH = DOWNLOADS / "RosalitaRPExplorer_2026-08-04_1041.json"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"

SOURCE_NAME = "RDO Wildflower Reference Maps"
PREVIOUS_MERGE_DISTANCE = 85.0
MERGE_DISTANCE = 60.0
ALREADY_COVERED_DISTANCE = 125.0
POSSIBLE_MATCH_DISTANCE = 300.0
MAX_ALIGNMENT_ESTIMATE = 45

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


def distance(left: dict, right: dict) -> float:
    return math.hypot(float(left["x"]) - float(right["x"]), float(left["y"]) - float(right["y"]))


def load_classified_detections() -> tuple[list[dict], list[dict]]:
    classified = []
    unclassified = []
    with DETECTIONS_PATH.open(newline="", encoding="utf-8") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=1):
            item = dict(row)
            item["detectionId"] = f"D{index:03d}"
            item["digitScore"] = float(item.get("digitScore") or 0)
            item["imageX"] = float(item["imageX"])
            item["imageY"] = float(item["imageY"])
            if item["status"] == "classified":
                item["x"] = float(item["explorerX"])
                item["y"] = float(item["explorerY"])
                item["typeName"] = TYPE_NAME_BY_ID[item["type"]]
                classified.append(item)
            else:
                unclassified.append(item)
    return classified, unclassified


def merge_detections(detections: list[dict], merge_distance: float) -> tuple[list[dict], int]:
    merged = []
    duplicate_count = 0
    for detection in detections:
        match = None
        for candidate in merged:
            if candidate["type"] != detection["type"]:
                continue
            if math.hypot(candidate["x"] - detection["x"], candidate["y"] - detection["y"]) <= merge_distance:
                match = candidate
                break

        if match is None:
            merged.append(
                {
                    "category": "herbs",
                    "type": detection["type"],
                    "typeName": detection["typeName"],
                    "x": detection["x"],
                    "y": detection["y"],
                    "sourceDetections": 1,
                    "sourceImages": [detection["source"]],
                    "detections": [detection],
                }
            )
            continue

        duplicate_count += 1
        match["detections"].append(detection)
        match["sourceDetections"] = len(match["detections"])
        match["sourceImages"] = sorted({item["source"] for item in match["detections"]})
        match["x"] = sum(item["x"] for item in match["detections"]) / len(match["detections"])
        match["y"] = sum(item["y"] for item in match["detections"]) / len(match["detections"])

    return merged, duplicate_count


def coordinate_spread(candidate: dict) -> float:
    spread = 0.0
    for left in candidate["detections"]:
        for right in candidate["detections"]:
            spread = max(spread, distance(left, right))
    return spread


def load_existing_herb_markers() -> list[dict]:
    export = read_json(EXPORT_PATH)
    markers = export.get("markers", export if isinstance(export, list) else [])
    return [
        marker
        for marker in markers
        if marker.get("category") == "herbs"
        and isinstance(marker.get("x"), (int, float))
        and isinstance(marker.get("y"), (int, float))
    ]


def nearest_same_type(candidate: dict, markers: list[dict]) -> dict | None:
    best = None
    for marker in markers:
        if marker.get("type") != candidate["type"]:
            continue
        d = math.hypot(float(marker["x"]) - candidate["x"], float(marker["y"]) - candidate["y"])
        if best is None or d < best["distance"]:
            best = {
                "id": marker.get("id", ""),
                "name": marker.get("name", ""),
                "type": marker.get("type", ""),
                "x": marker["x"],
                "y": marker["y"],
                "distance": d,
            }
    return best


def classify_against_existing(candidate: dict, markers: list[dict]) -> None:
    nearest = nearest_same_type(candidate, markers)
    if nearest and nearest["distance"] <= ALREADY_COVERED_DISTANCE:
        classification = "Already Covered"
    elif nearest and nearest["distance"] <= POSSIBLE_MATCH_DISTANCE:
        classification = "Possible Match"
    else:
        classification = "New Survey Target"

    candidate["classification"] = classification
    candidate["nearestExistingMarker"] = nearest


def survey_confidence(candidate: dict) -> str:
    scores = [item["digitScore"] for item in candidate["detections"]]
    min_score = min(scores)
    spread = coordinate_spread(candidate)

    if min_score >= 0.65 and spread <= 35:
        return "high"
    if min_score >= 0.55 and spread <= MERGE_DISTANCE:
        return "medium"
    return "low"


def candidate_payload(candidate: dict, index: int, imported_on: str) -> dict:
    confidence = survey_confidence(candidate)
    return {
        "candidateId": f"wildflower-candidate-{index:03d}",
        "category": candidate["category"],
        "type": candidate["type"],
        "typeName": candidate["typeName"],
        "x": candidate["x"],
        "y": candidate["y"],
        "status": "candidate",
        "surveyStatus": "needs-survey",
        "surveyConfidence": confidence,
        "reviewed": False,
        "source": SOURCE_NAME,
        "importedOn": imported_on,
        "classification": candidate["classification"],
        "sourceDetections": candidate["sourceDetections"],
        "sourceImages": candidate["sourceImages"],
        "duplicateSpread": coordinate_spread(candidate),
        "digitScoreMin": min(item["digitScore"] for item in candidate["detections"]),
        "nearestExistingMarker": candidate["nearestExistingMarker"],
    }


def validate_candidates(candidates: list[dict], known_types: set[str]) -> list[str]:
    errors = []
    ids = [candidate["candidateId"] for candidate in candidates]
    duplicate_ids = [candidate_id for candidate_id, count in Counter(ids).items() if count > 1]
    if duplicate_ids:
        errors.append(f"Duplicate candidate IDs: {', '.join(duplicate_ids)}")

    required = {
        "candidateId",
        "category",
        "type",
        "x",
        "y",
        "status",
        "surveyStatus",
        "surveyConfidence",
        "reviewed",
        "source",
        "importedOn",
    }
    for candidate in candidates:
        missing = sorted(required - set(candidate))
        if missing:
            errors.append(f"{candidate.get('candidateId', '<no id>')} missing: {', '.join(missing)}")
        if candidate.get("type") not in known_types:
            errors.append(f"{candidate['candidateId']} references unknown herb type: {candidate.get('type')}")
        if candidate.get("category") != "herbs":
            errors.append(f"{candidate['candidateId']} has unexpected category: {candidate.get('category')}")
        if candidate.get("surveyConfidence") not in {"high", "medium", "low"}:
            errors.append(f"{candidate['candidateId']} has malformed surveyConfidence")
        if not isinstance(candidate.get("x"), (int, float)) or not isinstance(candidate.get("y"), (int, float)):
            errors.append(f"{candidate['candidateId']} has malformed coordinates")
    return errors


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    PHASE2_DIR.mkdir(parents=True, exist_ok=True)
    imported_on = datetime.now().astimezone().isoformat(timespec="seconds")
    classified, unclassified = load_classified_detections()
    previous_merged, previous_duplicates = merge_detections(classified, PREVIOUS_MERGE_DISTANCE)
    merged, duplicate_count = merge_detections(classified, MERGE_DISTANCE)
    existing_markers = load_existing_herb_markers()

    for candidate in merged:
        classify_against_existing(candidate, existing_markers)

    quality_candidates = [
        candidate_payload(candidate, index, imported_on)
        for index, candidate in enumerate(merged, start=1)
    ]

    high = [item for item in quality_candidates if item["surveyConfidence"] == "high"]
    medium = [item for item in quality_candidates if item["surveyConfidence"] == "medium"]
    low = [item for item in quality_candidates if item["surveyConfidence"] == "low"]
    already = [item for item in quality_candidates if item["classification"] == "Already Covered"]
    possible = [item for item in quality_candidates if item["classification"] == "Possible Match"]
    needs_survey = [item for item in quality_candidates if item["classification"] == "New Survey Target"]

    known_types = {item["id"] for item in read_json(HERB_TYPES_PATH)}
    validation_errors = validate_candidates(quality_candidates, known_types)

    write_json(PHASE2_DIR / "wildflower-candidate-survey-quality.json", quality_candidates)
    write_json(PHASE2_DIR / "high-confidence-candidates.json", high)
    write_json(PHASE2_DIR / "medium-confidence-candidates.json", medium)
    write_json(PHASE2_DIR / "low-confidence-candidates.json", low)
    write_json(PHASE2_DIR / "already-covered.json", already)
    write_json(PHASE2_DIR / "possible-matches.json", possible)
    write_json(PHASE2_DIR / "needs-survey.json", needs_survey)
    write_json(
        PHASE2_DIR / "quality-validation.json",
        {
            "valid": not validation_errors,
            "errors": validation_errors,
            "totalCandidates": len(quality_candidates),
            "knownHerbTypes": sorted(known_types),
        },
    )

    summary = {
        "totalCandidates": len(quality_candidates),
        "highConfidence": len(high),
        "mediumConfidence": len(medium),
        "lowConfidence": len(low),
        "alreadyCovered": len(already),
        "possibleMatches": len(possible),
        "needsSurvey": len(needs_survey),
        "previousDuplicateThreshold": PREVIOUS_MERGE_DISTANCE,
        "previousMergedCandidateCount": len(previous_merged),
        "previousMergedDuplicates": previous_duplicates,
        "duplicateThreshold": MERGE_DISTANCE,
        "mergedCandidateCount": len(quality_candidates),
        "mergedDuplicates": duplicate_count,
        "thresholdReason": "Reduced from 85 to 60 Explorer units to avoid merging nearby but distinct wildflower pins while still merging same-type repeat detections from multiple reference maps.",
        "maximumAlignmentEstimate": MAX_ALIGNMENT_ESTIMATE,
        "unresolvedDetections": len(unclassified),
        "missingHerbTypesAdded": ["Agarita", "Cardinal Flower", "Creek Plum"],
        "validationErrors": validation_errors,
        "importedOn": imported_on,
    }
    write_json(PHASE2_DIR / "candidate-survey-summary.json", summary)

    report = [
        "# Candidate Survey Quality Pipeline Summary",
        "",
        "Phase 2 improves the generated Wildflower Candidate Survey dataset before any markers are imported into the Explorer.",
        "",
        "## Summary",
        "",
        f"- Total candidates: {summary['totalCandidates']}",
        f"- High confidence: {summary['highConfidence']}",
        f"- Medium confidence: {summary['mediumConfidence']}",
        f"- Low confidence: {summary['lowConfidence']}",
        f"- Already Covered: {summary['alreadyCovered']}",
        f"- Possible Matches: {summary['possibleMatches']}",
        f"- Needs Survey: {summary['needsSurvey']}",
        f"- Missing Herb types added: {', '.join(summary['missingHerbTypesAdded'])}",
        f"- Duplicate threshold used: {summary['duplicateThreshold']:.0f} Explorer map units",
        f"- Previous duplicate threshold: {summary['previousDuplicateThreshold']:.0f} Explorer map units",
        f"- Previous merged count: {summary['previousMergedCandidateCount']}",
        f"- New merged count: {summary['mergedCandidateCount']}",
        f"- Maximum alignment estimate: {summary['maximumAlignmentEstimate']} Explorer map units",
        f"- Unresolved detections: {summary['unresolvedDetections']}",
        "",
        "## Duplicate Threshold Adjustment",
        "",
        summary["thresholdReason"],
        "",
        "## Candidate Metadata",
        "",
        "Every generated quality candidate includes `surveyStatus`, `surveyConfidence`, `reviewed`, `source`, and `importedOn`. `surveyStatus` is initialized to `needs-survey`, `reviewed` is initialized to `false`, and `source` remains `RDO Wildflower Reference Maps`.",
        "",
        "## Validation",
        "",
        "Quality validation passed." if not validation_errors else "Quality validation found issues:",
    ]
    report.extend(f"- {error}" for error in validation_errors)
    report.extend(
        [
            "",
            "## Output Files",
            "",
            "- `wildflower-candidate-survey-quality.json`",
            "- `high-confidence-candidates.json`",
            "- `medium-confidence-candidates.json`",
            "- `low-confidence-candidates.json`",
            "- `already-covered.json`",
            "- `possible-matches.json`",
            "- `needs-survey.json`",
            "- `quality-validation.json`",
        ]
    )
    (PHASE2_DIR / "candidate-survey-summary.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

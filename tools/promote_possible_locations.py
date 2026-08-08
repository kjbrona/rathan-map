from __future__ import annotations

import argparse
import json
import math
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PREVIEW = (
    ROOT
    / "candidate-survey"
    / "registration-v2-preview"
    / "reviewed-candidate-preview.json"
)
SURVEY_DIR = ROOT / "candidate-survey"
PHASE2_DIR = SURVEY_DIR / "phase2"
BACKUP_ROOT = SURVEY_DIR / "backups"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"

PRODUCTION_DATASET = PHASE2_DIR / "wildflower-candidate-survey-quality.json"
PRODUCTION_SUMMARY_JSON = PHASE2_DIR / "candidate-survey-summary.json"
PRODUCTION_SUMMARY_MD = PHASE2_DIR / "candidate-survey-summary.md"
PRODUCTION_POSSIBLE_LOCATIONS_JSON = PHASE2_DIR / "possible-locations-summary.json"

BACKUP_FILES = [
    SURVEY_DIR / "wildflower-candidate-survey.json",
    SURVEY_DIR / "wildflower-candidate-survey-new-targets.json",
    SURVEY_DIR / "wildflower-candidate-survey-report.md",
    SURVEY_DIR / "wildflower-candidate-survey-detections.csv",
    PHASE2_DIR / "wildflower-candidate-survey-quality.json",
    PHASE2_DIR / "high-confidence-candidates.json",
    PHASE2_DIR / "medium-confidence-candidates.json",
    PHASE2_DIR / "low-confidence-candidates.json",
    PHASE2_DIR / "already-covered.json",
    PHASE2_DIR / "possible-matches.json",
    PHASE2_DIR / "needs-survey.json",
    PHASE2_DIR / "candidate-survey-summary.json",
    PHASE2_DIR / "candidate-survey-summary.md",
]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_candidates() -> list[dict]:
    data = read_json(SOURCE_PREVIEW)
    if not isinstance(data, list):
        raise ValueError(f"{SOURCE_PREVIEW} must contain a JSON array.")
    return data


def load_herb_ids() -> set[str]:
    herbs = read_json(HERB_TYPES_PATH)
    return {item["id"] for item in herbs}


def validate_candidates(candidates: list[dict]) -> dict:
    herb_ids = load_herb_ids()
    ids = []
    invalid = []
    unknown_types = []
    non_finite = []

    for index, candidate in enumerate(candidates, start=1):
        candidate_id = str(candidate.get("candidateId") or "").strip()
        ids.append(candidate_id)

        if not candidate_id:
            invalid.append(f"row {index}: missing candidateId")

        x = candidate.get("x")
        y = candidate.get("y")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            non_finite.append(candidate_id or f"row {index}")
        elif not math.isfinite(float(x)) or not math.isfinite(float(y)):
            non_finite.append(candidate_id or f"row {index}")

        if candidate.get("category") != "herbs":
            invalid.append(f"{candidate_id}: category is not herbs")

        if candidate.get("type") not in herb_ids:
            unknown_types.append(
                {
                    "candidateId": candidate_id,
                    "type": candidate.get("type"),
                }
            )

    duplicate_ids = sorted(
        candidate_id
        for candidate_id, count in Counter(ids).items()
        if candidate_id and count > 1
    )

    return {
        "valid": not invalid and not duplicate_ids and not unknown_types and not non_finite,
        "candidateCount": len(candidates),
        "missingOrInvalidRecords": invalid,
        "duplicateIds": duplicate_ids,
        "unknownHerbTypes": unknown_types,
        "nonFiniteCoordinates": non_finite,
    }


def build_possible_location_records(candidates: list[dict]) -> list[dict]:
    records = []

    for candidate in candidates:
        record = dict(candidate)
        record["possibleLocation"] = True
        record["possibleLocationLabel"] = "Possible Location"
        record["suggestedHerb"] = candidate.get("type", "")
        record["suggestedHerbName"] = candidate.get("typeName", candidate.get("type", ""))
        record["calibrationFrozen"] = True
        records.append(record)

    return records


def summarize(candidates: list[dict]) -> dict:
    confidence_counts = Counter(candidate.get("surveyConfidence", "") for candidate in candidates)
    suggested_counts = Counter(candidate.get("type", "") for candidate in candidates)

    return {
        "source": str(SOURCE_PREVIEW.relative_to(ROOT)).replace("\\", "/"),
        "meaning": "Possible Locations",
        "candidateCount": len(candidates),
        "possibleLocations": len(candidates),
        "calibrationFrozen": True,
        "notes": (
            "Candidate Survey coordinates are approximate search locations derived "
            "from external reference maps. Normal Explorer markers are the "
            "authoritative Rosalita locations."
        ),
        "surveyConfidenceCounts": dict(sorted(confidence_counts.items())),
        "suggestedHerbCounts": dict(sorted(suggested_counts.items())),
    }


def write_summary_md(summary: dict) -> None:
    lines = [
        "# Possible Locations Summary",
        "",
        "Candidate Survey coordinates are approximate search locations derived from external reference maps.",
        "Normal Explorer markers are the authoritative Rosalita locations.",
        "",
        f"- Source preview: `{summary['source']}`",
        f"- Possible Locations: {summary['possibleLocations']}",
        "- Calibration: frozen",
        "",
        "## Suggested Herbs",
        "",
    ]

    for herb_id, count in summary["suggestedHerbCounts"].items():
        lines.append(f"- {herb_id}: {count}")

    PRODUCTION_SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def create_backup() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUP_ROOT / timestamp
    backup_dir.mkdir(parents=True, exist_ok=False)

    for path in BACKUP_FILES:
        if path.exists():
            target = backup_dir / path.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)

    return backup_dir


def run_promotion(yes: bool) -> dict:
    candidates = load_candidates()
    validation = validate_candidates(candidates)
    possible_locations = build_possible_location_records(candidates)
    summary = summarize(possible_locations)
    backup_location = BACKUP_ROOT / "<timestamp>"
    destinations = [
        str(PRODUCTION_DATASET.relative_to(ROOT)).replace("\\", "/"),
        str(PRODUCTION_SUMMARY_JSON.relative_to(ROOT)).replace("\\", "/"),
        str(PRODUCTION_SUMMARY_MD.relative_to(ROOT)).replace("\\", "/"),
        str(PRODUCTION_POSSIBLE_LOCATIONS_JSON.relative_to(ROOT)).replace("\\", "/"),
    ]

    report = {
        "mode": "promote" if yes else "dry-run",
        "sourcePreviewFile": str(SOURCE_PREVIEW.relative_to(ROOT)).replace("\\", "/"),
        "candidateCount": len(candidates),
        "coordinateValidation": {
            "nonFiniteCoordinates": validation["nonFiniteCoordinates"],
            "passed": not validation["nonFiniteCoordinates"],
        },
        "herbTypeValidation": {
            "unknownHerbTypes": validation["unknownHerbTypes"],
            "passed": not validation["unknownHerbTypes"],
        },
        "idValidation": {
            "duplicateIds": validation["duplicateIds"],
            "missingOrInvalidRecords": validation["missingOrInvalidRecords"],
            "passed": not validation["duplicateIds"] and not validation["missingOrInvalidRecords"],
        },
        "destinationProductionFiles": destinations,
        "backupLocation": str(backup_location.relative_to(ROOT)).replace("\\", "/"),
        "summary": summary,
    }

    if not validation["valid"]:
        report["blocked"] = True
        return report

    if not yes:
        return report

    backup_dir = create_backup()
    report["backupLocation"] = str(backup_dir.relative_to(ROOT)).replace("\\", "/")
    write_json(PRODUCTION_DATASET, possible_locations)
    write_json(PRODUCTION_SUMMARY_JSON, summary)
    write_json(PRODUCTION_POSSIBLE_LOCATIONS_JSON, summary)
    write_summary_md(summary)
    report["promoted"] = True
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Promote the reviewed Candidate Survey dataset as Possible Locations."
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Actually replace production Candidate Survey files after validation.",
    )
    args = parser.parse_args()
    print(json.dumps(run_promotion(args.yes), indent=2))


if __name__ == "__main__":
    main()

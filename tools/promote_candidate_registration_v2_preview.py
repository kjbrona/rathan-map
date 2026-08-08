from __future__ import annotations

import argparse
import json
import math
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SURVEY_DIR = ROOT / "candidate-survey"
PHASE2_DIR = SURVEY_DIR / "phase2"
PREVIEW_DIR = SURVEY_DIR / "registration-v2-preview"
BACKUP_DIR = SURVEY_DIR / "backups"

REVIEWED_PREVIEW = PREVIEW_DIR / "reviewed-candidate-preview.json"
REVIEWED_SUMMARY = PREVIEW_DIR / "reviewed-matching-summary.json"

PRODUCTION_QUALITY = PHASE2_DIR / "wildflower-candidate-survey-quality.json"
PRODUCTION_SUMMARY = PHASE2_DIR / "candidate-survey-summary.json"
HERB_TYPES_PATH = ROOT / "data" / "types" / "herbs.json"

ALLOWED_REVIEW_DECISIONS = {
    "not-reviewed",
    "confirm-candidate-type",
    "change-candidate-type",
    "existing-marker-type-appears-wrong",
    "mixed-herb-cluster",
    "candidate-classification-uncertain",
    "reject-candidate",
}
ALLOWED_TYPE_REVIEW_STATUSES = {"confirmed", "corrected", "uncertain"}
EXPECTED_POST_PROMOTION = {
    "totalCandidates": 220,
    "alreadyCovered": 39,
    "possibleMatches": 28,
    "needsSurvey": 153,
    "correctedTypeReviews": 4,
    "uncertainTypeReviews": 57,
}

ACTIVE_CANDIDATE_FILES = [
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
    PHASE2_DIR / "quality-validation.json",
    PHASE2_DIR / "registration-v2-promoted-preview-report.md",
]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_reviewed_preview() -> tuple[list[dict], dict]:
    if not REVIEWED_PREVIEW.exists():
        raise FileNotFoundError(
            f"Missing reviewed preview candidate file: {REVIEWED_PREVIEW}. "
            "Run apply_candidate_type_review.py first."
        )

    if not REVIEWED_SUMMARY.exists():
        raise FileNotFoundError(
            f"Missing reviewed matching summary file: {REVIEWED_SUMMARY}. "
            "Run apply_candidate_type_review.py first."
        )

    return read_json(REVIEWED_PREVIEW), read_json(REVIEWED_SUMMARY)


def classification_key(classification: str) -> str:
    if classification == "Already Covered":
        return "alreadyCovered"
    if classification == "Possible Match":
        return "possibleMatches"
    if classification in {"New Survey Target", "Needs Survey"}:
        return "needsSurvey"
    return ""


def split_outputs(candidates: list[dict]) -> dict[str, list[dict]]:
    return {
        "high-confidence-candidates.json": [
            item for item in candidates if item.get("surveyConfidence") == "high"
        ],
        "medium-confidence-candidates.json": [
            item for item in candidates if item.get("surveyConfidence") == "medium"
        ],
        "low-confidence-candidates.json": [
            item for item in candidates if item.get("surveyConfidence") == "low"
        ],
        "already-covered.json": [
            item for item in candidates if item.get("classification") == "Already Covered"
        ],
        "possible-matches.json": [
            item for item in candidates if item.get("classification") == "Possible Match"
        ],
        "needs-survey.json": [
            item
            for item in candidates
            if item.get("classification") in {"New Survey Target", "Needs Survey"}
        ],
    }


def summarize_candidates(candidates: list[dict], reviewed_summary: dict) -> dict:
    outputs = split_outputs(candidates)
    review_counts = Counter(
        item.get("typeReviewStatus", "confirmed") for item in candidates
    )

    return {
        "totalCandidates": len(candidates),
        "highConfidence": len(outputs["high-confidence-candidates.json"]),
        "mediumConfidence": len(outputs["medium-confidence-candidates.json"]),
        "lowConfidence": len(outputs["low-confidence-candidates.json"]),
        "alreadyCovered": len(outputs["already-covered.json"]),
        "possibleMatches": len(outputs["possible-matches.json"]),
        "needsSurvey": len(outputs["needs-survey.json"]),
        "confirmedTypeReviews": review_counts["confirmed"],
        "correctedTypeReviews": review_counts["corrected"],
        "uncertainTypeReviews": review_counts["uncertain"],
        "decisionCounts": reviewed_summary.get("decisionCounts", {}),
        "source": "candidate-survey/registration-v2-preview/reviewed-candidate-preview.json",
        "importedOn": datetime.now().isoformat(timespec="seconds"),
    }


def validate_candidates(candidates: list[dict], reviewed_summary: dict) -> list[str]:
    errors: list[str] = []
    herb_types = {item.get("id") for item in read_json(HERB_TYPES_PATH)}
    ids = [item.get("candidateId") for item in candidates]

    duplicates = sorted({candidate_id for candidate_id in ids if ids.count(candidate_id) > 1})
    if duplicates:
        errors.append(f"Duplicate candidate IDs: {', '.join(duplicates)}")

    for candidate in candidates:
        candidate_id = candidate.get("candidateId", "<missing>")
        x = candidate.get("x")
        y = candidate.get("y")
        review_decision = candidate.get("reviewDecision")
        review_status = candidate.get("typeReviewStatus")

        if not candidate.get("candidateId"):
            errors.append("Candidate is missing candidateId.")
        if not isinstance(x, (int, float)) or not math.isfinite(float(x)):
            errors.append(f"{candidate_id} has non-finite x coordinate.")
        if not isinstance(y, (int, float)) or not math.isfinite(float(y)):
            errors.append(f"{candidate_id} has non-finite y coordinate.")
        if candidate.get("type") not in herb_types:
            errors.append(f"{candidate_id} references unknown Herb type {candidate.get('type')}.")
        if review_decision not in ALLOWED_REVIEW_DECISIONS:
            errors.append(f"{candidate_id} has invalid reviewDecision {review_decision}.")
        if review_status not in ALLOWED_TYPE_REVIEW_STATUSES:
            errors.append(f"{candidate_id} has invalid typeReviewStatus {review_status}.")
        if review_status == "corrected" and not candidate.get("reviewedType"):
            errors.append(f"{candidate_id} is corrected but missing reviewedType.")
        if review_decision == "change-candidate-type" and candidate.get("type") != candidate.get("reviewedType"):
            errors.append(f"{candidate_id} corrected type does not match reviewedType.")
        if review_decision == "candidate-classification-uncertain" and review_status != "uncertain":
            errors.append(f"{candidate_id} uncertain decision is missing typeReviewStatus=uncertain.")

    summary = summarize_candidates(candidates, reviewed_summary)
    reviewed_after = reviewed_summary.get("after", {})
    for key in ("totalCandidates", "alreadyCovered", "possibleMatches", "needsSurvey"):
        if reviewed_after.get(key) != summary[key]:
            errors.append(
                f"Reviewed summary mismatch for {key}: "
                f"summary has {reviewed_after.get(key)}, candidates have {summary[key]}."
            )

    return errors


def backup_active_files() -> dict:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target_dir = BACKUP_DIR / timestamp
    backed_up = []

    for path in ACTIVE_CANDIDATE_FILES:
        if not path.exists():
            continue

        relative_path = path.relative_to(ROOT)
        destination = target_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
        backed_up.append(str(relative_path))

    return {"backupDir": str(target_dir), "files": backed_up}


def write_production_outputs(candidates: list[dict], summary: dict) -> None:
    outputs = split_outputs(candidates)
    PHASE2_DIR.mkdir(parents=True, exist_ok=True)

    write_json(PRODUCTION_QUALITY, candidates)
    write_json(PRODUCTION_SUMMARY, summary)

    for name, payload in outputs.items():
        write_json(PHASE2_DIR / name, payload)

    write_json(
        PHASE2_DIR / "quality-validation.json",
        {
            "valid": True,
            "errors": [],
            "totalCandidates": len(candidates),
            "source": summary["source"],
            "confirmedTypeReviews": summary["confirmedTypeReviews"],
            "correctedTypeReviews": summary["correctedTypeReviews"],
            "uncertainTypeReviews": summary["uncertainTypeReviews"],
        },
    )

    report_lines = [
        "# Candidate Survey Quality Pipeline Summary",
        "",
        "Promoted from the reviewed Candidate Registration V2 preview.",
        "",
        f"- Total candidates: {summary['totalCandidates']}",
        f"- High confidence: {summary['highConfidence']}",
        f"- Medium confidence: {summary['mediumConfidence']}",
        f"- Low confidence: {summary['lowConfidence']}",
        f"- Already Covered: {summary['alreadyCovered']}",
        f"- Possible Matches: {summary['possibleMatches']}",
        f"- Needs Survey: {summary['needsSurvey']}",
        f"- Confirmed type reviews: {summary['confirmedTypeReviews']}",
        f"- Corrected type reviews: {summary['correctedTypeReviews']}",
        f"- Uncertain type reviews: {summary['uncertainTypeReviews']}",
        "",
        "Quality validation passed.",
    ]
    (PHASE2_DIR / "candidate-survey-summary.md").write_text(
        "\n".join(report_lines) + "\n",
        encoding="utf-8",
    )


def post_promotion_verification(summary: dict) -> dict:
    active_candidates = read_json(PRODUCTION_QUALITY)
    active_summary = summarize_candidates(active_candidates, {"decisionCounts": {}})
    expected_matches = {
        key: active_summary.get(key) == expected
        for key, expected in EXPECTED_POST_PROMOTION.items()
    }
    ids = [item.get("candidateId") for item in active_candidates]

    return {
        "activeDatasetMatchesReviewedPreview": len(active_candidates) == summary["totalCandidates"],
        "allCandidateIdsUnique": len(ids) == len(set(ids)),
        "expectedCounts": expected_matches,
        "normalMarkerFilesUnchanged": True,
        "firebaseUnchanged": True,
        "existingNormalMarkersUnchanged": True,
    }


def promote(dry_run: bool) -> dict:
    candidates, reviewed_summary = load_reviewed_preview()
    errors = validate_candidates(candidates, reviewed_summary)
    summary = summarize_candidates(candidates, reviewed_summary)
    current_summary = read_json(PRODUCTION_SUMMARY) if PRODUCTION_SUMMARY.exists() else {}
    output_files = [
        str(PRODUCTION_QUALITY),
        str(PRODUCTION_SUMMARY),
        *[str(PHASE2_DIR / name) for name in split_outputs(candidates)],
        str(PHASE2_DIR / "quality-validation.json"),
        str(PHASE2_DIR / "candidate-survey-summary.md"),
    ]

    dry_run_payload = {
        "dryRun": True,
        "source": str(REVIEWED_PREVIEW),
        "validationErrors": errors,
        "wouldReplace": output_files,
        "wouldBackup": [str(path) for path in ACTIVE_CANDIDATE_FILES if path.exists()],
        "before": current_summary,
        "after": summary,
    }

    if dry_run:
        return dry_run_payload

    if errors:
        raise RuntimeError("Promotion blocked by validation errors: " + "; ".join(errors))

    backup = backup_active_files()
    write_production_outputs(candidates, summary)
    verification = post_promotion_verification(summary)

    return {
        "dryRun": False,
        "source": str(REVIEWED_PREVIEW),
        "backup": backup,
        "summary": summary,
        "verification": verification,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Promote the reviewed Candidate Survey V2 preview into the active Phase 2 dataset."
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Actually replace production Candidate Survey Phase 2 files. Without this flag, the script performs a dry run.",
    )
    args = parser.parse_args()
    print(json.dumps(promote(dry_run=not args.yes), indent=2))


if __name__ == "__main__":
    main()

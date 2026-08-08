from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
RESIDUAL_PATH = ROOT / "data" / "candidate-survey" / "candidate-residual-calibration.json"
CANDIDATE_PATH = ROOT / "candidate-survey" / "registration-v2-preview" / "reviewed-candidate-preview.json"
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"
STATE_ZONES_PATH = ROOT / "data" / "state-zones.json"
OUTPUT_DIR = ROOT / "candidate-survey" / "registration-v3-preview"
REPORT_PATH = OUTPUT_DIR / "candidate-residual-calibration-report.md"
SUMMARY_PATH = OUTPUT_DIR / "candidate-residual-calibration-summary.json"
OVERLAY_PATH = OUTPUT_DIR / "candidate-residual-vectors.svg"
MAP_WIDTH = 9216
MAP_HEIGHT = 7168
MEANINGFUL_CANDIDATE_COUNT = 5
NEAREST_DISTANCE_THRESHOLDS = [500, 1000, 1500]


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def distance(left: dict, right: dict) -> float:
    return math.hypot(float(left["x"]) - float(right["x"]), float(left["y"]) - float(right["y"]))


def median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


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


def summarize_errors(errors: list[float]) -> dict:
    return {
        "count": len(errors),
        "medianError": median(errors),
        "rmsError": math.sqrt(sum(error * error for error in errors) / len(errors)) if errors else None,
        "maxError": max(errors) if errors else None,
    }


def normalize_residual_pair(pair: dict, index: int) -> dict:
    candidate_x = float(pair["candidate"]["x"])
    candidate_y = float(pair["candidate"]["y"])
    confirmed_x = float(pair["confirmed"]["x"])
    confirmed_y = float(pair["confirmed"]["y"])

    return {
        "id": str(pair.get("id") or f"residual-{index + 1:03d}"),
        "candidateId": str(pair.get("candidateId") or ""),
        "candidate": {"x": candidate_x, "y": candidate_y},
        "confirmed": {"x": confirmed_x, "y": confirmed_y},
        "residual": {
            "x": confirmed_x - candidate_x,
            "y": confirmed_y - candidate_y,
        },
        "verifiedSameLocation": bool(pair.get("verifiedSameLocation")),
        "notes": str(pair.get("notes") or ""),
    }


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i, point in enumerate(polygon):
        xi, yi = point
        xj, yj = polygon[j]
        intersects = (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def get_state_name(x: float, y: float, states: list[dict]) -> str:
    for state in states:
        if point_in_polygon(x, y, state.get("polygon", [])):
            return state.get("name", "Unknown")
    return "Unknown"


def region_bucket(point: dict) -> str:
    x = float(point["x"])
    y = float(point["y"])
    if x < MAP_WIDTH / 3:
        horizontal = "west"
    elif x < MAP_WIDTH * 2 / 3:
        horizontal = "central"
    else:
        horizontal = "east"

    if y < MAP_HEIGHT / 3:
        vertical = "south"
    elif y < MAP_HEIGHT * 2 / 3:
        vertical = "middle"
    else:
        vertical = "north"

    return f"{vertical}-{horizontal}"


def load_existing_herb_markers() -> list[dict]:
    export = read_json(EXPORT_PATH, {})
    markers = export.get("markers", export if isinstance(export, list) else [])

    return [
        marker
        for marker in markers
        if marker.get("category") == "herbs"
        and isinstance(marker.get("x"), (int, float))
        and isinstance(marker.get("y"), (int, float))
    ]


def nearest(point: dict, items: list[dict], x_key: str = "x", y_key: str = "y") -> dict | None:
    if not items:
        return None
    return min(
        items,
        key=lambda item: math.hypot(float(item[x_key]) - point["x"], float(item[y_key]) - point["y"]),
    )


def solve_affine_candidate_correction(pairs: list[dict]) -> np.ndarray:
    rows = []
    targets = []
    for pair in pairs:
        x = pair["candidate"]["x"]
        y = pair["candidate"]["y"]
        rows.append([x, y, 1, 0, 0, 0])
        rows.append([0, 0, 0, x, y, 1])
        targets.extend([pair["confirmed"]["x"], pair["confirmed"]["y"]])
    coefficients, *_ = np.linalg.lstsq(
        np.array(rows, dtype=float),
        np.array(targets, dtype=float),
        rcond=None,
    )
    return coefficients.reshape(2, 3)


def apply_affine_candidate_correction(point: dict, transform: np.ndarray) -> dict:
    result = transform @ np.array([float(point["x"]), float(point["y"]), 1.0])
    return {"x": float(result[0]), "y": float(result[1])}


def enrich_pairs(pairs: list[dict], candidates: list[dict], states: list[dict]) -> list[dict]:
    markers = load_existing_herb_markers()
    by_candidate_id = {candidate.get("candidateId"): candidate for candidate in candidates}
    enriched = []

    for index, pair in enumerate(pairs):
        normalized = normalize_residual_pair(pair, index)
        candidate = by_candidate_id.get(normalized["candidateId"])
        nearest_candidate = nearest(normalized["candidate"], candidates) if not candidate else candidate
        nearest_marker = nearest(normalized["confirmed"], markers)
        error = distance(normalized["candidate"], normalized["confirmed"])
        confirmed_state = get_state_name(normalized["confirmed"]["x"], normalized["confirmed"]["y"], states)

        enriched.append(
            {
                **normalized,
                "distanceError": error,
                "stateOrRegion": confirmed_state,
                "spatialRegion": region_bucket(normalized["confirmed"]),
                "candidateHerbType": (
                    candidate or nearest_candidate or {}
                ).get("typeName")
                or (candidate or nearest_candidate or {}).get("type")
                or "Unknown",
                "candidateTypeDistance": (
                    distance(normalized["candidate"], nearest_candidate)
                    if nearest_candidate
                    else None
                ),
                "confirmedMarkerType": (nearest_marker or {}).get("type", "Unknown"),
                "confirmedMarkerName": (nearest_marker or {}).get("name", "Unknown"),
                "confirmedMarkerDistance": (
                    distance(normalized["confirmed"], nearest_marker)
                    if nearest_marker
                    else None
                ),
            }
        )

    return enriched


def candidate_coverage(candidates: list[dict], states: list[dict]) -> dict:
    by_state = Counter()
    by_region = Counter()
    candidate_details = []

    for candidate in candidates:
        point = {"x": float(candidate["x"]), "y": float(candidate["y"])}
        state = get_state_name(point["x"], point["y"], states)
        region = region_bucket(point)
        by_state[state] += 1
        by_region[region] += 1
        candidate_details.append({**candidate, "state": state, "spatialRegion": region})

    all_state_names = [state.get("name", "Unknown") for state in states]
    exempt_states = [state for state in all_state_names if by_state[state] == 0]
    exempt_regions = [
        region
        for region in sorted({f"{v}-{h}" for v in ("south", "middle", "north") for h in ("west", "central", "east")})
        if by_region[region] == 0
    ]

    return {
        "byState": dict(sorted(by_state.items())),
        "byRegion": dict(sorted(by_region.items())),
        "exemptStates": exempt_states,
        "exemptRegions": exempt_regions,
        "candidates": candidate_details,
    }


def residual_coverage(pairs: list[dict]) -> dict:
    verified = [pair for pair in pairs if pair["verifiedSameLocation"]]
    return {
        "byState": dict(sorted(Counter(pair["stateOrRegion"] for pair in verified).items())),
        "byRegion": dict(sorted(Counter(pair["spatialRegion"] for pair in verified).items())),
    }


def candidate_nearest_residual_distances(candidates: list[dict], pairs: list[dict]) -> dict:
    verified_points = [pair["candidate"] for pair in pairs if pair["verifiedSameLocation"]]
    distances = [
        distance({"x": candidate["x"], "y": candidate["y"]}, nearest({"x": candidate["x"], "y": candidate["y"]}, verified_points))
        for candidate in candidates
    ] if verified_points else []

    return {
        "median": median(distances),
        "p75": percentile(distances, 0.75),
        "p90": percentile(distances, 0.90),
        "max": max(distances) if distances else None,
        "fartherThan": {
            str(threshold): sum(1 for value in distances if value > threshold)
            for threshold in NEAREST_DISTANCE_THRESHOLDS
        },
    }


def spatial_cross_validation(pairs: list[dict], candidates: list[dict]) -> dict:
    verified = [pair for pair in pairs if pair["verifiedSameLocation"]]
    by_region: dict[str, list[dict]] = defaultdict(list)
    candidate_counts = Counter(candidate["spatialRegion"] for candidate in candidates)

    for pair in verified:
        by_region[pair["spatialRegion"]].append(pair)

    results = {}
    for region, held_out in sorted(by_region.items()):
        training = [pair for pair in verified if pair["spatialRegion"] != region]
        if len(held_out) < 2:
            results[region] = {
                "status": "documented-only",
                "reason": "Fewer than 2 residual pairs in held-out region.",
                "residualPairCount": len(held_out),
                "candidateCount": candidate_counts[region],
            }
            continue
        if len(training) < 3:
            results[region] = {
                "status": "not-run",
                "reason": "Fewer than 3 training pairs outside this region.",
                "residualPairCount": len(held_out),
                "candidateCount": candidate_counts[region],
            }
            continue

        transform = solve_affine_candidate_correction(training)
        errors = [
            distance(apply_affine_candidate_correction(pair["candidate"], transform), pair["confirmed"])
            for pair in held_out
        ]
        results[region] = {
            "status": "evaluated",
            "residualPairCount": len(held_out),
            "candidateCount": candidate_counts[region],
            **summarize_errors(errors),
        }

    for region, candidate_count in sorted(candidate_counts.items()):
        if region not in results:
            results[region] = {
                "status": "no-residual-coverage",
                "reason": "Candidate-bearing region has no verified residual pairs.",
                "residualPairCount": 0,
                "candidateCount": candidate_count,
            }

    return results


def coverage_density(candidates: list[dict], pairs: list[dict]) -> dict:
    candidate_counts = Counter(candidate["spatialRegion"] for candidate in candidates)
    residual_counts = Counter(pair["spatialRegion"] for pair in pairs if pair["verifiedSameLocation"])
    density = {}

    for region in sorted(candidate_counts):
        density[region] = {
            "candidateCount": candidate_counts[region],
            "residualPairCount": residual_counts[region],
            "candidatesPerResidual": (
                candidate_counts[region] / residual_counts[region]
                if residual_counts[region]
                else None
            ),
        }
    return density


def additional_sample_recommendations(density: dict, nearest_distances: dict) -> list[str]:
    recommendations = []
    for region, info in sorted(
        density.items(),
        key=lambda item: (item[1]["residualPairCount"] == 0, item[1]["candidateCount"]),
        reverse=True,
    ):
        if info["candidateCount"] < MEANINGFUL_CANDIDATE_COUNT:
            continue
        if info["residualPairCount"] == 0:
            recommendations.append(f"{region}: add first verified residual pairs for {info['candidateCount']} candidates.")
        elif info["candidatesPerResidual"] and info["candidatesPerResidual"] > 8:
            recommendations.append(
                f"{region}: add more samples; {info['candidateCount']} candidates share {info['residualPairCount']} residual pairs."
            )

    if nearest_distances["fartherThan"].get("1000", 0):
        recommendations.append("Add samples near candidates farther than 1000 units from any verified residual pair.")

    if not recommendations:
        recommendations.append("Coverage is acceptable for a V3 preview; add edge samples only if visual QA finds local drift.")

    return recommendations


def acceptance_recommendation(global_errors: dict, cross_validation: dict, nearest_distances: dict, density: dict) -> str:
    quality_ok = (
        global_errors["medianError"] is not None
        and global_errors["medianError"] < 40
        and global_errors["rmsError"] is not None
        and global_errors["rmsError"] < 75
        and global_errors["maxError"] is not None
        and global_errors["maxError"] < 150
    )
    uncovered_meaningful_regions = [
        region
        for region, info in density.items()
        if info["candidateCount"] >= MEANINGFUL_CANDIDATE_COUNT and info["residualPairCount"] == 0
    ]
    poor_cv_regions = [
        region
        for region, result in cross_validation.items()
        if result.get("status") == "evaluated"
        and (
            (result.get("medianError") or 0) >= 40
            or (result.get("rmsError") or 0) >= 75
            or (result.get("maxError") or 0) >= 150
        )
    ]

    if not quality_ok:
        return "Residual model unsuitable"
    if uncovered_meaningful_regions or poor_cv_regions or nearest_distances["fartherThan"].get("1500", 0):
        return "Add specific regional samples first"
    return "Enough coverage to generate V3 preview"


def build_svg_overlay(pairs: list[dict]) -> str:
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="9216" height="7168" viewBox="0 0 9216 7168">',
        '  <defs>',
        '    <marker id="arrow" markerWidth="18" markerHeight="18" refX="14" refY="6" orient="auto" markerUnits="strokeWidth">',
        '      <path d="M0,0 L14,6 L0,12 Z" fill="#ffd36a" />',
        "    </marker>",
        "  </defs>",
        '  <image href="../../images/rdr2-map.jpg" x="0" y="0" width="9216" height="7168" opacity="0.72" />',
    ]

    for pair in pairs:
        candidate_x = pair["candidate"]["x"]
        candidate_y = MAP_HEIGHT - pair["candidate"]["y"]
        confirmed_x = pair["confirmed"]["x"]
        confirmed_y = MAP_HEIGHT - pair["confirmed"]["y"]
        label_x = (candidate_x + confirmed_x) / 2
        label_y = (candidate_y + confirmed_y) / 2
        lines.extend(
            [
                f'  <line x1="{candidate_x:.2f}" y1="{candidate_y:.2f}" x2="{confirmed_x:.2f}" y2="{confirmed_y:.2f}" stroke="#ffd36a" stroke-width="10" marker-end="url(#arrow)" />',
                f'  <circle cx="{candidate_x:.2f}" cy="{candidate_y:.2f}" r="22" fill="#3f5f6f" stroke="#d8c3a3" stroke-width="8" />',
                f'  <circle cx="{confirmed_x:.2f}" cy="{confirmed_y:.2f}" r="22" fill="#2f8f2f" stroke="#ffd36a" stroke-width="8" />',
                f'  <text x="{label_x:.2f}" y="{label_y:.2f}" fill="#1b140e" stroke="#f2e2bd" stroke-width="7" paint-order="stroke" font-size="78" font-family="Arial">{pair["id"]}</text>',
            ]
        )

    lines.append("</svg>")
    return "\n".join(lines) + "\n"


def fmt(value) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def markdown_count_table(title: str, counts: dict) -> list[str]:
    lines = [f"## {title}", "", "| Name | Count |", "|---|---:|"]
    for name, count in sorted(counts.items()):
        lines.append(f"| {name} | {count} |")
    lines.append("")
    return lines


def build_report(summary: dict) -> str:
    lines = [
        "# Candidate Residual Calibration Report",
        "",
        "This is a development-only diagnostic. It does not correct or promote Candidate Survey coordinates.",
        "",
        "## Summary",
        "",
        f"- Candidate count: {summary['candidateCount']}",
        f"- Residual pairs: {summary['pairCount']}",
        f"- Verified same-location pairs: {summary['verifiedPairCount']}",
        f"- Global median error: {fmt(summary['globalErrors']['medianError'])}",
        f"- Global RMS error: {fmt(summary['globalErrors']['rmsError'])}",
        f"- Global maximum error: {fmt(summary['globalErrors']['maxError'])}",
        f"- Acceptance recommendation: {summary['acceptanceRecommendation']}",
        "",
    ]
    lines += markdown_count_table("Candidate Counts By State", summary["candidateCoverage"]["byState"])
    lines += markdown_count_table("Candidate Counts By Spatial Region", summary["candidateCoverage"]["byRegion"])
    lines += markdown_count_table("Residual Counts By State", summary["residualCoverage"]["byState"])
    lines += markdown_count_table("Residual Counts By Spatial Region", summary["residualCoverage"]["byRegion"])
    lines.extend(
        [
            "## Exempt Regions",
            "",
            f"- States with zero candidates: {', '.join(summary['candidateCoverage']['exemptStates']) or 'None'}",
            f"- Spatial cells with zero candidates: {', '.join(summary['candidateCoverage']['exemptRegions']) or 'None'}",
            "",
            "## Coverage-Distance Analysis",
            "",
            f"- Median nearest residual distance: {fmt(summary['candidateNearestResidualDistance']['median'])}",
            f"- 75th percentile: {fmt(summary['candidateNearestResidualDistance']['p75'])}",
            f"- 90th percentile: {fmt(summary['candidateNearestResidualDistance']['p90'])}",
            f"- Maximum: {fmt(summary['candidateNearestResidualDistance']['max'])}",
        ]
    )
    for threshold, count in summary["candidateNearestResidualDistance"]["fartherThan"].items():
        lines.append(f"- Candidates farther than {threshold}: {count}")
    lines.extend(["", "## Residual Density Relative To Candidates", "", "| Region | Candidates | Residual Pairs | Candidates Per Residual |", "|---|---:|---:|---:|"])
    for region, info in summary["coverageDensity"].items():
        lines.append(
            f"| {region} | {info['candidateCount']} | {info['residualPairCount']} | {fmt(info['candidatesPerResidual'])} |"
        )
    lines.extend(["", "## Spatial Cross-Validation", "", "| Region | Status | Candidates | Residual Pairs | Median | RMS | Max | Notes |", "|---|---|---:|---:|---:|---:|---:|---|"])
    for region, result in sorted(summary["spatialCrossValidation"].items()):
        lines.append(
            f"| {region} | {result['status']} | {result.get('candidateCount', 0)} | {result.get('residualPairCount', 0)} | {fmt(result.get('medianError'))} | {fmt(result.get('rmsError'))} | {fmt(result.get('maxError'))} | {result.get('reason', '')} |"
        )
    lines.extend(["", "## Recommended Additional Samples", ""])
    for recommendation in summary["recommendedAdditionalSamples"]:
        lines.append(f"- {recommendation}")
    lines.extend(
        [
            "",
            "## Revised Acceptance Rules",
            "",
            "- Regions with zero Candidate Survey markers are exempt.",
            "- Regions with very few candidates or no verified matching locations are documented rather than treated as hard failures.",
            "- The 40% residual-pair cap is removed.",
            "- Acceptance is based on global quality, candidate-bearing regional coverage, spatial cross-validation, and distance to nearest verified residual pair.",
            "",
            "## Residual Pairs",
            "",
            "| ID | Candidate X/Y | Confirmed X/Y | X Residual | Y Residual | Distance | State | Region | Candidate Type | Confirmed Marker Type | Flag |",
            "|---|---:|---:|---:|---:|---:|---|---|---|---|---|",
        ]
    )
    for pair in summary["pairs"]:
        flag = "Re-verify >200" if pair["distanceError"] > 200 else ""
        lines.append(
            "| {id} | {cx:.2f}, {cy:.2f} | {fx:.2f}, {fy:.2f} | {rx:.2f} | {ry:.2f} | {dist:.2f} | {state} | {region} | {candidate_type} | {marker_type} | {flag} |".format(
                id=pair["id"],
                cx=pair["candidate"]["x"],
                cy=pair["candidate"]["y"],
                fx=pair["confirmed"]["x"],
                fy=pair["confirmed"]["y"],
                rx=pair["residual"]["x"],
                ry=pair["residual"]["y"],
                dist=pair["distanceError"],
                state=pair["stateOrRegion"],
                region=pair["spatialRegion"],
                candidate_type=pair["candidateHerbType"],
                marker_type=pair["confirmedMarkerType"],
                flag=flag,
            )
        )
    lines.append("")
    return "\n".join(lines)


def analyze() -> dict:
    raw_pairs = read_json(RESIDUAL_PATH, [])
    normalized_pairs = [normalize_residual_pair(pair, index) for index, pair in enumerate(raw_pairs)]
    write_json(RESIDUAL_PATH, normalized_pairs)

    candidates = read_json(CANDIDATE_PATH, [])
    states = read_json(STATE_ZONES_PATH, {}).get("states", [])
    coverage = candidate_coverage(candidates, states)
    enriched = enrich_pairs(normalized_pairs, coverage["candidates"], states)
    verified = [pair for pair in enriched if pair["verifiedSameLocation"]]
    global_errors = summarize_errors([pair["distanceError"] for pair in verified])
    residual_counts = residual_coverage(enriched)
    nearest_distances = candidate_nearest_residual_distances(coverage["candidates"], enriched)
    cross_validation = spatial_cross_validation(enriched, coverage["candidates"])
    density = coverage_density(coverage["candidates"], enriched)
    recommendations = additional_sample_recommendations(density, nearest_distances)
    acceptance = acceptance_recommendation(global_errors, cross_validation, nearest_distances, density)

    summary = {
        "candidateCount": len(candidates),
        "pairCount": len(enriched),
        "verifiedPairCount": len(verified),
        "globalOffsetValid": False,
        "globalOffsetReason": "Residual vectors differ by direction and magnitude.",
        "acceptanceCriteriaMet": acceptance == "Enough coverage to generate V3 preview",
        "acceptanceRecommendation": acceptance,
        "meaningfulCandidateCountThreshold": MEANINGFUL_CANDIDATE_COUNT,
        "globalErrors": global_errors,
        "candidateCoverage": {
            "byState": coverage["byState"],
            "byRegion": coverage["byRegion"],
            "exemptStates": coverage["exemptStates"],
            "exemptRegions": coverage["exemptRegions"],
        },
        "residualCoverage": residual_counts,
        "candidateNearestResidualDistance": nearest_distances,
        "coverageDensity": density,
        "spatialCrossValidation": cross_validation,
        "recommendedAdditionalSamples": recommendations,
        "pairs": enriched,
        "outputs": {
            "report": str(REPORT_PATH),
            "overlay": str(OVERLAY_PATH),
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(build_report(summary), encoding="utf-8")
    OVERLAY_PATH.write_text(build_svg_overlay(enriched), encoding="utf-8")
    write_json(SUMMARY_PATH, summary)
    return summary


def main() -> None:
    print(json.dumps(analyze(), indent=2))


if __name__ == "__main__":
    main()

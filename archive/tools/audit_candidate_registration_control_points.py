from __future__ import annotations

import csv
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRATION_PATH = ROOT / "data" / "candidate-survey" / "source-map-registration.json"
AUDIT_DIR = ROOT / "candidate-survey" / "registration-v2-preview"
CSV_PATH = AUDIT_DIR / "invalid-derived-control-points.csv"
REPORT_PATH = AUDIT_DIR / "registration-v2-blocked-report.md"


def is_derived_from_simple_formula(point: dict) -> tuple[bool, dict]:
    source = point.get("sourceVisual", {})
    explorer = point.get("explorer", {})
    if not source or not explorer:
        return False, {}

    source_x = float(source["x"])
    source_y = float(source["y"])
    explorer_x = float(explorer["x"])
    explorer_y = float(explorer["y"])
    derived_x = source_x * 4.5
    derived_leaflet_y = 7168 - source_y * 4.75
    return (
        math.isclose(explorer_x, derived_x, abs_tol=0.001)
        and math.isclose(explorer_y, derived_leaflet_y, abs_tol=0.001),
        {
            "derivedExplorerX": derived_x,
            "derivedExplorerY": derived_leaflet_y,
            "xDelta": explorer_x - derived_x,
            "yDelta": explorer_y - derived_leaflet_y,
            "formula": "explorerX = sourceX * 4.5; explorerY = 7168 - (sourceY * 4.75)",
        },
    )


def audit() -> tuple[list[dict], dict]:
    registration = json.loads(REGISTRATION_PATH.read_text(encoding="utf-8"))
    rows = []
    counts = {
        "total": 0,
        "invalidDerived": 0,
        "independentManual": 0,
    }

    for map_id, config in registration["maps"].items():
        for point in config.get("controlPoints", []):
            counts["total"] += 1
            derived, details = is_derived_from_simple_formula(point)
            independent = (
                point.get("selection") == "independent-manual"
                and "sourceVisual" in point
                and "explorerVisual" in point
                and point.get("sourceCoordinateMethod") == "manual-click"
                and point.get("explorerCoordinateMethod") == "manual-click"
            )
            if derived or not independent:
                counts["invalidDerived"] += 1
            else:
                counts["independentManual"] += 1

            rows.append(
                {
                    "mapId": map_id,
                    "sourceMap": config["name"],
                    "controlPointName": point.get("name", ""),
                    "sourceX": point.get("sourceVisual", {}).get("x", ""),
                    "sourceY": point.get("sourceVisual", {}).get("y", ""),
                    "storedExplorerX": point.get("explorer", {}).get("x", point.get("explorerVisual", {}).get("x", "")),
                    "storedExplorerY": point.get("explorer", {}).get("y", point.get("explorerVisual", {}).get("y", "")),
                    "sourceCoordinateMethod": point.get("sourceCoordinateMethod", "unknown; previously labeled manual"),
                    "explorerCoordinateMethod": point.get("explorerCoordinateMethod", "formula-derived from source coordinate"),
                    "derivedFormulaMatched": "yes" if derived else "no",
                    "derivedFormula": details.get("formula", ""),
                    "independentlySelectedOnBothImages": "yes" if independent and not derived else "no",
                    "validForRegistrationTesting": "yes" if independent and not derived else "no",
                    "retirementReason": "" if independent and not derived else "Not independently selected on both images; old Explorer coordinate is derived from source coordinate.",
                }
            )

    return rows, counts


def write_report(rows: list[dict], counts: dict) -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    report = [
        "# Candidate Survey Registration V2 Blocked Report",
        "",
        "The current registration control-point set is invalid for registration validation.",
        "",
        "## Why The Previous Residual Was 0.0000",
        "",
        "The stored Explorer coordinates match a simple formula derived directly from the source-image coordinates:",
        "",
        "- `explorerX = sourceX * 4.5`",
        "- `explorerY = 7168 - (sourceY * 4.75)`",
        "",
        "Because those target points were generated from the same simple transform family being tested, the affine solver could reproduce them with numerical roundoff only. That is why the residual report showed `0.0000`; it was not evidence of real map alignment.",
        "",
        "## Control Point Audit",
        "",
        f"- Total stored control points: {counts['total']}",
        f"- Invalid derived or unproven points: {counts['invalidDerived']}",
        f"- Independent manual v2 points: {counts['independentManual']}",
        "",
        "Every old point has been treated as retired for V2 validation until both sides are manually clicked in the manual control-point editor.",
        "",
        "## Status",
        "",
        "Candidate coordinates were not regenerated. The active Phase 1 and Phase 2 candidate files were not replaced.",
        "",
        "## Next Required Step",
        "",
        "Run `tools/manual_candidate_registration_editor.py`, select at least 18 independent landmarks per source map, and save the registration JSON. Then run the V2 validation tools before replacing any active candidate data.",
        "",
        f"Full audit CSV: `{CSV_PATH.name}`",
    ]
    REPORT_PATH.write_text("\n".join(report) + "\n", encoding="utf-8")


def main() -> None:
    rows, counts = audit()
    write_report(rows, counts)
    print(json.dumps({"counts": counts, "csv": str(CSV_PATH), "report": str(REPORT_PATH)}, indent=2))


if __name__ == "__main__":
    main()

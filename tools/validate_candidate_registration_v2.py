from __future__ import annotations

import csv
import json
from pathlib import Path

from PIL import Image, ImageDraw

from source_map_registration import (
    compare_source_map_registration_models,
    leave_one_out_validation,
    load_source_map_registration,
    solve_affine_transform,
    solve_homography_transform,
    transform_source_to_explorer,
    verify_source_map_registration,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "candidate-survey" / "registration-v2-preview"
BASE_MAP_PATH = ROOT / "images" / "rdr2-map.jpg"


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def valid_points(config: dict) -> list[dict]:
    return [
        point
        for point in config.get("controlPoints", [])
        if not point.get("retired") and "sourceVisual" in point and "explorerVisual" in point
    ]


def draw_control_overlays(map_id: str, config: dict) -> list[Path]:
    paths = []
    source = Image.open(config["sourceImage"]).convert("RGB")
    explorer = Image.open(BASE_MAP_PATH).convert("RGB")
    source_draw = ImageDraw.Draw(source)
    explorer_draw = ImageDraw.Draw(explorer)

    bounds = config.get("geographicBoundsVisual")
    if bounds:
        source_draw.rectangle(
            (bounds["left"], bounds["top"], bounds["right"], bounds["bottom"]),
            outline="#2dd36f",
            width=4,
        )

    for index, point in enumerate(valid_points(config), start=1):
        sx = point["sourceVisual"]["x"]
        sy = point["sourceVisual"]["y"]
        ex = point["explorerVisual"]["x"]
        ey = point["explorerVisual"]["y"]
        source_draw.line((sx - 12, sy, sx + 12, sy), fill="#ff2f2f", width=3)
        source_draw.line((sx, sy - 12, sx, sy + 12), fill="#ff2f2f", width=3)
        source_draw.text((sx + 10, sy - 10), f"{index} {point['name']}", fill="#ff2f2f")
        explorer_draw.line((ex - 12, ey, ex + 12, ey), fill="#2dd36f", width=3)
        explorer_draw.line((ex, ey - 12, ex, ey + 12), fill="#2dd36f", width=3)
        explorer_draw.text((ex + 10, ey - 10), f"{index} {point['name']}", fill="#2dd36f")

    source_path = OUTPUT_DIR / f"{map_id}-v2-source-control-points.png"
    explorer_path = OUTPUT_DIR / f"{map_id}-v2-explorer-control-points.jpg"
    source.save(source_path)
    explorer.save(explorer_path, quality=92)
    paths.extend([source_path, explorer_path])
    return paths


def acceptance(training: dict, loo: dict) -> dict:
    return {
        "trainingAccepted": (
            training["meanError"] is not None
            and training["meanError"] < 12
            and training["rmsError"] < 18
            and training["maxError"] < 40
        ),
        "leaveOneOutAccepted": (
            loo["meanError"] is not None
            and loo["meanError"] < 20
            and loo["rmsError"] < 28
            and loo["maxError"] < 60
        ),
    }


def validate() -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    registration = load_source_map_registration()
    report = {}

    for map_id, config in registration["maps"].items():
        point_count = len(valid_points(config))
        map_report = {
            "name": config["name"],
            "validIndependentControlPoints": point_count,
            "geographicBoundsVisual": config.get("geographicBoundsVisual"),
            "status": "blocked",
        }
        draw_control_overlays(map_id, config)

        if point_count < 18:
            map_report["blockedReason"] = "At least 18 independent manual control points are required before solving registration."
            report[map_id] = map_report
            continue

        model_reports = {}
        for model in ("affine", "homography"):
            points = valid_points(config)
            transform = solve_homography_transform(points) if model == "homography" else solve_affine_transform(points)
            training = verify_source_map_registration(config, {"model": model, "transform": transform})
            loo = leave_one_out_validation(config, model)
            model_reports[model] = {
                "training": training,
                "leaveOneOut": loo,
                "acceptance": acceptance(training, loo),
            }

        map_report["status"] = "validated"
        map_report["models"] = model_reports
        report[map_id] = map_report

    report_path = OUTPUT_DIR / "registration-v2-validation.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    print(json.dumps(validate(), indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANDIDATE_PATH = ROOT / "candidate-survey" / "registration-v2-preview" / "reviewed-candidate-preview.json"
RESIDUAL_PATH = ROOT / "data" / "candidate-survey" / "candidate-residual-calibration.json"
STATE_ZONES_PATH = ROOT / "data" / "state-zones.json"
OUTPUT_DIR = ROOT / "candidate-survey" / "registration-v3-preview"
COVERAGE_ANALYSIS_PATH = OUTPUT_DIR / "coverage-analysis.json"
COVERAGE_CLUSTERS_PATH = OUTPUT_DIR / "coverage-clusters.json"
PRIORITY_PLAN_JSON_PATH = OUTPUT_DIR / "priority-survey-plan.json"
PRIORITY_PLAN_MD_PATH = OUTPUT_DIR / "priority-survey-plan.md"
COVERAGE_HEATMAP_PATH = OUTPUT_DIR / "coverage-heatmap.svg"
PRIORITY_TARGET_MAP_PATH = OUTPUT_DIR / "priority-survey-targets-map.svg"
PRIORITY_TARGET_HTML_PATH = OUTPUT_DIR / "priority-survey-targets-map.html"
COVERAGE_SUMMARY_PATH = OUTPUT_DIR / "coverage-summary.md"
MAP_WIDTH = 9216
MAP_HEIGHT = 7168
CLUSTER_DISTANCE = 500.0
COVERAGE_RADIUS = 750.0
DISTANCE_THRESHOLDS = [500, 750, 1000, 1500]


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


def fmt(value) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


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


def normalize_residual_pair(pair: dict, index: int) -> dict:
    candidate = pair["candidate"]
    confirmed = pair["confirmed"]
    return {
        "id": str(pair.get("id") or f"residual-{index + 1:03d}"),
        "candidate": {"x": float(candidate["x"]), "y": float(candidate["y"])},
        "confirmed": {"x": float(confirmed["x"]), "y": float(confirmed["y"])},
        "verifiedSameLocation": bool(pair.get("verifiedSameLocation")),
    }


def nearest_residual(candidate: dict, residuals: list[dict]) -> tuple[dict | None, float | None]:
    if not residuals:
        return None, None
    nearest = min(residuals, key=lambda residual: distance(candidate, residual["candidate"]))
    return nearest, distance(candidate, nearest["candidate"])


def build_coverage_analysis(candidates: list[dict], residuals: list[dict], states: list[dict]) -> list[dict]:
    analysis = []
    for candidate in candidates:
        point = {"x": float(candidate["x"]), "y": float(candidate["y"])}
        residual, nearest_distance = nearest_residual(point, residuals)
        analysis.append(
            {
                "candidateId": candidate.get("candidateId"),
                "herbType": candidate.get("typeName") or candidate.get("type"),
                "type": candidate.get("type"),
                "x": point["x"],
                "y": point["y"],
                "state": get_state_name(point["x"], point["y"], states),
                "region": region_bucket(point),
                "nearestResidualId": residual["id"] if residual else "",
                "nearestResidualDistance": nearest_distance,
                "surveyConfidence": candidate.get("surveyConfidence", ""),
                "typeReviewStatus": candidate.get("typeReviewStatus", "confirmed"),
            }
        )
    return analysis


def cluster_candidates(analysis: list[dict]) -> list[dict]:
    remaining = sorted(
        analysis,
        key=lambda item: item["nearestResidualDistance"] or 0,
        reverse=True,
    )
    clusters = []

    while remaining:
        seed = remaining.pop(0)
        members = [seed]
        keep = []
        for candidate in remaining:
            if distance(seed, candidate) <= CLUSTER_DISTANCE:
                members.append(candidate)
            else:
                keep.append(candidate)
        remaining = keep
        center = {
            "x": sum(member["x"] for member in members) / len(members),
            "y": sum(member["y"] for member in members) / len(members),
        }
        distances = [member["nearestResidualDistance"] or 0 for member in members]
        herb_types = sorted({member["herbType"] for member in members})
        states = sorted({member["state"] for member in members})
        regions = sorted({member["region"] for member in members})
        representative = max(members, key=lambda item: item["nearestResidualDistance"] or 0)
        clusters.append(
            {
                "clusterId": f"coverage-cluster-{len(clusters) + 1:03d}",
                "center": center,
                "candidateCount": len(members),
                "averageDistanceToNearestResidual": sum(distances) / len(distances),
                "maximumDistanceToNearestResidual": max(distances),
                "states": states,
                "regions": regions,
                "herbDiversity": len(herb_types),
                "herbTypes": herb_types,
                "representativeCandidate": representative,
                "candidates": [member["candidateId"] for member in members],
            }
        )
    return clusters


def edge_score(center: dict) -> float:
    distance_to_edge = min(center["x"], MAP_WIDTH - center["x"], center["y"], MAP_HEIGHT - center["y"])
    return max(0.0, 1.0 - distance_to_edge / 1800.0)


def rank_clusters(clusters: list[dict], residual_counts_by_region: Counter) -> list[dict]:
    ranked = []
    for cluster in clusters:
        uncovered_regions = [region for region in cluster["regions"] if residual_counts_by_region[region] == 0]
        sparse_regions = [region for region in cluster["regions"] if 0 < residual_counts_by_region[region] <= 3]
        isolation = cluster["maximumDistanceToNearestResidual"] / 1000.0
        density = math.log1p(cluster["candidateCount"])
        uncovered_bonus = 2.0 if uncovered_regions else 0.0
        sparse_bonus = 0.8 if sparse_regions else 0.0
        edge_bonus = edge_score(cluster["center"])
        score = isolation * 3.0 + density * 1.25 + uncovered_bonus + sparse_bonus + edge_bonus
        reason_parts = []
        if uncovered_regions:
            reason_parts.append(f"no residual coverage in {', '.join(uncovered_regions)}")
        elif sparse_regions:
            reason_parts.append(f"sparse residual coverage in {', '.join(sparse_regions)}")
        if cluster["maximumDistanceToNearestResidual"] > 1500:
            reason_parts.append("far from existing residuals")
        elif cluster["maximumDistanceToNearestResidual"] > 1000:
            reason_parts.append("moderately far from existing residuals")
        if cluster["candidateCount"] >= 5:
            reason_parts.append(f"{cluster['candidateCount']} nearby candidates")
        if edge_bonus > 0.25:
            reason_parts.append("near calibrated-area edge")

        ranked.append(
            {
                **cluster,
                "priorityScore": score,
                "expectedBenefit": classify_expected_benefit(score),
                "reason": "; ".join(reason_parts) or "fills local coverage gap",
            }
        )

    ranked.sort(key=lambda item: item["priorityScore"], reverse=True)
    for index, cluster in enumerate(ranked, 1):
        cluster["priority"] = index
    return ranked


def classify_expected_benefit(score: float) -> str:
    if score >= 8:
        return "high coverage increase and reduced extrapolation"
    if score >= 5:
        return "moderate coverage increase"
    return "local refinement"


def route_for_cluster(cluster: dict, analysis_by_id: dict[str, dict]) -> dict:
    members = [analysis_by_id[candidate_id] for candidate_id in cluster["candidates"] if candidate_id in analysis_by_id]
    if not members:
        return {"recommendedOrder": [], "approximateTravelDistance": 0}
    remaining = members[:]
    current = cluster["representativeCandidate"]
    ordered = []
    total_distance = 0.0
    while remaining:
        next_candidate = min(remaining, key=lambda item: distance(current, item))
        total_distance += 0 if not ordered else distance(current, next_candidate)
        ordered.append(next_candidate)
        remaining.remove(next_candidate)
        current = next_candidate
    return {
        "estimatedCandidateCount": len(ordered),
        "approximateTravelDistance": total_distance,
        "recommendedOrder": [
            {
                "candidateId": item["candidateId"],
                "herbType": item["herbType"],
                "x": item["x"],
                "y": item["y"],
            }
            for item in ordered
        ],
    }


def select_plan(ranked: list[dict], count: int, analysis_by_id: dict[str, dict]) -> list[dict]:
    plan = []
    for cluster in ranked[:count]:
        representative = cluster["representativeCandidate"]
        plan.append(
            {
                "priority": cluster["priority"],
                "clusterId": cluster["clusterId"],
                "region": ", ".join(cluster["regions"]),
                "state": ", ".join(cluster["states"]),
                "approximateExplorerCoordinates": cluster["center"],
                "candidateId": representative["candidateId"],
                "herbType": representative["herbType"],
                "reason": cluster["reason"],
                "estimatedImprovement": cluster["expectedBenefit"],
                "route": route_for_cluster(cluster, analysis_by_id),
            }
        )
    return plan


def coverage_metrics(analysis: list[dict], residuals: list[dict]) -> dict:
    distances = [
        item["nearestResidualDistance"]
        for item in analysis
        if item["nearestResidualDistance"] is not None
    ]
    residual_regions = Counter(region_bucket(residual["candidate"]) for residual in residuals)
    candidate_regions = Counter(item["region"] for item in analysis)
    return {
        "currentResidualPairs": len(residuals),
        "residualPairsByRegion": dict(sorted(residual_regions.items())),
        "candidatesByRegion": dict(sorted(candidate_regions.items())),
        "medianCandidateToResidualDistance": median(distances),
        "p75CandidateToResidualDistance": percentile(distances, 0.75),
        "p90CandidateToResidualDistance": percentile(distances, 0.90),
        "maximumCandidateToResidualDistance": max(distances) if distances else None,
        "candidatesOutside": {
            str(threshold): sum(1 for value in distances if value > threshold)
            for threshold in DISTANCE_THRESHOLDS
        },
    }


def predicted_improvement(plan: list[dict], total_candidates: int, label: str) -> dict:
    covered_candidates = len({candidate["candidateId"] for item in plan for candidate in item["route"]["recommendedOrder"]})
    regions = sorted({item["region"] for item in plan})
    return {
        "plan": label,
        "newResidualPairs": len(plan),
        "candidateClusterCoverageIncrease": covered_candidates,
        "candidateClusterCoveragePercent": covered_candidates / total_candidates if total_candidates else 0,
        "regionsImproved": regions,
        "expectedEffect": (
            "Substantially reduces extrapolated areas."
            if len(plan) >= 20
            else "Reduces the largest extrapolated areas."
            if len(plan) >= 10
            else "Improves local coverage."
        ),
    }


def heat_color(distance_value: float | None) -> str:
    if distance_value is None or distance_value > 1000:
        return "#d94f3d"
    if distance_value > 500:
        return "#d7a541"
    return "#55d66b"


def build_heatmap_svg(analysis: list[dict], residuals: list[dict], ranked: list[dict]) -> str:
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="9216" height="7168" viewBox="0 0 9216 7168">',
        '  <image href="../../images/rdr2-map.jpg" x="0" y="0" width="9216" height="7168" opacity="0.62" />',
    ]
    for residual in residuals:
        x = residual["candidate"]["x"]
        y = MAP_HEIGHT - residual["candidate"]["y"]
        lines.append(f'  <circle cx="{x:.2f}" cy="{y:.2f}" r="{COVERAGE_RADIUS}" fill="#55d66b" opacity="0.10" stroke="#55d66b" stroke-width="7" />')
    for candidate in analysis:
        x = candidate["x"]
        y = MAP_HEIGHT - candidate["y"]
        color = heat_color(candidate["nearestResidualDistance"])
        lines.append(f'  <circle cx="{x:.2f}" cy="{y:.2f}" r="14" fill="{color}" stroke="#1b140e" stroke-width="4" opacity="0.92" />')
    for cluster in ranked[:30]:
        x = cluster["center"]["x"]
        y = MAP_HEIGHT - cluster["center"]["y"]
        lines.append(f'  <circle cx="{x:.2f}" cy="{y:.2f}" r="55" fill="none" stroke="#ff3333" stroke-width="12" />')
        lines.append(f'  <text x="{x + 62:.2f}" y="{y + 20:.2f}" fill="#1b140e" stroke="#f2e2bd" stroke-width="7" paint-order="stroke" font-family="Arial" font-size="76">#{cluster["priority"]}</text>')
    for residual in residuals:
        x = residual["candidate"]["x"]
        y = MAP_HEIGHT - residual["candidate"]["y"]
        lines.append(f'  <rect x="{x - 18:.2f}" y="{y - 18:.2f}" width="36" height="36" fill="#1b140e" stroke="#ffd36a" stroke-width="7" />')
    lines.append("</svg>")
    return "\n".join(lines) + "\n"


def build_priority_targets_svg(plans: dict, residuals: list[dict]) -> str:
    top30 = plans["top30"]
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="9216" height="7168" viewBox="0 0 9216 7168">',
        '  <image href="../../images/rdr2-map.jpg" x="0" y="0" width="9216" height="7168" opacity="0.78" />',
        '  <rect x="80" y="80" width="1800" height="760" rx="28" fill="#1b140e" opacity="0.86" />',
        '  <text x="150" y="190" fill="#ffd36a" font-family="Arial" font-size="86" font-weight="700">Residual Survey Targets</text>',
        '  <text x="150" y="300" fill="#f2e2bd" font-family="Arial" font-size="56">Numbers show recommended priority order.</text>',
        '  <circle cx="190" cy="410" r="35" fill="#d94f3d" stroke="#f2e2bd" stroke-width="9" />',
        '  <text x="250" y="430" fill="#f2e2bd" font-family="Arial" font-size="54">Top 10 targets</text>',
        '  <circle cx="190" cy="515" r="30" fill="#d7a541" stroke="#1b140e" stroke-width="8" />',
        '  <text x="250" y="535" fill="#f2e2bd" font-family="Arial" font-size="54">Priority 11-20</text>',
        '  <circle cx="190" cy="620" r="25" fill="#3f5f6f" stroke="#f2e2bd" stroke-width="7" />',
        '  <text x="250" y="640" fill="#f2e2bd" font-family="Arial" font-size="54">Priority 21-30</text>',
        '  <rect x="155" y="690" width="70" height="70" fill="#1b140e" stroke="#55d66b" stroke-width="10" />',
        '  <text x="250" y="742" fill="#f2e2bd" font-family="Arial" font-size="54">Existing residual pair</text>',
    ]

    for residual in residuals:
        x = residual["candidate"]["x"]
        y = MAP_HEIGHT - residual["candidate"]["y"]
        lines.append(
            f'  <rect x="{x - 18:.2f}" y="{y - 18:.2f}" width="36" height="36" fill="#1b140e" stroke="#55d66b" stroke-width="7" opacity="0.88" />'
        )

    for item in reversed(top30):
        priority = item["priority"]
        center = item["approximateExplorerCoordinates"]
        x = center["x"]
        y = MAP_HEIGHT - center["y"]
        color = "#d94f3d" if priority <= 10 else "#d7a541" if priority <= 20 else "#3f5f6f"
        radius = 58 if priority <= 10 else 48 if priority <= 20 else 40
        stroke = "#f2e2bd" if priority <= 10 else "#1b140e"
        route_points = item["route"]["recommendedOrder"]
        if len(route_points) > 1:
            points = " ".join(
                f'{point["x"]:.2f},{MAP_HEIGHT - point["y"]:.2f}'
                for point in route_points
            )
            lines.append(
                f'  <polyline points="{points}" fill="none" stroke="{color}" stroke-width="10" stroke-dasharray="24 18" opacity="0.62" />'
            )

        lines.append(
            f'  <circle cx="{x:.2f}" cy="{y:.2f}" r="{radius}" fill="{color}" stroke="{stroke}" stroke-width="10" opacity="0.96" />'
        )
        lines.append(
            f'  <text x="{x:.2f}" y="{y + 20:.2f}" text-anchor="middle" fill="#ffffff" stroke="#1b140e" stroke-width="8" paint-order="stroke" font-family="Arial" font-size="{58 if priority <= 10 else 48}" font-weight="800">{priority}</text>'
        )
        label = f'{item["candidateId"]} · {item["herbType"]}'
        lines.append(
            f'  <text x="{x + radius + 18:.2f}" y="{y - radius - 10:.2f}" fill="#1b140e" stroke="#f2e2bd" stroke-width="7" paint-order="stroke" font-family="Arial" font-size="54" font-weight="700">{label}</text>'
        )

    lines.append("</svg>")
    return "\n".join(lines) + "\n"


def build_priority_targets_html(plans: dict, residuals: list[dict]) -> str:
    payload = {
        "targets": plans["top30"],
        "residuals": residuals,
        "map": {"width": MAP_WIDTH, "height": MAP_HEIGHT},
    }
    data_json = json.dumps(payload)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Residual Survey Targets Map</title>
  <link rel="stylesheet" href="/vendor/leaflet/leaflet.css" />
  <style>
    html,
    body {{
      margin: 0;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #14100b;
      color: #f2e2bd;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
    }}
    aside {{
      position: fixed;
      inset: 0 auto 0 0;
      width: 340px;
      box-sizing: border-box;
      overflow: auto;
      padding: 12px;
      background: #1b140e;
      border-right: 1px solid #8b5a2b;
      z-index: 1000;
    }}
    h1 {{
      margin: 0 0 8px;
      color: #ffd36a;
      font-size: 18px;
    }}
    .help {{
      margin: 0 0 10px;
      color: #c8aa72;
      font-size: 13px;
      line-height: 1.35;
    }}
    #map {{
      position: fixed;
      inset: 0 0 0 340px;
      width: auto;
      height: auto;
      background: #111;
    }}
    @media (max-width: 900px) {{
      aside {{
        width: 280px;
      }}
      #map {{
        left: 280px;
      }}
    }}
    .target-list {{
      display: grid;
      gap: 5px;
    }}
    .target-list button {{
      width: 100%;
      padding: 7px;
      text-align: left;
      color: #f2e2bd;
      background: #2a2118;
      border: 1px solid #8b5a2b;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      line-height: 1.25;
    }}
    .target-list button:hover {{
      border-color: #ffd36a;
      background: #35281c;
    }}
    .priority-marker {{
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      box-sizing: border-box;
      color: #fff;
      border: 3px solid #f2e2bd;
      box-shadow: 0 2px 7px rgba(0, 0, 0, 0.75);
      font-size: 15px;
      font-weight: 800;
      line-height: 1;
    }}
    .priority-top10 {{
      background: #d94f3d;
    }}
    .priority-top20 {{
      background: #d7a541;
      color: #1b140e;
      border-color: #1b140e;
    }}
    .priority-top30 {{
      background: #3f5f6f;
    }}
    .residual-anchor {{
      width: 18px;
      height: 18px;
      background: #1b140e;
      border: 3px solid #55d66b;
      box-sizing: border-box;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
    }}
    .popup {{
      min-width: 220px;
      color: #1b140e;
      font-size: 13px;
      line-height: 1.3;
    }}
    .popup h2 {{
      margin: 0 0 6px;
      font-size: 16px;
    }}
    .popup dl {{
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 8px;
      margin: 0;
    }}
    .popup dt {{
      font-weight: 700;
    }}
    .popup dd {{
      margin: 0;
    }}
  </style>
</head>
<body>
  <aside>
    <h1>Survey Targets</h1>
    <p class="help">Click a priority target to jump to it. Red targets are the top 10 places to collect new residual pairs.</p>
    <div id="target-list" class="target-list"></div>
  </aside>
  <main id="map"></main>

  <script src="/vendor/leaflet/leaflet.js"></script>
  <script>
    const DATA = {data_json};
    const map = L.map("map", {{
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 2,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      doubleClickZoom: false,
    }});
    const bounds = [[0, 0], [DATA.map.height, DATA.map.width]];
    L.imageOverlay("/images/rdr2-map.jpg", bounds).addTo(map);
    map.fitBounds(bounds, {{ animate: false }});
    setTimeout(() => map.invalidateSize(false), 0);
    window.addEventListener("resize", () => map.invalidateSize(false));

    function pointToLatLng(point) {{
      return [point.y, point.x];
    }}

    function markerClass(priority) {{
      if (priority <= 10) return "priority-marker priority-top10";
      if (priority <= 20) return "priority-marker priority-top20";
      return "priority-marker priority-top30";
    }}

    const targetMarkers = new Map();
    for (const residual of DATA.residuals) {{
      L.marker(pointToLatLng(residual.candidate), {{
        icon: L.divIcon({{
          className: "",
          html: '<div class="residual-anchor"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }}),
      }}).addTo(map).bindTooltip(residual.id);
    }}

    for (const target of DATA.targets) {{
      const center = target.approximateExplorerCoordinates;
      const route = target.route.recommendedOrder || [];
      if (route.length > 1) {{
        L.polyline(route.map(pointToLatLng), {{
          color: target.priority <= 10 ? "#d94f3d" : target.priority <= 20 ? "#d7a541" : "#3f5f6f",
          weight: 3,
          dashArray: "8 7",
          opacity: 0.72,
        }}).addTo(map);
      }}
      const marker = L.marker(pointToLatLng(center), {{
        icon: L.divIcon({{
          className: "",
          html: `<div class="${{markerClass(target.priority)}}">${{target.priority}}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }}),
        zIndexOffset: 1000 - target.priority,
      }}).addTo(map);
      marker.bindPopup(`
        <div class="popup">
          <h2>Priority ${{target.priority}}</h2>
          <dl>
            <dt>Candidate</dt><dd>${{target.candidateId}}</dd>
            <dt>Herb</dt><dd>${{target.herbType}}</dd>
            <dt>State</dt><dd>${{target.state}}</dd>
            <dt>Region</dt><dd>${{target.region}}</dd>
            <dt>Coords</dt><dd>X ${{center.x.toFixed(2)}} | Y ${{center.y.toFixed(2)}}</dd>
            <dt>Route</dt><dd>${{target.route.estimatedCandidateCount}} nearby candidates</dd>
            <dt>Reason</dt><dd>${{target.reason}}</dd>
          </dl>
        </div>
      `);
      targetMarkers.set(target.priority, marker);
    }}

    const list = document.getElementById("target-list");
    for (const target of DATA.targets) {{
      const button = document.createElement("button");
      button.innerHTML = `<strong>#${{target.priority}} ${{target.candidateId}}</strong><br>${{target.herbType}} · ${{target.state}}<br>X ${{target.approximateExplorerCoordinates.x.toFixed(0)}} | Y ${{target.approximateExplorerCoordinates.y.toFixed(0)}}`;
      button.addEventListener("click", () => {{
        const marker = targetMarkers.get(target.priority);
        map.setView(marker.getLatLng(), -1);
        marker.openPopup();
      }});
      list.appendChild(button);
    }}
  </script>
</body>
</html>
"""


def build_priority_markdown(plans: dict, metrics: dict, improvement: dict) -> str:
    lines = [
        "# Residual Coverage Priority Survey Plan",
        "",
        "This is planning output only. It does not modify production candidate files.",
        "",
        "## Top 10 Survey Targets",
        "",
    ]
    for item in plans["top10"]:
        lines.extend(
            [
                f"### Priority {item['priority']}: {item['candidateId']}",
                "",
                f"- Region: {item['region']}",
                f"- State: {item['state']}",
                f"- Coordinates: X {item['approximateExplorerCoordinates']['x']:.2f}, Y {item['approximateExplorerCoordinates']['y']:.2f}",
                f"- Herb type: {item['herbType']}",
                f"- Reason: {item['reason']}",
                f"- Estimated improvement: {item['estimatedImprovement']}",
                f"- Route candidate count: {item['route']['estimatedCandidateCount']}",
                f"- Approximate route distance: {item['route']['approximateTravelDistance']:.2f}",
                "",
            ]
        )
    lines.extend(
        [
            "## Coverage Metrics",
            "",
            f"- Current residual pairs: {metrics['currentResidualPairs']}",
            f"- Median candidate-to-residual distance: {fmt(metrics['medianCandidateToResidualDistance'])}",
            f"- 75th percentile: {fmt(metrics['p75CandidateToResidualDistance'])}",
            f"- 90th percentile: {fmt(metrics['p90CandidateToResidualDistance'])}",
            f"- Maximum: {fmt(metrics['maximumCandidateToResidualDistance'])}",
        ]
    )
    for threshold, count in metrics["candidatesOutside"].items():
        lines.append(f"- Candidates outside {threshold}: {count}")
    lines.extend(
        [
            "",
            "## Future Explorer Layer Design: Calibration Coverage",
            "",
            "- Render residual pairs as fixed square anchors with translucent 750-unit coverage circles.",
            "- Render candidates as small heat-colored dots: green within 500 units, yellow within 1000, red beyond 1000.",
            "- Add toggles for residual anchors, candidate heat dots, priority clusters, and suggested route lines.",
            "- Keep the layer off by default and reuse a single Leaflet layer group for quick clearing.",
            "- For performance, precompute nearest-residual distances in JSON and avoid recalculating distance to every residual on each pan or zoom.",
            "",
            "## Predicted Improvement",
            "",
        ]
    )
    for key in ("after10", "after20", "after30"):
        item = improvement[key]
        lines.extend(
            [
                f"### {item['newResidualPairs']} New Residual Pairs",
                "",
                f"- Cluster candidates covered: {item['candidateClusterCoverageIncrease']}",
                f"- Candidate coverage increase: {item['candidateClusterCoveragePercent']:.1%}",
                f"- Regions improved: {', '.join(item['regionsImproved'])}",
                f"- Expected effect: {item['expectedEffect']}",
                "",
            ]
        )
    return "\n".join(lines)


def build_summary_markdown(metrics: dict, ranked: list[dict]) -> str:
    poorest = sorted(
        metrics["candidatesByRegion"].items(),
        key=lambda item: (
            metrics["residualPairsByRegion"].get(item[0], 0),
            -item[1],
        ),
    )
    lines = [
        "# Residual Coverage Summary",
        "",
        f"- Current residual pairs: {metrics['currentResidualPairs']}",
        f"- Median candidate-to-residual distance: {fmt(metrics['medianCandidateToResidualDistance'])}",
        f"- 75th percentile: {fmt(metrics['p75CandidateToResidualDistance'])}",
        f"- 90th percentile: {fmt(metrics['p90CandidateToResidualDistance'])}",
        f"- Maximum: {fmt(metrics['maximumCandidateToResidualDistance'])}",
        "",
        "## Poorest Covered Candidate Regions",
        "",
    ]
    for region, count in poorest[:6]:
        lines.append(f"- {region}: {count} candidates, {metrics['residualPairsByRegion'].get(region, 0)} residual pairs")
    lines.extend(["", "## Highest Priority Clusters", ""])
    for cluster in ranked[:10]:
        candidate = cluster["representativeCandidate"]
        lines.append(
            f"- #{cluster['priority']} {candidate['candidateId']} ({candidate['herbType']}), {cluster['reason']}"
        )
    return "\n".join(lines) + "\n"


def plan() -> dict:
    candidates = read_json(CANDIDATE_PATH, [])
    residual_pairs = [
        normalize_residual_pair(pair, index)
        for index, pair in enumerate(read_json(RESIDUAL_PATH, []))
        if pair.get("verifiedSameLocation")
    ]
    states = read_json(STATE_ZONES_PATH, {}).get("states", [])
    analysis = build_coverage_analysis(candidates, residual_pairs, states)
    clusters = cluster_candidates(analysis)
    residual_counts_by_region = Counter(region_bucket(pair["candidate"]) for pair in residual_pairs)
    ranked = rank_clusters(clusters, residual_counts_by_region)
    analysis_by_id = {item["candidateId"]: item for item in analysis}
    plans = {
        "top10": select_plan(ranked, 10, analysis_by_id),
        "top20": select_plan(ranked, 20, analysis_by_id),
        "top30": select_plan(ranked, 30, analysis_by_id),
    }
    metrics = coverage_metrics(analysis, residual_pairs)
    improvement = {
        "after10": predicted_improvement(plans["top10"], len(candidates), "Top 10"),
        "after20": predicted_improvement(plans["top20"], len(candidates), "Top 20"),
        "after30": predicted_improvement(plans["top30"], len(candidates), "Top 30"),
    }
    plan_payload = {
        "clusterDistance": CLUSTER_DISTANCE,
        "coverageRadius": COVERAGE_RADIUS,
        "metrics": metrics,
        "plans": plans,
        "predictedImprovement": improvement,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(COVERAGE_ANALYSIS_PATH, analysis)
    write_json(COVERAGE_CLUSTERS_PATH, ranked)
    write_json(PRIORITY_PLAN_JSON_PATH, plan_payload)
    COVERAGE_HEATMAP_PATH.write_text(build_heatmap_svg(analysis, residual_pairs, ranked), encoding="utf-8")
    PRIORITY_TARGET_MAP_PATH.write_text(build_priority_targets_svg(plans, residual_pairs), encoding="utf-8")
    PRIORITY_TARGET_HTML_PATH.write_text(build_priority_targets_html(plans, residual_pairs), encoding="utf-8")
    PRIORITY_PLAN_MD_PATH.write_text(build_priority_markdown(plans, metrics, improvement), encoding="utf-8")
    COVERAGE_SUMMARY_PATH.write_text(build_summary_markdown(metrics, ranked), encoding="utf-8")
    return {
        "files": [
            str(COVERAGE_ANALYSIS_PATH),
            str(COVERAGE_CLUSTERS_PATH),
            str(PRIORITY_PLAN_MD_PATH),
            str(PRIORITY_PLAN_JSON_PATH),
            str(COVERAGE_HEATMAP_PATH),
            str(PRIORITY_TARGET_MAP_PATH),
            str(PRIORITY_TARGET_HTML_PATH),
            str(COVERAGE_SUMMARY_PATH),
        ],
        "clusterCount": len(ranked),
        "top10": plans["top10"],
        "metrics": metrics,
        "predictedImprovement": improvement,
    }


def main() -> None:
    print(json.dumps(plan(), indent=2))


if __name__ == "__main__":
    main()

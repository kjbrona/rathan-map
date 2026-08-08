from __future__ import annotations

import json
import math
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
RESIDUAL_PATH = ROOT / "data" / "candidate-survey" / "candidate-residual-calibration.json"
CANDIDATE_PATH = ROOT / "candidate-survey" / "registration-v2-preview" / "reviewed-candidate-preview.json"
EXPORT_PATH = Path.home() / "Downloads" / "RosalitaRPExplorer_2026-08-04_1041.json"
MAP_WIDTH = 9216
MAP_HEIGHT = 7168
DEFAULT_PORT = 8767


EDITOR_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Candidate Residual Calibration Editor</title>
  <link rel="stylesheet" href="/vendor/leaflet/leaflet.css" />
  <style>
    body {
      margin: 0;
      display: grid;
      grid-template-columns: 390px 1fr;
      height: 100vh;
      color: #f2e2bd;
      background: #16110c;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
    }
    aside {
      overflow: auto;
      padding: 14px;
      border-right: 1px solid #8b5a2b;
      background: #1b140e;
    }
    h1, h2 {
      margin: 0 0 10px;
      color: #e4c27a;
      font-size: 16px;
      font-weight: 700;
    }
    label {
      display: block;
      margin: 8px 0;
      font-size: 13px;
    }
    input, select, textarea, button {
      width: 100%;
      box-sizing: border-box;
      margin-top: 3px;
      padding: 7px;
      color: #f2e2bd;
      background: #2a2118;
      border: 1px solid #8b5a2b;
      font: inherit;
    }
    button {
      cursor: pointer;
      font-weight: 700;
    }
    button.primary {
      background: #2f6f35;
      border-color: #63b36b;
    }
    button.danger {
      background: #653022;
      border-color: #d97f7f;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .pair-list {
      display: grid;
      gap: 5px;
      margin-top: 8px;
    }
    .pair-list button {
      text-align: left;
      font-weight: 500;
    }
    .meta {
      margin: 8px 0;
      color: #c8aa72;
      font-size: 12px;
      line-height: 1.35;
    }
    #map {
      height: 100vh;
      background: #111;
    }
    .candidate-dot,
    .confirmed-dot,
    .candidate-map-dot,
    .existing-map-dot {
      display: grid;
      place-items: center;
      border-radius: 50%;
      box-sizing: border-box;
      font-weight: 800;
    }
    .candidate-dot,
    .confirmed-dot {
      width: 18px;
      height: 18px;
      font-size: 11px;
    }
    .candidate-dot {
      background: #3f5f6f;
      border: 2px solid #d8c3a3;
      color: #f2e2bd;
    }
    .confirmed-dot {
      background: #2f8f2f;
      border: 2px solid #ffd36a;
      color: #fff;
    }
    .candidate-map-dot,
    .existing-map-dot {
      width: 22px;
      height: 22px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
      font-size: 10px;
      cursor: pointer;
    }
    .candidate-map-dot {
      background: #3f5f6f;
      border: 2px solid #d8c3a3;
      color: #f2e2bd;
    }
    .existing-map-dot {
      background: #2f8f2f;
      border: 2px solid #ffd36a;
      color: #fff;
    }
    .map-marker-legend {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin: 8px 0;
      font-size: 12px;
    }
    .map-marker-legend label {
      display: flex;
      align-items: center;
      gap: 5px;
      margin: 0;
    }
    .map-marker-legend input {
      width: auto;
      margin: 0;
    }
  </style>
</head>
<body>
  <aside>
    <h1>Candidate Residual Calibration</h1>
    <p class="meta">Development-only. Saves residual pairs to <code>data/candidate-survey/candidate-residual-calibration.json</code>.</p>
    <p class="meta" id="marker-source">Existing marker source: loading...</p>
    <label>
      Load current Explorer export
      <input id="marker-export-file" type="file" accept="application/json,.json" />
    </label>
    <div class="map-marker-legend">
      <label><input type="checkbox" id="show-candidates" checked /> Blue C candidates</label>
      <label><input type="checkbox" id="show-existing" checked /> Green E existing</label>
    </div>

    <label>
      Existing residual pair
      <select id="pair-select"></select>
    </label>

    <label>
      Candidate marker
      <select id="candidate-select"></select>
    </label>

    <div class="grid">
      <label>Candidate X<input id="candidate-x" type="number" step="0.01" /></label>
      <label>Candidate Y<input id="candidate-y" type="number" step="0.01" /></label>
    </div>

    <label>
      Confirmed existing marker, optional
      <select id="marker-select"></select>
    </label>

    <div class="grid">
      <label>Confirmed X<input id="confirmed-x" type="number" step="0.01" /></label>
      <label>Confirmed Y<input id="confirmed-y" type="number" step="0.01" /></label>
    </div>

    <label>
      <input id="verified" type="checkbox" style="width:auto" />
      Verified same source location
    </label>

    <label>
      Notes
      <textarea id="notes" rows="3"></textarea>
    </label>

    <div class="meta" id="residual-preview">Residual: not calculated</div>
    <button class="primary" id="save-pair">Save Pair</button>
    <button id="new-pair">New Pair</button>
    <button class="danger" id="delete-pair">Delete Pair</button>
    <div class="meta" id="status"></div>

    <h2>Saved Pairs</h2>
    <div class="pair-list" id="pair-list"></div>
  </aside>
  <main id="map"></main>

  <script src="/vendor/leaflet/leaflet.js"></script>
  <script>
    const MAP_WIDTH = 9216;
    const MAP_HEIGHT = 7168;
    let candidates = [];
    let markers = [];
    let pairs = [];
    let editingId = "";
    const candidateMarkerLayer = L.layerGroup();
    const existingMarkerLayer = L.layerGroup();
    const pairLayer = L.layerGroup();
    const workingLayer = L.layerGroup();
    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 2,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      doubleClickZoom: false,
    });
    const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
    L.imageOverlay("/images/rdr2-map.jpg", bounds).addTo(map);
    candidateMarkerLayer.addTo(map);
    existingMarkerLayer.addTo(map);
    pairLayer.addTo(map);
    workingLayer.addTo(map);
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { animate: false });
    }, 0);

    function byId(id) { return document.getElementById(id); }
    function numberValue(id) {
      const value = Number(byId(id).value);
      return Number.isFinite(value) ? value : null;
    }
    function pointToLatLng(point) { return [point.y, point.x]; }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function extractHerbMarkersFromExport(payload) {
      const sourceMarkers = Array.isArray(payload) ? payload : payload.markers;
      if (!Array.isArray(sourceMarkers)) return [];
      return sourceMarkers.filter((marker) =>
        marker &&
        marker.category === "herbs" &&
        Number.isFinite(Number(marker.x)) &&
        Number.isFinite(Number(marker.y))
      );
    }
    function residual() {
      const candidate = { x: numberValue("candidate-x"), y: numberValue("candidate-y") };
      const confirmed = { x: numberValue("confirmed-x"), y: numberValue("confirmed-y") };
      if ([candidate.x, candidate.y, confirmed.x, confirmed.y].some((v) => v === null)) return null;
      return {
        x: confirmed.x - candidate.x,
        y: confirmed.y - candidate.y,
        distance: distance(candidate, confirmed),
      };
    }
    function markerHtml(type) {
      return `<div class="${type}-dot">${type === "candidate" ? "C" : "R"}</div>`;
    }
    function mapMarkerHtml(type) {
      return `<div class="${type}-map-dot">${type === "candidate" ? "C" : "E"}</div>`;
    }
    function selectCandidate(candidate, pan = false) {
      if (!candidate) return;
      byId("candidate-select").value = candidate.candidateId;
      byId("candidate-x").value = Number(candidate.x).toFixed(2);
      byId("candidate-y").value = Number(candidate.y).toFixed(2);
      renderWorkingVector();
      if (pan) map.panTo([candidate.y, candidate.x]);
    }
    function selectExistingMarker(marker, pan = false) {
      if (!marker) return;
      byId("marker-select").value = marker.id;
      byId("confirmed-x").value = Number(marker.x).toFixed(2);
      byId("confirmed-y").value = Number(marker.y).toFixed(2);
      renderWorkingVector();
      if (pan) map.panTo([marker.y, marker.x]);
    }
    function renderSelectableMarkers() {
      candidateMarkerLayer.clearLayers();
      existingMarkerLayer.clearLayers();

      for (const candidate of candidates) {
        const marker = L.marker([candidate.y, candidate.x], {
          icon: L.divIcon({
            className: "",
            html: mapMarkerHtml("candidate"),
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          zIndexOffset: 300,
        }).addTo(candidateMarkerLayer);
        marker.bindTooltip(`${candidate.candidateId}<br>${candidate.typeName || candidate.type}`, {
          direction: "top",
          opacity: 0.92,
        });
        marker.on("click", () => selectCandidate(candidate));
      }

      for (const herbMarker of markers) {
        const marker = L.marker([herbMarker.y, herbMarker.x], {
          icon: L.divIcon({
            className: "",
            html: mapMarkerHtml("existing"),
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          zIndexOffset: 250,
        }).addTo(existingMarkerLayer);
        marker.bindTooltip(`${herbMarker.name || herbMarker.type}<br>${herbMarker.type}`, {
          direction: "top",
          opacity: 0.92,
        });
        marker.on("click", () => selectExistingMarker(herbMarker));
      }
    }
    function updateSelectableLayerVisibility() {
      if (byId("show-candidates").checked) {
        if (!map.hasLayer(candidateMarkerLayer)) candidateMarkerLayer.addTo(map);
      } else if (map.hasLayer(candidateMarkerLayer)) {
        candidateMarkerLayer.remove();
      }

      if (byId("show-existing").checked) {
        if (!map.hasLayer(existingMarkerLayer)) existingMarkerLayer.addTo(map);
      } else if (map.hasLayer(existingMarkerLayer)) {
        existingMarkerLayer.remove();
      }
    }
    function renderWorkingVector() {
      workingLayer.clearLayers();
      const candidate = { x: numberValue("candidate-x"), y: numberValue("candidate-y") };
      const confirmed = { x: numberValue("confirmed-x"), y: numberValue("confirmed-y") };
      const r = residual();
      if (!r) {
        byId("residual-preview").textContent = "Residual: not calculated";
        return;
      }
      byId("residual-preview").textContent =
        `Residual: X ${r.x.toFixed(2)} | Y ${r.y.toFixed(2)} | Distance ${r.distance.toFixed(2)}`;
      L.marker(pointToLatLng(candidate), {
        icon: L.divIcon({ className: "", html: markerHtml("candidate"), iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(workingLayer);
      L.marker(pointToLatLng(confirmed), {
        icon: L.divIcon({ className: "", html: markerHtml("confirmed"), iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(workingLayer);
      L.polyline([pointToLatLng(candidate), pointToLatLng(confirmed)], {
        color: "#ffd36a",
        weight: 3,
        dashArray: "8 5",
      }).addTo(workingLayer);
    }
    function renderPairs() {
      pairLayer.clearLayers();
      const list = byId("pair-list");
      list.innerHTML = "";
      byId("pair-select").innerHTML = `<option value="">New residual pair</option>` +
        pairs.map((pair) => `<option value="${pair.id}">${pair.id}</option>`).join("");
      for (const pair of pairs) {
        const button = document.createElement("button");
        button.textContent = `${pair.id}: ${pair.residual.x.toFixed(2)}, ${pair.residual.y.toFixed(2)}`;
        button.addEventListener("click", () => loadPair(pair.id));
        list.appendChild(button);
        L.polyline([pointToLatLng(pair.candidate), pointToLatLng(pair.confirmed)], {
          color: pair.verifiedSameLocation ? "#55d66b" : "#d97f7f",
          weight: 2,
        }).addTo(pairLayer);
      }
    }
    function loadPair(id) {
      const pair = pairs.find((item) => item.id === id);
      if (!pair) return;
      editingId = pair.id;
      byId("pair-select").value = pair.id;
      byId("candidate-select").value = pair.candidateId || "";
      byId("candidate-x").value = pair.candidate.x;
      byId("candidate-y").value = pair.candidate.y;
      byId("confirmed-x").value = pair.confirmed.x;
      byId("confirmed-y").value = pair.confirmed.y;
      byId("verified").checked = Boolean(pair.verifiedSameLocation);
      byId("notes").value = pair.notes || "";
      renderWorkingVector();
      map.panTo(pointToLatLng(pair.confirmed));
    }
    function newPair() {
      editingId = "";
      byId("pair-select").value = "";
      byId("candidate-select").value = "";
      byId("marker-select").value = "";
      ["candidate-x", "candidate-y", "confirmed-x", "confirmed-y", "notes"].forEach((id) => byId(id).value = "");
      byId("verified").checked = false;
      renderWorkingVector();
    }
    function nextId() {
      const max = pairs.reduce((highest, pair) => {
        const match = String(pair.id).match(/residual-(\\d+)/);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      return `residual-${String(max + 1).padStart(3, "0")}`;
    }
    async function savePair() {
      const r = residual();
      if (!r) {
        byId("status").textContent = "Enter valid candidate and confirmed coordinates before saving.";
        return;
      }
      const pair = {
        id: editingId || nextId(),
        candidateId: byId("candidate-select").value,
        candidate: { x: numberValue("candidate-x"), y: numberValue("candidate-y") },
        confirmed: { x: numberValue("confirmed-x"), y: numberValue("confirmed-y") },
        residual: { x: r.x, y: r.y },
        verifiedSameLocation: byId("verified").checked,
        notes: byId("notes").value.trim(),
      };
      const index = pairs.findIndex((item) => item.id === pair.id);
      if (index >= 0) pairs[index] = pair;
      else pairs.push(pair);
      const response = await fetch("/api/residuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pairs),
      });
      const payload = await response.json();
      pairs = payload.residuals;
      editingId = pair.id;
      renderPairs();
      loadPair(pair.id);
      byId("status").textContent = "Saved.";
    }
    async function deletePair() {
      if (!editingId) return;
      pairs = pairs.filter((item) => item.id !== editingId);
      const response = await fetch("/api/residuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pairs),
      });
      const payload = await response.json();
      pairs = payload.residuals;
      newPair();
      renderPairs();
      byId("status").textContent = "Deleted.";
    }
    async function loadData() {
      const response = await fetch("/api/data");
      const payload = await response.json();
      candidates = payload.candidates;
      markers = payload.markers;
      pairs = payload.residuals;
      byId("marker-source").textContent =
        `Existing marker source: ${payload.markerSource || "server export"} (${markers.length} herb markers)`;
      populateMarkerSelectors();
      renderSelectableMarkers();
      renderPairs();
    }
    function populateMarkerSelectors() {
      byId("candidate-select").innerHTML = `<option value="">Manual candidate coordinate</option>` +
        candidates.map((candidate) =>
          `<option value="${candidate.candidateId}">${candidate.candidateId} · ${candidate.typeName || candidate.type}</option>`
        ).join("");
      byId("marker-select").innerHTML = `<option value="">Manual confirmed coordinate</option>` +
        markers.map((marker) =>
          `<option value="${marker.id}">${marker.name || marker.type} · ${marker.type}</option>`
        ).join("");
    }
    function loadMarkerExportFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          const payload = JSON.parse(reader.result);
          const loadedMarkers = extractHerbMarkersFromExport(payload);
          if (!loadedMarkers.length) {
            byId("status").textContent = "That file did not contain any herb markers.";
            return;
          }
          markers = loadedMarkers;
          byId("marker-source").textContent =
            `Existing marker source: ${file.name} (${markers.length} herb markers)`;
          byId("marker-select").value = "";
          populateMarkerSelectors();
          renderSelectableMarkers();
          renderWorkingVector();
          byId("status").textContent = "Loaded current marker export for comparison.";
        } catch (error) {
          byId("status").textContent = "Could not read that marker export JSON.";
        }
      });
      reader.readAsText(file);
    }
    byId("candidate-select").addEventListener("change", (event) => {
      const candidate = candidates.find((item) => item.candidateId === event.target.value);
      selectCandidate(candidate, true);
    });
    byId("marker-select").addEventListener("change", (event) => {
      const marker = markers.find((item) => item.id === event.target.value);
      selectExistingMarker(marker, true);
    });
    ["candidate-x", "candidate-y", "confirmed-x", "confirmed-y"].forEach((id) => {
      byId(id).addEventListener("input", renderWorkingVector);
    });
    byId("pair-select").addEventListener("change", (event) => event.target.value ? loadPair(event.target.value) : newPair());
    byId("save-pair").addEventListener("click", savePair);
    byId("new-pair").addEventListener("click", newPair);
    byId("delete-pair").addEventListener("click", deletePair);
    byId("show-candidates").addEventListener("change", updateSelectableLayerVisibility);
    byId("show-existing").addEventListener("change", updateSelectableLayerVisibility);
    byId("marker-export-file").addEventListener("change", (event) => {
      loadMarkerExportFile(event.target.files[0]);
    });
    loadData();
  </script>
</body>
</html>
"""


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def normalize_residual_pair(pair: dict, index: int) -> dict:
    candidate = pair.get("candidate") or {}
    confirmed = pair.get("confirmed") or {}
    candidate_x = float(candidate["x"])
    candidate_y = float(candidate["y"])
    confirmed_x = float(confirmed["x"])
    confirmed_y = float(confirmed["y"])

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


class ResidualEditorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, payload, status: int = 200) -> None:
        encoded = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            encoded = EDITOR_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return

        if parsed.path == "/api/data":
            self.send_json(
                {
                    "map": {"width": MAP_WIDTH, "height": MAP_HEIGHT},
                    "candidates": read_json(CANDIDATE_PATH, []),
                    "markers": load_existing_herb_markers(),
                    "residuals": read_json(RESIDUAL_PATH, []),
                    "markerSource": str(EXPORT_PATH),
                }
            )
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/residuals":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, list):
            self.send_json({"error": "Expected a list of residual pairs."}, status=400)
            return

        normalized = [normalize_residual_pair(pair, index) for index, pair in enumerate(payload)]
        write_json(RESIDUAL_PATH, normalized)
        self.send_json({"residuals": normalized})


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", DEFAULT_PORT), ResidualEditorHandler)
    print(f"Candidate Residual Calibration Editor: http://127.0.0.1:{DEFAULT_PORT}/")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()

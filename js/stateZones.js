/*
==================================================
RosalitaRP Explorer
Version : 1.3.21
Creator : Rathan
==================================================
*/

let STATE_ZONES = [];
let stateZoneLayer = null;
let stateZoneToggle = null;

async function loadStateZoneData() {
  const response = await fetch(
    `data/state-zones.json?v=${encodeURIComponent(APP_VERSION)}`
  );
  const stateZoneData = await response.json();
  STATE_ZONES = Array.isArray(stateZoneData.states) ? stateZoneData.states : [];
  return STATE_ZONES;
}

function getStateZones() {
  return STATE_ZONES;
}

function getStateById(stateId) {
  return STATE_ZONES.find((state) => state.id === stateId);
}

function pointInPolygon(x, y, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function getStateForCoordinates(x, y) {
  const mapX = Number(x);
  const mapY = Number(y);

  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
    return null;
  }

  return (
    STATE_ZONES.find((state) =>
      pointInPolygon(mapX, mapY, state.polygon)
    ) || null
  );
}

function getStateIdForCoordinates(x, y) {
  const state = getStateForCoordinates(x, y);
  return state ? state.id : "";
}

function getStateName(stateId) {
  const state = getStateById(stateId);
  return state ? state.name : "";
}

function getMarkerAutoStateName(markerData) {
  if (!markerData) {
    return "";
  }

  return getStateName(markerData.stateAuto) || "Unknown";
}

function getMarkerStateName(markerData) {
  if (!markerData) {
    return "";
  }

  return getStateName(markerData.state) || "Unknown";
}

function buildStateDropdown(selectId, selectedStateId = "") {
  const select = document.getElementById(selectId);

  if (!select) {
    return;
  }

  select.innerHTML = "";

  const unknownOption = document.createElement("option");
  unknownOption.value = "";
  unknownOption.textContent = "Unknown";
  select.appendChild(unknownOption);

  STATE_ZONES.forEach((state) => {
    const option = document.createElement("option");
    option.value = state.id;
    option.textContent = state.name;
    select.appendChild(option);
  });

  select.value = selectedStateId || "";
}

function buildStateFilterDropdown(selectId, selectedStateId = "") {
  const select = document.getElementById(selectId);

  if (!select) {
    return;
  }

  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All States";
  select.appendChild(allOption);

  STATE_ZONES.forEach((state) => {
    const option = document.createElement("option");
    option.value = state.id;
    option.textContent = state.name;
    select.appendChild(option);
  });

  select.value = selectedStateId || "";
}

function initializeStateZoneOverlay() {
  stateZoneToggle = document.getElementById("show-state-zones");

  if (!stateZoneToggle) {
    return;
  }

  stateZoneToggle.checked = false;
  stateZoneToggle.addEventListener("change", function () {
    setStateZoneOverlayVisible(this.checked);
  });

  window.addEventListener("resize", updateFilterHeaderHeight);
  updateFilterHeaderHeight();
}

function setStateZoneOverlayVisible(visible) {
  if (visible) {
    renderStateZoneOverlay();
    return;
  }

  if (stateZoneLayer) {
    stateZoneLayer.remove();
    stateZoneLayer = null;
  }
}

function renderStateZoneOverlay() {
  if (stateZoneLayer) {
    stateZoneLayer.remove();
  }

  stateZoneLayer = L.layerGroup().addTo(map);

  STATE_ZONES.forEach((state) => {
    if (!Array.isArray(state.polygon) || state.polygon.length < 3) {
      return;
    }

    const latLngs = state.polygon.map(([x, y]) => [y, x]);

    L.polygon(latLngs, {
      color: state.color,
      weight: 2,
      opacity: 0.75,
      fillColor: state.color,
      fillOpacity: 0.14,
      interactive: false,
    }).addTo(stateZoneLayer);
  });
}

function updateFilterHeaderHeight() {
  const filterHeader = document.querySelector(".filter-panel-header");

  if (!filterHeader) {
    return;
  }

  document.documentElement.style.setProperty(
    "--filter-header-height",
    `${Math.ceil(filterHeader.getBoundingClientRect().height)}px`
  );
}

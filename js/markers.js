/*
==================================================
RosalitaRP Explorer
Version : 0.6.0
Creator : Rathan
==================================================
*/

let markers = [];
let selectedMarkerId = null;

function addMarker(markerData) {
  markerData.leafletMarker = createLeafletMarker(markerData);
  markers.push(markerData);
  selectMarker(markerData.id);
  updateMarkerStats();
}

function createLeafletMarker(markerData) {
  const category = getCategoryById(markerData.category);
  const type = getTypeById(markerData.category, markerData.type);

  const iconText = type ? type.icon : category ? category.icon : "📍";

  const leafletMarker = L.marker([markerData.y, markerData.x], {
    icon: createCategoryIcon(iconText, false, markerData.status),
  }).addTo(map);

  leafletMarker.bindPopup(`
    <strong>${iconText} ${escapeHtml(markerData.name)}</strong>
  `);

  leafletMarker.on("click", function (event) {
    if (event.originalEvent) {
      L.DomEvent.stopPropagation(event.originalEvent);
    }

    selectMarker(markerData.id);
  });

  return leafletMarker;
}

function selectMarker(markerId) {
  selectedMarkerId = markerId;

  markers.forEach((marker) => {
    const isSelected = marker.id === markerId;
    const category = getCategoryById(marker.category);
    const type = getTypeById(marker.category, marker.type);
    const iconText = type ? type.icon : category ? category.icon : "📍";

    marker.leafletMarker.setIcon(
      createCategoryIcon(iconText, isSelected, marker.status)
    );
  });

  const markerData = getMarkerById(markerId);

  if (!markerData) {
    clearSelectedMarker();
    return;
  }

  renderMarkerDetails(markerData);
}

function clearSelectedMarker() {
  selectedMarkerId = null;

  markers.forEach((marker) => {
    const category = getCategoryById(marker.category);
    const type = getTypeById(marker.category, marker.type);
    const iconText = type ? type.icon : category ? category.icon : "📍";

    marker.leafletMarker.setIcon(
      createCategoryIcon(iconText, false, marker.status)
    );
  });

  renderMarkerDetails(null);
}

function getMarkerById(markerId) {
  return markers.find((marker) => marker.id === markerId);
}

async function updateMarker(markerId, updates) {
  const markerData = getMarkerById(markerId);

  if (!markerData) {
    return;
  }

  Object.assign(markerData, updates);
  markerData.modifiedAt = new Date().toISOString();

  if (markerData.leafletMarker) {
    map.removeLayer(markerData.leafletMarker);
  }

  markerData.leafletMarker = createLeafletMarker(markerData);
  selectMarker(markerId);
}

function deleteMarker(markerId) {
  const markerData = getMarkerById(markerId);

  if (!markerData) {
    return;
  }

  if (markerData.leafletMarker) {
    map.removeLayer(markerData.leafletMarker);
  }

  markers = markers.filter((marker) => marker.id !== markerId);
  clearSelectedMarker();
  updateMarkerStats();
}

function createCategoryIcon(iconText, selected, status = "unverified") {
  const statusClass = getStatusClass(status);

  return L.divIcon({
    className: selected
      ? `category-marker selected ${statusClass}`
      : `category-marker ${statusClass}`,
    html: `<div class="category-marker-icon">${escapeHtml(iconText)}</div>`,
    iconSize: selected ? [36, 36] : [28, 28],
    iconAnchor: selected ? [18, 18] : [14, 14],
    popupAnchor: [0, -14],
  });
}

function getStatusClass(status) {
  if (status === "verified") {
    return "status-verified";
  }

  if (status === "invalid") {
    return "status-invalid";
  }

  return "status-unverified";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
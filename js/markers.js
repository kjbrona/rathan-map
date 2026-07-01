/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let renderedMarkerLayer = L.layerGroup().addTo(map);

function clearRenderedMarkers() {
  renderedMarkerLayer.clearLayers();
}

function renderMarker(markerData, selected = false) {
  const category = getCategoryById(markerData.category);
  const type = getTypeById(markerData.category, markerData.type);

  const iconText = type ? type.icon : category ? category.icon : "📍";

  const markerLatLng = [markerData.y, markerData.x];

  if (markerData.category === "dangerous-animals") {
    renderDangerZone(markerData, markerLatLng);
  }

  const leafletMarker = L.marker(markerLatLng, {
    icon: createCategoryIcon(iconText, selected, markerData.status),
  }).addTo(renderedMarkerLayer);

  leafletMarker.bindPopup(`
    <strong>${iconText} ${escapeHtml(markerData.name)}</strong>
  `);

  leafletMarker.on("click", function (event) {
    if (event.originalEvent) {
      L.DomEvent.stopPropagation(event.originalEvent);
    }

    selectMarker(markerData.id);
  });

  leafletMarker.on("contextmenu", function (event) {
    if (event.originalEvent) {
      L.DomEvent.stopPropagation(event.originalEvent);
    }

    openMarkerContextMenu(markerData.id, event.originalEvent);
  });
}

function renderDangerZone(markerData, markerLatLng) {
  L.circle(markerLatLng, {
    radius: getDangerRadiusValue(
      markerData.category,
      markerData.dangerRadius
    ),
    color: "#c4511f",
    weight: 2,
    opacity: 0.55,
    fillColor: "#f97316",
    fillOpacity: 0.16,
    interactive: false,
  }).addTo(renderedMarkerLayer);
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

function centerOnMarker(markerId) {
  const markerData = getMarkerById(markerId);

  if (!markerData || !isMarkerVisible(markerData)) {
    return false;
  }

  map.flyTo([markerData.y, markerData.x], Math.max(map.getZoom(), 0), {
    animate: true,
    duration: 0.65,
  });

  return true;
}

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
  const type = getTypeById(markerData.category, markerData.type);
  const group = getTypeGroupForType(markerData.category, markerData.type);
  const iconPath = getTypeGroupIconUrl(group);
  const iconLabel = group ? group.name : type ? type.name : "Marker";

  const markerLatLng = [markerData.y, markerData.x];

  if (markerData.category === "dangerous-animals") {
    renderDangerZone(markerData, markerLatLng);
  }

  const leafletMarker = L.marker(markerLatLng, {
    icon: createTypeGroupMarkerIcon(
      iconPath,
      iconLabel,
      selected,
      markerData.status
    ),
  }).addTo(renderedMarkerLayer);

  leafletMarker.bindPopup(`
    <strong>${createTypeGroupIconHtml(
      markerData.category,
      markerData.type,
      "popup-type-icon"
    )} ${escapeHtml(markerData.name)}</strong>
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

function createTypeGroupMarkerIcon(
  iconPath,
  iconLabel,
  selected,
  status = "unverified"
) {
  const statusClass = getStatusClass(status);
  const iconSize = selected ? 30 : 24;
  const iconHtml = iconPath
    ? `<img class="category-marker-icon-image" src="${escapeHtml(
        iconPath
      )}" alt="${escapeHtml(iconLabel)}" />`
    : "";

  return L.divIcon({
    className: selected
      ? `category-marker selected ${statusClass}`
      : `category-marker ${statusClass}`,
    html: `<div class="category-marker-icon">${iconHtml}</div>`,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    popupAnchor: [0, -(iconSize / 2)],
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

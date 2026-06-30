/*
==================================================
RosalitaRP Explorer
Version : 0.4.0
Creator : Rathan
==================================================
*/

let markers = [];

function addMarker(markerData) {
  markers.push(markerData);

  const category = getCategoryById(markerData.category);
  const icon = category ? category.icon : "📍";
  const categoryName = category ? category.name : "Unknown";

  const leafletMarker = L.marker([markerData.y, markerData.x], {
    icon: createCategoryIcon(icon),
  }).addTo(map);

  leafletMarker.bindPopup(`
    <strong>${escapeHtml(markerData.name)}</strong><br>
    <em>${icon} ${escapeHtml(categoryName)}</em><br><br>
    ${escapeHtml(markerData.notes || "")}<br><br>
    X: ${markerData.x}<br>
    Y: ${markerData.y}
  `);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createCategoryIcon(iconText) {
  return L.divIcon({
    className: "category-marker",
    html: `<div class="category-marker-icon">${iconText}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}
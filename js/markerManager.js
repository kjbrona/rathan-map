/*
==================================================
RosalitaRP Explorer
Version : 0.6.0
Creator : Rathan
==================================================
*/

let markers = [];
let selectedMarkerId = null;
let activeCategoryFilters = new Set();

function initializeMarkerManager() {
  activeCategoryFilters = new Set(CATEGORIES.map((category) => category.id));
}

function addMarker(markerData) {
  markers.push(markerData);
  selectMarker(markerData.id);
  updateMarkerStats();
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

  selectMarker(markerId);
  updateMarkerStats();
}

function deleteMarker(markerId) {
  markers = markers.filter((marker) => marker.id !== markerId);

  selectedMarkerId = null;
  refreshMarkers();
  renderMarkerDetails(null);
  updateMarkerStats();
}

function selectMarker(markerId) {
  selectedMarkerId = markerId;

  const markerData = getMarkerById(markerId);

  if (!markerData) {
    clearSelectedMarker();
    return;
  }

  refreshMarkers();
  renderMarkerDetails(markerData);
}

function clearSelectedMarker() {
  selectedMarkerId = null;
  refreshMarkers();
  renderMarkerDetails(null);
}

function refreshMarkers() {
  clearRenderedMarkers();

  markers.forEach((markerData) => {
    if (!isMarkerVisible(markerData)) {
      return;
    }

    renderMarker(markerData, markerData.id === selectedMarkerId);
  });
}

function isMarkerVisible(markerData) {
  return activeCategoryFilters.has(markerData.category);
}

function setCategoryFilter(categoryId, enabled) {
  if (enabled) {
    activeCategoryFilters.add(categoryId);
  } else {
    activeCategoryFilters.delete(categoryId);
  }

  if (selectedMarkerId) {
    const selectedMarker = getMarkerById(selectedMarkerId);

    if (selectedMarker && !isMarkerVisible(selectedMarker)) {
      selectedMarkerId = null;
      renderMarkerDetails(null);
    }
  }

  refreshMarkers();
}
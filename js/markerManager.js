/*
==================================================
RosalitaRP Explorer
Version : 0.8.1
Creator : Rathan
==================================================
*/

let markers = [];
let selectedMarkerId = null;
let activeCategoryFilters = new Set();
let activeTypeFilters = new Map();
let autosaveStatusTimer = null;

async function initializeMarkerManager() {
  activeCategoryFilters = new Set(
    CATEGORIES.filter((category) => category.enabled !== false).map(
      (category) => category.id
    )
  );

  activeTypeFilters = new Map();

  await Promise.all(
    CATEGORIES.map(async (category) => {
      const types = await loadTypesForCategory(category.id);
      activeTypeFilters.set(
        category.id,
        new Set(
          types
            .filter((type) => type.enabled !== false)
            .map((type) => type.id)
        )
      );
    })
  );

  applySavedFilterState();
  markers = loadMarkers();
  setAutosaveStatus("saved");
}

function addMarker(markerData) {
  markers.push(markerData);
  persistMarkers();
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

  persistMarkers();
  selectMarker(markerId);
  updateMarkerStats();
}

async function moveMarker(markerId, x, y) {
  await updateMarker(markerId, {
    x: Number(x),
    y: Number(y),
  });
}

async function moveSelectedMarkerTo(latlng) {
  if (!selectedMarkerId) {
    cancelMoveMarkerMode();
    return;
  }

  await moveMarker(
    selectedMarkerId,
    Math.round(latlng.lng),
    Math.round(latlng.lat)
  );
  cancelMoveMarkerMode();
}

function deleteMarker(markerId) {
  markers = markers.filter((marker) => marker.id !== markerId);

  selectedMarkerId = null;
  persistMarkers();
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

function getSelectedMarkerId() {
  return selectedMarkerId;
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

  updateMarkerStats();
  refreshSearchResults();
}

function isMarkerVisible(markerData) {
  if (!activeCategoryFilters.has(markerData.category)) {
    return false;
  }

  const activeTypes = activeTypeFilters.get(markerData.category);

  if (!activeTypes || !markerData.type) {
    return true;
  }

  return activeTypes.has(markerData.type);
}

function setCategoryFilter(categoryId, enabled) {
  if (enabled) {
    activeCategoryFilters.add(categoryId);
    activeTypeFilters.set(
      categoryId,
      new Set((TYPE_DATA[categoryId] || []).map((type) => type.id))
    );
  } else {
    activeCategoryFilters.delete(categoryId);
    activeTypeFilters.set(categoryId, new Set());
  }

  if (selectedMarkerId) {
    const selectedMarker = getMarkerById(selectedMarkerId);

    if (selectedMarker && !isMarkerVisible(selectedMarker)) {
      selectedMarkerId = null;
      renderMarkerDetails(null);
    }
  }

  saveFilterStateToStorage(getFilterStateForStorage());
  refreshMarkers();
}

function setCategoryAndTypeFilters(categoryId, enabled) {
  if (enabled) {
    activeCategoryFilters.add(categoryId);
  } else {
    activeCategoryFilters.delete(categoryId);
  }

  const categoryTypes = TYPE_DATA[categoryId] || [];
  const activeTypes = new Set();

  if (enabled) {
    categoryTypes.forEach((type) => {
      activeTypes.add(type.id);
    });
  }

  activeTypeFilters.set(categoryId, activeTypes);

  if (selectedMarkerId) {
    const selectedMarker = getMarkerById(selectedMarkerId);

    if (selectedMarker && !isMarkerVisible(selectedMarker)) {
      selectedMarkerId = null;
      renderMarkerDetails(null);
    }
  }

  saveFilterStateToStorage(getFilterStateForStorage());
  refreshMarkers();
}

function setTypeFilter(categoryId, typeId, enabled) {
  if (!activeTypeFilters.has(categoryId)) {
    activeTypeFilters.set(categoryId, new Set());
  }

  const activeTypes = activeTypeFilters.get(categoryId);

  if (enabled) {
    activeTypes.add(typeId);
    activeCategoryFilters.add(categoryId);
  } else {
    activeTypes.delete(typeId);

    if (activeTypes.size === 0) {
      activeCategoryFilters.delete(categoryId);
    }
  }

  if (selectedMarkerId) {
    const selectedMarker = getMarkerById(selectedMarkerId);

    if (selectedMarker && !isMarkerVisible(selectedMarker)) {
      selectedMarkerId = null;
      renderMarkerDetails(null);
    }
  }

  saveFilterStateToStorage(getFilterStateForStorage());
  refreshMarkers();
}

function isCategoryFilterActive(categoryId) {
  return activeCategoryFilters.has(categoryId);
}

function isTypeFilterActive(categoryId, typeId) {
  const activeTypes = activeTypeFilters.get(categoryId);
  return activeTypes ? activeTypes.has(typeId) : true;
}

function getVisibleMarkerCount() {
  return markers.filter(isMarkerVisible).length;
}

function getVisibleMarkers() {
  return markers.filter(isMarkerVisible);
}

function getMarkersForExport() {
  return markers.slice();
}

function refreshSearchResults() {
  if (typeof updateSearchResults === "function") {
    updateSearchResults();
  }
}

function replaceMarkers(importedMarkers) {
  const replacementMarkers = sanitizeMarkers(importedMarkers);
  markers = replacementMarkers;
  selectedMarkerId = null;
  persistMarkers();
  refreshMarkers();
  renderMarkerDetails(null);
  updateMarkerStats();

  return {
    imported: replacementMarkers.length,
    skipped: 0,
  };
}

function mergeMarkers(importedMarkers) {
  const originalMarkerCount = markers.length;
  markers = mergeMarkerCollections(markers, importedMarkers);
  selectedMarkerId = null;
  persistMarkers();
  refreshMarkers();
  renderMarkerDetails(null);
  updateMarkerStats();

  return {
    imported: markers.length - originalMarkerCount,
    skipped: sanitizeMarkers(importedMarkers).length - (markers.length - originalMarkerCount),
  };
}

function persistMarkers() {
  setAutosaveStatus("saving");

  const saveResult = saveMarkers(markers);

  if (saveResult.ok) {
    autosaveStatusTimer = setTimeout(() => {
      setAutosaveStatus("saved");
    }, 250);
  } else {
    setAutosaveStatus("unsaved");
  }

  return saveResult;
}

function setAutosaveStatus(status) {
  const statusLabel = document.getElementById("autosave-status");

  if (!statusLabel) {
    return;
  }

  if (autosaveStatusTimer) {
    clearTimeout(autosaveStatusTimer);
    autosaveStatusTimer = null;
  }

  const labels = {
    saved: "Saved",
    saving: "Saving...",
    unsaved: "Not Saved",
  };

  statusLabel.textContent = labels[status] || labels.unsaved;
  statusLabel.dataset.status = status;
}

function getCategoryFilterState(categoryId) {
  const types = TYPE_DATA[categoryId] || [];

  if (types.length === 0) {
    return {
      checked: isCategoryFilterActive(categoryId),
      indeterminate: false,
    };
  }

  const activeTypes = activeTypeFilters.get(categoryId) || new Set();
  const activeTypeCount = types.filter((type) => activeTypes.has(type.id))
    .length;

  return {
    checked:
      activeTypeCount === types.length && isCategoryFilterActive(categoryId),
    indeterminate: activeTypeCount > 0 && activeTypeCount < types.length,
  };
}

function getFilterStateForStorage() {
  const activeTypes = {};

  activeTypeFilters.forEach((typeIds, categoryId) => {
    activeTypes[categoryId] = Array.from(typeIds);
  });

  return {
    categories: Array.from(activeCategoryFilters),
    types: activeTypes,
  };
}

function applySavedFilterState() {
  const savedFilterState = loadSavedFilterState();

  if (!savedFilterState) {
    return;
  }

  if (Array.isArray(savedFilterState.categories)) {
    const validCategoryIds = new Set(CATEGORIES.map((category) => category.id));
    activeCategoryFilters = new Set(
      savedFilterState.categories.filter((categoryId) =>
        validCategoryIds.has(categoryId)
      )
    );
  }

  if (savedFilterState.types && typeof savedFilterState.types === "object") {
    activeTypeFilters.forEach((typeIds, categoryId) => {
      const savedTypeIds = savedFilterState.types[categoryId];

      if (!Array.isArray(savedTypeIds)) {
        return;
      }

      const validTypeIds = new Set(typeIds);
      activeTypeFilters.set(
        categoryId,
        new Set(savedTypeIds.filter((typeId) => validTypeIds.has(typeId)))
      );
    });
  }
}

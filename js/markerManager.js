/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let markers = [];
let selectedMarkerId = null;
let activeFilters = createEmptyFilterState();
let autosaveStatusTimer = null;
const HERB_SHARED_MARKER_FIELDS = [
  "uses",
  "itemCategory",
  "itemUse",
  "vendorValue",
  "craftingUses",
  "itemNotes",
];

async function initializeMarkerManager() {
  activeFilters = createDefaultFilterState();

  await Promise.all(
    CATEGORIES.map(async (category) => {
      const types = await loadTypesForCategory(category.id);
      activeFilters.types.set(
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
  markers = await loadMarkers();
  setAutosaveStatus("saved");
}

function createEmptyFilterState() {
  return {
    state: "",
    statuses: [],
    confidences: [],
    uses: [],
    categories: new Set(),
    types: new Map(),
  };
}

function createDefaultFilterState() {
  return {
    state: "",
    statuses: [],
    confidences: [],
    uses: [],
    categories: new Set(
      CATEGORIES.filter((category) => category.enabled !== false).map(
        (category) => category.id
      )
    ),
    types: new Map(),
  };
}

function addMarker(markerData) {
  applyExistingHerbSharedFields(markerData);
  updateMarkerStateFromCoordinates(markerData);
  markers.push(markerData);
  syncHerbSharedFields(markerData, markerData, {
    includeSource: false,
    preserveEmptySource: true,
  });
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
  updateMarkerStateFromCoordinates(markerData);
  markerData.modifiedAt = new Date().toISOString();
  syncHerbSharedFields(markerData, updates);

  await persistMarkers();
  selectMarker(markerId);
  updateMarkerStats();
}

async function moveMarker(markerId, x, y) {
  await updateMarker(markerId, {
    x: Number(x),
    y: Number(y),
  });
}

function updateMarkerStateFromCoordinates(markerData) {
  if (!markerData) {
    return;
  }

  const stateAuto = getStateIdForCoordinates(markerData.x, markerData.y);
  markerData.stateAuto = stateAuto;

  if (markerData.stateOverride) {
    markerData.state = markerData.state || stateAuto;
    return;
  }

  markerData.state = stateAuto;
  markerData.stateOverride = false;
}

function applyExistingHerbSharedFields(markerData) {
  if (!isHerbMarker(markerData)) {
    return;
  }

  const matchingMarker = markers.find((candidate) => {
    return (
      candidate.id !== markerData.id &&
      candidate.category === markerData.category &&
      candidate.type === markerData.type &&
      hasAnyHerbSharedFieldValue(candidate)
    );
  });

  if (!matchingMarker) {
    return;
  }

  HERB_SHARED_MARKER_FIELDS.forEach((fieldName) => {
    if (!hasHerbSharedFieldValue(markerData, fieldName)) {
      markerData[fieldName] = cloneHerbSharedFieldValue(
        matchingMarker[fieldName]
      );
    }
  });
}

function syncHerbSharedFields(
  sourceMarker,
  sourceValues,
  { includeSource = false, preserveEmptySource = false } = {}
) {
  if (!isHerbMarker(sourceMarker) || !hasAnyHerbSharedFieldKey(sourceValues)) {
    return;
  }

  markers.forEach((targetMarker) => {
    if (
      (!includeSource && targetMarker.id === sourceMarker.id) ||
      targetMarker.category !== sourceMarker.category ||
      targetMarker.type !== sourceMarker.type
    ) {
      return;
    }

    HERB_SHARED_MARKER_FIELDS.forEach((fieldName) => {
      if (!Object.prototype.hasOwnProperty.call(sourceValues, fieldName)) {
        return;
      }

      if (
        preserveEmptySource &&
        !hasHerbSharedFieldValue(sourceValues, fieldName)
      ) {
        return;
      }

      targetMarker[fieldName] = cloneHerbSharedFieldValue(sourceMarker[fieldName]);
    });

    targetMarker.modifiedAt = new Date().toISOString();
  });
}

function isHerbMarker(markerData) {
  return markerData && markerData.category === "herbs" && markerData.type;
}

function hasAnyHerbSharedFieldKey(values = {}) {
  return HERB_SHARED_MARKER_FIELDS.some((fieldName) => {
    return Object.prototype.hasOwnProperty.call(values, fieldName);
  });
}

function hasAnyHerbSharedFieldValue(markerData = {}) {
  return HERB_SHARED_MARKER_FIELDS.some((fieldName) => {
    return hasHerbSharedFieldValue(markerData, fieldName);
  });
}

function hasHerbSharedFieldValue(markerData = {}, fieldName) {
  const value = markerData[fieldName];
  return Array.isArray(value)
    ? value.length > 0
    : String(value || "").trim().length > 0;
}

function cloneHerbSharedFieldValue(value) {
  return Array.isArray(value) ? value.slice() : value || "";
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

async function deleteMarker(markerId) {
  markers = markers.filter((marker) => marker.id !== markerId);

  selectedMarkerId = null;
  await removeStoredMarker(markerId);
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

function applyRemoteMarkers(remoteMarkers) {
  const previousSelectedMarkerId = selectedMarkerId;
  markers = sanitizeMarkers(remoteMarkers);

  if (
    previousSelectedMarkerId &&
    !markers.some((marker) => marker.id === previousSelectedMarkerId)
  ) {
    selectedMarkerId = null;
    renderMarkerDetails(null);
  }

  refreshMarkers();

  if (selectedMarkerId) {
    renderMarkerDetails(getMarkerById(selectedMarkerId));
  }
}

function isMarkerVisible(markerData) {
  if (activeFilters.state && markerData.state !== activeFilters.state) {
    return false;
  }

  if (
    activeFilters.statuses.length > 0 &&
    !activeFilters.statuses.includes(markerData.status || "unverified")
  ) {
    return false;
  }

  if (
    activeFilters.confidences.length > 0 &&
    !activeFilters.confidences.includes(markerData.confidence || "guess")
  ) {
    return false;
  }

  if (activeFilters.uses.length > 0) {
    const markerUses = Array.isArray(markerData.uses) ? markerData.uses : [];

    if (!activeFilters.uses.some((useId) => markerUses.includes(useId))) {
      return false;
    }
  }

  if (!activeFilters.categories.has(markerData.category)) {
    return false;
  }

  const activeTypes = activeFilters.types.get(markerData.category);

  if (!activeTypes || !markerData.type) {
    return true;
  }

  return activeTypes.has(markerData.type);
}

function setCategoryFilter(categoryId, enabled) {
  if (enabled) {
    activeFilters.categories.add(categoryId);
    activeFilters.types.set(
      categoryId,
      new Set((TYPE_DATA[categoryId] || []).map((type) => type.id))
    );
  } else {
    activeFilters.categories.delete(categoryId);
    activeFilters.types.set(categoryId, new Set());
  }

  applyFilterChange();
}

function setCategoryAndTypeFilters(categoryId, enabled) {
  if (enabled) {
    activeFilters.categories.add(categoryId);
  } else {
    activeFilters.categories.delete(categoryId);
  }

  const categoryTypes = TYPE_DATA[categoryId] || [];
  const activeTypes = new Set();

  if (enabled) {
    categoryTypes.forEach((type) => {
      activeTypes.add(type.id);
    });
  }

  activeFilters.types.set(categoryId, activeTypes);

  applyFilterChange();
}

function setTypeFilter(categoryId, typeId, enabled) {
  if (!activeFilters.types.has(categoryId)) {
    activeFilters.types.set(categoryId, new Set());
  }

  const activeTypes = activeFilters.types.get(categoryId);

  if (enabled) {
    activeTypes.add(typeId);
    activeFilters.categories.add(categoryId);
  } else {
    activeTypes.delete(typeId);

    if (activeTypes.size === 0) {
      activeFilters.categories.delete(categoryId);
    }
  }

  applyFilterChange();
}

function setAllFilters(enabled) {
  activeFilters.categories = new Set();
  activeFilters.types = new Map();

  CATEGORIES.forEach((category) => {
    const categoryTypes = TYPE_DATA[category.id] || [];

    activeFilters.types.set(
      category.id,
      enabled ? new Set(categoryTypes.map((type) => type.id)) : new Set()
    );

    if (enabled) {
      activeFilters.categories.add(category.id);
    }
  });

  applyFilterChange();
}

function isCategoryFilterActive(categoryId) {
  return activeFilters.categories.has(categoryId);
}

function isTypeFilterActive(categoryId, typeId) {
  const activeTypes = activeFilters.types.get(categoryId);
  return activeTypes ? activeTypes.has(typeId) : true;
}

function getVisibleMarkerCount() {
  return markers.filter(isMarkerVisible).length;
}

function getVisibleMarkers() {
  return markers.filter(isMarkerVisible);
}

function setStateFilter(stateId) {
  activeFilters.state = stateId || "";
  applyFilterChange();
}

function getStateFilter() {
  return activeFilters.state;
}

function getActiveFilterState() {
  return getFilterStateForStorage();
}

function setStatusFilter(statuses) {
  activeFilters.statuses = normalizeFilterArray(statuses);
  applyFilterChange();
}

function setConfidenceFilter(confidences) {
  activeFilters.confidences = normalizeFilterArray(confidences);
  applyFilterChange();
}

function setUsesFilter(uses) {
  activeFilters.uses = normalizeFilterArray(uses);
  applyFilterChange();
}

function resetAllFilters() {
  const resetState = createDefaultFilterState();
  resetState.types = activeFilters.types;

  CATEGORIES.forEach((category) => {
    const categoryTypes = TYPE_DATA[category.id] || [];
    resetState.types.set(
      category.id,
      new Set(categoryTypes.map((type) => type.id))
    );
  });

  activeFilters = resetState;
  applyFilterChange();
}

function normalizeFilterArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter((item, index, items) => item && items.indexOf(item) === index);
}

function applyFilterChange() {
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

function getMarkersForExport() {
  return markers.slice();
}

function refreshSearchResults() {
  if (typeof updateSearchResults === "function") {
    updateSearchResults();
  }
}

async function replaceMarkers(importedMarkers) {
  const replacementMarkers = sanitizeMarkers(importedMarkers);
  markers = replacementMarkers;
  selectedMarkerId = null;
  await persistMarkers();
  refreshMarkers();
  renderMarkerDetails(null);
  updateMarkerStats();

  return {
    imported: replacementMarkers.length,
    skipped: 0,
  };
}

async function mergeMarkers(importedMarkers) {
  const originalMarkerCount = markers.length;
  markers = mergeMarkerCollections(markers, importedMarkers);
  selectedMarkerId = null;
  await persistMarkers();
  refreshMarkers();
  renderMarkerDetails(null);
  updateMarkerStats();

  return {
    imported: markers.length - originalMarkerCount,
    skipped: sanitizeMarkers(importedMarkers).length - (markers.length - originalMarkerCount),
  };
}

async function persistMarkers() {
  setAutosaveStatus("saving");

  const saveResult = await saveMarkers(markers);

  if (saveResult.ok) {
    autosaveStatusTimer = setTimeout(() => {
      setAutosaveStatus("saved");
    }, 250);
  } else {
    setAutosaveStatus("unsaved");
  }

  return saveResult;
}

async function persistMarker(markerData) {
  setAutosaveStatus("saving");

  const saveResult = await saveMarker(markerData, markers);

  if (saveResult.ok) {
    autosaveStatusTimer = setTimeout(() => {
      setAutosaveStatus("saved");
    }, 250);
  } else {
    setAutosaveStatus("unsaved");
  }

  return saveResult;
}

async function removeStoredMarker(markerId) {
  setAutosaveStatus("saving");

  const saveResult = await deleteStoredMarker(markerId, markers);

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

  const activeTypes = activeFilters.types.get(categoryId) || new Set();
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

  activeFilters.types.forEach((typeIds, categoryId) => {
    activeTypes[categoryId] = Array.from(typeIds);
  });

  return {
    state: activeFilters.state,
    statuses: activeFilters.statuses,
    confidences: activeFilters.confidences,
    uses: activeFilters.uses,
    categories: Array.from(activeFilters.categories),
    types: activeTypes,
  };
}

function applySavedFilterState() {
  const savedFilterState = loadSavedFilterState();

  if (!savedFilterState) {
    return;
  }

  const migratedFilterState = migrateSavedFilterState(savedFilterState);

  if (Array.isArray(migratedFilterState.categories)) {
    const validCategoryIds = new Set(CATEGORIES.map((category) => category.id));
    activeFilters.categories = new Set(
      migratedFilterState.categories.filter((categoryId) =>
        validCategoryIds.has(categoryId)
      )
    );
  }

  activeFilters.state = migratedFilterState.state || "";
  activeFilters.statuses = normalizeFilterArray(migratedFilterState.statuses);
  activeFilters.confidences = normalizeFilterArray(
    migratedFilterState.confidences
  );
  activeFilters.uses = normalizeFilterArray(migratedFilterState.uses);

  if (migratedFilterState.types && typeof migratedFilterState.types === "object") {
    activeFilters.types.forEach((typeIds, categoryId) => {
      const savedTypeIds = migratedFilterState.types[categoryId];

      if (!Array.isArray(savedTypeIds)) {
        return;
      }

      const validTypeIds = new Set(typeIds);
      activeFilters.types.set(
        categoryId,
        new Set(
          savedTypeIds
            .map((typeId) => migrateSavedTypeFilter(categoryId, typeId))
            .filter((typeId) => validTypeIds.has(typeId))
        )
      );
    });
  }
}

function migrateSavedFilterState(savedFilterState) {
  return {
    state: savedFilterState.state || "",
    statuses: Array.isArray(savedFilterState.statuses)
      ? savedFilterState.statuses
      : [],
    confidences: Array.isArray(savedFilterState.confidences)
      ? savedFilterState.confidences
      : [],
    uses: Array.isArray(savedFilterState.uses) ? savedFilterState.uses : [],
    categories: Array.isArray(savedFilterState.categories)
      ? savedFilterState.categories
      : [],
    types:
      savedFilterState.types && typeof savedFilterState.types === "object"
        ? savedFilterState.types
        : {},
  };
}

function migrateSavedTypeFilter(categoryId, typeId) {
  if (categoryId === "mining" && typeId === "gold-flakes") {
    return "gold";
  }

  return typeId;
}

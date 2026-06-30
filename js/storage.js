/*
==================================================
RosalitaRP Explorer
Version : 0.8.1
Creator : Rathan
==================================================
*/

const MARKER_STORAGE_KEY = "rosalitarp-explorer-markers";
const FILTER_STORAGE_KEY = "rosalitarp-explorer-filters";
const STORAGE_APPLICATION = "RosalitaRP Explorer";
const STORAGE_VERSION = APP_VERSION;
const SUPPORTED_IMPORT_VERSIONS = ["0.7.0", "0.8.0", "0.8.1"];

const MARKER_STORAGE_FIELDS = [
  "id",
  "name",
  "category",
  "type",
  "status",
  "confidence",
  "notes",
  "x",
  "y",
  "createdAt",
  "modifiedAt",
];

function saveMarkers(markerData) {
  if (!canUseLocalStorage()) {
    return {
      ok: false,
      message: "Local Storage is not available in this browser.",
    };
  }

  try {
    const storedMarkers = sanitizeMarkers(markerData);
    localStorage.setItem(MARKER_STORAGE_KEY, JSON.stringify(storedMarkers));

    return {
      ok: true,
      markerCount: storedMarkers.length,
    };
  } catch (error) {
    console.warn("Marker data could not be saved.", error);

    return {
      ok: false,
      message: "Marker data could not be saved.",
    };
  }
}

function loadMarkers() {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const storedValue = localStorage.getItem(MARKER_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedMarkers = JSON.parse(storedValue);
    const markerList = Array.isArray(parsedMarkers)
      ? parsedMarkers
      : parsedMarkers.markers;

    if (!Array.isArray(markerList)) {
      console.warn("Saved marker data is not a valid marker list.");
      return [];
    }

    return sanitizeMarkers(markerList);
  } catch (error) {
    console.warn("Saved marker data contains invalid JSON.", error);
    return [];
  }
}

function createMarkerExport(markerData) {
  const markersForExport = sanitizeMarkers(markerData);

  return {
    version: STORAGE_VERSION,
    application: STORAGE_APPLICATION,
    created: new Date().toISOString(),
    markerCount: markersForExport.length,
    markers: markersForExport,
  };
}

function stringifyMarkerExport(markerData) {
  return JSON.stringify(createMarkerExport(markerData), null, 2);
}

function getMarkerExportFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `RosalitaRPExplorer_${year}-${month}-${day}_${hours}${minutes}.json`;
}

function validateMarkerImport(importData) {
  if (!importData || typeof importData !== "object") {
    return {
      ok: false,
      message: "The selected file is empty or is not a valid marker backup.",
    };
  }

  if (!importData.version) {
    return {
      ok: false,
      message: "The selected file is missing a backup version.",
    };
  }

  if (importData.application !== STORAGE_APPLICATION) {
    return {
      ok: false,
      message: "The selected file was not created for RosalitaRP Explorer.",
    };
  }

  if (!isSupportedImportVersion(importData.version)) {
    return {
      ok: false,
      message: `Backup version ${importData.version} is not supported.`,
    };
  }

  if (!Array.isArray(importData.markers)) {
    return {
      ok: false,
      message: "The selected file does not contain a markers array.",
    };
  }

  return {
    ok: true,
    markers: sanitizeMarkers(importData.markers),
  };
}

function parseMarkerImportFile(fileText) {
  if (!fileText || !fileText.trim()) {
    return {
      ok: false,
      message: "The selected file is empty.",
    };
  }

  try {
    return validateMarkerImport(JSON.parse(fileText));
  } catch (error) {
    console.warn("Imported marker file contains invalid JSON.", error);

    return {
      ok: false,
      message: "The selected file is not valid JSON.",
    };
  }
}

function mergeMarkerCollections(existingMarkers, importedMarkers) {
  const mergedMarkers = sanitizeMarkers(existingMarkers);
  const existingIds = new Set(mergedMarkers.map((marker) => marker.id));
  const markersToImport = sanitizeMarkers(importedMarkers);

  markersToImport.forEach((marker) => {
    if (!existingIds.has(marker.id)) {
      mergedMarkers.push(marker);
      existingIds.add(marker.id);
    }
  });

  return mergedMarkers;
}

function sanitizeMarkers(markerData) {
  if (!Array.isArray(markerData)) {
    return [];
  }

  return markerData.map(normalizeStoredMarker).filter(Boolean);
}

function canUseLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch (error) {
    return false;
  }
}

function isSupportedImportVersion(version) {
  return SUPPORTED_IMPORT_VERSIONS.includes(version);
}

function loadSavedFilterState() {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const storedValue = localStorage.getItem(FILTER_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedFilters = JSON.parse(storedValue);

    if (!parsedFilters || typeof parsedFilters !== "object") {
      return null;
    }

    return parsedFilters;
  } catch (error) {
    console.warn("Saved filter data could not be loaded.", error);
    return null;
  }
}

function saveFilterStateToStorage(filterState) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
  } catch (error) {
    console.warn("Filter data could not be saved.", error);
  }
}

function normalizeStoredMarker(markerData) {
  if (!markerData || typeof markerData !== "object") {
    return null;
  }

  if (
    !markerData.id ||
    !markerData.name ||
    !markerData.category ||
    !markerData.type
  ) {
    return null;
  }

  const x = Number(markerData.x);
  const y = Number(markerData.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const storedMarker = {};

  MARKER_STORAGE_FIELDS.forEach((fieldName) => {
    storedMarker[fieldName] = markerData[fieldName] || "";
  });

  storedMarker.status = markerData.status || "unverified";
  storedMarker.confidence = markerData.confidence || "guess";
  storedMarker.notes = markerData.notes || "";
  storedMarker.x = x;
  storedMarker.y = y;

  return storedMarker;
}

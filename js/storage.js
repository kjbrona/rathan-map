/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

const MARKER_STORAGE_KEY = "rosalitarp-explorer-markers";
const FILTER_STORAGE_KEY = "rosalitarp-explorer-filters";
const STORAGE_APPLICATION = "RosalitaRP Explorer";
const STORAGE_VERSION = APP_VERSION;
const SUPPORTED_IMPORT_VERSIONS = [
  "0.7.0",
  "0.8.0",
  "0.8.1",
  "0.8.2",
  "0.9.0",
  "1.0.0",
  "1.1.0",
  "1.1.1",
  "1.2.0",
  "1.2.1",
  "1.2.2",
  "1.2.3",
  "1.2.4",
  "1.2.5",
  "1.2.6",
  "1.2.7",
  "1.2.8",
  "1.3.0",
  "1.3.1",
  "1.3.2",
  "1.3.3",
  "1.3.4",
  "1.3.5",
  "1.3.6",
  "1.3.7",
  "1.3.8",
  "1.3.9",
  "1.3.10",
  "1.3.11",
  "1.3.12",
  "1.3.13",
  "1.3.14",
  "1.3.15",
  "1.3.16",
  "1.3.17",
  "1.3.18",
  "1.3.19",
  "1.3.20",
  "1.3.21",
  "1.3.22",
  "1.3.23",
  "1.3.24",
  "1.3.25",
  "1.3.26",
  "1.3.27",
  "1.3.28",
  "1.3.29",
  "1.3.30",
  "1.3.31",
  "1.3.32",
  "1.3.33",
  "1.3.34",
  "1.3.35",
  "1.3.36",
  "1.3.37",
  "1.3.38",
];

const MARKER_STORAGE_FIELDS = [
  "id",
  "name",
  "category",
  "type",
  "status",
  "confidence",
  "state",
  "stateAuto",
  "stateOverride",
  "worldPosition",
  "uses",
  "notes",
  ...ITEM_DISCOVERY_FIELDS.map((field) => field.id),
  "dangerRadius",
  "fields",
  "templateData",
  "x",
  "y",
  "createdAt",
  "modifiedAt",
];

const DUPLICATED_TEMPLATE_FIELDS_BY_CATEGORY = {
  mining: ["primaryOutput", "excludedDrops"],
  herbs: ["herbName", "herbSpecies", "herbSubcategory"],
  fishing: ["fishSpecies"],
  trees: ["treeType"],
  npcs: ["profession"],
  "crafting-benches": ["benchType"],
  camps: ["campType"],
};

const TYPE_MIGRATION_FIELDS_BY_CATEGORY = {
  mining: ["primaryOutput"],
  fishing: ["fishSpecies"],
  trees: ["treeType"],
  npcs: ["profession"],
  "crafting-benches": ["benchType"],
  camps: ["campType"],
};

const GENERIC_TYPE_IDS_BY_CATEGORY = {
  npcs: ["npc"],
  "crafting-benches": ["general-bench"],
  camps: ["camp"],
};

const TYPE_ID_ALIASES = {
  "gold-flakes": "gold",
  "gatherable-saplings": "tree",
};


async function saveMarkers(markerData) {
  if (isFirebaseStorageAvailable()) {
    const firebaseSaved = await saveMarkersToFirebase(markerData);

    if (firebaseSaved) {
      saveMarkersToLocalStorage(markerData);
      return {
        ok: true,
        markerCount: sanitizeMarkers(markerData).length,
      };
    }
  }

  return saveMarkersToLocalStorage(markerData);
}

async function saveMarker(markerData, markerCollectionData) {
  if (isFirebaseStorageAvailable()) {
    const firebaseSaved = await saveMarkerToFirebase(markerData);

    if (firebaseSaved) {
      saveMarkersToLocalStorage(markerCollectionData);
      return {
        ok: true,
        markerCount: sanitizeMarkers(markerCollectionData).length,
      };
    }
  }

  return saveMarkersToLocalStorage(markerCollectionData);
}

async function deleteStoredMarker(markerId, markerCollectionData) {
  if (isFirebaseStorageAvailable()) {
    const firebaseDeleted = await deleteMarkerFromFirebase(markerId);

    if (firebaseDeleted) {
      saveMarkersToLocalStorage(markerCollectionData);
      return {
        ok: true,
        markerCount: sanitizeMarkers(markerCollectionData).length,
      };
    }
  }

  return saveMarkersToLocalStorage(markerCollectionData);
}

async function loadMarkers() {
  const firebaseReady = await initializeFirebaseStorage();

  if (firebaseReady) {
    const firebaseMarkers = await loadMarkersFromFirebase();

    if (firebaseMarkers) {
      saveMarkersToLocalStorage(firebaseMarkers);
      subscribeToFirebaseMarkers(applyRemoteMarkers);
      updateDataSourceStatus("Firebase Connected");
      return sanitizeMarkers(firebaseMarkers);
    }
  }

  updateDataSourceStatus(
    firebaseReady ? "Firebase Offline" : "Local Browser Storage"
  );
  return loadMarkersFromLocalStorage();
}

function saveMarkersToLocalStorage(markerData) {
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

function loadMarkersFromLocalStorage() {
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

function updateDataSourceStatus(statusText) {
  const dataSourceStatus = document.getElementById("data-source-status");

  if (dataSourceStatus) {
    dataSourceStatus.textContent = statusText;
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
  const calculatedState = getStateIdForCoordinates(x, y);
  const savedState = markerData.state || "";
  const savedStateAuto = markerData.stateAuto || calculatedState;
  const hasStateOverride = Object.prototype.hasOwnProperty.call(
    markerData,
    "stateOverride"
  );

  storedMarker.stateAuto = savedStateAuto;
  storedMarker.stateOverride = hasStateOverride
    ? Boolean(markerData.stateOverride)
    : Boolean(savedState && savedState !== savedStateAuto);
  storedMarker.state = storedMarker.stateOverride
    ? savedState || savedStateAuto
    : savedStateAuto;
  const hasWorldPosition = Object.prototype.hasOwnProperty.call(
    markerData,
    "worldPosition"
  );

  if (hasWorldPosition && markerData.worldPosition !== "") {
    const normalizedWorldPosition = normalizeWorldPosition(
      markerData.worldPosition
    );

    if (!normalizedWorldPosition) {
      return null;
    }

    storedMarker.worldPosition = normalizedWorldPosition;
  } else {
    delete storedMarker.worldPosition;
  }

  storedMarker.uses = normalizeUses(
    markerData.uses ||
      (markerData.templateData && markerData.templateData.uses) ||
      (markerData.fields && markerData.fields.uses)
  );
  storedMarker.notes = markerData.notes || "";
  ITEM_DISCOVERY_FIELDS.forEach((field) => {
    storedMarker[field.id] = markerData[field.id] || "";
  });
  storedMarker.dangerRadius = getDangerRadiusValue(
    storedMarker.category,
    markerData.dangerRadius
  );
  storedMarker.fields =
    markerData.fields && typeof markerData.fields === "object"
      ? { ...markerData.fields }
      : {};
  storedMarker.templateData =
    markerData.templateData && typeof markerData.templateData === "object"
      ? { ...markerData.templateData }
      : { ...storedMarker.fields };
  storedMarker.x = x;
  storedMarker.y = y;

  migrateMarkerTemplateData(storedMarker);
  migrateMarkerUses(storedMarker, markerData);

  return storedMarker;
}

function migrateMarkerUses(storedMarker, sourceMarker) {
  if (storedMarker.uses.length > 0) {
    return;
  }

  const legacySubcategory =
    sourceMarker.herbSubcategory ||
    (sourceMarker.templateData && sourceMarker.templateData.herbSubcategory) ||
    (sourceMarker.fields && sourceMarker.fields.herbSubcategory) ||
    "";
  const migratedUse = getUseFromLegacyHerbSubcategory(legacySubcategory);

  storedMarker.uses = migratedUse ? [migratedUse] : [];
}

function getUseFromLegacyHerbSubcategory(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const legacyUseMap = {
    "food-seasoning": "Cooking",
    food: "Cooking",
    seasoning: "Cooking",
    medicinal: "Medicine",
    medicine: "Medicine",
    unknown: "Research Needed",
  };

  return legacyUseMap[normalizedValue] || "";
}

function migrateMarkerTemplateData(markerData) {
  markerData.type = getMigratedTypeId(markerData.type);
  migrateTypeFromTemplateData(markerData);

  removeDuplicatedTemplateFields(markerData.category, markerData.fields);
  removeDuplicatedTemplateFields(markerData.category, markerData.templateData);
}

function migrateTypeFromTemplateData(markerData) {
  const genericTypeIds = GENERIC_TYPE_IDS_BY_CATEGORY[markerData.category] || [];

  if (genericTypeIds.length > 0 && !genericTypeIds.includes(markerData.type)) {
    return;
  }

  const migrationFields =
    TYPE_MIGRATION_FIELDS_BY_CATEGORY[markerData.category] || [];
  const templateSources = [markerData.templateData, markerData.fields];

  for (const source of templateSources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    for (const fieldId of migrationFields) {
      const migratedTypeId = getMigratedTypeId(source[fieldId]);

      if (migratedTypeId) {
        markerData.type = migratedTypeId;
        return;
      }
    }
  }
}

function getMigratedTypeId(value) {
  const typeId = slugifyTypeValue(value);

  if (!typeId) {
    return "";
  }

  return TYPE_ID_ALIASES[typeId] || typeId;
}

function slugifyTypeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function removeDuplicatedTemplateFields(categoryId, templateValues) {
  if (!templateValues || typeof templateValues !== "object") {
    return;
  }

  (DUPLICATED_TEMPLATE_FIELDS_BY_CATEGORY[categoryId] || []).forEach(
    (fieldId) => {
      delete templateValues[fieldId];
    }
  );
}

function getDangerRadiusValue(categoryId, value) {
  if (categoryId !== "dangerous-animals") {
    return "";
  }

  const radius = Number(value);

  if (!Number.isFinite(radius) || radius <= 0) {
    return DEFAULT_DANGER_RADIUS;
  }

  return radius;
}

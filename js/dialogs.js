/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let pendingMarkerLatLng = null;
let markerNameManuallyEdited = false;
const ADD_MARKER_PREFS_STORAGE_KEY = "rosalitarp-explorer-add-marker-prefs";

function initializeDialogs() {
  initializeMarkerDialogControls();

  document
    .getElementById("marker-dialog-close")
    .addEventListener("click", closeMarkerDialog);

  document
    .getElementById("marker-cancel")
    .addEventListener("click", closeMarkerDialog);

  document
    .getElementById("marker-form")
    .addEventListener("submit", saveMarkerFromDialog);
}

async function initializeMarkerDialogControls() {
  const categorySelect = document.getElementById("marker-category");
  const typeSelect = document.getElementById("marker-type");
  const nameInput = document.getElementById("marker-name");

  await buildCategoryDropdown("marker-category");

  if (CATEGORIES.length > 0) {
    await buildTypeDropdown("marker-type", categorySelect.value);
    updateTypeIconPreview(
      "marker-type-icon",
      categorySelect.value,
      typeSelect.value
    );
    renderTemplateFields("marker-template-fields", categorySelect.value);
  }

  categorySelect.addEventListener("change", async function () {
    await buildTypeDropdown("marker-type", this.value);
    updateTypeIconPreview(
      "marker-type-icon",
      this.value,
      document.getElementById("marker-type").value
    );
    renderTemplateFields("marker-template-fields", this.value);
    autoFillMarkerName();
  });

  typeSelect.addEventListener("change", function () {
    updateTypeIconPreview(
      "marker-type-icon",
      document.getElementById("marker-category").value,
      this.value
    );
    autoFillMarkerName();
  });

  nameInput.addEventListener("input", function () {
    markerNameManuallyEdited = this.value.trim().length > 0;
  });

  document
    .getElementById("marker-state")
    .addEventListener("change", updateMarkerDialogStateHelper);
}

async function openMarkerDialog(latlng) {
  pendingMarkerLatLng = latlng;
  markerNameManuallyEdited = false;

  const x = Math.round(latlng.lng);
  const y = Math.round(latlng.lat);

  document.getElementById("marker-form").reset();
  applyLastUsedMarkerDefaults();
  populateItemDiscoveryFields("marker");
  document.getElementById("marker-found-date").value = getLocalDateInputValue();

  await buildCategoryDropdown("marker-category");

  if (CATEGORIES.length > 0) {
    const categoryId = document.getElementById("marker-category").value;
    await buildTypeDropdown("marker-type", categoryId);
    updateTypeIconPreview(
      "marker-type-icon",
      categoryId,
      document.getElementById("marker-type").value
    );
    renderTemplateFields("marker-template-fields", categoryId);
  }

  autoFillMarkerName();

  document.getElementById("marker-x").value = x;
  document.getElementById("marker-y").value = y;
  document.getElementById("marker-x-display").textContent = x;
  document.getElementById("marker-y-display").textContent = y;
  buildStateDropdown("marker-state", getStateIdForCoordinates(x, y));
  updateMarkerDialogStateHelper();

  document.getElementById("marker-dialog").classList.remove("hidden");
  focusFirstTemplateField("marker-template-fields");
}

function focusFirstTemplateField(containerId) {
  const firstField = document.querySelector(
    `#${containerId} input, #${containerId} select, #${containerId} textarea`
  );

  if (firstField) {
    firstField.focus();
  }
}

function autoFillMarkerName() {
  if (markerNameManuallyEdited) {
    return;
  }

  const categoryId = document.getElementById("marker-category").value;
  const typeId = document.getElementById("marker-type").value;
  const typeName = getSelectedTypeName(categoryId, typeId);

  document.getElementById("marker-name").value = typeName;
}

function closeMarkerDialog() {
  pendingMarkerLatLng = null;
  markerNameManuallyEdited = false;
  document.getElementById("marker-dialog").classList.add("hidden");
  clearAddMarkerMode();
}

function applyLastUsedMarkerDefaults() {
  const prefs = loadAddMarkerPreferences();
  document.getElementById("marker-status").value =
    prefs.status || "unverified";
  document.getElementById("marker-confidence").value =
    prefs.confidence || "guess";
}

function saveLastUsedMarkerDefaults(status, confidence) {
  try {
    localStorage.setItem(
      ADD_MARKER_PREFS_STORAGE_KEY,
      JSON.stringify({ status, confidence })
    );
  } catch (error) {
    console.warn("Add Marker preferences could not be saved.", error);
  }
}

function loadAddMarkerPreferences() {
  try {
    const storedValue = localStorage.getItem(ADD_MARKER_PREFS_STORAGE_KEY);
    const prefs = storedValue ? JSON.parse(storedValue) : {};

    if (!prefs || typeof prefs !== "object") {
      return {};
    }

    return {
      status: isValidMarkerStatus(prefs.status) ? prefs.status : "",
      confidence: isValidMarkerConfidence(prefs.confidence)
        ? prefs.confidence
        : "",
    };
  } catch (error) {
    console.warn("Add Marker preferences could not be loaded.", error);
    return {};
  }
}

function isValidMarkerStatus(value) {
  return ["unverified", "verified", "invalid"].includes(value);
}

function isValidMarkerConfidence(value) {
  return ["guess", "approximate", "exact"].includes(value);
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateMarkerDialogStateHelper() {
  const stateSelect = document.getElementById("marker-state");
  const stateHelper = document.getElementById("marker-state-helper");

  if (!stateSelect || !stateHelper) {
    return;
  }

  const x = Number(document.getElementById("marker-x").value);
  const y = Number(document.getElementById("marker-y").value);
  const stateAuto = getStateIdForCoordinates(x, y);
  const selectedState = stateSelect.value;

  if (selectedState && selectedState !== stateAuto) {
    stateHelper.textContent = `Auto-detected: ${getStateName(stateAuto) || "Unknown"}`;
    stateHelper.classList.remove("hidden");
  } else {
    stateHelper.textContent = "";
    stateHelper.classList.add("hidden");
  }
}

function saveMarkerFromDialog(event) {
  event.preventDefault();
  const categoryId = document.getElementById("marker-category").value;
  const templateValues = collectTemplateFieldValues(
    "marker-template-fields",
    categoryId
  );

  const markerData = {
    id: crypto.randomUUID(),
    name: document.getElementById("marker-name").value.trim(),
    category: categoryId,
    type: document.getElementById("marker-type").value,
    status: document.getElementById("marker-status").value,
    confidence: document.getElementById("marker-confidence").value,
    uses: normalizeUses(templateValues.shared.uses),
    notes: templateValues.shared.notes || "",
    ...collectItemDiscoveryValues("marker"),
    fields: templateValues.templateData,
    templateData: templateValues.templateData,
    dangerRadius: getDangerRadiusValue(
      categoryId,
      templateValues.shared.dangerRadius
    ),
    x: Number(document.getElementById("marker-x").value),
    y: Number(document.getElementById("marker-y").value),
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  markerData.stateAuto = getStateIdForCoordinates(markerData.x, markerData.y);
  markerData.state = document.getElementById("marker-state").value;
  markerData.stateOverride =
    markerData.state !== "" && markerData.state !== markerData.stateAuto;

  saveLastUsedMarkerDefaults(markerData.status, markerData.confidence);
  addMarker(markerData);
  closeMarkerDialog();
}

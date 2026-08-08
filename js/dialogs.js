/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let pendingMarkerLatLng = null;
let pendingMarkerOriginalLatLng = null;
let pendingMarkerPreview = null;
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
    renderPendingMarkerPreview();
  });

  typeSelect.addEventListener("change", function () {
    updateTypeIconPreview(
      "marker-type-icon",
      document.getElementById("marker-category").value,
      this.value
    );
    autoFillMarkerName();
    renderPendingMarkerPreview();
  });

  nameInput.addEventListener("input", function () {
    markerNameManuallyEdited = this.value.trim().length > 0;
  });

  document
    .getElementById("marker-state")
    .addEventListener("change", updateMarkerDialogStateHelper);

  document
    .getElementById("marker-game-vector")
    .addEventListener("input", function () {
      validateGameVectorField("marker-game-vector", "marker-game-vector-error");
    });

  document
    .getElementById("marker-game-vector")
    .addEventListener("blur", calculatePendingMarkerFromGameVector);

  document
    .getElementById("marker-game-vector")
    .addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        calculatePendingMarkerFromGameVector();
      }
    });

  document
    .getElementById("marker-paste-calculate")
    .addEventListener("click", pasteAndCalculatePendingMarker);

  document
    .getElementById("marker-use-current-position")
    .addEventListener("click", useCurrentPendingMapPosition);
}

async function openMarkerDialog(latlng, prefill = null) {
  pendingMarkerLatLng = latlng;
  pendingMarkerOriginalLatLng = latlng;
  markerNameManuallyEdited = false;

  const x = latlng.lng;
  const y = latlng.lat;

  document.getElementById("marker-form").reset();
  setCandidatePromotionWarning("");
  applyLastUsedMarkerDefaults();
  populateItemDiscoveryFields("marker");
  applyLastUsedFoundByDefault();
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

  setPendingMarkerMapCoordinates(x, y, {
    updatePreview: false,
    updateCalculatedPosition: false,
  });
  document.getElementById("marker-game-vector").value = "";
  validateGameVectorField("marker-game-vector", "marker-game-vector-error");
  clearGameVectorMessage();
  hideCalculatedPosition();
  buildStateDropdown("marker-state", getStateIdForCoordinates(x, y));
  updateMarkerDialogStateHelper();

  if (prefill) {
    await applyMarkerDialogPrefill(prefill);
  } else {
    autoFillMarkerName();
  }

  renderPendingMarkerPreview();

  document.getElementById("marker-dialog").classList.remove("hidden");
  focusFirstTemplateField("marker-template-fields");
}

async function applyMarkerDialogPrefill(prefill) {
  const categorySelect = document.getElementById("marker-category");
  const typeSelect = document.getElementById("marker-type");
  const nameInput = document.getElementById("marker-name");
  const categoryId = prefill.category || categorySelect.value;

  categorySelect.value = categoryId;
  await buildTypeDropdown("marker-type", categoryId, prefill.type);

  if (prefill.type) {
    typeSelect.value = prefill.type;
  }

  updateTypeIconPreview("marker-type-icon", categoryId, typeSelect.value);
  renderTemplateFields("marker-template-fields", categoryId, {
    notes: prefill.notes || "",
    fields: {},
    templateData: {},
  });

  if (prefill.name) {
    nameInput.value = prefill.name;
    markerNameManuallyEdited = true;
  } else {
    markerNameManuallyEdited = false;
    autoFillMarkerName();
  }

  if (isValidMarkerStatus(prefill.status)) {
    document.getElementById("marker-status").value = prefill.status;
  }

  if (isValidMarkerConfidence(prefill.confidence)) {
    document.getElementById("marker-confidence").value = prefill.confidence;
  }

  const itemNotesInput = document.getElementById("marker-item-notes");

  if (itemNotesInput && prefill.itemNotes) {
    itemNotesInput.value = prefill.itemNotes;
  }

  setCandidatePromotionWarning(prefill.candidateReviewWarning || "");

  if (Number.isFinite(Number(prefill.x)) && Number.isFinite(Number(prefill.y))) {
    setPendingMarkerMapCoordinates(Number(prefill.x), Number(prefill.y), {
      updatePreview: false,
      updateCalculatedPosition: false,
    });
  }
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
  pendingMarkerOriginalLatLng = null;
  markerNameManuallyEdited = false;
  setCandidatePromotionWarning("");
  document.getElementById("marker-dialog").classList.add("hidden");
  removePendingMarkerPreview();
  clearAddMarkerMode();
}

function setCandidatePromotionWarning(message) {
  const warning = document.getElementById("marker-candidate-warning");

  if (!warning) {
    return;
  }

  warning.textContent = message || "";
  warning.classList.toggle("hidden", !message);
}

function applyLastUsedMarkerDefaults() {
  const prefs = loadAddMarkerPreferences();
  document.getElementById("marker-status").value =
    prefs.status || "unverified";
  document.getElementById("marker-confidence").value =
    prefs.confidence || "guess";
}

function applyLastUsedFoundByDefault() {
  const prefs = loadAddMarkerPreferences();
  const foundByInput = document.getElementById("marker-found-by");

  if (foundByInput && prefs.foundBy) {
    foundByInput.value = prefs.foundBy;
  }
}

function saveLastUsedMarkerDefaults({ status, confidence, foundBy } = {}) {
  const existingPrefs = loadAddMarkerPreferences();
  const nextPrefs = {
    ...existingPrefs,
  };

  if (isValidMarkerStatus(status)) {
    nextPrefs.status = status;
  }

  if (isValidMarkerConfidence(confidence)) {
    nextPrefs.confidence = confidence;
  }

  if (typeof foundBy === "string" && foundBy.trim()) {
    nextPrefs.foundBy = foundBy.trim();
  }

  try {
    localStorage.setItem(
      ADD_MARKER_PREFS_STORAGE_KEY,
      JSON.stringify(nextPrefs)
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
      foundBy:
        typeof prefs.foundBy === "string" ? prefs.foundBy.trim() : "",
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

function validateGameVectorField(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  if (!input || !error) {
    return true;
  }

  const hasValue = input.value.trim().length > 0;
  const isValid = !hasValue || Boolean(parseGameVector(input.value));

  input.classList.toggle("input-error", !isValid);
  error.classList.toggle("hidden", isValid);

  return isValid;
}

function setPendingMarkerMapCoordinates(
  x,
  y,
  { updatePreview = true, updateCalculatedPosition = true } = {}
) {
  const mapX = Number(x);
  const mapY = Number(y);

  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
    return;
  }

  pendingMarkerLatLng = L.latLng(mapY, mapX);
  document.getElementById("marker-x").value = mapX;
  document.getElementById("marker-y").value = mapY;
  document.getElementById("marker-x-display").textContent =
    formatMapCoordinate(mapX);
  document.getElementById("marker-y-display").textContent =
    formatMapCoordinate(mapY);
  buildStateDropdown("marker-state", getStateIdForCoordinates(mapX, mapY));
  updateMarkerDialogStateHelper();

  if (updateCalculatedPosition) {
    showCalculatedPosition(mapX, mapY);
  }

  if (updatePreview) {
    renderPendingMarkerPreview();
  }
}

function formatMapCoordinate(coordinate) {
  return Number.isInteger(coordinate)
    ? String(coordinate)
    : coordinate.toFixed(2);
}

function renderPendingMarkerPreview() {
  if (!pendingMarkerLatLng) {
    return;
  }

  const markerLatLng = [pendingMarkerLatLng.lat, pendingMarkerLatLng.lng];
  const categoryId = document.getElementById("marker-category").value;
  const typeId = document.getElementById("marker-type").value;
  const group = getTypeGroupForType(categoryId, typeId);
  const iconPath = getTypeGroupIconUrl(group);
  const iconLabel = group ? group.name : "Marker";

  if (!pendingMarkerPreview) {
    pendingMarkerPreview = L.marker(markerLatLng, {
      draggable: true,
      icon: createTypeGroupMarkerIcon(iconPath, iconLabel, true, "unverified"),
    }).addTo(map);

    pendingMarkerPreview.on("dragend", function () {
      const latLng = pendingMarkerPreview.getLatLng();
      setPendingMarkerMapCoordinates(latLng.lng, latLng.lat, {
        updatePreview: false,
        updateCalculatedPosition: false,
      });
      showGameVectorMessage("Using adjusted map position.");
    });
    return;
  }

  pendingMarkerPreview.setLatLng(markerLatLng);
  pendingMarkerPreview.setIcon(
    createTypeGroupMarkerIcon(iconPath, iconLabel, true, "unverified")
  );
}

function removePendingMarkerPreview() {
  if (!pendingMarkerPreview) {
    return;
  }

  pendingMarkerPreview.remove();
  pendingMarkerPreview = null;
}

async function pasteAndCalculatePendingMarker() {
  const input = document.getElementById("marker-game-vector");

  try {
    const clipboardText = await navigator.clipboard.readText();
    input.value = clipboardText;
  } catch (error) {
    showGameVectorMessage(
      "Clipboard access was denied. Paste the vector manually, then press Enter or leave the field.",
      "warning"
    );
    input.focus();
    return;
  }

  calculatePendingMarkerFromGameVector();
}

function calculatePendingMarkerFromGameVector() {
  const worldPositionResult = getWorldPositionFromField(
    "marker-game-vector",
    "marker-game-vector-error"
  );

  if (!worldPositionResult.ok) {
    return;
  }

  if (!worldPositionResult.worldPosition) {
    hideCalculatedPosition();
    clearGameVectorMessage();
    return;
  }

  const mapCoordinates = worldToMapCoordinates(
    worldPositionResult.worldPosition.x,
    worldPositionResult.worldPosition.y
  );

  if (!mapCoordinates) {
    showGameVectorMessage("The vector could not be converted.", "warning");
    return;
  }

  if (!isMapCoordinateInBounds(mapCoordinates.x, mapCoordinates.y)) {
    showCalculatedPosition(mapCoordinates.x, mapCoordinates.y);
    showGameVectorMessage(
      "Calculated position is outside the map bounds; marker was not moved.",
      "warning"
    );
    return;
  }

  setPendingMarkerMapCoordinates(mapCoordinates.x, mapCoordinates.y);
  showGameVectorMessage("Marker moved to calculated position.");
}

function useCurrentPendingMapPosition() {
  const mapX = Number(document.getElementById("marker-x").value);
  const mapY = Number(document.getElementById("marker-y").value);

  if (Number.isFinite(mapX) && Number.isFinite(mapY)) {
    setPendingMarkerMapCoordinates(mapX, mapY, {
      updateCalculatedPosition: false,
    });
  } else if (pendingMarkerOriginalLatLng) {
    setPendingMarkerMapCoordinates(
      pendingMarkerOriginalLatLng.lng,
      pendingMarkerOriginalLatLng.lat,
      { updateCalculatedPosition: false }
    );
  }

  hideCalculatedPosition();
  showGameVectorMessage("Using current map position.");
}

function showCalculatedPosition(x, y) {
  document.getElementById("marker-calculated-x").textContent =
    formatMapCoordinate(x);
  document.getElementById("marker-calculated-y").textContent =
    formatMapCoordinate(y);
  document
    .getElementById("marker-calculated-position")
    .classList.remove("hidden");
}

function hideCalculatedPosition() {
  document.getElementById("marker-calculated-position").classList.add("hidden");
}

function showGameVectorMessage(message, type = "") {
  const messageElement = document.getElementById("marker-game-vector-message");

  messageElement.textContent = message;
  messageElement.classList.toggle("warning", type === "warning");
  messageElement.classList.remove("hidden");
}

function clearGameVectorMessage() {
  const messageElement = document.getElementById("marker-game-vector-message");

  messageElement.textContent = "";
  messageElement.classList.remove("warning");
  messageElement.classList.add("hidden");
}

function getWorldPositionFromField(inputId, errorId) {
  if (!validateGameVectorField(inputId, errorId)) {
    const input = document.getElementById(inputId);

    if (input) {
      input.focus();
    }

    return { ok: false, worldPosition: null };
  }

  const input = document.getElementById(inputId);
  const value = input ? input.value.trim() : "";

  return {
    ok: true,
    worldPosition: value ? parseGameVector(value) : null,
  };
}

function saveMarkerFromDialog(event) {
  event.preventDefault();
  const categoryId = document.getElementById("marker-category").value;
  const templateValues = collectTemplateFieldValues(
    "marker-template-fields",
    categoryId
  );
  const worldPositionResult = getWorldPositionFromField(
    "marker-game-vector",
    "marker-game-vector-error"
  );

  if (!worldPositionResult.ok) {
    return;
  }

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

  if (worldPositionResult.worldPosition) {
    markerData.worldPosition = worldPositionResult.worldPosition;
  }

  markerData.stateAuto = getStateIdForCoordinates(markerData.x, markerData.y);
  markerData.state = document.getElementById("marker-state").value;
  markerData.stateOverride =
    markerData.state !== "" && markerData.state !== markerData.stateAuto;

  saveLastUsedMarkerDefaults({
    status: markerData.status,
    confidence: markerData.confidence,
    foundBy: markerData.foundBy,
  });
  addMarker(markerData);
  if (typeof handleCandidatePromotedMarkerSaved === "function") {
    handleCandidatePromotedMarkerSaved(markerData);
  }
  closeMarkerDialog();
}

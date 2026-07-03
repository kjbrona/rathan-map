/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let pendingMarkerLatLng = null;
let markerNameManuallyEdited = false;

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
}

async function openMarkerDialog(latlng) {
  pendingMarkerLatLng = latlng;
  markerNameManuallyEdited = false;

  const x = Math.round(latlng.lng);
  const y = Math.round(latlng.lat);

  document.getElementById("marker-form").reset();
  document.getElementById("marker-status").value = "unverified";
  document.getElementById("marker-confidence").value = "guess";
  populateItemDiscoveryFields("marker");

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

  addMarker(markerData);
  closeMarkerDialog();
}

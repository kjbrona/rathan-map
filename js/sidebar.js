/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

const expandedCategoryFilters = new Set();

function initializeSidebar() {
  document.getElementById("app-title").textContent = APP_NAME;
  document.getElementById("app-subtitle").textContent = APP_SUBTITLE;
  document.getElementById("app-version").textContent = APP_VERSION;
  document.getElementById("app-creator").textContent = APP_CREATOR;

  renderCategoryList();
  initializeFilterControls();
  initializeStateFilterControl();
  initializeMarkerDetailsPanel();
  initializeSearch();

  const addMarkerButton = document.getElementById("add-marker-btn");

  addMarkerButton.addEventListener("click", () => {
    currentMode = MODES.ADD_MARKER;
    addMarkerButton.classList.add("active");
  });

  initializeMarkerBackupControls();
  updateMarkerStats();
}

function initializeFilterControls() {
  document
    .getElementById("filters-all-on")
    .addEventListener("click", function () {
      setAllFilters(true);
      renderCategoryList();
    });

  document
    .getElementById("filters-all-off")
    .addEventListener("click", function () {
      setAllFilters(false);
      renderCategoryList();
    });
}

function initializeStateFilterControl() {
  buildStateFilterDropdown("state-filter", getStateFilter());

  const stateFilter = document.getElementById("state-filter");

  if (!stateFilter) {
    return;
  }

  stateFilter.addEventListener("change", function () {
    setStateFilter(this.value);
  });
}

function initializeMarkerBackupControls() {
  document
    .getElementById("export-markers-btn")
    .addEventListener("click", exportMarkersToFile);

  document
    .getElementById("import-markers-btn")
    .addEventListener("click", function () {
      document.getElementById("import-markers-file").click();
    });

  document
    .getElementById("import-markers-file")
    .addEventListener("change", importMarkersFromFile);
}

function exportMarkersToFile() {
  const exportText = stringifyMarkerExport(getMarkersForExport());
  const fileBlob = new Blob([exportText], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(fileBlob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = getMarkerExportFilename();
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);

  updateMarkerStats();
}

async function importMarkersFromFile(event) {
  const fileInput = event.target;
  const selectedFile = fileInput.files[0];

  if (!selectedFile) {
    return;
  }

  try {
    const importResult = parseMarkerImportFile(await selectedFile.text());

    if (!importResult.ok) {
      alert(importResult.message);
      return;
    }

    const importMode = await requestImportMode();

    if (!importMode) {
      return;
    }

    const importSummary =
      importMode === "replace"
        ? await replaceMarkers(importResult.markers)
        : await mergeMarkers(importResult.markers);

    alert(
      `Imported ${importSummary.imported} marker(s).` +
        (importSummary.skipped
          ? ` Skipped ${importSummary.skipped} duplicate marker(s).`
          : "")
    );
    renderCategoryList();
    updateMarkerStats();
  } catch (error) {
    console.warn("Marker import failed.", error);
    alert("The selected marker file could not be imported.");
  } finally {
    fileInput.value = "";
  }
}

function requestImportMode() {
  const dialog = document.getElementById("import-mode-dialog");
  const form = document.getElementById("import-mode-form");
  const closeButton = document.getElementById("import-mode-close");
  const cancelButton = document.getElementById("import-mode-cancel");

  dialog.classList.remove("hidden");

  return new Promise((resolve) => {
    function closeDialog(importMode = null) {
      dialog.classList.add("hidden");
      form.removeEventListener("submit", handleSubmit);
      closeButton.removeEventListener("click", handleCancel);
      cancelButton.removeEventListener("click", handleCancel);
      resolve(importMode);
    }

    function handleSubmit(event) {
      event.preventDefault();

      const selectedMode = form.querySelector(
        "input[name='import-mode']:checked"
      );

      closeDialog(selectedMode ? selectedMode.value : null);
    }

    function handleCancel() {
      closeDialog(null);
    }

    form.addEventListener("submit", handleSubmit);
    closeButton.addEventListener("click", handleCancel);
    cancelButton.addEventListener("click", handleCancel);
  });
}

function renderCategoryList() {
  const list = document.getElementById("category-list");
  list.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const types = TYPE_DATA[category.id] || [];
    const isExpanded = expandedCategoryFilters.has(category.id);

    list.appendChild(createCategoryFilter(category, types, isExpanded));
  });
}

function createCategoryFilter(category, types, isExpanded) {
  const categoryItem = document.createElement("div");
  categoryItem.className = "category-filter";

  const categoryRow = document.createElement("div");
  categoryRow.className = "category-filter-row";

  const categoryState = getCategoryFilterState(category.id);
  const categoryCheckbox = createCheckbox({
    className: "category-checkbox",
    checked: categoryState.checked,
    indeterminate: categoryState.indeterminate,
    onChange: (checked) => {
      setCategoryAndTypeFilters(category.id, checked);
      renderCategoryList();
    },
  });

  const categoryToggle = document.createElement("button");
  categoryToggle.type = "button";
  categoryToggle.className = "category-filter-toggle";
  categoryToggle.setAttribute("aria-expanded", String(isExpanded));
  categoryToggle.textContent = `${isExpanded ? "v" : ">"} ${category.name}`;

  categoryRow.appendChild(categoryCheckbox);
  categoryRow.appendChild(categoryToggle);
  categoryItem.appendChild(categoryRow);

  const typeList = document.createElement("div");
  typeList.className = isExpanded
    ? "type-filter-list"
    : "type-filter-list hidden";

  types.forEach((type) => {
    typeList.appendChild(createTypeFilter(category.id, type));
  });

  categoryToggle.addEventListener("click", function () {
    toggleCategoryExpansion(category.id, categoryToggle, typeList, category);
  });

  categoryItem.appendChild(typeList);

  return categoryItem;
}

function createTypeFilter(categoryId, type) {
  const typeLabel = document.createElement("label");
  typeLabel.className = "type-filter-label";

  const typeCheckbox = createCheckbox({
    checked: isTypeFilterActive(categoryId, type.id),
    onChange: (checked) => {
      setTypeFilter(categoryId, type.id, checked);
      renderCategoryList();
    },
  });

  const typeName = document.createElement("span");
  typeName.textContent = type.name;

  typeLabel.appendChild(typeCheckbox);
  typeLabel.insertAdjacentHTML(
    "beforeend",
    createTypeGroupIconHtml(categoryId, type.id, "type-filter-icon")
  );
  typeLabel.appendChild(typeName);

  return typeLabel;
}

function createCheckbox({ className = "", checked, indeterminate, onChange }) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = className;
  checkbox.checked = checked;
  checkbox.indeterminate = Boolean(indeterminate);

  checkbox.addEventListener("change", function () {
    onChange(this.checked);
  });

  return checkbox;
}

function toggleCategoryExpansion(categoryId, toggle, typeList, category) {
  const isExpanded = expandedCategoryFilters.has(categoryId);

  if (isExpanded) {
    expandedCategoryFilters.delete(categoryId);
    typeList.classList.add("hidden");
  } else {
    expandedCategoryFilters.add(categoryId);
    typeList.classList.remove("hidden");
  }

  const nextExpanded = !isExpanded;
  toggle.setAttribute("aria-expanded", String(nextExpanded));
  toggle.textContent = `${nextExpanded ? "v" : ">"} ${category.name}`;
}

function clearAddMarkerMode() {
  currentMode = MODES.BROWSE;

  const addMarkerButton = document.getElementById("add-marker-btn");
  addMarkerButton.classList.remove("active");
}

async function initializeMarkerDetailsPanel() {
  await buildCategoryDropdown("edit-marker-category");

  const initialCategory = document.getElementById("edit-marker-category").value;
  await buildTypeDropdown("edit-marker-type", initialCategory);
  updateTypeIconPreview(
    "edit-marker-type-icon",
    initialCategory,
    document.getElementById("edit-marker-type").value
  );

  document
    .getElementById("edit-marker-category")
    .addEventListener("change", async function () {
      await buildTypeDropdown("edit-marker-type", this.value);
      updateTypeIconPreview(
        "edit-marker-type-icon",
        this.value,
        document.getElementById("edit-marker-type").value
      );
      renderTemplateFields("edit-marker-template-fields", this.value, {
        notes: "",
        dangerRadius: DEFAULT_DANGER_RADIUS,
        fields: {},
        templateData: {},
      });
    });

  document
    .getElementById("edit-marker-type")
    .addEventListener("change", function () {
      updateTypeIconPreview(
        "edit-marker-type-icon",
        document.getElementById("edit-marker-category").value,
        this.value
      );
    });

  document
    .getElementById("edit-marker-state")
    .addEventListener("change", updateEditMarkerStateHelper);

  document
    .getElementById("marker-details-form")
    .addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!selectedMarkerId) {
        return;
      }

      const categoryId = document.getElementById("edit-marker-category").value;
      const existingMarker = getMarkerById(selectedMarkerId);

      if (!existingMarker) {
        return;
      }

      const templateValues = collectTemplateFieldValues(
        "edit-marker-template-fields",
        categoryId
      );
      const hasTemplateNotes = Object.prototype.hasOwnProperty.call(
        templateValues.shared,
        "notes"
      );
      const stateAuto = getStateIdForCoordinates(
        existingMarker.x,
        existingMarker.y
      );
      const selectedState = document.getElementById("edit-marker-state").value;

      await updateMarker(selectedMarkerId, {
        name: document.getElementById("edit-marker-name").value.trim(),
        category: categoryId,
        type: document.getElementById("edit-marker-type").value,
        status: document.getElementById("edit-marker-status").value,
        confidence: document.getElementById("edit-marker-confidence").value,
        state: selectedState,
        stateAuto,
        stateOverride: selectedState !== "" && selectedState !== stateAuto,
        notes: hasTemplateNotes
          ? templateValues.shared.notes
          : (existingMarker && existingMarker.notes) || "",
        ...collectItemDiscoveryValues("edit-marker"),
        fields: templateValues.templateData,
        templateData: templateValues.templateData,
        dangerRadius: getDangerRadiusValue(
          categoryId,
          templateValues.shared.dangerRadius,
          existingMarker
        ),
      });
    });

  document
    .getElementById("edit-marker-delete")
    .addEventListener("click", async function () {
      if (!selectedMarkerId) {
        return;
      }

      if (confirm("Delete this marker?")) {
        await deleteMarker(selectedMarkerId);
      }
    });

  document
    .getElementById("edit-marker-move")
    .addEventListener("click", enterMoveMarkerMode);

  document
    .getElementById("edit-marker-cancel-move")
    .addEventListener("click", cancelMoveMarkerMode);
}

async function renderMarkerDetails(markerData) {
  const detailsSection = document.getElementById("marker-details-section");
  const empty = document.getElementById("marker-details-empty");
  const form = document.getElementById("marker-details-form");

  if (!markerData) {
    cancelMoveMarkerMode();
    detailsSection.classList.add("no-marker-selected");
    empty.style.display = "block";
    form.classList.add("hidden");
    return;
  }

  detailsSection.classList.remove("no-marker-selected");
  empty.style.display = "none";
  form.classList.remove("hidden");

  document.getElementById("edit-marker-name").value = markerData.name;
  document.getElementById("edit-marker-status").value =
    markerData.status || "unverified";
  document.getElementById("edit-marker-confidence").value =
    markerData.confidence || "guess";
  populateItemDiscoveryFields("edit-marker", markerData);

  const itemDiscoverySection = document.getElementById(
    "edit-item-discovery-section"
  );

  if (itemDiscoverySection) {
    itemDiscoverySection.open = markerHasItemDiscoveryData(markerData);
  }

  await buildCategoryDropdown("edit-marker-category", markerData.category);
  await buildTypeDropdown(
    "edit-marker-type",
    markerData.category,
    markerData.type
  );
  updateTypeIconPreview(
    "edit-marker-type-icon",
    markerData.category,
    document.getElementById("edit-marker-type").value
  );

  renderTemplateFields(
    "edit-marker-template-fields",
    markerData.category,
    markerData
  );
  document.getElementById("edit-marker-x-display").textContent = markerData.x;
  document.getElementById("edit-marker-y-display").textContent = markerData.y;
  buildStateDropdown("edit-marker-state", markerData.state);
  updateEditMarkerStateHelper();
}

function updateEditMarkerStateHelper() {
  const stateSelect = document.getElementById("edit-marker-state");
  const stateHelper = document.getElementById("edit-marker-state-helper");

  if (!stateSelect || !stateHelper || !selectedMarkerId) {
    return;
  }

  const markerData = getMarkerById(selectedMarkerId);

  if (!markerData) {
    stateHelper.textContent = "";
    stateHelper.classList.add("hidden");
    return;
  }

  const stateAuto = getStateIdForCoordinates(markerData.x, markerData.y);
  const selectedState = stateSelect.value;

  if (selectedState && selectedState !== stateAuto) {
    stateHelper.textContent = `Auto-detected: ${getStateName(stateAuto) || "Unknown"}`;
    stateHelper.classList.remove("hidden");
  } else {
    stateHelper.textContent = "";
    stateHelper.classList.add("hidden");
  }
}

function enterMoveMarkerMode() {
  if (!getSelectedMarkerId()) {
    return;
  }

  currentMode = MODES.MOVE_MARKER;
  updateMoveMarkerModeUI();
}

function cancelMoveMarkerMode() {
  if (currentMode === MODES.MOVE_MARKER) {
    currentMode = MODES.BROWSE;
  }

  updateMoveMarkerModeUI();
}

function updateMoveMarkerModeUI() {
  const detailsSection = document.getElementById("marker-details-section");
  const moveButton = document.getElementById("edit-marker-move");
  const cancelButton = document.getElementById("edit-marker-cancel-move");
  const isMoving = currentMode === MODES.MOVE_MARKER;

  if (!detailsSection || !moveButton || !cancelButton) {
    return;
  }

  detailsSection.classList.toggle("move-marker-active", isMoving);
  document.body.classList.toggle("move-marker-mode", isMoving);
  moveButton.classList.toggle("active", isMoving);
  cancelButton.classList.toggle("hidden", !isMoving);
  moveButton.textContent = isMoving ? "Click Map To Move" : "Move Marker";
}

function updateMarkerStats() {
  const total = document.getElementById("marker-count-total");

  if (total) {
    total.textContent = markers.length;
  }

  const visible = document.getElementById("marker-count-visible");

  if (visible) {
    visible.textContent = getVisibleMarkerCount();
  }
}

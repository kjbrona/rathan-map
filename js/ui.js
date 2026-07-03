/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

async function buildCategoryDropdown(selectId, selectedCategoryId = null) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;

    if (selectedCategoryId && category.id === selectedCategoryId) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  return select.value;
}

async function buildTypeDropdown(selectId, categoryId, selectedTypeId = null) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";

  const types = await loadTypesForCategory(categoryId);

  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;

    if (selectedTypeId && type.id === selectedTypeId) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  return select.value;
}

function updateTypeIconPreview(previewId, categoryId, typeId) {
  const preview = document.getElementById(previewId);

  if (!preview) {
    return;
  }

  const group = getTypeGroupForType(categoryId, typeId);

  if (!group) {
    preview.innerHTML = "";
    preview.title = "";
    return;
  }

  preview.innerHTML = createTypeGroupIconHtml(
    categoryId,
    typeId,
    "type-icon-preview-image"
  );
  preview.title = group.name;
}

function getSelectedTypeName(categoryId, typeId) {
  const type = getTypeById(categoryId, typeId);
  return type ? type.name : "";
}

function renderTemplateFields(containerId, categoryId, markerData = {}) {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  container.innerHTML = "";

  getTemplateFields(categoryId).forEach((field) => {
    container.appendChild(createTemplateFieldControl(field, markerData));
  });
}

function createTemplateFieldControl(field, markerData) {
  const label = document.createElement("label");
  const inputId = `template-field-${field.id}-${crypto.randomUUID()}`;
  const value = getMarkerTemplateFieldValue(markerData, field);
  const control =
    field.type === "textarea"
      ? document.createElement("textarea")
      : field.type === "select"
      ? document.createElement("select")
      : document.createElement("input");

  label.textContent = field.label;
  control.id = inputId;
  control.dataset.templateFieldId = field.id;
  control.dataset.sharedField = field.shared ? "true" : "false";

  if (field.placeholder) {
    control.placeholder = field.placeholder;
  }

  if (field.type === "textarea") {
    control.rows = 3;
  } else if (field.type === "select") {
    (field.options || []).forEach((optionData) => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      control.appendChild(option);
    });
  } else if (field.type === "number") {
    control.type = "number";

    if (field.min !== undefined) {
      control.min = field.min;
    }

    if (field.step !== undefined) {
      control.step = field.step;
    }
  } else {
    control.type = "text";
  }

  control.value = value;
  label.appendChild(control);

  return label;
}

function getMarkerTemplateFieldValue(markerData, field) {
  if (field.shared && markerData[field.id] !== undefined) {
    return markerData[field.id];
  }

  if (
    markerData.templateData &&
    markerData.templateData[field.id] !== undefined
  ) {
    return markerData.templateData[field.id];
  }

  if (markerData.fields && markerData.fields[field.id] !== undefined) {
    return markerData.fields[field.id];
  }

  return field.default || "";
}

function collectTemplateFieldValues(containerId, categoryId) {
  const container = document.getElementById(containerId);
  const values = {
    shared: {},
    templateData: {},
  };

  if (!container) {
    return values;
  }

  getTemplateFields(categoryId).forEach((field) => {
    const control = container.querySelector(
      `[data-template-field-id="${field.id}"]`
    );
    const value = control ? control.value.trim() : field.default || "";

    if (field.shared) {
      values.shared[field.id] = value;
    } else {
      values.templateData[field.id] = value;
    }
  });

  return values;
}

function getItemDiscoveryInputId(formPrefix, fieldId) {
  const field = ITEM_DISCOVERY_FIELDS.find((fieldData) => {
    return fieldData.id === fieldId;
  });

  return field ? `${formPrefix}-${field.inputId}` : "";
}

function collectItemDiscoveryValues(formPrefix) {
  return ITEM_DISCOVERY_FIELDS.reduce((values, field) => {
    const control = document.getElementById(
      getItemDiscoveryInputId(formPrefix, field.id)
    );

    values[field.id] = control ? control.value.trim() : "";
    return values;
  }, {});
}

function populateItemDiscoveryFields(formPrefix, markerData = {}) {
  ITEM_DISCOVERY_FIELDS.forEach((field) => {
    const control = document.getElementById(
      getItemDiscoveryInputId(formPrefix, field.id)
    );

    if (control) {
      control.value = markerData[field.id] || "";
    }
  });
}

function markerHasItemDiscoveryData(markerData = {}) {
  return ITEM_DISCOVERY_FIELDS.some((field) => {
    return String(markerData[field.id] || "").trim().length > 0;
  });
}

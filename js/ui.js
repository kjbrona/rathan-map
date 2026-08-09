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

async function buildTypeDropdown(
  selectId,
  categoryId,
  selectedTypeId = null,
  groupId = ""
) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";

  let types = await loadTypesForCategory(categoryId);

  if (categoryId === "animals" && groupId) {
    types = types.filter((type) => type.group === groupId);
  }

  const groupedTypes = getGroupedTypesForDropdown(types, categoryId);

  groupedTypes.forEach((groupData) => {
    const parent = groupData.group
      ? createTypeOptGroup(groupData.group)
      : select;

    groupData.types.forEach((type) => {
      parent.appendChild(createTypeOption(type, selectedTypeId));
    });

    if (groupData.group) {
      select.appendChild(parent);
    }
  });

  return select.value;
}

async function buildAnimalGroupDropdown(
  selectId,
  categoryId,
  selectedGroupId = ""
) {
  const select = document.getElementById(selectId);

  if (!select) {
    return "";
  }

  const field = select.closest(".animal-group-field");
  select.innerHTML = "";

  if (categoryId !== "animals") {
    if (field) {
      field.classList.add("hidden");
    }

    return "";
  }

  const types = await loadTypesForCategory(categoryId);
  const groupIds = types
    .map((type) => type.group)
    .filter((groupId, index, groupList) => {
      return groupId && groupList.indexOf(groupId) === index;
    });

  groupIds.forEach((groupId) => {
    const group = getTypeGroupById(groupId);
    const option = document.createElement("option");

    option.value = groupId;
    option.textContent = group ? group.name : groupId;
    select.appendChild(option);
  });

  if (selectedGroupId && groupIds.includes(selectedGroupId)) {
    select.value = selectedGroupId;
  }

  if (field) {
    field.classList.remove("hidden");
  }

  return select.value;
}

function getTypeGroupIdForType(categoryId, typeId) {
  const type = getTypeById(categoryId, typeId);

  return type ? type.group || "" : "";
}

function getGroupedTypesForDropdown(types, categoryId = "") {
  if (categoryId !== "animals") {
    return [{ group: null, types }];
  }

  const groupIds = types
    .map((type) => type.group)
    .filter((groupId, index, groupList) => {
      return groupId && groupList.indexOf(groupId) === index;
    });

  if (groupIds.length <= 1) {
    return [{ group: null, types }];
  }

  return groupIds.map((groupId) => ({
    group: getTypeGroupById(groupId),
    types: types.filter((type) => type.group === groupId),
  }));
}

function createTypeOptGroup(group) {
  const optGroup = document.createElement("optgroup");
  optGroup.label = group ? group.name : "Other";
  return optGroup;
}

function createTypeOption(type, selectedTypeId = null) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;

    if (selectedTypeId && type.id === selectedTypeId) {
      option.selected = true;
    }

  return option;
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

function updateTypeGroupHelper(helperId, categoryId, typeId) {
  const helper = document.getElementById(helperId);

  if (!helper) {
    return;
  }

  const group = getTypeGroupForType(categoryId, typeId);

  if (categoryId !== "animals" || !group) {
    helper.textContent = "";
    helper.classList.add("hidden");
    return;
  }

  helper.textContent = `Animal Group: ${group.name}`;
  helper.classList.remove("hidden");
}

function getSelectedTypeName(categoryId, typeId) {
  const type = getTypeById(categoryId, typeId);
  return type ? type.name : "";
}

function renderTemplateFields(containerId, categoryId, markerData = {}, typeId = "") {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  container.innerHTML = "";

  getTemplateFields(categoryId, typeId || markerData.type).forEach((field) => {
    container.appendChild(createTemplateFieldControl(field, markerData));
  });
}

function createTemplateFieldControl(field, markerData) {
  const label = document.createElement("label");
  const inputId = `template-field-${field.id}-${crypto.randomUUID()}`;
  const value = getMarkerTemplateFieldValue(markerData, field);
  const isCheckboxList = field.type === "checkbox-list";
  const control =
    isCheckboxList
      ? document.createElement("div")
      : field.type === "textarea"
      ? document.createElement("textarea")
      : field.type === "select"
      ? document.createElement("select")
      : document.createElement("input");

  label.textContent = field.label;
  control.id = inputId;
  control.dataset.templateFieldId = field.id;
  control.dataset.sharedField = field.shared ? "true" : "false";

  if (isCheckboxList) {
    control.className = "checkbox-list-field";
    getTemplateFieldOptions(field).forEach((optionData) => {
      const optionLabel = document.createElement("label");
      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.value = optionData.value;
      checkbox.checked = Array.isArray(value) && value.includes(optionData.value);

      optionLabel.appendChild(checkbox);
      optionLabel.appendChild(document.createTextNode(optionData.label));
      control.appendChild(optionLabel);
    });
  } else if (field.placeholder) {
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
  if (field.type === "checkbox-list") {
    return normalizeTemplateArrayValue(
      markerData[field.id] !== undefined
        ? markerData[field.id]
        : markerData.templateData && markerData.templateData[field.id] !== undefined
        ? markerData.templateData[field.id]
        : markerData.fields && markerData.fields[field.id] !== undefined
        ? markerData.fields[field.id]
        : field.default
    );
  }

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

function getTemplateFieldOptions(field) {
  if (field.optionsSource === "uses") {
    return getUseOptions().map((use) => ({
      value: use.id,
      label: use.label,
    }));
  }

  return field.options || [];
}

function normalizeTemplateArrayValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function collectTemplateFieldValues(containerId, categoryId, typeId = "") {
  const container = document.getElementById(containerId);
  const values = {
    shared: {},
    templateData: {},
  };

  if (!container) {
    return values;
  }

  getTemplateFields(categoryId, typeId).forEach((field) => {
    const control = container.querySelector(
      `[data-template-field-id="${field.id}"]`
    );
    const value =
      control && field.type === "checkbox-list"
        ? Array.from(control.querySelectorAll("input[type='checkbox']:checked"))
            .map((checkbox) => checkbox.value)
            .filter(Boolean)
        : control
        ? control.value.trim()
        : field.default || "";

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

function collectItemDiscoveryValues(formPrefix, existingData = {}) {
  return ITEM_DISCOVERY_FIELDS.reduce((values, field) => {
    const control = document.getElementById(
      getItemDiscoveryInputId(formPrefix, field.id)
    );

    values[field.id] = control
      ? control.value.trim()
      : existingData[field.id] || "";
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
    if (field.id === "itemName") {
      return false;
    }

    return String(markerData[field.id] || "").trim().length > 0;
  });
}

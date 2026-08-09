/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let TEMPLATE_DATA = {
  default: [],
  categories: {},
};

async function loadTemplateData() {
  const response = await fetch(
    `data/templates.json?v=${encodeURIComponent(APP_VERSION)}`
  );
  TEMPLATE_DATA = await response.json();
  return TEMPLATE_DATA;
}

function getTemplateFields(categoryId, typeId = "") {
  const fields =
    TEMPLATE_DATA.categories[categoryId] ||
    TEMPLATE_DATA.default ||
    [];

  return fields.filter((field) => isTemplateFieldVisible(field, categoryId, typeId));
}

function isTemplateFieldVisible(field, categoryId, typeId = "") {
  if (!field.visibleWhenGroup) {
    return true;
  }

  const group = getTypeGroupForType(categoryId, typeId);
  return group && group.id === field.visibleWhenGroup;
}

function getTemplateFieldById(categoryId, fieldId, typeId = "") {
  return getTemplateFields(categoryId, typeId).find((field) => field.id === fieldId);
}

function getDefaultTemplateValues(categoryId, typeId = "") {
  const values = {};

  getTemplateFields(categoryId, typeId).forEach((field) => {
    values[field.id] = field.default || "";
  });

  return values;
}

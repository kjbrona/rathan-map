/*
==================================================
RosalitaRP Explorer
Version : 0.9.0
Creator : Rathan
==================================================
*/

let TEMPLATE_DATA = {
  default: [],
  categories: {},
};

async function loadTemplateData() {
  const response = await fetch("data/templates.json");
  TEMPLATE_DATA = await response.json();
  return TEMPLATE_DATA;
}

function getTemplateFields(categoryId) {
  return (
    TEMPLATE_DATA.categories[categoryId] ||
    TEMPLATE_DATA.default ||
    []
  );
}

function getTemplateFieldById(categoryId, fieldId) {
  return getTemplateFields(categoryId).find((field) => field.id === fieldId);
}

function getDefaultTemplateValues(categoryId) {
  const values = {};

  getTemplateFields(categoryId).forEach((field) => {
    values[field.id] = field.default || "";
  });

  return values;
}

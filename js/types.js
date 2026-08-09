/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let TYPE_DATA = {};
let TYPE_GROUPS = {};
let TYPE_GROUP_LIST = [];

async function loadTypeGroupData() {
  const response = await fetch(
    `data/type-groups.json?v=${encodeURIComponent(APP_VERSION)}`
  );
  TYPE_GROUP_LIST = await response.json();
  TYPE_GROUPS = TYPE_GROUP_LIST.reduce((groupsById, group) => {
    groupsById[group.id] = group;
    return groupsById;
  }, {});

  return TYPE_GROUP_LIST;
}

async function loadTypesForCategory(categoryId) {
  const resolvedCategoryId =
    typeof getMigratedCategoryId === "function"
      ? getMigratedCategoryId(categoryId)
      : categoryId;

  if (TYPE_DATA[resolvedCategoryId]) {
    return TYPE_DATA[resolvedCategoryId];
  }

  const response = await fetch(
    `data/types/${resolvedCategoryId}.json?v=${encodeURIComponent(
      APP_VERSION
    )}`
  );
  TYPE_DATA[resolvedCategoryId] = await response.json();

  if (resolvedCategoryId !== categoryId) {
    TYPE_DATA[categoryId] = TYPE_DATA[resolvedCategoryId];
  }

  return TYPE_DATA[resolvedCategoryId];
}

function getTypeById(categoryId, typeId) {
  const resolvedCategoryId =
    typeof getMigratedCategoryId === "function"
      ? getMigratedCategoryId(categoryId)
      : categoryId;
  const types = TYPE_DATA[resolvedCategoryId] || TYPE_DATA[categoryId] || [];
  return types.find((type) => type.id === typeId);
}

function getTypeGroupById(groupId) {
  return TYPE_GROUPS[groupId];
}

function getTypeGroupForType(categoryId, typeId) {
  const type = getTypeById(categoryId, typeId);
  return type ? getTypeGroupById(type.group) : null;
}

function getTypeGroupIconUrl(group) {
  if (!group || !group.icon) {
    return "";
  }

  return `${group.icon}?v=${encodeURIComponent(APP_VERSION)}`;
}

function createTypeGroupIconHtml(categoryId, typeId, className = "type-group-icon") {
  const group = getTypeGroupForType(categoryId, typeId);

  if (!group) {
    return "";
  }

  return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(
    getTypeGroupIconUrl(group)
  )}" alt="" aria-hidden="true" title="${escapeAttribute(group.name)}" />`;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

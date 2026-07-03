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
  const response = await fetch("data/type-groups.json");
  TYPE_GROUP_LIST = await response.json();
  TYPE_GROUPS = TYPE_GROUP_LIST.reduce((groupsById, group) => {
    groupsById[group.id] = group;
    return groupsById;
  }, {});

  return TYPE_GROUP_LIST;
}

async function loadTypesForCategory(categoryId) {
  if (TYPE_DATA[categoryId]) {
    return TYPE_DATA[categoryId];
  }

  const response = await fetch(`data/types/${categoryId}.json`);
  TYPE_DATA[categoryId] = await response.json();

  return TYPE_DATA[categoryId];
}

function getTypeById(categoryId, typeId) {
  const types = TYPE_DATA[categoryId] || [];
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
==================================================
RosalitaRP Explorer
Version : 0.9.0
Creator : Rathan
==================================================
*/

let TYPE_DATA = {};

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

/*
==================================================
RosalitaRP Explorer
Version : 0.8.1
Creator : Rathan
==================================================
*/

async function buildCategoryDropdown(selectId, selectedCategoryId = null) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon} ${category.name}`;

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
    option.textContent = `${type.icon} ${type.name}`;

    if (selectedTypeId && type.id === selectedTypeId) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  return select.value;
}

function getSelectedTypeName(categoryId, typeId) {
  const type = getTypeById(categoryId, typeId);
  return type ? type.name : "";
}

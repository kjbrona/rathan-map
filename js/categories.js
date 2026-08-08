/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let CATEGORIES = [];

async function loadCategoryData() {
  const response = await fetch(
    `data/categories.json?v=${encodeURIComponent(APP_VERSION)}`
  );
  CATEGORIES = await response.json();
  return CATEGORIES;
}

function getCategories() {
  return CATEGORIES;
}

function getCategoryById(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId);
}

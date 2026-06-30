/*
==================================================
RosalitaRP Explorer
Version : 0.2.0
Creator : Rathan
==================================================
*/

let CATEGORIES = [];

async function loadCategoryData() {
  const response = await fetch("data/categories.json");
  CATEGORIES = await response.json();
  return CATEGORIES;
}

function getCategories() {
  return CATEGORIES;
}

function getCategoryById(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId);
}
/*
==================================================
RosalitaRP Explorer
Version : 0.3.0
Creator : Rathan
==================================================
*/

function initializeSidebar() {
  document.getElementById("app-title").textContent = APP_NAME;
  document.getElementById("app-subtitle").textContent = APP_SUBTITLE;

  renderCategoryList();

  const addMarkerButton = document.getElementById("add-marker-btn");

  addMarkerButton.addEventListener("click", () => {
    currentMode = MODES.ADD_MARKER;
    addMarkerButton.classList.add("active");
  });
}

function renderCategoryList() {
  const list = document.getElementById("category-list");
  list.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const label = document.createElement("label");

    label.innerHTML = `
      <input
        type="checkbox"
        data-category-id="${category.id}"
        ${category.enabled ? "checked" : ""}
      />
      ${category.icon} ${category.name}
    `;

    list.appendChild(label);
  });
}

function clearAddMarkerMode() {
  currentMode = MODES.BROWSE;

  const addMarkerButton = document.getElementById("add-marker-btn");
  addMarkerButton.classList.remove("active");
}
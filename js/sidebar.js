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
  initializeMarkerDetailsPanel();

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

async function initializeMarkerDetailsPanel() {
  populateEditCategoryDropdown();

  document
    .getElementById("edit-marker-category")
    .addEventListener("change", async function () {
      await populateEditTypeDropdown(this.value);
    });

  document
    .getElementById("marker-details-form")
    .addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!selectedMarkerId) {
        return;
      }

      await updateMarker(selectedMarkerId, {
        name: document.getElementById("edit-marker-name").value.trim(),
        category: document.getElementById("edit-marker-category").value,
        type: document.getElementById("edit-marker-type").value,
        notes: document.getElementById("edit-marker-notes").value.trim(),
      });
    });

  document
    .getElementById("edit-marker-delete")
    .addEventListener("click", function () {
      if (!selectedMarkerId) {
        return;
      }

      if (confirm("Delete this marker?")) {
        deleteMarker(selectedMarkerId);
      }
    });
}

async function populateEditCategoryDropdown(selectedCategory = null) {

    const select = document.getElementById("edit-marker-category");

    select.innerHTML = "";

    CATEGORIES.forEach((category) => {

        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = `${category.icon} ${category.name}`;

        if (selectedCategory && category.id === selectedCategory) {
            option.selected = true;
        }

        select.appendChild(option);

    });

    // Populate the types for the selected category
    const categoryId = selectedCategory || CATEGORIES[0].id;
    await populateEditTypeDropdown(categoryId);
}

async function populateEditTypeDropdown(categoryId, selectedTypeId = null) {
  const select = document.getElementById("edit-marker-type");
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
}

async function renderMarkerDetails(markerData) {
  const empty = document.getElementById("marker-details-empty");
  const form = document.getElementById("marker-details-form");

  if (!markerData) {
    empty.style.display = "block";
    form.classList.add("hidden");
    return;
  }

  empty.style.display = "none";
  form.classList.remove("hidden");

  document.getElementById("edit-marker-name").value = markerData.name;
  await populateEditCategoryDropdown(markerData.category);
  document.getElementById("edit-marker-type").value = markerData.type;
  document.getElementById("edit-marker-notes").value = markerData.notes || "";
  document.getElementById("edit-marker-x-display").textContent = markerData.x;
  document.getElementById("edit-marker-y-display").textContent = markerData.y;
}
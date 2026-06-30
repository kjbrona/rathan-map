/*
==================================================
RosalitaRP Explorer
Version : 0.6.0
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
  await buildCategoryDropdown("edit-marker-category");

  const initialCategory = document.getElementById("edit-marker-category").value;
  await buildTypeDropdown("edit-marker-type", initialCategory);

  document
    .getElementById("edit-marker-category")
    .addEventListener("change", async function () {
      await buildTypeDropdown("edit-marker-type", this.value);
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
        status: document.getElementById("edit-marker-status").value,
        confidence: document.getElementById("edit-marker-confidence").value,
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

  await buildCategoryDropdown("edit-marker-category", markerData.category);
  await buildTypeDropdown("edit-marker-type", markerData.category, markerData.type);

  document.getElementById("edit-marker-status").value =
    markerData.status || "unverified";

  document.getElementById("edit-marker-confidence").value =
    markerData.confidence || "guess";

  document.getElementById("edit-marker-notes").value = markerData.notes || "";
  document.getElementById("edit-marker-x-display").textContent = markerData.x;
  document.getElementById("edit-marker-y-display").textContent = markerData.y;
}

function updateMarkerStats() {
  const total = document.getElementById("marker-count-total");

  if (!total) {
    return;
  }

  total.textContent = markers.length;
}
/*
==================================================
RosalitaRP Explorer
Version : 0.5.0
Creator : Rathan
==================================================
*/

let pendingMarkerLatLng = null;

function initializeDialogs() {
  populateMarkerCategoryDropdown();

  document
    .getElementById("marker-category")
    .addEventListener("change", async function () {
      await populateMarkerTypeDropdown(this.value);
    });

  document
    .getElementById("marker-dialog-close")
    .addEventListener("click", closeMarkerDialog);

  document
    .getElementById("marker-cancel")
    .addEventListener("click", closeMarkerDialog);

  document
    .getElementById("marker-form")
    .addEventListener("submit", saveMarkerFromDialog);
}

async function populateMarkerCategoryDropdown() {
  const select = document.getElementById("marker-category");
  select.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon} ${category.name}`;
    select.appendChild(option);
  });

  if (CATEGORIES.length > 0) {
    await populateMarkerTypeDropdown(CATEGORIES[0].id);
  }
}

async function populateMarkerTypeDropdown(categoryId) {
  const select = document.getElementById("marker-type");
  select.innerHTML = "";

  const types = await loadTypesForCategory(categoryId);

  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = `${type.icon} ${type.name}`;
    select.appendChild(option);
  });
}

async function openMarkerDialog(latlng) {
  pendingMarkerLatLng = latlng;

  const x = Math.round(latlng.lng);
  const y = Math.round(latlng.lat);

  document.getElementById("marker-form").reset();

  if (CATEGORIES.length > 0) {
    document.getElementById("marker-category").value = CATEGORIES[0].id;
    await populateMarkerTypeDropdown(CATEGORIES[0].id);
  }

  document.getElementById("marker-x").value = x;
  document.getElementById("marker-y").value = y;
  document.getElementById("marker-x-display").textContent = x;
  document.getElementById("marker-y-display").textContent = y;

  document.getElementById("marker-dialog").classList.remove("hidden");
  document.getElementById("marker-name").focus();
}

function closeMarkerDialog() {
  pendingMarkerLatLng = null;
  document.getElementById("marker-dialog").classList.add("hidden");
  clearAddMarkerMode();
}

function saveMarkerFromDialog(event) {
  event.preventDefault();

  const markerData = {
    id: Date.now(),
    name: document.getElementById("marker-name").value.trim(),
    category: document.getElementById("marker-category").value,
    type: document.getElementById("marker-type").value,
    notes: document.getElementById("marker-notes").value.trim(),
    x: Number(document.getElementById("marker-x").value),
    y: Number(document.getElementById("marker-y").value),
    createdAt: new Date().toISOString(),
  };

  addMarker(markerData);
  closeMarkerDialog();
}
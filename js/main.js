/*
==================================================
RosalitaRP Explorer
Version : 0.9.0
Creator : Rathan
==================================================
*/

async function initializeApp() {
  console.log(`${APP_NAME} v${APP_VERSION}`);
  console.log(`Created by ${APP_CREATOR}`);

  await loadCategoryData();
  await loadTemplateData();

  await initializeMarkerManager();
  initializeSidebar();
  initializeDialogs();
  initializeContextMenus();
  refreshMarkers();

  map.on("click", function (event) {
    closeContextMenu();

    if (currentMode === MODES.ADD_MARKER) {
      openMarkerDialog(event.latlng);
      return;
    }

    if (currentMode === MODES.MOVE_MARKER) {
      moveSelectedMarkerTo(event.latlng);
      return;
    }

    clearSelectedMarker();
  });

  map.on("contextmenu", function (event) {
    if (currentMode === MODES.MOVE_MARKER) {
      return;
    }

    openMapContextMenu(event.latlng, event.originalEvent);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeContextMenu();
    }

    if (event.key === "Escape" && currentMode === MODES.MOVE_MARKER) {
      cancelMoveMarkerMode();
    }
  });
}

initializeApp();

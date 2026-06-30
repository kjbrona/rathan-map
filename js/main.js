/*
==================================================
RosalitaRP Explorer
Version : 0.8.1
Creator : Rathan
==================================================
*/

async function initializeApp() {
  console.log(`${APP_NAME} v${APP_VERSION}`);
  console.log(`Created by ${APP_CREATOR}`);

  await loadCategoryData();

  await initializeMarkerManager();
  initializeSidebar();
  initializeDialogs();
  refreshMarkers();

  map.on("click", function (event) {
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

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && currentMode === MODES.MOVE_MARKER) {
      cancelMoveMarkerMode();
    }
  });
}

initializeApp();

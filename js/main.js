/*
==================================================
RosalitaRP Explorer
Version : 0.3.0
Creator : Rathan
==================================================
*/

async function initializeApp() {
  console.log(`${APP_NAME} v${APP_VERSION}`);
  console.log(`Created by ${APP_CREATOR}`);

  await loadCategoryData();
  initializeSidebar();

  map.on("click", function (event) {
    if (currentMode !== MODES.ADD_MARKER) {
      return;
    }

    addTemporaryMarker(event.latlng);
    clearAddMarkerMode();
  });
}

initializeApp();
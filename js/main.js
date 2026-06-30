/*
==================================================
RosalitaRP Explorer
Version : 0.4.0
Creator : Rathan
==================================================
*/

async function initializeApp() {
  console.log(`${APP_NAME} v${APP_VERSION}`);
  console.log(`Created by ${APP_CREATOR}`);

  await loadCategoryData();
  initializeSidebar();
  initializeDialogs();

  map.on("click", function (event) {
    if (currentMode !== MODES.ADD_MARKER) {
      return;
    }

    openMarkerDialog(event.latlng);
  });
}

initializeApp();
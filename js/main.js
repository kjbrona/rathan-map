/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

async function initializeApp() {
  console.log(`${APP_NAME} v${APP_VERSION}`);
  console.log(`Created by ${APP_CREATOR}`);

  // Bind the local UI before network reads so slow Firebase cannot leave it blank/inert.
  document.getElementById("app-title").textContent = APP_NAME;
  document.getElementById("app-version").textContent = APP_VERSION;
  await initializeFirebaseStorage();
  await initializeServerControls();
  initializeAccountControls();

  await loadCategoryData();
  await loadTypeGroupData();
  await loadUseData();
  await loadTemplateData();
  await loadStateZoneData();

  await refreshServerProfiles();
  renderServerControls();
  applyServerReadOnlyUI();
  await initializeMarkerManager();
  initializeSidebar();
  renderServerControls();
  initializeStateZoneOverlay();
  initializeDialogs();
  initializeContextMenus();
  refreshMarkers();
  restoreServerMapView();

  try {
    await initializeCandidateSurveyLayer();
  } catch (error) {
    console.warn("Possible Locations layer could not be initialized.", error);
  }

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

initializeApp().catch((error) => {
  console.error(`${APP_NAME} could not be initialized.`, error);
  const status = document.getElementById("data-source-status");
  if (status) status.textContent = location.protocol === "file:"
    ? "Local files cannot load the map data. Run Start Local Explorer.cmd, then open http://127.0.0.1:8080/"
    : "Startup could not finish. Reload the page or check the browser console.";
});

/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let activeContextMenu = null;
let activeContextMenuMarkerId = null;

function initializeContextMenus() {
  document.addEventListener("click", closeContextMenu);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeContextMenu();
    }
  });
}

function openMarkerContextMenu(markerId, originalEvent) {
  const markerData = getMarkerById(markerId);

  if (!markerData) {
    return;
  }

  activeContextMenuMarkerId = markerId;
  openContextMenu(originalEvent, [
    {
      label: "Center on Marker",
      action: () => centerOnMarker(markerId),
    },
    {
      label: "Move Marker",
      action: () => startMoveMarkerFromContext(markerId),
    },
    {
      label: "Edit Marker",
      action: () => selectMarker(markerId),
    },
    {
      label: "Delete Marker",
      action: () => deleteMarkerFromContext(markerId),
      danger: true,
    },
    {
      label: "Copy Coordinates",
      action: () => copyMarkerCoordinates(markerData),
    },
  ]);
}

function openMapContextMenu(latlng, originalEvent) {
  activeContextMenuMarkerId = null;
  openContextMenu(originalEvent, [
    {
      label: "Add Marker Here",
      action: () => openMarkerDialog(latlng),
    },
    {
      label: "Copy Coordinates",
      action: () => copyCoordinates(latlng.lng, latlng.lat),
    },
  ]);
}

function openContextMenu(originalEvent, menuItems) {
  closeContextMenu();

  if (originalEvent) {
    originalEvent.preventDefault();
    originalEvent.stopPropagation();
  }

  const menu = document.createElement("div");
  menu.className = "context-menu";

  menuItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;

    if (item.danger) {
      button.classList.add("danger");
    }

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      closeContextMenu();
      item.action();
    });

    menu.appendChild(button);
  });

  document.body.appendChild(menu);
  positionContextMenu(menu, originalEvent);
  activeContextMenu = menu;
}

function positionContextMenu(menu, originalEvent) {
  const pointerX = originalEvent ? originalEvent.clientX : 0;
  const pointerY = originalEvent ? originalEvent.clientY : 0;
  const menuBounds = menu.getBoundingClientRect();
  const padding = 8;
  const left = Math.min(
    pointerX,
    window.innerWidth - menuBounds.width - padding
  );
  const top = Math.min(
    pointerY,
    window.innerHeight - menuBounds.height - padding
  );

  menu.style.left = `${Math.max(padding, left)}px`;
  menu.style.top = `${Math.max(padding, top)}px`;
}

function closeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }

  activeContextMenuMarkerId = null;
}

function startMoveMarkerFromContext(markerId) {
  selectMarker(markerId);
  enterMoveMarkerMode();
}

async function deleteMarkerFromContext(markerId) {
  const markerData = getMarkerById(markerId);

  if (!markerData) {
    return;
  }

  if (confirm(`Delete marker "${markerData.name}"?`)) {
    await deleteMarker(markerId);
  }
}

function copyMarkerCoordinates(markerData) {
  copyCoordinates(markerData.x, markerData.y);
}

async function copyCoordinates(x, y) {
  const coordinateText = `X: ${Math.round(Number(x))}, Y: ${Math.round(
    Number(y)
  )}`;

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(coordinateText);
      return;
    }
  } catch (error) {
    console.warn("Clipboard copy failed.", error);
  }

  window.prompt("Copy coordinates:", coordinateText);
}

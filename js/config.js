/*
==================================================
RosalitaRP Explorer
Version : 1.3.29
Creator : Rathan
==================================================
*/

const APP_NAME = "RosalitaRP Explorer";
const APP_SUBTITLE = "Community Resource Map";
const APP_VERSION = "1.3.29";
const APP_CREATOR = "Rathan";
const DEFAULT_DANGER_RADIUS = 50;

const ITEM_DISCOVERY_FIELDS = [
  { id: "itemName", inputId: "item-name" },
  { id: "itemCategory", inputId: "item-category" },
  { id: "itemUse", inputId: "item-use" },
  { id: "foundBy", inputId: "found-by" },
  { id: "foundDate", inputId: "found-date" },
  { id: "vendorValue", inputId: "vendor-value" },
  { id: "craftingUses", inputId: "crafting-uses" },
  { id: "itemNotes", inputId: "item-notes" },
];

const MAP_WIDTH = 9216;
const MAP_HEIGHT = 7168;
const MAP_IMAGE = "images/rdr2-map.jpg";

const MIN_ZOOM = -5;
const MAX_ZOOM = 4;

const MODES = {
  BROWSE: "browse",
  ADD_MARKER: "add-marker",
  MOVE_MARKER: "move-marker",
  EDIT_MARKER: "edit-marker",
  DELETE_MARKER: "delete-marker",
};

let currentMode = MODES.BROWSE;

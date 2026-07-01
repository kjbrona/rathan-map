/*
==================================================
RosalitaRP Explorer
Version : 1.0.0
Creator : Rathan
==================================================
*/

const APP_NAME = "RosalitaRP Explorer";
const APP_SUBTITLE = "Community Resource Map";
const APP_VERSION = "1.0.0";
const APP_CREATOR = "Rathan";

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

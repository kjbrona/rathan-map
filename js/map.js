/*
==================================================
RosalitaRP Explorer
Version : 0.2.0
Creator : Rathan
==================================================
*/

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  zoomControl: true,
  zoomSnap: 1,
  zoomDelta: 1,
  wheelPxPerZoomLevel: 120,
  doubleClickZoom: false,
});

const mapBounds = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH],
];

L.imageOverlay(MAP_IMAGE, mapBounds).addTo(map);

map.setMaxBounds(mapBounds);
map.fitBounds(mapBounds);
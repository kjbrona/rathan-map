/*
==================================================
RosalitaRP Explorer
Version : 0.2.0
Creator : Rathan
==================================================
*/

let tempMarker = null;

function addTemporaryMarker(latlng) {
  if (tempMarker) {
    map.removeLayer(tempMarker);
  }

  tempMarker = L.marker(latlng).addTo(map);

  tempMarker
    .bindPopup(`
      <strong>Test Marker</strong><br>
      X: ${Math.round(latlng.lng)}<br>
      Y: ${Math.round(latlng.lat)}
    `)
    .openPopup();
}
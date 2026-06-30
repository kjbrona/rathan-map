console.log(`${APP_NAME} v${APP_VERSION}`);
console.log(`Created by ${APP_CREATOR}`);

map.on("click", function (event) {
  addTemporaryMarker(event.latlng);
});
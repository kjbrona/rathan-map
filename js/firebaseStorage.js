/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let firebaseDb = null;
let markerCollection = null;
let markerSnapshotUnsubscribe = null;
let firebaseAvailable = false;

function withFirebaseReadTimeout(promise, timeoutMs = 5000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Firebase read timed out; using local data.")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function initializeFirebaseStorage() {
  try {
    const app = initializeFirebaseApp();

    if (!app || typeof firebase.firestore !== "function") {
      setFirebaseAvailability(false);
      return false;
    }

    firebaseDb = firebase.firestore();
    markerCollection = getServerMarkerCollection(firebaseDb);

    setFirebaseAvailability(true);
    return true;
  } catch (error) {
    console.warn("Firebase storage is unavailable.", error);
    setFirebaseAvailability(false);
    return false;
  }
}

function isFirebaseStorageAvailable() {
  return firebaseAvailable && markerCollection !== null;
}

async function loadMarkersFromFirebase() {
  if (!isFirebaseStorageAvailable()) {
    return null;
  }

  try {
    const snapshot = await withFirebaseReadTimeout(markerCollection.get());
    setFirebaseAvailability(true);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.warn("Markers could not be loaded from Firebase.", error);
    setFirebaseAvailability(false);
    return null;
  }
}

async function saveMarkerToFirebase(markerData) {
  if (!hasEditorAccess() || isServerArchived()) return false;
  if (!isFirebaseStorageAvailable()) {
    return false;
  }

  try {
    const storedMarker = sanitizeMarkers([markerData])[0];

    if (!storedMarker) {
      return false;
    }

    await markerCollection.doc(storedMarker.id).set(storedMarker);
    setFirebaseAvailability(true);
    return true;
  } catch (error) {
    console.warn("Marker could not be saved to Firebase.", error);
    setFirebaseAvailability(false);
    return false;
  }
}

async function deleteMarkerFromFirebase(markerId) {
  if (!hasEditorAccess() || isServerArchived()) return false;
  if (!isFirebaseStorageAvailable()) {
    return false;
  }

  try {
    await markerCollection.doc(markerId).delete();
    setFirebaseAvailability(true);
    return true;
  } catch (error) {
    console.warn("Marker could not be deleted from Firebase.", error);
    setFirebaseAvailability(false);
    return false;
  }
}

async function saveMarkersToFirebase(markerData, deleteMissing = true) {
  if (!hasEditorAccess() || isServerArchived()) return false;
  if (!isFirebaseStorageAvailable()) {
    return false;
  }

  try {
    const markersToSave = sanitizeMarkers(markerData);
    const generation = accountGeneration;
    const snapshot = await markerCollection.get();
    const incomingIds = new Set(markersToSave.map((marker) => marker.id));
    const batch = firebaseDb.batch();

    markersToSave.forEach((marker) => {
      batch.set(markerCollection.doc(marker.id), marker);
    });

    snapshot.docs.forEach((doc) => {
      if (deleteMissing && !incomingIds.has(doc.id)) {
        batch.delete(doc.ref);
      }
    });

    if (!hasEditorAccess() || generation !== accountGeneration || isServerArchived()) return false;
    await batch.commit();
    setFirebaseAvailability(true);
    return true;
  } catch (error) {
    console.warn("Markers could not be saved to Firebase.", error);
    setFirebaseAvailability(false);
    return false;
  }
}

function subscribeToFirebaseMarkers(onMarkersChanged) {
  if (!isFirebaseStorageAvailable()) {
    return;
  }

  try {
    if (markerSnapshotUnsubscribe) {
      markerSnapshotUnsubscribe();
    }

    markerSnapshotUnsubscribe = markerCollection.onSnapshot(
      (snapshot) => {
        if (serverSwitching || serverLifecycleBusy || pendingServerWrites > 0 || hasPendingLocalMarkers()) return;
        setFirebaseAvailability(true);
        const snapshotMarkers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (typeof saveMarkersToLocalStorage === "function") {
          saveMarkersToLocalStorage(snapshotMarkers);
        }

        onMarkersChanged(snapshotMarkers);
      },
      (error) => {
        console.warn("Firebase marker sync stopped.", error);
        setFirebaseAvailability(false);
      }
    );
  } catch (error) {
    console.warn("Firebase marker sync could not start.", error);
    setFirebaseAvailability(false);
  }
}

function setFirebaseAvailability(isAvailable) {
  firebaseAvailable = isAvailable;
  updateDataSourceStatus(
    isAvailable ? "Firebase Connected" : "Firebase Offline"
  );
}

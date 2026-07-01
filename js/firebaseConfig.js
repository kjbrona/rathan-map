/*
==================================================
RosalitaRP Explorer
Version : 1.0.0
Creator : Rathan
==================================================
*/

const firebaseConfig = {
  apiKey: "AIzaSyAsWWA_hgGj0BeXKjjDO3FSZ94OjjqC4Ds",
  authDomain: "rosalitarp-explorer-df1b0.firebaseapp.com",
  projectId: "rosalitarp-explorer-df1b0",
  storageBucket: "rosalitarp-explorer-df1b0.firebasestorage.app",
  messagingSenderId: "231337759079",
  appId: "1:231337759079:web:debcd5f427a0ecb13d5fc2",
};

function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith("REPLACE_WITH") &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.startsWith("REPLACE_WITH")
  );
}

function initializeFirebaseApp() {
  if (!isFirebaseConfigured() || typeof firebase === "undefined") {
    return null;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    return firebase.app();
  } catch (error) {
    console.warn("Firebase could not be initialized.", error);
    return null;
  }
}

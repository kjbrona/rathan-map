// The Firestore rules are authoritative; these checks also keep the UI read-only.
const OWNER_EMAIL = "kjbrona@gmail.com";
let accountUser = null;
let accountRole = "viewer";
let accountGeneration = 0;
let editorSubscription = null;
let accountMessage = "Sign in to edit. Visitors can view all servers.";

function isOwner() { return accountRole === "owner"; }
function hasEditorAccess() { return isOwner() || accountRole === "editor"; }

function renderAccountControls() {
  document.getElementById("account-status").textContent = accountMessage;
  document.getElementById("account-signin").hidden = !!accountUser;
  document.getElementById("account-signout").hidden = !accountUser;
  document.getElementById("editor-controls").hidden = !isOwner();
  document.getElementById("sync-local-markers").disabled = !canEditServer();
  applyServerReadOnlyUI();
  renderServerManagement();
}

function acceptAccount(user) {
  const generation = ++accountGeneration;
  if (editorSubscription) editorSubscription();
  editorSubscription = null;
  accountUser = user;
  accountRole = "viewer";
  const email = user?.email?.toLowerCase();
  const verifiedGoogle = user?.emailVerified && user.providerData?.some(p => p.providerId === "google.com");
  accountMessage = user ? `${email || "Signed in"} — Viewer` : "Sign in to edit. Visitors can view all servers.";
  if (verifiedGoogle && email === OWNER_EMAIL) {
    accountRole = "owner";
    accountMessage = `${email} — Owner`;
  } else if (verifiedGoogle && firebaseDb) {
    editorSubscription = firebaseDb.collection("editors").doc(email).onSnapshot({ includeMetadataChanges: true }, snapshot => {
      if (generation !== accountGeneration) return;
      // Never grant permissions from a stale offline cache.
      accountRole = !snapshot.metadata?.fromCache && snapshot.exists && snapshot.data().enabled === true ? "editor" : "viewer";
      accountMessage = `${email} — ${accountRole === "editor" ? "Editor (all servers)" : "Viewer"}`;
      renderAccountControls();
    }, () => {
      if (generation !== accountGeneration) return;
      accountRole = "viewer";
      accountMessage = `${email} — Editor access could not be verified`;
      renderAccountControls();
    });
  }
  renderAccountControls();
}

function initializeAccountControls() {
  renderAccountControls();
  if (typeof firebase === "undefined" || typeof firebase.auth !== "function" || !initializeFirebaseApp()) {
    accountMessage = "Sign-in unavailable. Viewing and exporting remain available.";
    renderAccountControls();
    return;
  }
  const auth = firebase.auth();
  auth.onAuthStateChanged(acceptAccount, error => {
    acceptAccount(null);
    accountMessage = `Sign-in unavailable: ${error.message}`;
    renderAccountControls();
  });
  document.getElementById("account-signin").addEventListener("click", async () => {
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (error) { alert(`Google sign-in failed (${error.code}). Enable Google in Firebase Authentication and authorize this site's domain.`); }
  });
  document.getElementById("account-signout").addEventListener("click", async () => {
    if (pendingServerWrites || serverLifecycleBusy) { alert("Wait for the current save to finish before signing out."); return; }
    try { await auth.signOut(); } catch (error) { alert(error.message); }
  });
  for (const [id, enabled] of [["editor-grant", true], ["editor-revoke", false]]) {
    document.getElementById(id).addEventListener("click", () => changeEditorAccess(enabled).catch(error => alert(error.message)));
  }
  document.getElementById("editor-list").addEventListener("click", async () => {
    if (!isOwner()) return;
    try {
      const result = await withFirebaseReadTimeout(firebaseDb.collection("editors").get());
      alert("Editors across all servers:\n" + (result.docs.filter(d => d.data().enabled === true).map(d => d.id).join("\n") || "None"));
    } catch (error) { alert(error.message); }
  });
  document.getElementById("sync-local-markers").addEventListener("click", () => syncLocalMarkers().catch(error => alert(error.message)));
}

async function changeEditorAccess(enabled) {
  if (!isOwner() || !firebaseDb) return;
  const email = document.getElementById("editor-email").value.trim().toLowerCase();
  if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email)) throw new Error("Enter the editor's Google account email.");
  if (email === OWNER_EMAIL) throw new Error("The owner always retains access.");
  if (!confirm(`${enabled ? "Grant" : "Remove"} editing access across ALL servers for ${email}?`)) return;
  const ref = firebaseDb.collection("editors").doc(email);
  if (enabled) await ref.set({ enabled: true });
  else await ref.delete();
  alert(`Editor access ${enabled ? "granted" : "removed"} for ${email}.`);
}

async function syncLocalMarkers() {
  if (!canEditServer() || !hasPendingLocalMarkers()) { alert("No pending local markers to sync, or this server is read only."); return; }
  if (!confirm(`Save the local markers for ${getActiveServer().name} to the cloud? Local versions replace matching IDs; other cloud markers are retained. Local deletions are not applied. Keep your exported backup.`)) return;
  const generation = accountGeneration;
  const localMarkers = getMarkersForExport();
  const result = await queueServerWrite(async () => {
    // Explicit retry even if a prior denied write marked Firebase unavailable.
    await initializeFirebaseStorage();
    if (!hasEditorAccess() || isServerArchived()) return { ok: false };
    const remote = await loadMarkersFromFirebase();
    if (!remote || generation !== accountGeneration || !hasEditorAccess()) return { ok: false };
    const merged = new Map(remote.map(marker => [marker.id, marker]));
    localMarkers.forEach(marker => merged.set(marker.id, marker));
    const data = [...merged.values()];
    // Upsert only local documents: concurrent cloud-only additions must survive.
    if (!await saveMarkersToFirebase(localMarkers, false)) return { ok: false };
    saveMarkersToLocalStorage(data);
    clearPendingLocalMarkers();
    applyRemoteMarkers(data);
    subscribeToFirebaseMarkers(applyRemoteMarkers);
    serverWriteFailed = false;
    return { ok: true };
  });
  alert(result.ok ? "Local markers saved to the cloud." : "Cloud save failed. Your local markers are still retained. Check Firebase permissions.");
}

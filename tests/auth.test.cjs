const assert = require('node:assert/strict');
const vm = require('node:vm');
const { session, read, local, cloud } = require('./server-profiles.test.cjs');

async function main() {
  const s = session();
  vm.runInContext(read('js/auth.js'), s.c);
  s.run('renderAccountControls = () => {}');
  assert.equal(s.run('hasEditorAccess()'), false);
  assert.equal(s.run('canEditServer()'), false);
  assert.equal((await s.run('queueServerWrite(() => { throw Error("must not execute"); })')).ok, false);
  await s.run('initializeFirebaseStorage()');
  assert.equal(await s.run('saveMarkersToFirebase([])'), false);
  assert.equal(s.run('savePendingLocalMarkers([]).ok'), false);
  const google = email => ({ email, emailVerified: true, providerData: [{providerId:'google.com'}] });
  s.c.user = google('kjbrona@gmail.com');
  s.run('acceptAccount(user)');
  assert.equal(s.run('isOwner() && canEditServer()'), true);
  s.run('serverProfiles[0].status = "archived"');
  assert.equal(s.run('canEditServer()'), false);
  assert.equal(await s.run('saveMarkersToFirebase([])'), false);
  s.run('serverProfiles[0].status = "active"');
  // Reject pending work if a different account signs in before execution.
  const queued = s.run('queueServerWrite(() => { throw Error("stale write executed"); })');
  s.run('acceptAccount(null)');
  assert.equal((await queued).ok, false);
  s.c.user = {...google('kjbrona@gmail.com'), emailVerified:false};
  s.run('acceptAccount(user)');
  assert.equal(s.run('hasEditorAccess()'), false);
  s.c.user = {...google('kjbrona@gmail.com'), providerData: [{providerId:'password'}]};
  s.run('acceptAccount(user)');
  assert.equal(s.run('hasEditorAccess()'), false);

  const callbacks = [];
  s.c.watch = (options, callback) => { callbacks.push(callback); return () => {}; };
  s.run('firebaseDb = { collection: () => ({doc: () => ({onSnapshot: watch})}) }');
  s.c.user = google('editor@example.com');
  s.run('acceptAccount(user)');
  assert.equal(s.run('hasEditorAccess()'), false);
  const snapshot = (enabled, cached = false) => ({exists:true, data:()=>({enabled}), metadata:{fromCache:cached}});
  callbacks[0](snapshot(true, true));
  assert.equal(s.run('hasEditorAccess()'), false);
  callbacks[0](snapshot(true));
  assert.equal(s.run('canEditServer()'), true);
  assert.equal(s.run('isOwner()'), false);
  s.run('serverProfiles.push({id:"ranch",name:"Ranch"})');
  // A global grant is not keyed by the selected server.
  assert.equal(s.run('hasEditorAccess()'), true);
  callbacks[0](snapshot(false));
  assert.equal(s.run('canEditServer()'), false);
  s.run('acceptAccount(null)');
  callbacks[0](snapshot(true));
  assert.equal(s.run('hasEditorAccess()'), false);

  // Existing unsynced marker backups survive sign-out and denied retries.
  local.setItem('explorer-pending-local-markers','true');
  local.setItem('rosalitarp-explorer-markers','[{"id":"keep"}]');
  await s.run('saveMarkers([])');
  assert.equal(local.getItem('rosalitarp-explorer-markers'),'[{"id":"keep"}]');
  assert.equal(local.getItem('explorer-pending-local-markers'),'true');
  assert.equal(cloud.get('markers').size, 0);
  // Explicit retry merges without dropping cloud-only IDs or crossing servers.
  const marker = {id:'local', name:'Ranch backup', category:'npcs', type:'fence', x:10, y:20};
  cloud.get('markers').set('cloud-only', {...marker, id:'cloud-only'});
  s.c.getMarkersForExport = () => [marker];
  s.c.confirm = () => true;
  s.c.user = google('kjbrona@gmail.com');
  s.run('acceptAccount(user)');
  await s.run('syncLocalMarkers()');
  assert.equal(cloud.get('markers').size, 2);
  assert.equal(cloud.get('markers').get('local').name, 'Ranch backup');
  assert.equal(local.getItem('explorer-pending-local-markers'), null);
  console.log('PASS: signed-out/unverified viewers, verified owner, global editor grant/revocation, stale callbacks, cached grants, archive guards, account-switch queue protection, and pending local preservation.');
  console.log('PASS: explicit local sync retains cloud-only markers and clears pending state only after success.');
}
main().catch(error => {console.error(error); process.exitCode=1;});

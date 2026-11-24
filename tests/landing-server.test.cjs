const assert = require('node:assert/strict');
const {session, local, store, cloud, collection} = require('./server-profiles.test.cjs');
async function main() {
  store.clear(); cloud.clear();
  const ranch = {id:'original-ranch-id', name:'Ranch Roleplay', status:'active'};
  local.setItem('explorer-server-profiles', JSON.stringify([ranch]));
  const returning = session('rosalitarp', false);
  assert.equal(returning.run('activeServerId'), ranch.id);
  assert.equal(session('rosalitarp').run('activeServerId'), 'rosalitarp');
  assert.equal(local.getItem('explorer-explicit-server-switch'), null);
  // Reproduce the live failure: Ranch exists locally but only Rosalita is shared.
  const owner = session(ranch.id);
  let shared = null;
  let writes = 0;
  owner.c.firebaseRegistry = {
    collection: name => ({doc: id => ({name, id})}),
    runTransaction: operation => operation({
      get: async ref => { assert.equal(ref.id, ranch.id); return {exists: !!shared}; },
      set: (ref, value) => { writes++; shared = value; },
    }),
  };
  owner.run('firebaseDb = firebaseRegistry');
  assert.equal(await owner.run('publishMissingLandingProfile()'), true);
  assert.equal(shared.id, ranch.id);
  shared.status = 'archived';
  assert.equal(await owner.run('publishMissingLandingProfile()'), false);
  assert.equal(shared.status, 'archived');
  assert.equal(writes, 1);
  owner.c.isOwner = () => false;
  assert.equal(await owner.run('publishMissingLandingProfile()'), false);
  // A first-time visitor learns the actual ID from the cloud registry.
  store.clear();
  await collection('serverProfiles').doc(ranch.id).set(ranch);
  const fresh = session('rosalitarp', false);
  await fresh.run('initializeFirebaseStorage()');
  await fresh.run('refreshServerProfiles()');
  assert.equal(await fresh.run('selectLandingServer()'), true);
  assert.equal(fresh.reloads(), 1);
  assert.equal(local.getItem('explorer-explicit-server-switch'), ranch.id);
  assert.equal(cloud.get('markers').size, 0);
  local.setItem('explorer-server-profiles', JSON.stringify([{...ranch,status:'archived'}]));
  assert.equal(session('rosalitarp',false).run('activeServerId'), 'rosalitarp');
  console.log('PASS: Ranch entry default, existing saved selection ignored, deliberate switches retained, cloud-discovered original ID, archived fallback, and no marker writes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

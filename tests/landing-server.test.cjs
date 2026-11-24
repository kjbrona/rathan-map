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

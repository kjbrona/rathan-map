const assert = require('node:assert/strict');
const vm = require('node:vm');
const {TextEncoder} = require('node:util');
const {randomUUID} = require('node:crypto');
const {session,local,read,store} = require('./server-profiles.test.cjs');

function client(id='ranch') {
  const s=session(id);
  Object.assign(s.c,{TextEncoder,crypto:{randomUUID},markers:[],getMarkerById:id=>s.c.markers.find(m=>m.id===id)});
  vm.runInContext(read('js/fenceTracking.js'),s.c);
  s.run('refreshFenceViews=()=>{};renderFencePanel=()=>{};fenceTracking=emptyFenceTracking();fenceTrackingReady=true;');
  return s;
}

async function main() {
  store.clear();local.setItem('explorer-server-profiles',JSON.stringify([{id:'ranch',name:'Ranch Roleplay'},{id:'other',name:'Other'}]));
  const s=client();
  const evalWith=(code,values)=>{Object.assign(s.c,values);return s.run(code);};
  for (const [date,expected] of [
    ['2026-11-27T07:59:59.999Z','2026-11-20T08:00:00.000Z'],
    ['2026-11-27T08:00:00.000Z','2026-11-27T08:00:00.000Z'],
    ['2027-01-01T07:59:59Z','2026-12-25T08:00:00.000Z'],
    ['2027-01-01T08:00:00Z','2027-01-01T08:00:00.000Z'],
    ['2026-03-08T12:00:00Z','2026-03-06T08:00:00.000Z'],
    ['2026-11-01T12:00:00Z','2026-10-30T08:00:00.000Z'],
  ]) assert.equal(evalWith('rotatingNpcBoundary(date,FENCE_SCHEDULE).id',{date}),expected);
  assert.equal(client('rosalitarp').run('fenceTracking.schedule'),null);
  assert.equal(client('other').run('fenceTracking.schedule'),null);
  const legacy={id:'legacy',category:'npcs',type:'fence',x:1,y:2,name:'Old fence',knownBy:['jim'],notes:'Keep me'};
  const unknown={...legacy,id:'unknown',fenceConfirmed:false};
  const now=Date.parse('2026-11-27T09:00:00Z');
  Object.assign(s.c,{legacy,unknown,now});
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now).state'),'known');
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now).count'),0);
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now).first'),undefined);
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).state'),'unconfirmed');
  s.run('fenceTracking=applyFenceObservation(fenceTracking,unknown,"not-found","Jim",now,"obs1")');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).confirmed'),false);
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).state'),'searched');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now+604800000).state'),'unconfirmed');
  s.run('fenceTracking=applyFenceObservation(fenceTracking,legacy,"found","Tom",now,"obs2")');
  s.run('fenceTracking=applyFenceObservation(fenceTracking,legacy,"found","Tom",now+1,"obs3")');
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now).count'),1);
  s.run('fenceTracking=applyFenceObservation(fenceTracking,unknown,"found","Jim",now+2,"obs4")');
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now).state'),'known');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).state'),'current');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now+604800000).state'),'known');
  assert.equal(s.run('fenceLocationInfo(unknown,applyFenceObservation(fenceTracking,unknown,"found","Jim",now+604800000,"next-week"),now+604800000).count'),2);
  assert.equal(s.run('fenceSearchSummary([legacy,unknown],fenceTracking,now).percent'),100);
  s.run('fenceTracking=applyFenceObservation(fenceTracking,unknown,"clear","Jim",now+3,"obs5")');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).state'),'known');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).count'),1);
  s.run('fenceTracking=applyFenceObservation(fenceTracking,legacy,"not-found","Tom",now+4,"obs6")');
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now).confirmed'),true);
  assert.equal(s.run('fenceLocationInfo(legacy,fenceTracking,now+604800000*5).state'),'known');
  assert.equal(s.run('fenceTracking.observations.length'),6);
  s.run('fenceTracking=applyFenceObservation(fenceTracking,unknown,"correct","Jim",now+5,"unused",{id:"obs4",reason:"Wrong NPC"})');
  assert.equal(s.run('fenceLocationInfo(unknown,fenceTracking,now).count'),0);
  assert.equal(s.run('fenceTracking.observations.length'),6);
  assert(s.run('fenceTracking.observations.find(o=>o.id==="obs4").invalidated'));
  assert.throws(()=>s.run('validateFenceTracking(fenceTracking,"other")'));
  assert.throws(()=>s.run('validateFenceTracking({...fenceTracking, observations:[{...fenceTracking.observations[0],rotationId:"2026-11-28"}]},"ranch")'));

  // Optimistic Firestore test double: retries on document-version contention.
  // No production credentials or data are used.
  const docs=new Map(), versions=new Map();const watchers=[];
  let offline=false, retries=0;
  const ref=path=>({path,collection:name=>coll(path+'/'+name)});
  const coll=path=>({doc:id=>ref(path+'/'+id)});
  const db={collection:coll,async runTransaction(callback){
    if(offline) throw Error('offline');
    for(let attempt=0;attempt<10;attempt++){
      const reads=new Map(),writes=new Map();
      const result=await callback({get:async r=>{
        reads.set(r.path,versions.get(r.path)||0);const value=docs.get(r.path);
        return {exists:value!==undefined,data:()=>value===undefined?undefined:JSON.parse(JSON.stringify(value))};
      },set:(r,value)=>writes.set(r.path,JSON.parse(JSON.stringify(value)))});
      if([...reads].some(([p,v])=>(versions.get(p)||0)!==v)){retries++;continue;}
      for(const [p,v] of writes){docs.set(p,v);versions.set(p,(versions.get(p)||0)+1);}
      watchers.forEach(f=>f());return result;
    }throw Error('too much contention');
  }};
  const a=client(),b=client();
  for(const c of [a,b]){c.c.db=db;c.run('firebaseDb=db');c.c.markers=[legacy,unknown];}
  docs.set('servers/ranch/markers/legacy',legacy);docs.set('servers/ranch/markers/unknown',unknown);
  a.c.marker=legacy;b.c.marker=unknown;
  await Promise.all([a.run('commitFenceObservation(marker,"found",{contributor:"A"})'),b.run('commitFenceObservation(marker,"found",{contributor:"B"})')]);
  const saved=docs.get('servers/ranch/rotatingNpcs/fence');
  assert.equal(saved.observations.length,2);assert(retries>0);
  for(const c of [a,b]){
    c.c.saved=saved;c.run('fenceTracking=saved');
    assert.equal(c.run('markers.filter(m=>fenceLocationInfo(m).state==="current").length'),1);
  }
  b.c.marker=unknown;
  await assert.rejects(b.run('commitFenceObservation(marker,"not-found")'),/CURRENT_CONFLICT/);
  b.c.currentId=saved.current.observationId;
  await b.run('commitFenceObservation(marker,"not-found",{confirmedCurrent:currentId})');
  assert.equal(docs.get('servers/ranch/rotatingNpcs/fence').current,null);
  const before=JSON.stringify(docs.get('servers/ranch/rotatingNpcs/fence'));
  offline=true;
  await assert.rejects(a.run('commitFenceObservation(marker,"found")'),/offline/);
  assert.equal(JSON.stringify(docs.get('servers/ranch/rotatingNpcs/fence')),before);
  offline=false;
  docs.set('serverProfiles/ranch',{status:'archived'});
  await assert.rejects(a.run('commitFenceObservation(marker,"found")'),/Server or account changed/);
  assert.equal(JSON.stringify(docs.get('servers/ranch/rotatingNpcs/fence')),before);
  assert(!docs.has('servers/other/rotatingNpcs/fence'));
  docs.set('serverProfiles/ranch',{status:'active'});
  const delayed=client();delayed.c.marker=legacy;
  delayed.c.testNow=Date.parse('2026-11-27T07:59:59.999Z');
  delayed.c.delayedDb={collection:db.collection,runTransaction:callback=>db.runTransaction(tx=>callback({
    set:tx.set,get:async ref=>{const snapshot=await tx.get(ref);delayed.c.testNow=Date.parse('2026-11-27T08:00:00.000Z');return snapshot;},
  }))};
  delayed.run('firebaseDb=delayedDb;Date.now=()=>testNow');
  await delayed.run('commitFenceObservation(marker,"found")');
  assert.equal(docs.get('servers/ranch/rotatingNpcs/fence').observations.at(-1).rotationId,'2026-11-27T08:00:00.000Z');
  assert.equal(delayed.run('isTrackedFence({category:"npcs",type:"shady-dealer"})'),false);
  // A historical pointer stays historical when imported in a later rotation.
  delayed.c.oldBackup=JSON.parse(JSON.stringify(docs.get('servers/ranch/rotatingNpcs/fence')));
  delayed.c.testNow=Date.parse('2026-12-04T08:00:00.000Z');
  // Use the normal transaction double so the test clock is no longer changed by reads.
  delayed.c.db=db;delayed.run('firebaseDb=db');
  await delayed.run('importFenceTracking(oldBackup,true)');
  assert.equal(docs.get('servers/ranch/rotatingNpcs/fence').current,null);
  assert.equal(docs.get('servers/ranch/rotatingNpcs/fence').observations.length,delayed.c.oldBackup.observations.length);
  delayed.c.oldBackup.serverId='other';
  await assert.rejects(delayed.run('importFenceTracking(oldBackup)'),/Invalid Fence/);
  console.log('PASS: fixed UTC/DST/year boundaries, all derived states, expiry, legacy preservation, distinct counts, corrections, progress, validation, contending clients, single current pointer, conflict confirmation, failed writes, archive guard and server isolation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

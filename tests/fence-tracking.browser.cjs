const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.js':'application/javascript','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.route('**/js/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'js/auth.js'),'utf8')+'\naccountRole="owner";accountUser={email:OWNER_EMAIL};'}));
    await page.addInitScript(()=>{
      const profile={id:'ranch',name:'Ranch Roleplay',status:'active'};
      localStorage.setItem('explorer-server-profiles',JSON.stringify([profile]));
      const docs=new Map([['serverProfiles/ranch',profile],['servers/ranch/markers/legacy',{id:'legacy',category:'npcs',type:'fence',name:'Legacy Fence',x:4000,y:3000,knownBy:['tom'],notes:'Original notes'}]]);
      const subs=new Map();
      const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
      const snap=p=>({exists:docs.has(p),id:p.split('/').pop(),data:()=>clone(docs.get(p)),metadata:{fromCache:false}});
      const query=p=>({docs:[...docs].filter(([k])=>k.startsWith(p+'/')&&k.slice(p.length+1).indexOf('/')<0).map(([k])=>({...snap(k),ref:ref(k)}))});
      const emit=()=>{for(const [p,handlers] of subs) for(const [cb,isDoc] of handlers)cb(isDoc?snap(p):query(p));};
      const watch=(p,isDoc,args)=>{const cb=args.find(a=>typeof a==='function');if(!subs.has(p))subs.set(p,[]);subs.get(p).push([cb,isDoc]);queueMicrotask(()=>cb(isDoc?snap(p):query(p)));return()=>{};};
      const ref=p=>({path:p,collection:n=>col(p+'/'+n),get:async()=>snap(p),set:async v=>{docs.set(p,clone(v));emit();},delete:async()=>{docs.delete(p);emit();},onSnapshot:(...args)=>watch(p,true,args)});
      const col=p=>({doc:id=>ref(p+'/'+id),get:async()=>query(p),onSnapshot:(...args)=>watch(p,false,args)});
      const db={collection:col,batch:()=>{const ops=[];return{set:(r,v)=>ops.push(()=>docs.set(r.path,clone(v))),delete:r=>ops.push(()=>docs.delete(r.path)),commit:async()=>{ops.forEach(f=>f());emit();}};},runTransaction:async cb=>{
        if(window.failFenceWrites)throw Error('test offline');const writes=[];
        const result=await cb({get:async r=>snap(r.path),set:(r,v)=>writes.push(()=>docs.set(r.path,clone(v)))});
        writes.forEach(f=>f());emit();return result;
      }};
      window.firebase={apps:[{}],app:()=>({}),firestore:()=>db};
    });
    await page.goto(origin);await page.waitForFunction(()=>fenceTrackingReady && markers.length===1);
    await page.locator('#fence-panel > summary').click();
    assert((await page.locator('#fence-counts').innerText()).includes('Known: 1'));
    assert((await page.locator('#fence-countdown').innerText()).includes('Relocates in'));
    for(const [state,name] of [['unconfirmed','Potential'],['not-found','Searched'],['known','Historical'],['found','Current']]){
      await page.evaluate(()=>openMarkerDialog({lat:3100,lng:4100}));
      await page.locator('#marker-category').selectOption('npcs');await page.locator('#marker-type').selectOption('fence');
      await page.locator('#fence-create-state').selectOption(state);await page.locator('#marker-name').fill(name);await page.locator('#marker-save').click();
      await page.waitForFunction(()=>!fenceTrackingBusy && document.getElementById('marker-dialog').classList.contains('hidden'));
    }
    assert.equal(await page.evaluate(()=>markers.length),5);
    assert((await page.locator('#fence-current').innerText()).includes('Search successful'));
    assert.equal(await page.evaluate(()=>new Set(markers.map(m=>fenceLocationInfo(m).state)).size),4);
    const preview=await browser.newPage({viewport:{width:900,height:260}});
    await preview.setContent(`<body style="background:#1b140e;color:#f2e2bd;font:16px sans-serif;display:flex;gap:35px;padding:20px">${['current','known','searched','unconfirmed'].map(state=>`<div style="text-align:center"><p>${state}</p><div style="margin:auto;background:#d8c3a3;border:2px solid #c49a5a;border-radius:50%;width:24px;height:24px;display:grid;place-items:center"><img width="17" height="17" src="${origin}/images/icons/fence-${state}.svg"></div><p><img width="72" height="72" src="${origin}/images/icons/fence-${state}.svg"></p></div>`).join('')}</body>`);
    await preview.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
    const iconPreview=path.join(require('node:os').tmpdir(),'rathan-fence-icons.png');await preview.screenshot({path:iconPreview});console.log(`Icon preview: ${iconPreview}`);await preview.close();
    await page.locator('#fence-state-filter').selectOption('unconfirmed');assert.equal(await page.locator('.category-marker').count(),1);
    await page.locator('#fence-state-filter').selectOption('');
    await page.locator('#fence-unchecked').check();assert.equal(await page.locator('.category-marker').count(),3);
    await page.locator('#fence-unchecked').uncheck();
    await page.evaluate(()=>selectMarker(markers.find(m=>m.name==='Current').id));
    page.on('dialog',d=>d.accept(d.type()==='prompt'?'Tester':undefined));
    await page.locator('#fence-marker-details').getByRole('button',{name:'Searched — Not Found',exact:true}).click();
    await page.waitForFunction(()=>!fenceTrackingBusy && !fenceTracking.current);
    await page.locator('#fence-marker-details').getByRole('button',{name:'Clear Weekly Search Status',exact:true}).click();
    await page.waitForFunction(()=>!fenceTrackingBusy && fenceLocationInfo(getMarkerById(selectedMarkerId)).state==='known');
    const exported=await page.evaluate(async()=>({backup:createMarkerExport(markers),archive:await createServerArchive()}));
    assert(exported.backup.fenceTracking.observations.length>=4);assert.deepEqual(exported.archive.fenceTracking,exported.backup.fenceTracking);
    assert.equal(await page.evaluate(data=>validateMarkerImport(data).ok,exported.backup),true);
    await page.evaluate(data=>importFenceTracking(data),exported.backup.fenceTracking);
    const before=await page.evaluate(()=>fenceTracking.observations.length);
    await page.evaluate(()=>window.failFenceWrites=true);
    await page.locator('#fence-marker-details').getByRole('button',{name:'Fence Found Here',exact:true}).click();
    await page.waitForFunction(()=>!fenceTrackingBusy);
    assert.equal(await page.evaluate(()=>fenceTracking.observations.length),before);
    // Advance only the application's clock; the refresh timer derives expiry without writes.
    await page.evaluate(()=>{const next=rotatingNpcBoundary(Date.now(),fenceTracking.schedule).next;Date.now=()=>next;tickFenceRotation();});
    assert.equal(await page.evaluate(()=>markers.some(m=>['searched','current'].includes(fenceLocationInfo(m).state))),false);
    assert.equal(await page.evaluate(()=>fenceTracking.observations.length),before);
    await page.evaluate(()=>selectMarker('legacy'));
    await page.waitForFunction(()=>document.querySelectorAll('.leaflet-popup').length===1);
    assert.equal(await page.locator('.leaflet-popup').getByRole('button',{name:'Fence Found Here',exact:true}).isVisible(),true);
    assert((await page.locator('.leaflet-popup').innerText()).includes('Original notes'));
    assert.deepEqual(errors,[]);
    console.log('PASS: browser Fence panel, four creation states/icons, actions, conflict confirmation, state/unchecked filters, countdown, archive/export/import, failure handling, and open-page rotation expiry.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());

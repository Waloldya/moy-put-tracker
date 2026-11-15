'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const C=require('../tracker-core.js');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright'));
// Reproduce the original cache-first worker and its v1-only import contract.
const oldWorker=`const CACHE='moy-put-workout-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./app.js','./style.css','./data.js'])).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)))});`;
const oldHTML=`<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><main id="app"></main><script src="./app.js"></script><script>navigator.serviceWorker.register('./sw.js')</script></body></html>`;
const oldApp=`document.getElementById('app').innerHTML='<label>Загрузить копию<input id="import-file" type="file"></label><p id="legacy-error"></p>';document.getElementById('import-file').onchange=async e=>{const data=JSON.parse(await e.target.files[0].text());if(data.app!=='moy-put-workout'||!data.sessions)document.getElementById('legacy-error').textContent='Файл не является резервной копией МОЙ ПУТЬ';};`;
(async()=>{
 let serveLegacy=true,serveOldWorker=true,browser;
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname.endsWith('/')?'index.html':pathname.slice(1);
  const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(name)]||'text/plain');
  if(name==='sw.js'&&serveOldWorker){res.end(oldWorker);return;}
  if(serveLegacy&&['index.html','app.js'].includes(name)){res.end(name==='index.html'?oldHTML:oldApp);return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/';
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();
  await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.reload();
  const workout={sessions:{'pull__2026-11-02':{day:'pull',date:'2026-11-02',bodyWeight:'',notes:'Preserve this session',rpe:'',exercises:{sumo:[{weight:'80',count:'8',done:true}]},completedAt:null}}};
  const life=C.newLife();life.days['2026-11-02']={breakfast:[{id:'test-portion',name:'Test food',grams:100,nutrients:{kcal:100}}]};
  await page.evaluate(({workout,life})=>{localStorage.setItem('moyput_workouts_v1',JSON.stringify(workout));localStorage.setItem('moyput_life_v2',JSON.stringify(life));},{workout,life});
  const settings={app:'moy-put',version:2,workouts:{sessions:{}},life:C.newLife()};settings.life.goals.kcal=2200;
  await page.locator('#import-file').setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(settings))});await page.getByText('Файл не является резервной копией МОЙ ПУТЬ',{exact:true}).waitFor();
  serveLegacy=false;
  // Keep the old worker active: a cache-busted HTML URL must also get current assets.
  await page.goto(base+'index.html?update=2.0.1');await page.getByRole('button',{name:'Питание',exact:true}).waitFor({timeout:5000});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_workouts_v1'))),workout);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_life_v2'))),life);
  await page.locator('#bottomnav').getByRole('button',{name:'Данные',exact:true}).click();await page.locator('#life-import').setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(settings))});await page.getByRole('button',{name:'Объединить записи',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_life_v2')).goals.kcal),2200);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_workouts_v1')).sessions['pull__2026-11-02'].exercises.sumo[0].weight),'80');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_life_v2')).days['2026-11-02'].breakfast.length),1);
  serveOldWorker=false;
  await page.evaluate(async()=>{const changed=new Promise((resolve,reject)=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});setTimeout(()=>reject(Error('Worker did not update')),30000);});const registration=await navigator.serviceWorker.getRegistration();await registration.update();await changed;});
  await context.setOffline(true);await page.goto(base);await page.getByRole('button',{name:'Питание',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_life_v2')).goals.kcal),2200);
  console.log('PASS: reproduced v1 import rejection; recovery URL opens current UI through old cache, preserves both diaries, imports goals and remains available offline.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

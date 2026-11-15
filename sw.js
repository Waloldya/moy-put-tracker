'use strict';
const VERSION='2.0.1',CACHE='moy-put-workout-v'+VERSION;
const ASSETS=['./','./index.html','./style.css','./life.css','./data.js','./tracker-core.js','./food-provider.js','./life-ui.js','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png','./foods/index.json'].map(url=>/\.(js|css)$/.test(url)?url+'?v='+VERSION:url);
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(ASSETS);
 const index=await (await cache.match('./foods/index.json')).json();
 for(let i=0;i<index.chunks.length;i+=4)await cache.addAll(index.chunks.slice(i,i+4).map(name=>'./foods/'+name));
 await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('moy-put-workout-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(event.request);if(hit)return hit;
 try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell;}return new Response('Нет соединения',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
 })());
});

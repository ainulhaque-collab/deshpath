/* Only same-origin static assets are cached. Account/API responses are excluded. */
'use strict';
const CACHE='deshpath-journal-20261019-pages-1';
const CORE=['./','./index.html','./styles.css','./premium.css','./edition.css','./journey-art.css','./discovery.css','./world-passport.css','./games.css','./journal-features.css','./data.js','./foods.js','./food-images.js','./content-en.js','./edition-copy.js','./language.js','./map.js','./journal-kit.js','./discovery-data.js','./world-data.js','./world-passport.js','./games.js','./photo-map.js','./map-ui.js','./planner.js','./community-profile.js','./cloud-config.js','./cloud.js','./catalog.js','./community-online.js','./admin.js','./admin-auth.js','./admin-auth.css','./page-router.js','./page-router.css','./community-online.css','./ranked-games.js','./ranked-games.css','./app.js','./journey-art.js','./edition.js','./pwa.js','./assets/favicon.svg','./manifest.webmanifest'];
const eligible=url=>url.origin===self.location.origin&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/backend/')&&!url.pathname.includes('/.git')&&!url.search;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(key=>key.startsWith('deshpath-journal-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||!eligible(url))return;
  // Network-first serves current Git deployments; an offline copy is the fallback.
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok&&response.type==='basic')await cache.put(event.request,response.clone()).catch(()=>{});return response;}catch{const saved=await cache.match(event.request);if(saved)return saved;if(event.request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell;}return new Response('Offline: open this page online once to save it.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='DESHPATH_OFFLINE')return;const port=event.ports[0];
  event.waitUntil((async()=>{try{const response=await fetch('./offline-assets.json',{cache:'no-cache'});if(!response.ok)throw Error('MANIFEST');const paths=await response.json();if(!Array.isArray(paths)||paths.length>500)throw Error('MANIFEST');const urls=paths.map(p=>new URL(p,self.location.href)).filter(eligible);const cache=await caches.open(CACHE);let done=0;for(let i=0;i<urls.length;i+=4){await Promise.all(urls.slice(i,i+4).map(async url=>{const res=await fetch(url.href,{cache:'reload'});if(!res.ok)throw Error('ASSET');await cache.put(url.href,res);}));done=Math.min(i+4,urls.length);port?.postMessage({done,total:urls.length});}port?.postMessage({complete:true,total:urls.length});}catch{port?.postMessage({error:true});}})());
});

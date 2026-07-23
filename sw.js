const CACHE='tossed-v2';
const ASSETS=['./','./index.html','./styles.css','./manifest.webmanifest','./src/app.js','./src/config.js','./src/services/storage.js','./src/services/supabase.js','./src/services/engine.js','./src/games/riley.js','./src/ui/fullscreen.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request))));

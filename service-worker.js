const CACHE_NAME='today-eat-pwa-v5.11';
const APP_SHELL=[
  '/Today-eat/',
  '/Today-eat/index.html',
  '/Today-eat/style-v5.css?v=5.11',
  '/Today-eat/app-v5.js?v=5.11',
  '/Today-eat/manifest.webmanifest?v=5.11',
  '/Today-eat/manifest.json',
  '/Today-eat/icons/icon-192.png',
  '/Today-eat/icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(key=>{
      if(key!==CACHE_NAME) return caches.delete(key);
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  event.respondWith(
    fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      return response;
    }).catch(async ()=>{
      const cached=await caches.match(event.request);
      if(cached) return cached;
      if(event.request.mode==='navigate') return caches.match('/Today-eat/index.html');
      return new Response('',{status:504,statusText:'Offline'});
    })
  );
});

const CACHE='wing-scorecard-v1';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key!==CACHE)await caches.delete(key);}await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:'no-store'});
        const c=await caches.open(CACHE);c.put('./index.html',fresh.clone());
        return fresh;
      }catch(e){return (await caches.match('./index.html'))||Response.error();}
    })());
    return;
  }
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(event.request,{cache:'no-store'});
      const c=await caches.open(CACHE);c.put(event.request,fresh.clone());
      return fresh;
    }catch(e){return (await caches.match(event.request))||Response.error();}
  })());
});
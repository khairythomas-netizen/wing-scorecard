const CACHE='wingz-v3';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./wingz-logo.jpg'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key!==CACHE)await caches.delete(key);}await self.clients.claim();})());});
function personalizeIndex(html){
  html=html.replace(/<svg class="brandmark"[\s\S]*?<\/svg>/,'<img class="brandmark" src="wingz-logo.jpg" alt="WingZ logo" style="object-fit:contain;border-radius:8px">');
  html=html.replace('<section id="feed" class="page active">','<section id="feed" class="page">');
  html=html.replace('<section id="rate" class="page">','<section id="rate" class="page active">');
  html=html.replace('<button class="active" data-page="feed">','<button data-page="feed">');
  html=html.replace('<button class="rate" data-page="rate">','<button class="rate active" data-page="rate">');
  return html;
}
async function indexResponse(request){
  try{
    const fresh=await fetch(request,{cache:'no-store'});
    const html=personalizeIndex(await fresh.text());
    const response=new Response(html,{status:fresh.status,statusText:fresh.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    const c=await caches.open(CACHE);c.put('./index.html',response.clone());
    return response;
  }catch(e){
    const cached=await caches.match('./index.html');
    if(!cached)return Response.error();
    return new Response(personalizeIndex(await cached.text()),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  if(event.request.mode==='navigate'){
    event.respondWith(indexResponse(event.request));
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
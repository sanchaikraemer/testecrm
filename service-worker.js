const CACHE='levecrm-v43';
const CORE=[
  './','./index.html','./propostas.html','./styles.css?v=43','./app.js?v=43','./propostas.js?v=43',
  './levecrm-logo.png','./manifest.webmanifest','./icon-192.png','./icon-512.png','./leads-iniciais.json?v=43'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
        return response;
      }catch{
        const exact=await caches.match(request);
        if(exact)return exact;
        const fallback=url.pathname.endsWith('propostas.html')?'./propostas.html':'./index.html';
        return (await caches.match(fallback))||Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const isCritical=/\.(?:js|css|json)$/.test(url.pathname);
    if(isCritical){
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
        return response;
      }catch{
        return (await caches.match(request))||Response.error();
      }
    }
    const cached=await caches.match(request);
    const network=fetch(request).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
      return response;
    }).catch(()=>null);
    return cached||(await network)||Response.error();
  })());
});


self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{data={title:'LeveCRM',body:event.data?.text()||'Você tem um compromisso.',url:'./'};}
  event.waitUntil(self.registration.showNotification(data.title||'LeveCRM',{body:data.body||'Você tem um compromisso.',icon:'./icon-192.png',badge:'./icon-192.png',tag:'levecrm-agenda',data:{url:data.url||'./'}}));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const target=event.notification.data?.url||'./';
    for(const client of list){if('focus' in client){client.navigate?.(target);return client.focus();}}
    return clients.openWindow(target);
  }));
});

const CACHE='levecrm-v64-direciona-ai-pro';
const SHARE_CACHE='direciona-sharetarget-stable';
const ZIP_KEYS=['/__direciona_shared_zip__','./__direciona_shared_zip__','__direciona_shared_zip__'];
const CORE=[
  './','./index.html','./propostas.html','./styles.css?v=58','./app.js?v=64','./propostas.js?v=56',
  './levecrm-logo.png','./manifest.webmanifest','./icon-192.png','./icon-512.png','./leads-iniciais.json?v=56',
  './vendor/jszip.min.js?v=57','./share.html'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(CORE.map(u=>cache.add(u)))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==SHARE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.method==='POST'&&(url.pathname.endsWith('/share-target')||url.pathname.endsWith('/share.html'))){
    event.respondWith(handleShare(request));
    return;
  }

  if(url.pathname.includes('/api/'))return;
  if(request.method!=='GET')return;

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
    const isCritical=/\.(?:js|css|json|webmanifest)$/.test(url.pathname);
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

async function handleShare(request){
  try{
    const form=await request.formData();
    const files=form.getAll('zip');
    const file=files&&files[0];
    if(file&&typeof file.arrayBuffer==='function'){
      const body=await file.arrayBuffer();
      const cache=await caches.open(SHARE_CACHE);
      const headers=new Headers({
        'Content-Type':file.type||'application/zip',
        'X-File-Name':encodeURIComponent(file.name||'conversa-whatsapp.zip'),
        'X-Shared-At':new Date().toISOString(),
        'Cache-Control':'no-store'
      });
      await Promise.all(ZIP_KEYS.map(k=>cache.put(k,new Response(body.slice(0),{headers}))));
    }
  }catch(_){ }
  const target=new URL('./?shared=1&view=direciona',self.registration.scope).toString();
  return Response.redirect(target,303);
}

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

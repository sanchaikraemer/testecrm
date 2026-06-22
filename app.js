/* LeveCRM v35 — código consolidado
   Gerado a partir do arquivo recebido em 22/06/2026. */

/* ===== main ===== */
const F = (name) => document.querySelector(`[name="${name}"]`) || document.getElementById(name);
let currentView = 'kanban';
let SHOW_LOST = false;
let SHOW_SB = false;
let ALL = [];
let ATTACHES = [];
let ATTACHES_BY_LEAD = {};
let editingId = null;
let origSnap = null;
let SELECTED_LEAD_ID = null;
const NOTIFICATION_TIMERS = new Map();

/* ══════════════════════════════════════
   CONFIG SUPABASE
══════════════════════════════════════ */
const SB_URL='https://lnrbpiklzymblpyrobwx.supabase.co';
window.SB_URL=SB_URL;
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucmJwaWtsenltYmxweXJvYnd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjY0MjcsImV4cCI6MjA4NjQwMjQyN30.ybNh5WhAPWgAMW3gLKrxCGFfIl_9oH31Ajv8qqjtelo';
const TBL='leads';
const ATT_TBL='lead_attachments';
window.SB_KEY=SB_KEY;
const ATT_BKT='lead-attachments';
const AG_TBL='agenda_eventos';
const ACCESS_TBL='crm_access_users';
const ACCESS_SESSION_KEY='levecrm_access_session_v1';

/* ══════════════════════════════════════
   LISTAS
══════════════════════════════════════ */
const LISTS={
  empreendimento:['Personalité','Quality','Prime','Evolutti','Boulevard','Premium Office','Renaissance','NVR I–II','NVR III','Outros'],
  etapa:['NOVO / INICIAL','ATENDIMENTO','VISITA / PROPOSTA','NEGOCIAÇÃO','STAND BY','PERDIDO'],
  prioridade:['Fechado','Altíssima','Alta','Média','Baixa'],
  origem:['Meta','Instagram','Indicação','Corretor','Site','WhatsApp','Ligação','Presencial'],
  responsavel:[],
  visita:['Não','Corretor','Senger','Ambos'],
  motivo_perda:['Investimento baixo','Parcelamento direto','Permuta inviável','Vai aguardar','Curiosidade','Após valor some','Comprou outro','Restritivo CPF','Insatisfação c/ produto','Outro']
};
const ETAPA_MAP={'Novo':'NOVO / INICIAL','Em atendimento':'ATENDIMENTO','Evoluindo':'VISITA / PROPOSTA','Negociação':'NEGOCIAÇÃO','Stand by':'STAND BY','Perdido':'PERDIDO','Contato feito':'ATENDIMENTO','Visitou':'VISITA / PROPOSTA','Proposta':'VISITA / PROPOSTA'};
const MOTIVO_MAP={'Preço':'Investimento baixo','Parcelamento':'Parcelamento direto','Financiamento':'Parcelamento direto','Nunca respondeu':'Após valor some','Escolheu outro':'Comprou outro','Comprou outro':'Comprou outro','Sumiu':'Após valor some'};

function loadAdminData(){
  try{const r=lsGet('crm_resp');const e=lsGet('crm_emp');const o=lsGet('crm_orig');if(r){const a=JSON.parse(r);if(a.length)LISTS.responsavel=a.map(x=>x.nome||x);}if(e){const a=JSON.parse(e);if(a.length)LISTS.empreendimento=a.map(x=>x.nome||x);}if(o){const a=JSON.parse(o);if(a.length)LISTS.origem=a;}}catch(e){}}
function getAdminResp(){try{const r=lsGet('crm_resp');return r?JSON.parse(r):LISTS.responsavel.map(n=>({id:cid(),nome:n,fone:'',creci:''}));}catch{return[];}}
function getAdminEmps(){try{const e=lsGet('crm_emp');return e?JSON.parse(e):LISTS.empreendimento.map(n=>({id:cid(),nome:n,tipo:'',valor:'',status:'Disponível'}));}catch{return[];}}
function getAdminOrigs(){try{const o=lsGet('crm_orig');return o?JSON.parse(o):[...LISTS.origem];}catch{return[];}}

/* ══════════════════════════════════════
   NORMALIZAÇÃO
══════════════════════════════════════ */
function normEtapa(e){const s=String(e||'').trim();if(LISTS.etapa.includes(s))return s;if(ETAPA_MAP[s])return ETAPA_MAP[s];return'ATENDIMENTO';}
function normMotivo(m){const v=String(m||'').trim();if(!v)return'';if(LISTS.motivo_perda.includes(v))return v;if(MOTIVO_MAP[v])return MOTIVO_MAP[v];return v;}
function normVisita(v){const s=String(v||'').trim();return LISTS.visita.includes(s)?s:'Não';}
function normProx(v){const s=String(v??'').trim();return s?s.slice(0,10):null;}

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function cid(){return crypto.randomUUID();}
function pad2(n){return String(n).padStart(2,'0');}
function todayISO(){const d=new Date();return`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
function nowISO(){return new Date().toISOString();}
function obsPfx(d=new Date()){return`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())} - `;}
function dayStart(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function parseDate(iso){if(!iso)return null;const r=String(iso).trim();const od=/^(\d{4})-(\d{2})-(\d{2})$/.exec(r);if(od)return new Date(+od[1],+od[2]-1,+od[3]);const ld=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(r);if(ld)return new Date(+ld[1],+ld[2]-1,+ld[3],+ld[4],+ld[5],+(ld[6]||0));const d=new Date(r);return isNaN(d)?null:d;}
function daysSince(iso){const d=parseDate(iso);if(!d)return 0;const diff=Math.floor((dayStart(new Date())-dayStart(d))/86400000);return diff<0?0:diff;}
function escH(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function normPhone(p){const d=String(p||'').replace(/\D/g,'');if(!d)return'';return d.startsWith('55')?d:'55'+d;}
function prioRank(p){return p==='Fechado'?5:p==='Altíssima'?4:p==='Alta'?3:p==='Média'?2:1;}
function toPublicUrl(){return'';}
function fileIcon(fn,ft){const n=String(fn||'').toLowerCase();const t=String(ft||'').toLowerCase();if(t.includes('pdf')||n.endsWith('.pdf'))return'📄';if(t.includes('image')||/\.(png|jpe?g|webp|gif)$/i.test(n))return'🖼️';if(/\.(doc|docx|txt)$/i.test(n))return'📝';if(/\.(xls|xlsx|csv)$/i.test(n))return'📊';return'📎';}



async function getAttachmentSignedUrl(filePath,fileName='arquivo'){
  if(!filePath)throw new Error('Arquivo sem caminho válido.');
  const {data,error}=await AUTH_CLIENT.storage.from(ATT_BKT).createSignedUrl(filePath,300,{download:fileName});
  if(error)throw error;
  if(!data?.signedUrl)throw new Error('Não foi possível criar o link seguro.');
  return data.signedUrl;
}
async function openAttachment(filePath,fileName='arquivo'){
  const popup=window.open('about:blank','_blank');
  try{
    const url=await getAttachmentSignedUrl(filePath,fileName);
    if(popup)popup.location.href=url;else window.location.href=url;
  }catch(e){
    if(popup)popup.close();
    console.error(e);alert('Não foi possível abrir este anexo. Verifique as políticas do Storage.');
  }
}
function showToast(msg,dur=1600){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function setStatus(type,msg){const el=document.getElementById('statusbar');if(!el)return;el.innerHTML='';el.style.display='none';}

/* ══════════════════════════════════════
   ACESSO
══════════════════════════════════════ */
let ACCESS_USER=null;
let appBooted=false;
const ADMIN_EMAILS=['sanchaikraemer3@gmail.com'];
const AUTH_CLIENT=window.supabase.createClient(SB_URL, SB_KEY);
window.AUTH_CLIENT=AUTH_CLIENT;
function lsKey(k){return ACCESS_USER?.id?`${k}_${ACCESS_USER.id}`:k;}
function lsGet(k){return localStorage.getItem(lsKey(k));}
function lsSet(k,v){localStorage.setItem(lsKey(k),v);}
function lsRemove(k){localStorage.removeItem(lsKey(k));}
function accessNormUser(v){return String(v||'').trim().toLowerCase();}
function accessFmt(dt){const d=parseDate(dt);return d?`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`:'—';}
function showAccessError(msg){const el=document.getElementById('accessError');const ok=document.getElementById('accessOk');if(ok)ok.classList.remove('show');if(el){el.textContent=msg;el.classList.add('show');}}
function showAccessOk(msg){const el=document.getElementById('accessOk');const err=document.getElementById('accessError');if(err)err.classList.remove('show');if(el){el.textContent=msg;el.classList.add('show');}}
function clearAccessMessages(){document.getElementById('accessError')?.classList.remove('show');document.getElementById('accessOk')?.classList.remove('show');}
function lockAccess(msg=''){document.body.classList.add('access-locked');document.getElementById('accessOverlay')?.classList.add('show');if(msg)showAccessError(msg);}
function unlockAccess(){document.body.classList.remove('access-locked');document.getElementById('accessOverlay')?.classList.remove('show');}
function setAccessMode(mode='login'){
  const map={login:'panelLogin',cadastro:'panelCadastro',licenca:'panelLicenca'};
  ['tabLogin','tabCadastro','tabLicenca'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  ['panelLogin','panelCadastro','panelLicenca'].forEach(id=>document.getElementById(id)?.classList.remove('show'));
  if(mode==='cadastro'){document.getElementById('tabCadastro')?.classList.add('active');document.getElementById('panelCadastro')?.classList.add('show');}
  else if(mode==='licenca'){document.getElementById('tabLicenca')?.classList.add('active');document.getElementById('panelLicenca')?.classList.add('show');}
  else {document.getElementById('tabLogin')?.classList.add('active');document.getElementById('panelLogin')?.classList.add('show');}
}
function accessPlanMessage(profile){
  const now=Date.now();
  const status=String(profile?.account_status||'trial').toLowerCase();
  const trialEnd=parseDate(profile?.trial_end||'');
  const licenseEnd=parseDate(profile?.license_end||'');
  if(status==='blocked')return{ok:false,msg:'Seu acesso está bloqueado.'};
  if(status==='paused' || status==='pausado')return{ok:false,msg:'Seu acesso está pausado.'};
  if(status==='cancelled' || status==='cancelado')return{ok:false,msg:'Seu acesso foi cancelado.'};
  if(licenseEnd && licenseEnd.getTime()>=now)return{ok:true,msg:`Licença ativa até ${accessFmt(profile.license_end)}.`,kind:'license'};
  if(trialEnd && trialEnd.getTime()>=now)return{ok:true,msg:`Teste grátis ativo até ${accessFmt(profile.trial_end)}.`,kind:'trial'};
  return{ok:false,msg:'Seu teste/licença expirou. Entre e ative uma chave para continuar.'};
}
function saveAccessSession(){/* sessão agora é mantida pelo Supabase Auth */}
function clearAccessSession(){ACCESS_USER=null;}
function applyAccessUser(profile,session){
  const email=accessNormUser(session?.user?.email||profile?.email||'');
  ACCESS_USER={
    id:session?.user?.id||profile?.id||null,
    usuario:email,
    email,
    nome:profile?.nome||session?.user?.user_metadata?.nome||email.split('@')[0]||'Conta',
    is_admin:ADMIN_EMAILS.includes(email),
    status:profile?.account_status||'trial',
    trial_end:profile?.trial_end||'',
    license_end:profile?.license_end||''
  };
  const who=document.getElementById('whoPill');
  if(who){who.innerHTML=`<span class="dot ok"></span>${escH(ACCESS_USER.nome)}${ACCESS_USER.is_admin?' • admin':''}`;who.style.display='inline-flex';}
  const out=document.getElementById('btnLogoutAccess');if(out)out.style.display='inline-flex';
  const adminTab=document.querySelector('.nav-tab[data-view="admin"]');if(adminTab)adminTab.style.display=ACCESS_USER.is_admin?'inline-flex':'none';
  syncSidebarUtilityState();
}
async function fetchMyProfile(userId){
  const rows=await sbFetch(`profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return Array.isArray(rows)&&rows[0]?rows[0]:null;
}
async function ensureProfile(session){
  if(!session?.user?.id)return null;
  let profile=await fetchMyProfile(session.user.id);
  if(profile)return profile;
  showAccessError('Seu cadastro foi criado, mas o perfil ainda não apareceu no banco. Aguarde alguns segundos e tente entrar de novo.');
  return null;
}
async function fetchAccessByCredentials(usuario,senha){
  const email=accessNormUser(usuario), pass=String(senha||'').trim();
  const {data,error}=await AUTH_CLIENT.auth.signInWithPassword({email,password:pass});
  if(error)throw error;
  if(!data?.session)throw new Error('Sessão não retornada no login.');
  const profile=await ensureProfile(data.session);
  return {session:data.session,profile};
}
async function fetchAccessBySession(){
  const {data,error}=await AUTH_CLIENT.auth.getSession();
  if(error)throw error;
  if(!data?.session)return null;
  const profile=await ensureProfile(data.session);
  if(!profile)return null;
  return {session:data.session,profile};
}
async function accessLogin(){
  clearAccessMessages();
  const usuario=document.getElementById('gateUsuario').value.trim();
  const senha=document.getElementById('gateSenha').value.trim();
  if(!usuario||!senha){showAccessError('Preencha e-mail e senha.');return;}
  const btn=document.getElementById('gateEntrar');btn.disabled=true;btn.textContent='Entrando...';
  try{
    const payload=await fetchAccessByCredentials(usuario,senha);
    if(!payload?.profile){showAccessError('Perfil ainda não disponível. Tente novamente em instantes.');return;}
    applyAccessUser(payload.profile,payload.session);
    const check=accessPlanMessage(payload.profile);
    if(!check.ok){lockAccess(check.msg);setAccessMode('licenca');return;}
    unlockAccess();showAccessOk(check.msg);
    if(!appBooted)initApp();else await loadAll();
    setTimeout(clearAccessMessages,1400);
  }catch(e){console.error(e);showAccessError(e?.message?.includes('Invalid login credentials')?'E-mail ou senha não conferem.':'Não consegui validar seu acesso agora.');}
  finally{btn.disabled=false;btn.textContent='Entrar no LeveCRM';}
}
async function accessRegister(){
  clearAccessMessages();
  const nome=(document.getElementById('gateNome').value||'').trim();
  const email=accessNormUser(document.getElementById('gateCadastroEmail').value);
  const senha=(document.getElementById('gateCadastroSenha').value||'').trim();
  if(!nome||!email||!senha){showAccessError('Preencha nome, e-mail e senha para criar a conta.');setAccessMode('cadastro');return;}
  const btn=document.getElementById('gateCadastrar');btn.disabled=true;btn.textContent='Criando conta...';
  try{
    const {data,error}=await AUTH_CLIENT.auth.signUp({email,password:senha,options:{data:{nome}}});
    if(error)throw error;
    const session=data?.session||null;
    if(!session){
      showAccessOk('Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre no sistema.');
      setAccessMode('login');
      document.getElementById('gateUsuario').value=email;
      return;
    }
    const profile=await ensureProfile(session);
    if(!profile){showAccessOk('Conta criada. Aguarde alguns segundos e faça login.');setAccessMode('login');document.getElementById('gateUsuario').value=email;return;}
    applyAccessUser(profile,session);
    const check=accessPlanMessage(profile);
    if(!check.ok){lockAccess(check.msg);setAccessMode('licenca');return;}
    unlockAccess();showAccessOk(check.msg||'Conta criada com sucesso.');
    if(!appBooted)initApp();else await loadAll();
    setTimeout(clearAccessMessages,1800);
  }catch(e){console.error(e);showAccessError(e?.message||'Não consegui criar sua conta agora.');}
  finally{btn.disabled=false;btn.textContent='Criar conta e iniciar teste';}
}
async function activateLicenseFromInput(){
  clearAccessMessages();
  const code=(document.getElementById('gateChave').value||'').trim();
  if(!code){showAccessError('Digite a chave de acesso.');setAccessMode('licenca');return;}
  const sessionData=await AUTH_CLIENT.auth.getSession();
  if(!sessionData?.data?.session){showAccessError('Entre com sua conta antes de ativar a chave.');setAccessMode('login');return;}
  const btn=document.getElementById('gateAtivarChave');btn.disabled=true;btn.textContent='Ativando...';
  try{
    const {data,error}=await AUTH_CLIENT.rpc('redeem_license_key',{input_code:code});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.message||'Não consegui ativar a chave.');
    const payload=await fetchAccessBySession();
    if(!payload?.profile){throw new Error('Licença ativada, mas o perfil não pôde ser recarregado.');}
    applyAccessUser(payload.profile,payload.session);
    unlockAccess();
    showAccessOk(data?.message || 'Licença ativada com sucesso.');
    if(!appBooted)initApp();else await loadAll();
    setTimeout(clearAccessMessages,1600);
  }catch(e){console.error(e);showAccessError(e?.message||'Não consegui ativar a chave agora.');}
  finally{btn.disabled=false;btn.textContent='Ativar chave';}
}
function openAccessWhats(){
  const email=ACCESS_USER?.email||accessNormUser(document.getElementById('gateUsuario')?.value||document.getElementById('gateCadastroEmail')?.value||'');
  const msg=`Olá, meu teste do LeveCRM expirou e quero ativar meu acesso.${email?` Meu e-mail é ${email}.`:''}`;
  window.open(`https://wa.me/5554999013331?text=${encodeURIComponent(msg)}`,'_blank');
}
async function accessResumeSession(){
  lockAccess();clearAccessMessages();
  try{
    const payload=await fetchAccessBySession();
    if(!payload){return;}
    applyAccessUser(payload.profile,payload.session);
    const check=accessPlanMessage(payload.profile);
    if(!check.ok){lockAccess(check.msg);setAccessMode('licenca');return;}
    unlockAccess();
    if(!appBooted)initApp();else await loadAll();
    showAccessOk(check.msg);
    setTimeout(clearAccessMessages,1200);
  }catch(e){console.error(e);}
}
async function logoutAccess(){
  try{await AUTH_CLIENT.auth.signOut();}catch(e){console.error(e);}
  clearAccessSession();
  ['gateSenha','gateCadastroSenha','gateChave'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
  const who=document.getElementById('whoPill');if(who)who.style.display='none';
  const out=document.getElementById('btnLogoutAccess');if(out)out.style.display='none';
  if(typeof syncSidebarUtilityState==='function')syncSidebarUtilityState();
  const adminTab=document.querySelector('.nav-tab[data-view="admin"]');if(adminTab)adminTab.style.display='none';
  ALL=[];ATTACHES=[];refreshAttMap();render();lockAccess();setAccessMode('login');showAccessOk('Sessão encerrada.');
}
async function loadAccessAdmin(){
  const msg=document.getElementById('accessAdminMsg');
  const block=document.getElementById('accessAdminBlock');
  const list=document.getElementById('accessList');
  if(!msg||!block)return;
  if(!ACCESS_USER?.is_admin){
    msg.textContent='Somente o administrador visualiza esta aba.';
    block.style.display='none';
    return;
  }
  msg.innerHTML='Agora o acesso usa <b>Supabase Auth</b>. O usuário cria a própria conta na tela inicial. Nesta fase, a gestão avançada de perfis e licenças segue centralizada no Supabase para manter segurança real.';
  block.style.display='block';
  block.innerHTML=`
    <div class="api-info" style="margin-bottom:14px">
      <strong style="color:var(--accent)">Fluxo novo de acesso</strong><br>
      1. O cliente cria a própria conta por e-mail na tela de acesso.<br>
      2. O banco cria automaticamente o profile com <b>7 dias de teste</b>.<br>
      3. Após o pagamento, você gera ou ajusta a licença no Supabase.<br>
      4. O cliente entra e ativa a chave pelo próprio CRM.
    </div>
    <div class="adm-list" id="accessList"></div>
  `;
  const listNow=document.getElementById('accessList');
  if(!listNow)return;
  try{
    const myProfile=await fetchMyProfile(ACCESS_USER.id);
    const check=myProfile?accessPlanMessage(myProfile):null;
    listNow.innerHTML=`
      <div class="adm-item">
        <div style="flex:1;min-width:0">
          <div class="adm-item-name">${escH(ACCESS_USER.nome)} <span class="chip" style="background:#EFF6FF;color:#1D4ED8;border-color:#BFDBFE">ADMIN</span></div>
          <div class="adm-item-detail">
            E-mail: <b>${escH(ACCESS_USER.email||'')}</b><br>
            Status atual: <b>${escH(check?.ok ? (check.kind==='trial'?'Teste ativo':'Licença ativa') : 'Bloqueado/expirado')}</b><br>
            Trial até: <b>${accessFmt(myProfile?.trial_end)}</b><br>
            Licença até: <b>${accessFmt(myProfile?.license_end)}</b>
          </div>
        </div>
        <div class="access-tools">
          <button class="btn" type="button" onclick="switchView('kanban')">Voltar para leads</button>
          <button class="btn" type="button" onclick="window.open('${SB_URL.replace('.supabase.co','')? '' : ''}','_blank')" style="display:none"></button>
        </div>
      </div>
      <div class="adm-item">
        <div class="adm-item-name">Licenças agora ficam no Supabase</div>
        <div class="adm-item-detail">
          Para este momento, a parte sensível de criação/renovação de chaves ficou fora do HTML para não expor permissões administrativas no navegador.<br>
          Quando quisermos, eu monto a próxima etapa com painel seguro via função/rota administrativa.
        </div>
      </div>`;
    const btn=document.getElementById('btnSalvarAcesso');
    if(btn)btn.style.display='none';
  }catch(e){
    console.error(e);
    listNow.innerHTML='<div class="adm-item"><div class="adm-item-name">Não consegui carregar o resumo do acesso agora.</div></div>';
  }
}
async function saveAccessUser(){showToast('Nesta versão, os usuários criam a própria conta na tela inicial. A gestão de chaves ficou no Supabase para manter segurança real.');}
function copyAccessUser(v){navigator.clipboard?.writeText(String(v||''));showToast('Copiado.');}
function changeAccessPassword(){showToast('A troca de senha agora é pelo próprio login do usuário no Auth.');}
function extendAccessDays(){showToast('Nesta versão, a renovação fica centralizada no Supabase.');}
function setAccessStatus(){showToast('Nesta versão, o bloqueio/ativação fica centralizado no Supabase.');}
function deleteAccessUser(){showToast('Nesta versão, a gestão de contas fica centralizada no Supabase.');}

async function sbFetch(path,{method='GET',body=null,prefer='return=representation'}={}){
  let bearer=SB_KEY;
  try{
    const sess=await AUTH_CLIENT.auth.getSession();
    if(sess?.data?.session?.access_token)bearer=sess.data.session.access_token;
  }catch(e){}
  const r=await fetch(`${SB_URL}/rest/v1/${path}`,{method,headers:{'apikey':SB_KEY,'Authorization':`Bearer ${bearer}`,'Content-Type':'application/json','apikey':SB_KEY,'Prefer':prefer},body:body?JSON.stringify(body):null});
  if(!r.ok){const t=await r.text().catch(()=>'');throw new Error(`${r.status} ${r.statusText} — ${t}`);}
  if(r.status===204)return null;
  return r.json();
}
async function loadAll(){
  try{
    setStatus('warn','Conectando…');
    if(!ACCESS_USER?.id){ALL=[];ATTACHES=[];refreshAttMap();render();return;}
    const path=ACCESS_USER?.is_admin?`${TBL}?select=*`:`${TBL}?select=*&access_user_id=eq.${encodeURIComponent(ACCESS_USER.id)}`;
    const data=await sbFetch(path);
    const safeRows=(Array.isArray(data)?data:[]).filter(l=>ACCESS_USER?.is_admin || String(l.access_user_id||'')===String(ACCESS_USER.id));
    ALL=safeRows.map(l=>({...l,etapa:normEtapa(l.etapa),motivo_perda:normMotivo(l.motivo_perda),visita:normVisita(l.visita),ordem:Number(l.ordem)||Date.now(),proximo_contato:normProx(l.proximo_contato)}));
    await loadAttaches();
    setStatus('ok','');
    render();
  }catch(e){setStatus('bad','Sem conexão');console.error(e);ALL=[];ATTACHES=[];refreshAttMap();render();}
}
async function loadAttaches(){
  try{
    if(!ALL.length){ATTACHES=[];refreshAttMap();return;}
    const ids=ALL.map(x=>x.id).filter(Boolean);
    if(!ids.length){ATTACHES=[];refreshAttMap();return;}
    const inList=ids.map(id=>`"${String(id).replace(/"/g,'')}"`).join(',');
    const d=await sbFetch(`${ATT_TBL}?select=id,lead_id,file_name,file_path,file_type,created_at&lead_id=in.(${encodeURIComponent(inList)})&order=created_at.desc`);
    ATTACHES=Array.isArray(d)?d:[];
  }catch(e){ATTACHES=[];console.warn(e);}
  refreshAttMap();
}
function refreshAttMap(){ATTACHES_BY_LEAD=ATTACHES.reduce((a,i)=>{(a[i.lead_id]||=[]).push(i);return a;},{});}
function attCount(id){return(ATTACHES_BY_LEAD[id]||[]).length;}

async function upsertLead(payload,{silent=false}={}){
  if(!payload.nome?.trim()){alert('Nome é obrigatório.');return false;}
  payload.etapa=normEtapa(payload.etapa);
  payload.motivo_perda=normMotivo(payload.motivo_perda);
  payload.proximo_contato=normProx(payload.proximo_contato);
  payload.visita=normVisita(payload.visita);
  if(payload.etapa!=='PERDIDO')payload.motivo_perda='';
  else if(!payload.motivo_perda){alert('Motivo de perda obrigatório.');return false;}
  payload.access_user_id=ACCESS_USER?.id||payload.access_user_id||null;
  payload.atualizado_em=nowISO();
  payload.ordem=Number(payload.ordem)||Date.now();
  const exists=ALL.some(x=>x.id===payload.id);
  try{
    if(exists){
      const{id,...noId}=payload;
      const u=await sbFetch(`${TBL}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:noId});
      const upd=Array.isArray(u)&&u[0]?{...payload,...u[0]}:payload;
      const i=ALL.findIndex(x=>x.id===id);
      if(i>=0)ALL[i]={...upd,etapa:normEtapa(upd.etapa),motivo_perda:normMotivo(upd.motivo_perda),visita:normVisita(upd.visita),proximo_contato:normProx(upd.proximo_contato)};
    }else{
      payload.id=payload.id||cid();
      payload.criado_em=payload.criado_em||nowISO();
      const ins=await sbFetch(TBL,{method:'POST',body:payload});
      const r=Array.isArray(ins)?ins[0]:payload;
      ALL.unshift({...r,etapa:normEtapa(r.etapa),motivo_perda:normMotivo(r.motivo_perda),visita:normVisita(r.visita),proximo_contato:normProx(r.proximo_contato)});
    }
    if(!silent){showToast('Lead salvo ✓');render();}
    return true;
  }catch(e){console.error(e);alert('Erro ao salvar. Verifique Supabase.');return false;}
}
async function deleteLead(id){
  const l=ALL.find(x=>x.id===id);if(!l)return false;
  if(!confirm(`Excluir "${l.nome}" e todos os anexos vinculados?`))return false;
  try{
    const linked=ATTACHES_BY_LEAD[id]||[];
    const paths=linked.map(x=>x.file_path).filter(Boolean);
    if(paths.length){
      const {error}=await AUTH_CLIENT.storage.from(ATT_BKT).remove(paths);
      if(error)throw new Error(`Falha ao remover anexos: ${error.message}`);
      await sbFetch(`${ATT_TBL}?lead_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',prefer:'return=minimal'});
    }
    await sbFetch(`${TBL}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',prefer:'return=minimal'});
    ALL=ALL.filter(x=>x.id!==id);
    ATTACHES=ATTACHES.filter(x=>x.lead_id!==id);refreshAttMap();
    showToast('Lead e anexos excluídos.');render();return true;
  }catch(e){console.error(e);alert(e.message||'Erro ao excluir.');return false;}
}
function orderForTop(etapa){
  const arr=ALL.filter(x=>normEtapa(x.etapa)===normEtapa(etapa)).map(x=>Number(x.ordem)).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
  return arr.length?arr[0]-1000:1000;
}

async function uploadFiles(leadId,files){
  if(!leadId)throw new Error('Salve o lead primeiro.');
  if(!ACCESS_USER?.id)throw new Error('Sessão não autenticada.');
  const uploaded=[];
  for(const file of files){
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');
    const fp=`${leadId}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${safe}`;
    const {error:uploadError}=await AUTH_CLIENT.storage.from(ATT_BKT).upload(fp,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
    if(uploadError)throw new Error(`${file.name}: ${uploadError.message}`);
    try{
      const meta={lead_id:leadId,file_name:file.name,file_path:fp,file_type:file.type||''};
      const ins=await sbFetch(ATT_TBL,{method:'POST',body:meta});
      const row=Array.isArray(ins)?ins[0]:meta;
      uploaded.push(row);
    }catch(e){
      await AUTH_CLIENT.storage.from(ATT_BKT).remove([fp]).catch(()=>{});
      throw e;
    }
  }
  ATTACHES=[...uploaded,...ATTACHES];refreshAttMap();
  const lead=ALL.find(x=>x.id===leadId);
  if(lead){
    const msg=`(${uploaded.length} arquivo(s) anexado(s))`;
    const updObs=appendObs(lead.observacao||'',msg);
    await upsertLead({...lead,observacao:updObs},{silent:true});
    if(editingId===leadId){F('observacao').value=updObs;origSnap=formSnap();}
  }
  render();syncAttachUI();
}
function appendObs(cur,msg,d=new Date()){
  const c=String(cur||'').replace(/\r/g,'').replace(/[ \t]+$/gm,'').replace(/\n+$/g,'');
  const line=`${obsPfx(d)}${msg}`;
  return c?`${c}\n\n${line}`:line;
}

/* ══════════════════════════════════════
   CARD RENDERING
══════════════════════════════════════ */
function badgeInfo(lead){
  const d=daysSince(lead.atualizado_em||lead.criado_em||lead.data_inicio||'');
  if(d<=3)return{text:d===0?'hoje':d+'d',cls:'chip-dt-soft'};
  if(d<=7)return{text:d+'d',cls:'chip-dt-blue'};
  return{text:d+'d',cls:'chip-dt-red'};
}
function nextContact(lead){
  const iso=normProx(lead.proximo_contato);if(!iso)return null;
  const d=parseDate(iso);if(!d)return null;
  const today=dayStart(new Date());const base=dayStart(d);
  const diff=Math.floor((base-today)/86400000);
  const dias=['dom','seg','ter','qua','qui','sex','sáb'];
  const text=`${dias[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`;
  if(diff===0)return{text,cls:'chip-nc-green'};
  if(diff<0)return{text,cls:'chip-nc-red'};
  return{text,cls:'chip-nc-neutral'};
}
function hasActiveScheduledContact(lead){
  const iso=normProx(lead.proximo_contato);
  if(!iso)return false;
  const d=parseDate(iso);
  if(!d)return false;
  const today=dayStart(new Date());
  const base=dayStart(d);
  return base.getTime()>=today.getTime();
}
function isOverdueContact(lead){
  if(!lead || lead.prioridade==='Fechado')return false;
  const etapa=normEtapa(lead.etapa);
  if(etapa==='PERDIDO'||etapa==='STAND BY')return false;
  if(hasActiveScheduledContact(lead))return false;
  const d=daysSince(lead.atualizado_em||lead.criado_em||lead.data_inicio||'');
  return d>7;
}
function prioVisual(p){
  if(p==='Fechado')return{cls:'p-done',lbl:`<span class="card-prio prio-done">Fechado</span>`};
  if(p==='Altíssima')return{cls:'p-top',lbl:`<span class="card-prio prio-top">Altíssima</span>`};
  if(p==='Alta')return{cls:'p-high',lbl:`<span class="card-prio prio-high">Alta</span>`};
  if(p==='Média')return{cls:'p-med',lbl:`<span class="card-prio prio-med">Média</span>`};
  return{cls:'p-low',lbl:`<span class="card-prio prio-low">Baixa</span>`};
}
function waSvg(){return`<svg viewBox="0 0 32 32"><path d="M16 .5C7.4.5.5 7.4.5 16c0 2.8.7 5.5 2.1 7.9L.5 31.5l7.8-2.1c2.3 1.3 4.9 2 7.7 2 8.6 0 15.5-6.9 15.5-15.5S24.6.5 16 .5zm0 28.4c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.6 1.2 1.2-4.5-.3-.5c-1.3-2.1-2-4.4-2-6.9 0-7.2 5.8-13 13-13s13 5.8 13 13-5.8 13-13 13zm7.3-9.8c-.4-.2-2.4-1.2-2.8-1.3-.4-.2-.7-.2-1 .2s-1.1 1.3-1.4 1.6c-.3.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.5-2.2-2.9-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.2-.4.3-.6.1-.2 0-.5-.1-.7-.2-.2-1-.8-1.4-1.1-.3-.3-.7-.3-1-.3-.3 0-.6 0-.9.3-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.7c.2.3 2.3 3.6 5.6 5 .8.3 1.4.5 1.9.6.8.2 1.6.2 2.2.1.7-.1 2.4-1 2.7-2 .3-1 .3-1.9.2-2.1-.1-.2-.4-.3-.8-.5z"/></svg>`;}

function shortLeadName(nome,max=28){
  const n=String(nome||'').replace(/\s+/g,' ').trim();
  if(n.length<=max)return n;
  return n.slice(0,max-1).trimEnd()+'…';
}

function cardHTML(l){
  const etapa=normEtapa(l.etapa);
  const isPerd=etapa==='PERDIDO';const isSB=etapa==='STAND BY';
  const scheduled=hasActiveScheduledContact(l)&&!isPerd;
  const pvBase=prioVisual(l.prioridade||'Baixa');
  const pv=scheduled?{cls:'p-scheduled',lbl:pvBase.lbl}:pvBase;
  const wa=l.telefone?`<a class="wa-btn" href="https://wa.me/${normPhone(l.telefone)}" target="_blank" onclick="event.stopPropagation()">${waSvg()}</a>`:'';
  const nc=nextContact(l);
  const ncHTML=nc?`<span class="chip ${escH(nc.cls)}">${escH(nc.text)}</span>`:'';
  const att=attCount(l.id);const attHTML=att?`<span class="chip chip-attach">📎 ${att}</span>`:'';
  const overdue=isOverdueContact(l);

  if(isSB){
    return`<div class="card ${pv.cls}${overdue?' overdue-contact':''}" draggable="true" data-id="${l.id}">
      <div class="card-row1"><div class="sb-row"><div class="sb-nm" title="${escH(l.nome)}">${escH(shortLeadName(l.nome,26))}</div><div class="sb-sep">—</div><div class="sb-emp">${escH(l.empreendimento||'—')}</div></div>${pv.lbl}</div>
      <div class="card-row2"><div class="card-chips">${ncHTML}${attHTML}</div>${wa}</div>
    </div>`;}

  if(isPerd){
    const mot=l.motivo_perda?`<div style="margin-top:5px;font-size:11px;color:#64748B">Motivo: <b>${escH(l.motivo_perda)}</b></div>`:'';
    return`<div class="card ${pv.cls}" draggable="true" data-id="${l.id}">
      <div class="card-row1"><div class="card-nm" style="padding-left:6px" title="${escH(l.nome)}">${escH(shortLeadName(l.nome,28))}</div>${pv.lbl}</div>
      <div class="card-row2"><div class="card-chips"><div class="card-emp">${escH(l.empreendimento||'—')}</div>${ncHTML}${attHTML}</div>${wa}</div>${mot}
    </div>`;}

  const b=badgeInfo(l);
  return`<div class="card ${pv.cls}${overdue?' overdue-contact':''}" draggable="true" data-id="${l.id}">
    <div class="card-row1"><div class="card-nm" title="${escH(l.nome)}">${escH(shortLeadName(l.nome,28))}</div>${pv.lbl}</div>
    <div class="card-row2"><div class="card-chips"><div class="card-emp">${escH(l.empreendimento||'—')}</div>${ncHTML}${attHTML}</div>${wa}<span class="chip ${escH(b.cls)}">${b.text}</span></div>
  </div>`;
}

/* ══════════════════════════════════════
   FILTER + SORT
══════════════════════════════════════ */
function filtered(){
  const term=(document.getElementById('searchQ')?.value||'').toLowerCase().trim();
  const fE=document.getElementById('fEmp')?.value||'';
  const fO=document.getElementById('fOrig')?.value||'';
  const fR=document.getElementById('fResp')?.value||'';
  const fP=document.getElementById('fPri')?.value||'';
  return ALL.filter(l=>{
    if(term&&!`${l.nome||''} ${l.telefone||''}`.toLowerCase().includes(term))return false;
    if(fE&&l.empreendimento!==fE)return false;
    if(fO&&l.origem!==fO)return false;
    if(fR&&l.responsavel!==fR)return false;
    if(fP&&l.prioridade!==fP)return false;
    return true;
  });
}
function sortLeads(leads,etapa){
  const e=normEtapa(etapa);

  // Ordem visual principal dentro de cada coluna:
  // Fechado > Altíssima > Alta > Média > Baixa.
  // A data de próximo contato fica como desempate dentro do mesmo nível de prioridade.
  const active=new Set(['NOVO / INICIAL','ATENDIMENTO','VISITA / PROPOSTA','NEGOCIAÇÃO']);
  return leads.filter(l=>normEtapa(l.etapa)===e).sort((a,b)=>{
    const pa=prioRank(a.prioridade);
    const pb=prioRank(b.prioridade);
    if(pa!==pb)return pb-pa;

    if(active.has(e)){
      const na=normProx(a.proximo_contato);const nb=normProx(b.proximo_contato);
      const today=dayStart(new Date());
      const ka=na?Math.floor((dayStart(parseDate(na))-today)/86400000):999;
      const kb=nb?Math.floor((dayStart(parseDate(nb))-today)/86400000):999;
      if(ka!==kb)return ka-kb;
    }

    const oa=Number(a.ordem);const ob=Number(b.ordem);
    if(!isNaN(oa)&&!isNaN(ob)&&oa!==ob)return oa-ob;

    return new Date(b.atualizado_em||b.criado_em||0)-new Date(a.atualizado_em||a.criado_em||0);
  });
}

/* ══════════════════════════════════════
   RENDER KANBAN
══════════════════════════════════════ */
function isMobileKanban(){
  return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
}

function sortMobilePriority(leads){
  return [...leads].sort((a,b)=>{
    const pa=prioRank(a.prioridade);
    const pb=prioRank(b.prioridade);
    if(pa!==pb)return pb-pa;

    const na=normProx(a.proximo_contato);
    const nb=normProx(b.proximo_contato);
    const today=dayStart(new Date());
    const ka=na?Math.floor((dayStart(parseDate(na))-today)/86400000):999;
    const kb=nb?Math.floor((dayStart(parseDate(nb))-today)/86400000):999;
    if(ka!==kb)return ka-kb;

    return new Date(b.atualizado_em||b.criado_em||0)-new Date(a.atualizado_em||a.criado_em||0);
  });
}

function render(){
  const leads=filtered();
  const ativos=leads.filter(l=>normEtapa(l.etapa)!=='PERDIDO').length;
  const perdidos=leads.filter(l=>normEtapa(l.etapa)==='PERDIDO').length;
  document.getElementById('nAtivos').textContent=ativos;
  document.getElementById('nPerdidos').textContent=perdidos;
  document.getElementById('nTotal').textContent=ativos+perdidos;
  document.getElementById('btnToggleLost').textContent=SHOW_LOST?'Ocultar perdidos':'Mostrar perdidos';
  document.getElementById('btnToggleSb').textContent=SHOW_SB?'Ocultar Stand by':'Mostrar Stand by';
  updateAlertBanner();
  updateAgendaBadge();

  const board=document.getElementById('board');board.innerHTML='';

  if(isMobileKanban()){
    const mobileLeads=sortMobilePriority(leads.filter(l=>{
      const e=normEtapa(l.etapa);
      if(e==='PERDIDO')return SHOW_LOST;
      if(e==='STAND BY')return SHOW_SB;
      return true;
    }));
    const sec=document.createElement('section');
    sec.className='col mobile-priority-col';
    sec.dataset.etapa='MOBILE_PRIORITY';
    sec.innerHTML=`<div class="col-head"><span class="cname">LEADS POR PRIORIDADE</span><span class="cnt">${mobileLeads.length}</span></div><div class="dropzone mobile-priority-list">${mobileLeads.map(cardHTML).join('')}</div>`;
    board.appendChild(sec);
    wireMobileCards();
    if(currentView==='dashboard')renderDashboard();
    return;
  }

  const visibles=LISTS.etapa.filter(e=>{if(e==='PERDIDO')return SHOW_LOST;if(e==='STAND BY')return SHOW_SB;return true;});
  visibles.forEach(etapa=>{
    const inCol=sortLeads(leads,etapa);
    const sec=document.createElement('section');
    sec.className='col';sec.dataset.etapa=etapa;
    sec.innerHTML=`<div class="col-head"><span class="cname">${escH(etapa)}</span><span class="cnt">${inCol.length}</span></div><div class="dropzone" data-drop="${escH(etapa)}">${inCol.map(cardHTML).join('')}</div>`;
    board.appendChild(sec);
  });
  wireDnD();
  if(currentView==='dashboard')renderDashboard();
}

function wireMobileCards(){
  document.querySelectorAll('.card').forEach(c=>{
    c.removeAttribute('draggable');
    c.addEventListener('click',e=>{if(e.target.closest('.wa-btn'))return;openEdit(c.dataset.id);});
  });
}

/* ══════════════════════════════════════
   DnD
══════════════════════════════════════ */
let isDragging = false;
function wireDnD(){
  document.querySelectorAll('.card').forEach(c=>{
    c.addEventListener('dragstart',()=>{isDragging=true;c.classList.add('dragging');});
    c.addEventListener('dragend',()=>{isDragging=false;c.classList.remove('dragging');});
    c.addEventListener('click',e=>{if(isDragging)return;if(e.target.closest('.wa-btn'))return;openEdit(c.dataset.id);});
  });
  document.querySelectorAll('.dropzone').forEach(z=>{
    z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dragover');});
    z.addEventListener('dragleave',()=>z.classList.remove('dragover'));
    z.addEventListener('drop',async e=>{
      e.preventDefault();z.classList.remove('dragover');
      const card=document.querySelector('.card.dragging');const id=card?.dataset.id;if(!id)return;
      const lead=ALL.find(x=>x.id===id);if(!lead)return;
      const newE=normEtapa(z.dataset.drop);
      if(newE===normEtapa(lead.etapa))return;
      if(newE==='PERDIDO'){openEdit(id,true);return;}
      // Registrar movimentação
      addHistory(id,`${normEtapa(lead.etapa)} → ${newE}`);
      await upsertLead({...lead,etapa:newE,ordem:orderForTop(newE)});
    });
  });
}

/* ══════════════════════════════════════
   HISTÓRICO DE MOVIMENTAÇÃO
══════════════════════════════════════ */
function getHistory(id){try{return JSON.parse(lsGet(`crm_hist_${id}`)||'[]');}catch{return[];}}
function addHistory(id,action){
  const h=getHistory(id);
  h.push({date:nowISO(),action});
  // manter últimas 20 entradas
  if(h.length>20)h.shift();
  lsSet(`crm_hist_${id}`,JSON.stringify(h));
}
function renderHistory(id){
  const el=document.getElementById('historyLog');if(!el)return;
  const h=getHistory(id).slice().reverse();
  if(!h.length){el.innerHTML='<div style="font-size:11px;color:#94A3B8;padding:4px">Nenhuma movimentação registrada.</div>';return;}
  el.innerHTML=h.map(e=>{
    const d=parseDate(e.date);
    const ds=d?`${pad2(d.getDate())}/${pad2(d.getMonth()+1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`:'';
    return`<div class="history-entry"><span class="h-date">${ds}</span><span class="h-action">${escH(e.action)}</span></div>`;
  }).join('');
}

/* ══════════════════════════════════════
   ALERT BANNER
══════════════════════════════════════ */
function getOverdue(){
  const today=dayStart(new Date());
  return ALL.filter(l=>{
    const etapa=normEtapa(l.etapa);
    if(etapa==='PERDIDO'||etapa==='STAND BY'||l.prioridade==='Fechado')return false;
    const nc=normProx(l.proximo_contato);if(!nc)return false;
    const date=parseDate(nc);if(!date)return false;
    return dayStart(date)<=today;
  }).sort((a,b)=>(parseDate(normProx(a.proximo_contato))?.getTime()||0)-(parseDate(normProx(b.proximo_contato))?.getTime()||0));
}
function updateAlertBanner(){
  const banner=document.getElementById('alertBanner');if(!banner)return;
  const overdue=getOverdue();
  banner.classList.toggle('show',overdue.length>0);
  if(overdue.length>0){
    banner.querySelector('.ab-text').textContent=`${overdue.length} lead${overdue.length>1?'s':''} com contato hoje ou em atraso`;
    const count=document.getElementById('abCount');if(count)count.textContent=overdue.length;
  }
}
function formSnap(){
  return JSON.stringify({
    nome:F('nome').value.trim(),telefone:F('telefone').value.trim(),
    empreendimento:F('empreendimento').value,etapa:normEtapa(F('etapa').value),
    prioridade:F('prioridade').value,origem:F('origem').value,
    responsavel:F('responsavel').value,visita:normVisita(F('visita').value),
    motivo_perda:F('etapa').value==='PERDIDO'?normMotivo(F('motivo_perda').value):'',
    observacao:F('observacao').value.trim(),data_inicio:F('data_inicio').value||'',
    proximo_contato:normProx(F('proximo_contato').value)||''
  });
}
function leadSnap(l){
  return JSON.stringify({
    nome:(l.nome||'').trim(),telefone:(l.telefone||'').trim(),
    empreendimento:l.empreendimento||'',etapa:normEtapa(l.etapa||''),
    prioridade:l.prioridade||'',origem:l.origem||'',responsavel:l.responsavel||'',
    visita:normVisita(l.visita||''),motivo_perda:normMotivo(l.motivo_perda||''),
    observacao:(l.observacao||'').trim(),data_inicio:(l.data_inicio||'').trim(),
    proximo_contato:normProx(l.proximo_contato)||''
  });
}
function hasChanges(){return dlg.open&&origSnap!==null&&formSnap()!==origSnap;}
function confirmClose(){if(!hasChanges())return true;return confirm('Alterações não salvas. Fechar mesmo assim?');}
function closeDialog(force=false){if(!force&&!confirmClose())return false;dlg.close();editingId=null;origSnap=null;document.getElementById('aiChipResult').className='ai-result';return true;}
function toggleMotivo(){const p=F('etapa').value==='PERDIDO';F('motivo_perda').disabled=!p;F('motivo_perda').required=p;if(!p)F('motivo_perda').value='';}

function fillFormSelects(){
  const fields={prioridade:LISTS.prioridade,empreendimento:LISTS.empreendimento,etapa:LISTS.etapa,origem:LISTS.origem,responsavel:LISTS.responsavel,visita:LISTS.visita,motivo_perda:LISTS.motivo_perda};
  Object.entries(fields).forEach(([name,items])=>{const s=leadForm.querySelector(`[name="${name}"]`);s.innerHTML=items.map(v=>`<option value="${escH(v)}">${escH(v)}</option>`).join('');});
}

function openNew(){
  editingId=null;origSnap=null;leadForm.classList.add('is-new-lead');document.getElementById('dlgTitle').textContent='Novo Lead';document.getElementById('btnDelete').style.display='none';
  fillFormSelects();
  F('data_inicio').value=todayISO();F('proximo_contato').value='';F('nome').value='';F('telefone').value='';
  F('empreendimento').value='Outros';F('etapa').value='NOVO / INICIAL';F('prioridade').value='Baixa';
  F('origem').value='Instagram';F('responsavel').value=LISTS.responsavel[0]||'Corretor';
  F('visita').value='Não';F('motivo_perda').value='';F('observacao').value='';
  toggleMotivo();document.getElementById('attachList').innerHTML='';document.getElementById('attachHint').textContent=' Salve o lead primeiro.';document.getElementById('attachBtn').disabled=true;
  if(document.getElementById('historyLog')) document.getElementById('historyLog').innerHTML='<div style="font-size:11px;color:#94A3B8;padding:4px">Salve o lead para ver o histórico.</div>';
  origSnap=formSnap();dlg.showModal();
}

function openEdit(id,forcePerd=false){
  const l=ALL.find(x=>x.id===id);if(!l)return;
  editingId=id;leadForm.classList.remove('is-new-lead');document.getElementById('dlgTitle').textContent='Editar Lead';document.getElementById('btnDelete').style.display='inline-flex';
  fillFormSelects();
  F('data_inicio').value=l.data_inicio||todayISO();F('proximo_contato').value=normProx(l.proximo_contato)||'';
  F('nome').value=l.nome||'';F('telefone').value=l.telefone||'';F('empreendimento').value=l.empreendimento||'Outros';
  F('etapa').value=forcePerd?'PERDIDO':normEtapa(l.etapa||'NOVO / INICIAL');
  F('prioridade').value=l.prioridade||'Baixa';F('origem').value=l.origem||'Instagram';
  F('responsavel').value=l.responsavel||LISTS.responsavel[0];F('visita').value=normVisita(l.visita||'Não');
  F('motivo_perda').value=normMotivo(l.motivo_perda||'');F('observacao').value=l.observacao||'';
  document.querySelectorAll('.lead-attachment-clean-chip').forEach(el=>el.remove());
  toggleMotivo();syncAttachUI();renderHistory(id);
  origSnap=leadSnap({...l,etapa:forcePerd?'PERDIDO':normEtapa(l.etapa||'NOVO / INICIAL')});
  dlg.showModal();
}

function syncAttachUI(){
  const id=editingId;
  const hint=document.getElementById('attachHint');
  const btn=document.getElementById('attachBtn');
  const list=document.getElementById('attachList');
  if(btn)btn.disabled=!id;
  if(!id){if(hint)hint.textContent=' Salve o lead primeiro.';if(list)list.innerHTML='';return;}
  const items=(ATTACHES_BY_LEAD[id]||[]).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  if(hint)hint.textContent=items.length?` ${items.length} anexo(s).`:' Nenhum anexo.';
  if(!list)return;
  list.innerHTML=items.map(i=>`<button class="attach-chip" type="button" data-file-path="${escH(i.file_path||'')}" data-file-name="${escH(i.file_name||'Arquivo')}"><span>${fileIcon(i.file_name,i.file_type)}</span><span class="aname">${escH(i.file_name||'Arquivo')}</span></button>`).join('');
  list.querySelectorAll('[data-file-path]').forEach(el=>el.addEventListener('click',()=>openAttachment(el.dataset.filePath,el.dataset.fileName)));
}
function renderDashboard(){
  const el=document.getElementById('dashContent');if(!el)return;
  const today=dayStart(new Date());
  const active=ALL.filter(l=>normEtapa(l.etapa)!=='PERDIDO');
  const lost=ALL.filter(l=>normEtapa(l.etapa)==='PERDIDO');
  const overdue=getOverdue();
  const soon=active.filter(l=>{const nc=normProx(l.proximo_contato);if(!nc)return false;const d=dayStart(parseDate(nc));const diff=Math.floor((d-today)/86400000);return diff>0&&diff<=3;});

  // Taxa de conversão
  const total=ALL.length;const closed=ALL.filter(l=>l.prioridade==='Fechado').length;
  const convRate=total>0?Math.round(closed/total*100):0;

  // Tempo médio fechamento
  const closedLeads=ALL.filter(l=>l.prioridade==='Fechado'&&l.criado_em&&l.atualizado_em);
  const avgDays=closedLeads.length?Math.round(closedLeads.reduce((s,l)=>{const c=parseDate(l.criado_em);const u=parseDate(l.atualizado_em);return s+(c&&u?Math.floor((u-c)/86400000):0);},0)/closedLeads.length):0;

  // Funnel
  const funnel=['NOVO / INICIAL','ATENDIMENTO','VISITA / PROPOSTA','NEGOCIAÇÃO'];
  const fColors=['#1B2E4B','#2B5EA7','#4A90D9','#D4AF37'];
  const fCounts=funnel.map(e=>active.filter(l=>normEtapa(l.etapa)===e).length);
  const maxF=Math.max(...fCounts,1);
  const sbCount=active.filter(l=>normEtapa(l.etapa)==='STAND BY').length;

  // Próximos contatos
  const contacts=active.filter(l=>normProx(l.proximo_contato)).map(l=>{
    const d=dayStart(parseDate(normProx(l.proximo_contato)));
    const diff=Math.floor((d-today)/86400000);
    return{...l,_diff:diff,_d:d};
  }).sort((a,b)=>a._diff-b._diff).slice(0,10);

  // Origem stats
  const origCounts={};active.forEach(l=>{if(l.origem)origCounts[l.origem]=(origCounts[l.origem]||0)+1;});
  const origSorted=Object.entries(origCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxOrig=origSorted[0]?.[1]||1;

  // Por responsável
  const respCounts={};LISTS.responsavel.forEach(r=>{respCounts[r]=active.filter(l=>l.responsavel===r).length;});

  el.innerHTML=`
    <div class="dash-stats">
      <div class="stat-card c-blue"><div class="stat-lbl">Leads Ativos</div><div class="stat-val">${active.length}</div><div class="stat-sub">Em andamento</div></div>
      <div class="stat-card c-amber"><div class="stat-lbl">Em Atraso / Hoje</div><div class="stat-val">${overdue.length}</div><div class="stat-sub">${overdue.length?'⚠️ Ação necessária':'✓ Em dia'}</div></div>
      <div class="stat-card c-green"><div class="stat-lbl">Taxa de Conversão</div><div class="stat-val">${convRate}%</div><div class="stat-sub">${closed} fechados de ${total}</div></div>
      <div class="stat-card c-red"><div class="stat-lbl">Tempo Médio Fecham.</div><div class="stat-val">${avgDays}d</div><div class="stat-sub">${closedLeads.length} leads fechados</div></div>
    </div>

    <div class="dash-2col">
      <div class="dpanel">
        <div class="dpanel-head">🔽 Funil de Vendas<span class="dpanel-badge">${active.length} ativos</span></div>
        ${funnel.map((e,i)=>`<div class="funnel-row"><div class="funnel-lbl">${e}</div><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(Math.round(fCounts[i]/maxF*100),3)}%;background:${fColors[i]}">${fCounts[i]>0?fCounts[i]:''}</div></div><div class="funnel-cnt">${fCounts[i]}</div></div>`).join('')}
        <div class="funnel-row"><div class="funnel-lbl">STAND BY</div><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(Math.round(sbCount/maxF*100),3)}%;background:#8A9BB0">${sbCount>0?sbCount:''}</div></div><div class="funnel-cnt">${sbCount}</div></div>
        <div class="funnel-row"><div class="funnel-lbl">PERDIDOS</div><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(Math.round(lost.length/maxF*100),3)}%;background:#D64545">${lost.length>0?lost.length:''}</div></div><div class="funnel-cnt">${lost.length}</div></div>
      </div>

      <div class="dpanel">
        <div class="dpanel-head">🔔 Próximos Contatos<span class="dpanel-badge">${contacts.length} agendados</span></div>
        ${contacts.length===0?`<div style="padding:16px;font-size:12px;color:var(--muted);text-align:center">Nenhum contato agendado</div>`:
          contacts.map(l=>{
            const dc=l._diff<0?'past':l._diff===0?'today':'soon';
            const ds=l._diff<0?`${Math.abs(l._diff)}d atraso`:l._diff===0?'HOJE':`${pad2(l._d.getDate())}/${pad2(l._d.getMonth()+1)}`;
            return`<div class="contact-row" onclick="openEdit('${escH(l.id)}')"><div class="cdot ${dc}"></div><div style="flex:1;min-width:0"><div class="cname">${escH(l.nome)}</div><div class="cinfo">${escH(l.empreendimento||'—')} · ${escH(l.responsavel||'—')}</div></div><div class="cdate ${dc}">${ds}</div></div>`;
          }).join('')}
      </div>
    </div>

    <div class="dash-2col">
      <div class="dpanel">
        <div class="dpanel-head">📍 Leads por Origem</div>
        ${origSorted.map(([o,c])=>`<div class="origin-bar"><div class="origin-lbl">${escH(o)}</div><div class="origin-track"><div class="origin-fill" style="width:${Math.round(c/maxOrig*100)}%"></div></div><div class="origin-pct">${c}</div></div>`).join('')}
        ${!origSorted.length?'<div style="padding:12px;font-size:12px;color:var(--muted)">Sem dados</div>':''}
      </div>

      <div class="dpanel">
        <div class="dpanel-head">👤 Por Responsável</div>
        <div class="resp-grid">${LISTS.responsavel.map(r=>`<div class="resp-item"><div class="resp-lbl">${escH(r)}</div><div class="resp-cnt">${respCounts[r]||0}</div></div>`).join('')}</div>
      </div>
    </div>

    <div class="dpanel">
      <div class="dpanel-head">💡 Insight Semanal (IA)<span class="dpanel-badge" onclick="aiInsight()" style="cursor:pointer">✨ Gerar</span></div>
      <div class="insight-box" id="insightBox">Clique em "✨ Gerar" para a inteligência artificial analisar seus dados e sugerir ações práticas.</div>
    </div>

    <div class="dpanel">
      <div class="dpanel-head">📅 Compromissos de Hoje<span class="dpanel-badge" onclick="openAgenda()" style="cursor:pointer">Ver agenda →</span></div>
      <div id="dashToday" style="padding:4px 0"></div>
    </div>
  `;

  // Agenda hoje
  const todayKey=agKey(today.getFullYear(),today.getMonth(),today.getDate());
  const tevts=agForDay(todayKey);
  const dt=document.getElementById('dashToday');
  if(dt){
    if(!tevts.length){dt.innerHTML=`<div style="padding:12px 15px;font-size:12px;color:var(--muted)">Nenhum compromisso hoje. <span style="cursor:pointer;text-decoration:underline" onclick="openAgenda()">Adicionar →</span></div>`;}
    else{dt.innerHTML=tevts.map(e=>`<div class="contact-row"><div class="cdot today"></div><div class="cname" style="flex:1">${escH(e.desc)}</div><div class="cdate today">${e.time}</div></div>`).join('');}
  }
}

/* ══════════════════════════════════════
   API KEY
══════════════════════════════════════ */
async function secureAiCompletion(messages,{maxTokens=500,temperature=.25,model='gpt-4o-mini'}={}){
  let bearer=SB_KEY;
  try{const session=await AUTH_CLIENT.auth.getSession();bearer=session?.data?.session?.access_token||SB_KEY;}catch(e){}
  const r=await fetch(`${SB_URL}/functions/v1/direciona-openai`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':`Bearer ${bearer}`},
    body:JSON.stringify({model,temperature,max_tokens:maxTokens,messages})
  });
  if(!r.ok)throw new Error((await r.text().catch(()=>''))||`Erro ${r.status} na IA.`);
  const d=await r.json();
  return String(d?.choices?.[0]?.message?.content||d?.content||'').trim();
}
async function callClaude(prompt,maxTokens=250){
  return secureAiCompletion([{role:'user',content:prompt}],{maxTokens,temperature:.2});
}
async function aiLeadAction(type){
  const obs=F('observacao').value.trim();const nome=F('nome').value.trim();const emp=F('empreendimento').value;
  if(!obs&&!nome){alert('Abra um lead com histórico.');return;}
  const resultEl=document.getElementById('aiChipResult');
  ['aiBtnResumo','aiBtnAcao','aiBtnPrio'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true;});
  resultEl.className='ai-result show';resultEl.textContent='Analisando…';
  const prompts={
    resumo:`Assistente de CRM imobiliário. Resuma em 2 ou 3 linhas o histórico deste lead. Cliente: ${nome}. Imóvel: ${emp}. Histórico: ${obs}. Responda apenas com o resumo.`,
    acao:`Assistente de CRM imobiliário. Sugira a próxima ação mais eficaz para avançar esta venda. Cliente: ${nome}. Imóvel: ${emp}. Histórico: ${obs}. Máximo de 2 linhas, direto ao ponto.`,
    prio:`Assistente de CRM imobiliário. Classifique a prioridade como Baixa, Média, Alta ou Altíssima e explique em uma linha. Cliente: ${nome}. Imóvel: ${emp}. Histórico: ${obs}. Formato: PRIORIDADE: nível; Motivo: texto.`
  };
  try{
    const text=await callClaude(prompts[type],220);resultEl.textContent=text;
    if(type==='prio'){
      const m=text.match(/PRIORIDADE:\s*(Baixa|Média|Alta|Altíssima)/i);
      if(m){const val=LISTS.prioridade.find(x=>x.toLowerCase()===m[1].toLowerCase());if(val){F('prioridade').value=val;showToast(`Prioridade: ${val}`);}}
    }
  }catch(e){resultEl.textContent=`Erro: ${e.message}`;}
  finally{['aiBtnResumo','aiBtnAcao','aiBtnPrio'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=false;});}
}
async function aiInsight(){
  const el=document.getElementById('insightBox');if(!el)return;
  el.textContent='Gerando insight…';
  const active=ALL.filter(l=>normEtapa(l.etapa)!=='PERDIDO');
  const lost=ALL.filter(l=>normEtapa(l.etapa)==='PERDIDO');
  const mc={};lost.forEach(l=>{if(l.motivo_perda)mc[l.motivo_perda]=(mc[l.motivo_perda]||0)+1;});
  const top3=Object.entries(mc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} (${v})`).join(', ');
  const ctx=`Leads ativos: ${active.length}; Perdidos: ${lost.length}; Contatos vencidos: ${getOverdue().length}; Motivos principais: ${top3||'nenhum'}; Empreendimentos: ${[...new Set(active.map(l=>l.empreendimento).filter(Boolean))].slice(0,5).join(', ')}`;
  try{el.textContent='💡 '+await callClaude(`Consultor imobiliário: escreva um insight prático de 2 ou 3 frases para melhorar os resultados nesta semana. ${ctx}`,180);}
  catch(e){el.textContent=`Erro: ${e.message}`;}
}
function openAiImport(){
  aiImgB64=null;aiImgType=null;aiExtracted={nome:'',fone:'',emp:'',obs:''};
  document.getElementById('aiPreview').style.display='none';
  document.getElementById('aiPreviewImg').src='';
  document.getElementById('aiStatus').className='ai-status';
  document.getElementById('aiResultBox').className='ai-result-box';
  document.getElementById('aiAnalyzeBtn').style.display='none';
  document.getElementById('aiUseBtn').style.display='none';
  document.getElementById('aiRNome').textContent='—';document.getElementById('aiRFone').textContent='—';document.getElementById('aiREmp').textContent='—';
  document.getElementById('aiRCtxRow').style.display='none';
  document.getElementById('aiFileInput').value='';
  document.getElementById('aiModal').classList.add('open');
}
function closeAiImport(){document.getElementById('aiModal').classList.remove('open');}
function aiHandleFile(file){
  if(!file||!file.type.startsWith('image/'))return;
  if(file.size>5*1024*1024){alert('Imagem muito grande. Máx 5MB.');return;}
  aiImgType=file.type;
  const reader=new FileReader();
  reader.onload=e=>{
    const url=e.target.result;aiImgB64=url.split(',')[1];
    document.getElementById('aiPreviewImg').src=url;
    document.getElementById('aiPreview').style.display='block';
    document.getElementById('aiAnalyzeBtn').style.display='inline-flex';
    document.getElementById('aiResultBox').className='ai-result-box';
    document.getElementById('aiUseBtn').style.display='none';
  };reader.readAsDataURL(file);
}
async function aiAnalyze(){
  if(!aiImgB64){alert('Selecione uma imagem.');return;}
  const statusEl=document.getElementById('aiStatus');const stTxt=document.getElementById('aiStatusTxt');
  statusEl.className='ai-status show';stTxt.textContent='Analisando imagem…';
  document.getElementById('aiAnalyzeBtn').disabled=true;
  document.getElementById('aiResultBox').className='ai-result-box';
  document.getElementById('aiUseBtn').style.display='none';
  try{
    const prompt='Analise esta imagem de conversa imobiliária. Extraia nome, telefone visível, empreendimento ou produto e breve contexto. Responda SOMENTE JSON puro: {"nome":"","telefone":"","empreendimento":"","contexto":""}';
    const text=await secureAiCompletion([{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:`data:${aiImgType};base64,${aiImgB64}`}}]}],{maxTokens:350,temperature:.1});
    let parsed={nome:'',telefone:'',empreendimento:'',contexto:''};
    try{parsed=JSON.parse(text.replace(/```json|```/gi,'').trim());}
    catch{const match=text.match(/\{[\s\S]*\}/);if(match)parsed=JSON.parse(match[0]);}
    aiExtracted={nome:String(parsed.nome||'').trim(),fone:String(parsed.telefone||'').replace(/\D/g,''),emp:String(parsed.empreendimento||'').trim(),obs:String(parsed.contexto||'').trim()};
    document.getElementById('aiRNome').textContent=aiExtracted.nome||'Não encontrado';
    document.getElementById('aiRFone').textContent=aiExtracted.fone||'Não encontrado';
    document.getElementById('aiREmp').textContent=aiExtracted.emp||'Não encontrado';
    const ctxRow=document.getElementById('aiRCtxRow');
    if(ctxRow){ctxRow.style.display=aiExtracted.obs?'flex':'none';document.getElementById('aiRCtx').textContent=aiExtracted.obs||'';}
    statusEl.className='ai-status';document.getElementById('aiResultBox').className='ai-result-box show';document.getElementById('aiUseBtn').style.display='inline-flex';
  }catch(e){stTxt.textContent=`Erro: ${e.message}`;setTimeout(()=>statusEl.className='ai-status',3500);}
  finally{document.getElementById('aiAnalyzeBtn').disabled=false;}
}
async function aiUse(){
  const nome=(aiExtracted.nome||'').trim();
  if(!nome){alert('A IA não encontrou um nome confiável para criar o lead.');return;}
  const telefone=(aiExtracted.fone||'').replace(/\D/g,'');
  const empBruto=(aiExtracted.emp||'').trim();
  const empLista=(LISTS.empreendimento||[]).find(x=>String(x).toLowerCase()===empBruto.toLowerCase());
  const empreendimento=empLista||empBruto||'Outros';
  const observacao=aiExtracted.obs?appendObs('',`Importado por imagem: ${aiExtracted.obs}`):appendObs('',`Importado por imagem.`);
  const lead={
    id:cid(),
    ordem:orderForTop('NOVO / INICIAL'),
    data_inicio:todayISO(),
    proximo_contato:null,
    nome,
    telefone,
    empreendimento,
    etapa:'NOVO / INICIAL',
    prioridade:'Baixa',
    origem:'WhatsApp',
    responsavel:LISTS.responsavel[0]||'Corretor',
    visita:'Não',
    motivo_perda:'',
    observacao,
    criado_em:nowISO(),
    atualizado_em:nowISO()
  };
  const ok=await upsertLead(lead);
  if(!ok){alert('Não foi possível criar o lead.');return;}
  closeAiImport();
  switchView('kanban');
  showToast(`Lead "${nome}" criado ✓`);
}

/* ══════════════════════════════════════
   QUICK LEAD
══════════════════════════════════════ */
function openQuickLead(){
  document.getElementById('qlNome').value='';document.getElementById('qlFone').value='';
  document.getElementById('qlPrioridade').value='Baixa';
  document.getElementById('qlSaveTxt').textContent='✅ Salvar Lead';document.getElementById('qlSaveBtn').disabled=false;
  document.getElementById('qlModal').classList.add('open');
  setTimeout(()=>document.getElementById('qlNome').focus(),280);
}
function closeQuickLead(){document.getElementById('qlModal').classList.remove('open');}
async function saveQuickLead(){
  const nome=document.getElementById('qlNome').value.trim();
  if(!nome){document.getElementById('qlNome').style.borderColor='#EF4444';setTimeout(()=>document.getElementById('qlNome').style.borderColor='',1500);return;}
  const fone=document.getElementById('qlFone').value.trim();
  const prioridade=document.getElementById('qlPrioridade').value||'Baixa';
  const btn=document.getElementById('qlSaveBtn');const txt=document.getElementById('qlSaveTxt');
  btn.disabled=true;txt.innerHTML=`<span class="ql-spinner"></span> Salvando…`;
  const ok=await upsertLead({id:cid(),ordem:orderForTop('NOVO / INICIAL'),data_inicio:todayISO(),proximo_contato:null,nome,telefone:fone.replace(/\D/g,''),empreendimento:'Outros',etapa:'NOVO / INICIAL',prioridade,origem:'Instagram',responsavel:LISTS.responsavel[0]||'Corretor',visita:'Não',motivo_perda:'',observacao:'',criado_em:nowISO(),atualizado_em:nowISO()});
  if(ok){closeQuickLead();showToast(`Lead "${nome}" salvo! ⚡`);switchView('kanban');}
  else{btn.disabled=false;txt.textContent='✅ Salvar Lead';}
}

/* ══════════════════════════════════════
   AGENDA
══════════════════════════════════════ */
let agYear=new Date().getFullYear();
let agMonth=new Date().getMonth();
let agSelDay=null;
let AG_CACHE=[];

function agKey(y,m,d){return`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function agMapRow(r){return{id:String(r.id),date:String(r.data||''),time:String(r.hora||'').slice(0,5),desc:String(r.descricao||''),notify:Number(r.notify||0)};}
function agAll(){return Array.isArray(AG_CACHE)?AG_CACHE:[];}
function agTodayKey(){const n=new Date();return agKey(n.getFullYear(),n.getMonth(),n.getDate());}
function agParseDate(dateKey,time='00:00'){
  const [y,m,d]=String(dateKey||'').split('-').map(Number);
  const [hh,mm]=String(time||'00:00').split(':').map(Number);
  return new Date(y||0,(m||1)-1,d||1,hh||0,mm||0,0,0);
}
function agIsOverdue(e){
  const todayKey=agTodayKey();
  if(!e||!e.date)return false;
  if(e.date<todayKey)return true;
  if(e.date>todayKey)return false;
  if(!String(e.time||'').trim())return false;
  return agParseDate(e.date,e.time).getTime()<Date.now();
}
function agInNext7Days(e){
  if(!e||!e.date||agIsOverdue(e))return false;
  const todayStart=agParseDate(agTodayKey(),'00:00').getTime();
  const max=todayStart+(7*86400000)+86399999;
  const ms=agParseDate(e.date,e.time||'00:00').getTime();
  return ms>=todayStart&&ms<=max;
}
function agSortEvents(a,b){
  return String(a.date||'').localeCompare(String(b.date||''))||String(a.time||'99:99').localeCompare(String(b.time||'99:99'));
}
async function agLoad(){
  try{
    const d=await sbFetch(`${AG_TBL}?select=id,data,hora,descricao,notify&order=data.asc,hora.asc`);
    AG_CACHE=(Array.isArray(d)?d:[]).map(agMapRow);
    return AG_CACHE;
  }catch(e){
    console.error('Agenda load error',e);
    showToast('Erro ao carregar agenda.');
    AG_CACHE=[];
    return AG_CACHE;
  }
}
function agForDay(key){return agAll().filter(e=>e.date===key).sort((a,b)=>String(a.time).localeCompare(String(b.time)));}
function agDaysWithEvts(){return new Set(agAll().map(e=>e.date));}
function setAgendaDefaultTime(){const inp=document.getElementById('agTime');if(inp)inp.value='';syncAgNotifyState();}
function syncAgNotifyState(){
  const timeInp=document.getElementById('agTime');
  const notify=document.getElementById('agNotify');
  if(!notify)return;
  const hasTime=!!(timeInp&&String(timeInp.value||'').trim());
  notify.disabled=!hasTime;
  if(!hasTime)notify.value='0';
  else if(notify.value==='0')notify.value='-1';
}
function syncAgDateInput(){const inp=document.getElementById('agDate');if(inp)inp.value=agSelDay||agTodayKey();}
function setAgendaToday(){const n=new Date();agYear=n.getFullYear();agMonth=n.getMonth();agSelDay=agKey(agYear,agMonth,n.getDate());syncAgDateInput();renderAgenda();}

async function openAgenda(){
  await agLoad();
  const n=new Date();agYear=n.getFullYear();agMonth=n.getMonth();agSelDay=agKey(agYear,agMonth,n.getDate());
  setAgendaDefaultTime();syncAgDateInput();
  renderAgenda();
  document.getElementById('agModal').classList.add('open');
}
function closeAgenda(){document.getElementById('agModal').classList.remove('open');}

function updateAgendaSummary(){
  const now=new Date();
  const todayKey=agTodayKey();
  const currentMonth=`${agYear}-${String(agMonth+1).padStart(2,'0')}`;
  const overdue=agAll().filter(agIsOverdue).length;
  const todayCount=agAll().filter(e=>e.date===todayKey).length;
  const upcoming=agAll().filter(agInNext7Days).length;
  const inMonth=agAll().filter(e=>String(e.date||'').startsWith(currentMonth)).length;
  const setTxt=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=String(val);};
  setTxt('agStatOverdue',overdue);
  setTxt('agStatToday',todayCount);
  setTxt('agStatUpcoming',upcoming);
  setTxt('agStatMonth',inMonth);
}

function renderAgenda(){
  const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const monthTxt=`${months[agMonth]} ${agYear}`;
  const monthA=document.getElementById('agMonthTitle');if(monthA)monthA.textContent=monthTxt;
  const monthB=document.getElementById('agMonthTitleMini');if(monthB)monthB.textContent=monthTxt;

  const grid=document.getElementById('agGrid');
  if(grid){
    const today=new Date();const todayKey=agKey(today.getFullYear(),today.getMonth(),today.getDate());
    const withEvts=agDaysWithEvts();
    let html=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="ag-dow">${d}</div>`).join('');
    const firstDay=new Date(agYear,agMonth,1).getDay();
    for(let i=0;i<firstDay;i++)html+=`<div class="ag-day empty"></div>`;
    const daysInMonth=new Date(agYear,agMonth+1,0).getDate();
    for(let d=1;d<=daysInMonth;d++){
      const key=agKey(agYear,agMonth,d);
      const cls=['ag-day',key===todayKey?'today':'',key===agSelDay?'sel':'',withEvts.has(key)?'has-ev':''].filter(Boolean).join(' ');
      html+=`<div class="${cls}" onclick="agSelectDay('${key}')">${d}</div>`;
    }
    grid.innerHTML=html;
  }
  updateAgendaSummary();
  renderAgDay();
  renderOverdue();
  renderUpcoming();
  updateAgendaBadge();
}

function agSelectDay(key){
  agSelDay=key;
  const parts=key.split('-');
  if(parts.length>=2){agYear=Number(parts[0])||agYear;agMonth=(Number(parts[1])||agMonth+1)-1;}
  syncAgDateInput();
  renderAgenda();
}

function renderAgDay(){
  const key=agSelDay||agTodayKey();
  const parts=key.split('-');
  const d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const mesesLong=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const titleEl=document.getElementById('agDayTitle');
  const lblEl=document.getElementById('agDayLbl');
  if(titleEl)titleEl.textContent=`${dias[d.getDay()]}, ${d.getDate()} de ${mesesLong[d.getMonth()]}`;
  if(lblEl)lblEl.textContent=key===agTodayKey()?'Painel de hoje':`Compromissos do dia selecionado`;
  const evts=agForDay(key);
  const el=document.getElementById('agEventList'); if(!el)return;
  if(!evts.length){
    el.innerHTML=`<div class="ag-empty-state">Nenhum compromisso para este dia.</div>`;
    return;
  }
  el.innerHTML=evts.map(e=>`<div class="ag-event-card">
      <div class="ag-event-time"><strong class="${e.time?'':'ag-time-empty'}">${e.time||'Sem hora'}</strong><span>${key===agTodayKey()?'Hoje':parts[2]+'/'+parts[1]}</span></div>
      <div class="ag-event-main">
        <div class="ag-event-main-title">${escH(e.desc)}</div>
        <div class="ag-event-main-desc">Compromisso agendado para ${parts[2]}/${parts[1]}/${parts[0]} ${e.time?'às '+e.time:'sem horário'}.</div>
        <div class="ag-event-main-meta"><span class="ag-mini-tag">Agenda</span></div>
      </div>
      <div class="ag-event-actions">
        <button class="ag-action-btn primary" onclick="agUseDate('${e.date}','${e.time}',${JSON.stringify(String(e.desc))})">Reagendar</button>
        <button class="ag-action-btn danger" onclick="agDelete('${e.id}')">Remover</button>
      </div>
    </div>`).join('');
}

function agUseDate(date,time,desc){
  agSelDay=date;syncAgDateInput();
  const dateInp=document.getElementById('agDate'); if(dateInp)dateInp.value=date||'';
  const timeInp=document.getElementById('agTime'); if(timeInp)timeInp.value=time||'';
  const descInp=document.getElementById('agDesc'); if(descInp)descInp.value=desc||'';
  syncAgNotifyState();
  renderAgenda();
}

function renderOverdue(){
  const now=new Date();
  const list=agAll().filter(agIsOverdue).sort(agSortEvents);
  const el=document.getElementById('agOverdueList');
  const countEl=document.getElementById('agOverdueCount');
  if(countEl)countEl.textContent=list.length;
  if(!el)return;
  if(!list.length){el.innerHTML=`<div class="ag-empty-state" style="padding:22px 10px">Nada atrasado.</div>`;return;}
  el.innerHTML=list.slice(0,6).map(e=>agSideItemHtml(e)).join('');
}

function renderUpcoming(){
  const list=agAll().filter(agInNext7Days).sort(agSortEvents);
  const el=document.getElementById('agUpcoming');
  const countEl=document.getElementById('agUpcomingCount');
  if(countEl)countEl.textContent=list.length;
  if(!el)return;
  if(!list.length){el.innerHTML=`<div class="ag-empty-state" style="padding:22px 10px">Nenhum compromisso nos próximos 7 dias.</div>`;return;}
  el.innerHTML=list.slice(0,8).map(e=>agSideItemHtml(e)).join('');
}

function agSideItemHtml(e){
  const dt=agParseDate(e.date,e.time);
  const dateLbl=`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
  return `<div class="ag-side-item">
    <div>
      <div class="ag-side-time">${e.time||'Sem hora'}</div>
      <div class="ag-side-date">${dateLbl}</div>
    </div>
    <div class="ag-side-desc">${escH(e.desc)}</div>
    <button class="ag-side-del" onclick="agDelete('${e.id}')">×</button>
  </div>`;
}

async function agDelete(id){
  clearScheduledNotif(id);
  try{
    await sbFetch(`${AG_TBL}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',prefer:'return=minimal'});
    AG_CACHE=agAll().filter(e=>e.id!==id);
    renderAgenda();showToast('Compromisso removido.');
  }catch(e){
    console.error('Agenda delete error',e);
    alert('Erro ao excluir compromisso.');
  }
}

async function agAdd(){
  const rawDate=document.getElementById('agDate')?.value || '';
  const date=rawDate || agSelDay || agTodayKey();
  const time=(document.getElementById('agTime').value||'').trim();
  const desc=document.getElementById('agDesc').value.trim();
  if(!desc){alert('Preencha a descrição do compromisso.');return;}
  const notify=time ? Number(document.getElementById('agNotify').value||0) : 0;
  if(time&&notify!==0&&'Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch(e){}}
  try{
    const body={data:date,descricao:desc,notify,access_user_id:ACCESS_USER.id};
    if(time) body.hora=time;
    else body.hora=null;
    const ins=await sbFetch(AG_TBL,{method:'POST',body});
    const row=Array.isArray(ins)?ins[0]:ins;
    if(row)AG_CACHE=[...agAll(),agMapRow(row)].sort((a,b)=>a.date.localeCompare(b.date)||String(a.time||'').localeCompare(String(b.time||'')));
    agSelDay=date;
    syncAgDateInput();
    setAgendaDefaultTime();
    document.getElementById('agDesc').value='';
    document.getElementById('agNotify').value='0';
    syncAgNotifyState();
    renderAgenda();showToast('Compromisso adicionado ✓');
    const id=row?.id?String(row.id):'';
    if(time&&notify!==0&&id)scheduleNotif(date,time,desc,notify,id);
  }catch(e){
    console.error('Agenda insert error',e);
    alert('Erro ao salvar compromisso.');
  }
}
async function scheduleNotif(dateKey,time,desc,minutesBefore,id){
  clearScheduledNotif(id);
  if(!time||Number(minutesBefore)===0||!('Notification'in window))return;
  let permission=Notification.permission;
  if(permission==='default')permission=await Notification.requestPermission();
  if(permission!=='granted')return;
  const leadMinutes=Number(minutesBefore)<0?0:Number(minutesBefore)||0;
  const target=agParseDate(dateKey,time).getTime()-(leadMinutes*60000);
  const delay=target-Date.now();
  if(delay<=0)return;
  const fire=async()=>{
    const options={body:`${dateKey.split('-').reverse().join('/')} às ${time}`,icon:'./icon-192.png',badge:'./icon-192.png',tag:`agenda-${id}`,data:{url:location.href}};
    try{const reg=await navigator.serviceWorker?.ready;if(reg)await reg.showNotification(desc,options);else new Notification(desc,options);}catch(e){try{new Notification(desc,options);}catch(_){}}
    NOTIFICATION_TIMERS.delete(String(id));
  };
  const max=2147483647;
  if(delay<=max)NOTIFICATION_TIMERS.set(String(id),setTimeout(fire,delay));
}
function clearScheduledNotif(id){
  const key=String(id||'');const timer=NOTIFICATION_TIMERS.get(key);if(timer)clearTimeout(timer);NOTIFICATION_TIMERS.delete(key);
}
function updateAgendaBadge(){
  const todayKey=agTodayKey();
  const c=agForDay(todayKey).length;
  ['agBadge','agBadgeMobile','agBadgeSide'].forEach(id=>{
    const b=document.getElementById(id);if(!b)return;
    b.style.display='inline-flex';
    b.textContent=c;
    b.title = c===1 ? '1 compromisso hoje' : `${c} compromissos hoje`;
    b.style.background = c>0 ? '#EF4444' : '#94A3B8';
  });
}

function rescheduleAllNotifs(){
  NOTIFICATION_TIMERS.forEach(timer=>clearTimeout(timer));NOTIFICATION_TIMERS.clear();
  agAll().forEach(e=>{if(e.time&&Number(e.notify)!==0)scheduleNotif(e.date,e.time,e.desc,e.notify,e.id);});
  updateAgendaBadge();
}
function setupPaste(){
  const ta=leadForm.querySelector('[name="observacao"]');if(!ta)return;
  ta.addEventListener('paste',async e=>{
    const items=[...(e.clipboardData?.items||[])];
    const imgItem=items.find(i=>i.type.startsWith('image/'));
    if(!imgItem)return;
    e.preventDefault();
    if(!editingId){showToast('Salve o lead primeiro para colar imagens.');return;}
    const file=imgItem.getAsFile();if(!file)return;
    showToast('⏳ Enviando imagem…');
    try{await uploadFiles(editingId,[file]);showToast('📎 Imagem anexada ✓');}
    catch(err){showToast('Erro ao anexar imagem.');console.error(err);}
  });
}

/* ══════════════════════════════════════
   ADMIN
══════════════════════════════════════ */
function renderAdmin(tab){
  if(tab==='responsaveis'){
    const items=getAdminResp();const el=document.getElementById('listResp');
    el.innerHTML=items.length?items.map((it,i)=>{const nome=it.nome||it;const leadsAtivos=ALL.filter(l=>l.responsavel===nome&&normEtapa(l.etapa)!=='PERDIDO').length;
      return`<div class="adm-item"><div class="adm-item-name">👤 ${escH(nome)}</div><div class="adm-item-detail">${it.fone?escH(it.fone)+' · ':''}${it.creci?'CRECI:'+escH(it.creci)+' · ':''}<span style="color:#D4AF37">${leadsAtivos} leads</span></div><button class="adm-del" onclick="removeResp(${i})">✕</button></div>`;
    }).join(''):'<div style="font-size:12px;color:var(--muted);padding:8px">Nenhum cadastrado.</div>';
  }
  if(tab==='imoveis'){
    const items=getAdminEmps();const el=document.getElementById('listEmp');
    const sc={'Disponível':'#16A34A','Lançamento':'#D4AF37','Em obras':'#E67E22','Entregue':'#4A90D9','Esgotado':'#D64545'};
    el.innerHTML=items.length?items.map((it,i)=>{const nome=it.nome||it;const c=ALL.filter(l=>l.empreendimento===nome).length;
      return`<div class="adm-item"><div class="adm-item-name">🏠 ${escH(nome)}</div><div class="adm-item-detail">${it.tipo?`<span style="background:rgba(74,144,217,.15);color:#4A90D9;padding:1px 7px;border-radius:999px;font-size:10px">${escH(it.tipo)}</span> `:''}${it.valor?escH(it.valor)+' · ':''}<span style="color:${sc[it.status]||'#16A34A'}">${escH(it.status||'Disponível')}</span>${c?' · '+c+' leads':''}</div><button class="adm-del" onclick="removeEmp(${i})">✕</button></div>`;
    }).join(''):'<div style="font-size:12px;color:var(--muted);padding:8px">Nenhum cadastrado.</div>';
  }
  if(tab==='origens'){
    const items=getAdminOrigs();const el=document.getElementById('listOrig');
    el.innerHTML=items.length?items.map((it,i)=>{const c=ALL.filter(l=>l.origem===it).length;
      return`<div class="adm-item"><div class="adm-item-name">📍 ${escH(it)}</div><div class="adm-item-detail">${c} leads</div><button class="adm-del" onclick="removeOrig(${i})">✕</button></div>`;
    }).join(''):'<div style="font-size:12px;color:var(--muted);padding:8px">Nenhuma cadastrada.</div>';
  }
  if(tab==='access'){loadAccessAdmin();}
}
function addResp(){const n=(document.getElementById('newRespNome').value||'').trim();if(!n){alert('Informe o nome.');return;}const f=(document.getElementById('newRespFone').value||'').trim();const c=(document.getElementById('newRespCreci').value||'').trim();const items=getAdminResp();if(items.some(x=>(x.nome||x)===n)){alert('Já existe.');return;}items.push({id:cid(),nome:n,fone:f,creci:c});lsSet('crm_resp',JSON.stringify(items));LISTS.responsavel=items.map(x=>x.nome||x);document.getElementById('newRespNome').value='';document.getElementById('newRespFone').value='';document.getElementById('newRespCreci').value='';renderAdmin('responsaveis');syncFilterSelects();showToast('Corretor adicionado.');}
function removeResp(i){const items=getAdminResp();if(!confirm(`Remover "${items[i].nome||items[i]}"?`))return;items.splice(i,1);lsSet('crm_resp',JSON.stringify(items));LISTS.responsavel=items.map(x=>x.nome||x);renderAdmin('responsaveis');syncFilterSelects();showToast('Removido.');}
function addEmp(){const n=(document.getElementById('newEmpNome').value||'').trim();if(!n){alert('Informe o nome.');return;}const t=document.getElementById('newEmpTipo').value;const v=(document.getElementById('newEmpValor').value||'').trim();const s=document.getElementById('newEmpStatus').value;const items=getAdminEmps();if(items.some(x=>(x.nome||x)===n)){alert('Já existe.');return;}items.push({id:cid(),nome:n,tipo:t,valor:v,status:s});lsSet('crm_emp',JSON.stringify(items));LISTS.empreendimento=items.map(x=>x.nome||x);document.getElementById('newEmpNome').value='';renderAdmin('imoveis');syncFilterSelects();showToast('Imóvel adicionado.');}
function removeEmp(i){const items=getAdminEmps();if(!confirm(`Remover "${items[i].nome||items[i]}"?`))return;items.splice(i,1);lsSet('crm_emp',JSON.stringify(items));LISTS.empreendimento=items.map(x=>x.nome||x);renderAdmin('imoveis');syncFilterSelects();showToast('Removido.');}
function addOrig(){const n=(document.getElementById('newOrigNome').value||'').trim();if(!n){alert('Informe a origem.');return;}const items=getAdminOrigs();if(items.includes(n)){alert('Já existe.');return;}items.push(n);lsSet('crm_orig',JSON.stringify(items));LISTS.origem=items;document.getElementById('newOrigNome').value='';renderAdmin('origens');syncFilterSelects();showToast('Origem adicionada.');}
function removeOrig(i){const items=getAdminOrigs();if(!confirm(`Remover "${items[i]}"?`))return;items.splice(i,1);lsSet('crm_orig',JSON.stringify(items));LISTS.origem=items;renderAdmin('origens');syncFilterSelects();showToast('Removido.');}


function goHomeFromLogo(){
  switchView('kanban');
  window.scrollTo({top:0,behavior:'smooth'});
}
function toggleSidebar(forceOpen=null){
  const mobile=window.innerWidth<=640;
  if(mobile){
    const open = forceOpen!==null ? forceOpen : !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open',open);
  }else{
    document.body.classList.toggle('sidebar-collapsed');
    lsSet('crm_sidebar_collapsed',document.body.classList.contains('sidebar-collapsed')?'1':'0');
  }
}
function syncSidebarState(){
  if(window.innerWidth<=640){
    document.body.classList.remove('sidebar-collapsed');
  }else{
    const collapsed = lsGet('crm_sidebar_collapsed')==='1';
    document.body.classList.toggle('sidebar-collapsed',collapsed);
    document.body.classList.remove('sidebar-open');
  }
}

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */

function selectedLead(){return ALL.find(x=>String(x.id)===String(SELECTED_LEAD_ID||editingId||''))||null;}
function leadModulePayload(lead){return lead?{id:lead.id,nome:lead.nome||'',telefone:lead.telefone||'',empreendimento:lead.empreendimento||'',etapa:normEtapa(lead.etapa),prioridade:lead.prioridade||'',observacao:lead.observacao||'',proximo_contato:lead.proximo_contato||''}:null;}
function populateDirecionaFromLead(lead){
  if(!lead)return;const input=document.getElementById('clientMessage');if(!input)return;
  input.value=[`Cliente: ${lead.nome||'—'}`,`Telefone: ${lead.telefone||'—'}`,`Empreendimento: ${lead.empreendimento||'—'}`,`Etapa: ${normEtapa(lead.etapa)}`,`Prioridade: ${lead.prioridade||'—'}`,`Próximo contato: ${lead.proximo_contato||'—'}`,'','Histórico do atendimento:',lead.observacao||'Sem histórico registrado.'].join('\n');
  input.dispatchEvent(new Event('input',{bubbles:true}));
}
function sendSelectedLeadToProposal(){
  const lead=selectedLead();if(!lead)return;const frame=document.getElementById('proposalFrame');
  try{frame?.contentWindow?.postMessage({type:'LEVECRM_LEAD',lead:leadModulePayload(lead)},location.protocol==='file:'?'*':location.origin);}catch(e){console.warn(e);}
}
function openLeadInModule(name){
  if(editingId)SELECTED_LEAD_ID=editingId;
  const lead=selectedLead();try{document.getElementById('dlg')?.close();}catch(e){}
  if(name==='direciona')populateDirecionaFromLead(lead);
  switchView(name);if(name==='propostas')setTimeout(sendSelectedLeadToProposal,150);
  window.scrollTo({top:0,behavior:'smooth'});
}

function switchView(name){
  currentView=name;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-tab[data-view]').forEach(t=>t.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelector(`.nav-tab[data-view="${name}"]`)?.classList.add('active');
  const bar=document.getElementById('kanbanBar');if(bar)bar.style.display=name==='kanban'?'flex':'none';
  const mob=document.getElementById('mobileActions');if(mob)mob.style.display=name==='kanban'&&window.innerWidth<=640?'grid':'none';
  if(name==='dashboard')renderDashboard();
  if(name==='admin'){renderAdmin('responsaveis');renderAdmin('imoveis');renderAdmin('origens');if(ACCESS_USER?.is_admin)loadAccessAdmin();}
  if(name==='kanban'){render();syncMobileFiltersFromDesktop();refreshFilterButtonLabels();}
  if(name==='direciona')populateDirecionaFromLead(selectedLead());
  if(name==='propostas')setTimeout(sendSelectedLeadToProposal,120);
  if(window.innerWidth<=640)document.body.classList.remove('sidebar-open');
}
function fillSel(id,items,label){const s=document.getElementById(id);s.innerHTML=`<option value="">${label}</option>`+items.map(v=>`<option value="${escH(v)}">${escH(v)}</option>`).join('');}
function syncFilterSelects(){
  fillSel('fEmp',LISTS.empreendimento,'Empreendimento');
  fillSel('fOrig',LISTS.origem,'Origem');
  fillSel('fPri',LISTS.prioridade,'Prioridade');
  fillSel('mfEmp',LISTS.empreendimento,'Empreendimento');
  fillSel('mfOrig',LISTS.origem,'Origem');
  fillSel('mfPri',LISTS.prioridade,'Prioridade');
}
function syncMobileFiltersFromDesktop(){
  [['fEmp','mfEmp'],['fOrig','mfOrig'],['fPri','mfPri']].forEach(([a,b])=>{
    const sa=document.getElementById(a), sb=document.getElementById(b); if(sa&&sb) sb.value=sa.value;
  });
}
function syncDesktopFiltersFromMobile(){
  [['mfEmp','fEmp'],['mfOrig','fOrig'],['mfPri','fPri']].forEach(([a,b])=>{
    const sa=document.getElementById(a), sb=document.getElementById(b); if(sa&&sb) sb.value=sa.value;
  });
}
function openMobileFilters(){syncMobileFiltersFromDesktop();document.getElementById('mobileFilterModal').classList.add('open');}
function closeMobileFilters(){document.getElementById('mobileFilterModal').classList.remove('open');}


/* ══════════════════════════════════════
   CSV
══════════════════════════════════════ */
function csvEsc(v){const s=String(v??'');return/["\n,]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}

function parseCSV(text){
  const clean=String(text||'').replace(/^\uFEFF/,'');
  const first=(clean.split(/\r?\n/,1)[0]||'');
  const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<clean.length;i++){
    const c=clean[i],n=clean[i+1];
    if(quoted){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
    else if(c==='"')quoted=true;
    else if(c===delimiter){row.push(field);field='';}
    else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
function normalizeCSVHeader(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[\s-]+/g,'_');}

function exportCSV(){const headers=['id','ordem','data_inicio','proximo_contato','nome','telefone','empreendimento','etapa','prioridade','origem','responsavel','visita','motivo_perda','observacao','criado_em','atualizado_em'];const rows=filtered().map(r=>headers.map(h=>csvEsc(r[h])).join(','));const blob=new Blob([[headers.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`levecrm-${todayISO()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
async function importCSV(text){
  const rows=parseCSV(text);
  if(rows.length<2){alert('CSV vazio ou inválido.');return;}
  const headers=rows[0].map(normalizeCSVHeader);
  if(!headers.includes('nome')){alert('O CSV precisa ter uma coluna chamada nome.');return;}
  const records=rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??'']))).filter(r=>String(r.nome||'').trim());
  if(!records.length){alert('Nenhum lead válido encontrado.');return;}
  if(!confirm(`Importar ${records.length} lead(s)? Registros existentes com o mesmo ID, telefone ou nome serão atualizados.`))return;
  let saved=0,failed=0;
  for(const r of records){
    try{
      const phone=String(r.telefone||r.fone||'').replace(/\D/g,'');
      const existing=ALL.find(x=>(r.id&&String(x.id)===String(r.id))||(phone&&String(x.telefone||'').replace(/\D/g,'')===phone)||String(x.nome||'').trim().toLowerCase()===String(r.nome||'').trim().toLowerCase());
      const etapa=normEtapa(r.etapa||'NOVO / INICIAL');
      const payload={
        id:existing?.id||cid(),ordem:Number(r.ordem)||existing?.ordem||orderForTop(etapa),
        data_inicio:normProx(r.data_inicio)||existing?.data_inicio||todayISO(),proximo_contato:normProx(r.proximo_contato),
        nome:String(r.nome||'').trim(),telefone:phone,empreendimento:String(r.empreendimento||'Outros').trim()||'Outros',
        etapa,prioridade:LISTS.prioridade.includes(r.prioridade)?r.prioridade:'Baixa',origem:String(r.origem||'WhatsApp').trim()||'WhatsApp',
        responsavel:String(r.responsavel||LISTS.responsavel[0]||'').trim(),visita:normVisita(r.visita),
        motivo_perda:etapa==='PERDIDO'?(normMotivo(r.motivo_perda)||'Outro'):'',observacao:String(r.observacao||'').trim(),
        criado_em:existing?.criado_em||r.criado_em||nowISO(),atualizado_em:nowISO()
      };
      if(await upsertLead(payload,{silent:true}))saved++;else failed++;
    }catch(e){console.error('Falha ao importar linha',r,e);failed++;}
  }
  render();showToast(`${saved} lead(s) importado(s).`,2400);
  alert(`Importação concluída.\nSalvos: ${saved}\nFalhas: ${failed}`);
}
function applyTheme(t){
  const theme=ALL_THEMES.includes(t)?t:'t-light';
  document.body.classList.remove(...ALL_THEMES);
  document.body.classList.add(theme);
  document.querySelectorAll('.theme-opt').forEach(o=>o.classList.toggle('active',o.dataset.theme===theme));
  const lbl={'t-navy':'Azul','t-light':'Claro','t-dark':'Escuro'};
  const themeToggle=document.getElementById('themeToggle');
  if(themeToggle) themeToggle.textContent=(lbl[theme]||'Tema')+' ▾';
  const sideTheme=document.getElementById('sideThemeCurrent');
  if(sideTheme) sideTheme.textContent=(lbl[theme]||'Tema');
  lsSet('crm_theme',theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='t-light'?'#F5F7FA':theme==='t-dark'?'#08090C':'#082248');
  setupPWA();
}

/* ══════════════════════════════════════
   PWA MANIFEST + INSTALL
══════════════════════════════════════ */
let deferredInstallPrompt=null;
function getAppBasePath(){
  const p=location.pathname||'/';
  return p.endsWith('/')?p:p.substring(0,p.lastIndexOf('/')+1);
}
function setupPWA(){
  const manifestLink=document.querySelector('link[rel="manifest"]');
  if(manifestLink && !manifestLink.getAttribute('href')){
    manifestLink.setAttribute('href','./manifest.webmanifest');
  }
}
function isStandaloneMode(){
  return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
}
function updateInstallBtn(){
  const btn=document.getElementById('btnInstallApp');
  if(!btn)return;
  if(isStandaloneMode()){
    document.body.classList.add('app-installed');
    btn.style.display='none';
    return;
  }
  document.body.classList.remove('app-installed');
  const isLocal=location.protocol==='file:';
  btn.style.display=(deferredInstallPrompt||isLocal)?'inline-flex':'none';
  btn.textContent=isLocal?'📱 Instalar app':'📱 Instalar app';
  btn.title=isLocal?'Publique em HTTPS para instalar como app':'Instalar app';
}
async function handleInstallClick(){
  const isLocal=location.protocol==='file:';
  if(isLocal){
    alert('Para instalar como app, abra este CRM em um endereço HTTPS, como GitHub Pages.');
    return;
  }
  if(!deferredInstallPrompt){
    alert('O app ainda não está pronto para instalação. Confirme que index.html, manifest.webmanifest, service-worker.js, icon-192.png e icon-512.png foram enviados para a pasta /levecrm/ no GitHub. Depois recarregue a página.');
    return;
  }
  deferredInstallPrompt.prompt();
  try{await deferredInstallPrompt.userChoice;}catch(e){}
  deferredInstallPrompt=null;
  updateInstallBtn();
}
async function registerSW(){
  if(!('serviceWorker' in navigator))return;
  if(location.protocol==='file:')return;
  try{
    const reg=await navigator.serviceWorker.register('./service-worker.js?v=35');
    await reg.update();
    if(navigator.serviceWorker.controller){
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        window.location.reload();
      },{once:true});
    }
  }catch(e){
    console.warn('SW não registrado:',e);
  }
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  updateInstallBtn();
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.body.classList.add('app-installed');
  showToast('App instalado ✓');
  updateInstallBtn();
});

/* ══════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════ */

// Safe binding helper: evita travar a tela quando algum botão não existe neste modo/viewport
function bindEl(id, eventName, handler, opts){
  const el=document.getElementById(id);
  if(el) el.addEventListener(eventName, handler, opts);
}

// Theme
bindEl('themeToggle','click',e=>{e.stopPropagation();document.getElementById('themeWrap').classList.toggle('open');});
bindEl('themeMenu','click',e=>{const o=e.target.closest('[data-theme]');if(!o)return;applyTheme(o.dataset.theme);document.getElementById('themeWrap').classList.remove('open');});
document.addEventListener('click',e=>{
  if(!document.getElementById('themeWrap').contains(e.target))document.getElementById('themeWrap').classList.remove('open');
  const mw=document.getElementById('moreWrap'); if(mw && !mw.contains(e.target)) mw.classList.remove('open');
});

// Nav
document.querySelectorAll('.nav-tab[data-view]').forEach(t=>t.addEventListener('click',()=>switchView(t.dataset.view)));
const agendaTop=document.getElementById('agendaTabBtn'); if(agendaTop) agendaTop.addEventListener('click',openAgenda);
const agendaSide=document.getElementById('agendaTabBtnSide'); if(agendaSide) agendaSide.addEventListener('click',openAgenda);
function syncSidebarUtilityState(){
  const themeMap={'t-light':'Claro','t-dark':'Escuro','t-navy':'Azul'};
  const current=lsGet('crm_theme')||localStorage.getItem('crm_theme')||'t-light';
  const themeEl=document.getElementById('sideThemeCurrent');if(themeEl)themeEl.textContent=themeMap[current]||'Claro';
  const rawName=String(ACCESS_USER?.nome||ACCESS_USER?.name||ACCESS_USER?.displayName||'').trim();
  const nameEl=document.getElementById('sideAccountName');if(nameEl)nameEl.textContent=rawName||'Não conectado';
  const installBtn=document.getElementById('sideInstallApp');if(installBtn)installBtn.style.display=document.body.classList.contains('app-installed')?'none':'flex';
}
function cycleSidebarTheme(){
  const order=['t-light','t-dark','t-navy'];
  const current=lsGet('crm_theme')||localStorage.getItem('crm_theme')||'t-light';
  const next=order[(order.indexOf(current)+1)%order.length];
  applyTheme(next);
}
const sideToggleMain=document.getElementById('sideToggleMain'); if(sideToggleMain) sideToggleMain.addEventListener('click',()=>toggleSidebar());
const sideToggleNav=document.getElementById('sideToggleNav'); if(sideToggleNav) sideToggleNav.addEventListener('click',()=>toggleSidebar());
const sideLogo=document.getElementById('sideLogoHome'); if(sideLogo) sideLogo.addEventListener('click',goHomeFromLogo);
const topLogo=document.getElementById('topLogoHome'); if(topLogo){ topLogo.addEventListener('click',goHomeFromLogo); topLogo.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goHomeFromLogo();}}); }
const sideImportPrint=document.getElementById('sideImportPrint'); if(sideImportPrint) sideImportPrint.addEventListener('click',()=>document.getElementById('btnAiImport')?.click());
const sideInstallApp=document.getElementById('sideInstallApp'); if(sideInstallApp) sideInstallApp.addEventListener('click',()=>document.getElementById('btnInstallApp')?.click());
const sideThemeBtn=document.getElementById('sideThemeBtn'); if(sideThemeBtn) sideThemeBtn.addEventListener('click',cycleSidebarTheme);
const sideLogoutBtn=document.getElementById('sideLogoutBtn'); if(sideLogoutBtn) sideLogoutBtn.addEventListener('click',()=>document.getElementById('btnLogoutAccess')?.click());
syncSidebarUtilityState();
const sideBackdrop=document.getElementById('sideBackdrop'); if(sideBackdrop) sideBackdrop.addEventListener('click',()=>toggleSidebar(false));
window.addEventListener('resize',syncSidebarState);
const btnLeadDireciona=document.getElementById('btnLeadDireciona');
const btnLeadProposta=document.getElementById('btnLeadProposta');
if(btnLeadDireciona)btnLeadDireciona.addEventListener('click',()=>openLeadInModule('direciona'));
if(btnLeadProposta)btnLeadProposta.addEventListener('click',()=>openLeadInModule('propostas'));
bindEl('agendaBtnMobile','click',openAgenda);
window.addEventListener('message',e=>{if(e.data?.type==='LEVECRM_PROPOSAL_READY')sendSelectedLeadToProposal();});
bindEl('btnNewMobile','click',openNew);
bindEl('mobileFiltersBtn','click',openMobileFilters);
bindEl('mobileFilterClose','click',closeMobileFilters);
bindEl('mobileFilterModal','click',e=>{if(e.target===e.currentTarget)closeMobileFilters();});

// Alert banner → Dashboard
bindEl('alertBanner','click',()=>switchView('dashboard'));

// More menu
document.getElementById('moreToggle').addEventListener('click',e=>{
  e.stopPropagation();
  if(window.innerWidth<=900){ openMobileFilters(); return; }
  const mw=document.getElementById('moreWrap'); if(mw) mw.classList.toggle('open');
});
function refreshFilterButtonLabels(){
  const lostTxt=SHOW_LOST?'Ocultar perdidos':'Mostrar perdidos';
  const sbTxt=SHOW_SB?'Ocultar Stand by':'Mostrar Stand by';
  const a=document.getElementById('btnToggleLost'); if(a)a.textContent=lostTxt;
  const b=document.getElementById('mfToggleLost'); if(b)b.textContent=lostTxt;
  const c=document.getElementById('btnToggleSb'); if(c)c.textContent=sbTxt;
  const d=document.getElementById('mfToggleSb'); if(d)d.textContent=sbTxt;
}
bindEl('btnToggleLost','click',()=>{SHOW_LOST=!SHOW_LOST;const mw=document.getElementById('moreWrap'); if(mw) mw.classList.remove('open');refreshFilterButtonLabels();render();});
bindEl('btnToggleSb','click',()=>{SHOW_SB=!SHOW_SB;const mw=document.getElementById('moreWrap'); if(mw) mw.classList.remove('open');refreshFilterButtonLabels();render();});
bindEl('mfToggleLost','click',()=>{SHOW_LOST=!SHOW_LOST;refreshFilterButtonLabels();render();});
bindEl('mfToggleSb','click',()=>{SHOW_SB=!SHOW_SB;refreshFilterButtonLabels();render();});
bindEl('btnExport','click',()=>{const mw=document.getElementById('moreWrap'); if(mw) mw.classList.remove('open');exportCSV();});
bindEl('mfExport','click',()=>{closeMobileFilters();exportCSV();});
bindEl('btnImport','click',()=>{const mw=document.getElementById('moreWrap'); if(mw) mw.classList.remove('open');document.getElementById('csvInput').value='';document.getElementById('csvInput').click();});
bindEl('mfImport','click',()=>{closeMobileFilters();document.getElementById('csvInput').value='';document.getElementById('csvInput').click();});
bindEl('mfAiImport','click',()=>{closeMobileFilters();document.getElementById('btnAiImport').click();});
bindEl('csvInput','change',async e=>{const f=e.target.files?.[0];if(!f)return;await importCSV(await f.text());});

// Search
bindEl('searchQ','input',e=>{const sc=document.getElementById('searchClear'); if(sc) sc.classList.toggle('show',!!e.target.value.trim());render();});
bindEl('searchClear','click',()=>{const sq=document.getElementById('searchQ'); const sc=document.getElementById('searchClear'); if(sq)sq.value=''; if(sc)sc.classList.remove('show');render();});
['fEmp','fOrig','fResp','fPri'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('change',()=>{syncMobileFiltersFromDesktop();render();});});
['mfEmp','mfOrig','mfResp','mfPri'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('change',()=>{syncDesktopFiltersFromMobile();render();});});
window.addEventListener('resize',()=>{const mob=document.getElementById('mobileActions');if(mob)mob.style.display=currentView==='kanban'&&window.innerWidth<=640?'grid':'none';if(window.innerWidth>640)closeMobileFilters();});

// New lead
bindEl('btnNew','click',openNew);
bindEl('btnQuick','click',openQuickLead);

// Lead dialog
bindEl('dlgClose','click',()=>closeDialog());
bindEl('btnCancel','click',()=>closeDialog());
bindEl('dlg','cancel',e=>{e.preventDefault();closeDialog();});
bindEl('btnDelete','click',async()=>{if(editingId)await deleteLead(editingId);closeDialog(true);});
leadForm.querySelector('[name="etapa"]').addEventListener('change',toggleMotivo);

// Obs entry
document.getElementById('btnNovoAtendimento').addEventListener('click',()=>{
  const ta=F('observacao');const cur=String(ta.value||'').replace(/\r/g,'').replace(/[ \t]+$/gm,'').replace(/\n+$/g,'');
  const pfx=obsPfx();ta.value=cur?`${cur}\n\n${pfx}`:pfx;
  ta.focus();requestAnimationFrame(()=>{ta.setSelectionRange(ta.value.length,ta.value.length);});
});
F('observacao').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='j'){e.preventDefault();document.getElementById('btnNovoAtendimento').click();}});

// Attachments
document.getElementById('attachBtn').addEventListener('click',()=>{
  if(!editingId){alert('Salve o lead antes de anexar.');return;}
  document.getElementById('attachInput').value='';document.getElementById('attachInput').click();
});
document.getElementById('attachInput').addEventListener('change',async()=>{
  const files=Array.from(document.getElementById('attachInput').files||[]);if(!files.length)return;
  document.getElementById('attachBtn').disabled=true;
  try{await uploadFiles(editingId,files);showToast(`${files.length===1?'Anexo enviado':'Anexos enviados'} ✓`);}
  catch(e){alert(`Erro: ${e.message}`);}
  finally{document.getElementById('attachBtn').disabled=false;document.getElementById('attachInput').value='';}
});

// AI chips
bindEl('aiBtnResumo','click',()=>aiLeadAction('resumo'));
bindEl('aiBtnAcao','click',()=>aiLeadAction('acao'));
bindEl('aiBtnPrio','click',()=>aiLeadAction('prio'));

// Form submit
leadForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const nome=F('nome').value.trim();
  if(ALL.some(l=>l.id!==editingId&&normEtapa(l.etapa)!=='PERDIDO'&&(l.nome||'').trim().toLowerCase()===nome.toLowerCase())){
    if(!confirm(`Já existe lead ativo com "${nome}". Salvar mesmo assim?`))return;
  }
  if(origSnap&&formSnap()===origSnap){closeDialog(true);return;}
  const prevEtapa=editingId?normEtapa(ALL.find(x=>x.id===editingId)?.etapa||''):null;
  const newEtapa=normEtapa(F('etapa').value);
  if(editingId&&prevEtapa&&prevEtapa!==newEtapa)addHistory(editingId,`${prevEtapa} → ${newEtapa}`);
  const payload={id:editingId||cid(),ordem:editingId?(ALL.find(x=>x.id===editingId)?.ordem??Date.now()):orderForTop(newEtapa),data_inicio:F('data_inicio').value||todayISO(),proximo_contato:normProx(F('proximo_contato').value),nome,telefone:F('telefone').value.trim(),empreendimento:F('empreendimento').value,etapa:newEtapa,prioridade:F('prioridade').value,origem:F('origem').value,responsavel:F('responsavel').value,visita:normVisita(F('visita').value),motivo_perda:newEtapa==='PERDIDO'?normMotivo(F('motivo_perda').value):'',observacao:F('observacao').value,criado_em:editingId?(ALL.find(x=>x.id===editingId)?.criado_em||nowISO()):nowISO(),atualizado_em:nowISO()};
  const ok=await upsertLead(payload);
  if(ok){origSnap=formSnap();closeDialog(true);}
});

// Quick lead
bindEl('btnInstallApp','click',handleInstallClick);
bindEl('qlCancelBtn','click',closeQuickLead);
bindEl('qlSaveBtn','click',saveQuickLead);
bindEl('qlModal','click',e=>{if(e.target===e.currentTarget)closeQuickLead();});
bindEl('qlNome','keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('qlFone').focus();}});
bindEl('qlFone','keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveQuickLead();}});

// AI Import
bindEl('btnAiImport','click',openAiImport);
bindEl('aiCancelBtn','click',closeAiImport);
bindEl('aiAnalyzeBtn','click',aiAnalyze);
bindEl('aiUseBtn','click',aiUse);
bindEl('aiFileInput','change',e=>aiHandleFile(e.target.files?.[0]));
bindEl('aiDrop','dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragover');});
bindEl('aiDrop','dragleave',e=>e.currentTarget.classList.remove('dragover'));
bindEl('aiDrop','drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');aiHandleFile(e.dataTransfer.files?.[0]);});
bindEl('aiModal','click',e=>{if(e.target===e.currentTarget)closeAiImport();});

// Agenda
bindEl('agClose','click',closeAgenda);
bindEl('agModal','click',e=>{if(e.target===e.currentTarget)closeAgenda();});
bindEl('agPrev','click',()=>{agMonth--;if(agMonth<0){agMonth=11;agYear--;}renderAgenda();});
bindEl('agNext','click',()=>{agMonth++;if(agMonth>11){agMonth=0;agYear++;}renderAgenda();});
bindEl('agAddBtn','click',agAdd);
bindEl('agGoToday','click',setAgendaToday);
bindEl('agTime','input',syncAgNotifyState);
bindEl('agDesc','keydown',e=>{if(e.key==='Enter'){e.preventDefault();agAdd();}});
document.querySelectorAll('.ag-tab').forEach(t=>t.addEventListener('click',()=>{switchAgTab(t.dataset.agtab);if(t.dataset.agtab==='upcoming')renderUpcoming();}));

// Admin tabs
document.querySelectorAll('.adm-tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.adm-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  document.querySelectorAll('.adm-sec').forEach(x=>x.classList.remove('active'));
  const s=document.getElementById(`adm-${t.dataset.tab}`);if(s)s.classList.add('active');
  if(t.dataset.tab==='access')loadAccessAdmin();
  else renderAdmin(t.dataset.tab);
}));

// Contadores caixas
bindEl('boxPerdidos','click',()=>{SHOW_LOST=!SHOW_LOST;render();});
const btnSalvarAcesso=document.getElementById('btnSalvarAcesso'); if(btnSalvarAcesso) btnSalvarAcesso.addEventListener('click',saveAccessUser);

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */

try{
  document.title='LeveCRM';
  const statusbar=document.getElementById('statusbar');
  if(statusbar) statusbar.style.display='none';
  const fResp=document.getElementById('fResp');
  if(fResp) fResp.style.display='none';
  const mfResp=document.getElementById('mfResp');
  if(mfResp) mfResp.style.display='none';
}catch(e){}

function initApp(){
  if(appBooted)return;
  appBooted=true;
  loadAdminData();
  syncFilterSelects();
  syncMobileFiltersFromDesktop();
  refreshFilterButtonLabels();
  setupPaste();
  setupPWA();
  registerSW();
  applyTheme('t-light');
  updateInstallBtn();
  setInterval(()=>{document.querySelectorAll('.card').forEach(c=>{const id=c.dataset.id;const l=ALL.find(x=>x.id===id);if(!l)return;const nc=nextContact(l);const ncEl=c.querySelector('.chip-nc-neutral,.chip-nc-green,.chip-nc-red');if(ncEl&&nc){ncEl.className=`chip ${nc.cls}`;ncEl.textContent=nc.text;}});},60000);
  setInterval(updateAgendaBadge,60000);
  agLoad().then(()=>{rescheduleAllNotifs();updateAgendaBadge();});
  loadAll().then(()=>{refreshFilterButtonLabels();syncMobileFiltersFromDesktop();const mob=document.getElementById('mobileActions');if(mob)mob.style.display=currentView==='kanban'&&window.innerWidth<=640?'grid':'none';});
}

bindEl('gateEntrar','click',accessLogin);
bindEl('gateCadastrar','click',accessRegister);
bindEl('gateAtivarChave','click',activateLicenseFromInput);
bindEl('gateWhats','click',openAccessWhats);
document.getElementById('gateLimpar').addEventListener('click',()=>{
  ['gateUsuario','gateSenha','gateNome','gateCadastroEmail','gateCadastroSenha','gateChave'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  clearAccessMessages();
});
bindEl('btnLogoutAccess','click',logoutAccess);
bindEl('gateSenha','keydown',e=>{if(e.key==='Enter')accessLogin();});
bindEl('gateUsuario','keydown',e=>{if(e.key==='Enter')accessLogin();});
bindEl('gateCadastroSenha','keydown',e=>{if(e.key==='Enter')accessRegister();});
bindEl('gateChave','keydown',e=>{if(e.key==='Enter')activateLicenseFromInput();});
bindEl('tabLogin','click',()=>{clearAccessMessages();setAccessMode('login');});
bindEl('tabCadastro','click',()=>{clearAccessMessages();setAccessMode('cadastro');});
bindEl('tabLicenca','click',()=>{clearAccessMessages();setAccessMode('licenca');});
setAccessMode('login');
accessResumeSession();
/* Status online/offline */
(function(){
  function setStatus(){
    const dot=document.getElementById('userStatusDot');
    if(!dot) return;
    if(navigator.onLine){ dot.classList.add('online'); dot.classList.remove('offline'); dot.title='Online'; }
    else { dot.classList.add('offline'); dot.classList.remove('online'); dot.title='Offline'; }
  }
  window.addEventListener('online',setStatus);
  window.addEventListener('offline',setStatus);
  setStatus();
})();


/* ===== levecrm-counter-labels-js ===== */
(function(){
  function labelCounters(){
    const boxes = Array.from(document.querySelectorAll('.cbox'));
    const labels = ['Perdidos','Ativos','Total'];
    boxes.slice(0,3).forEach((box,i)=>{
      if(!box.querySelector('.t')){
        const n = box.textContent.trim();
        box.innerHTML = '<span class="n">'+n+'</span><span class="t">'+labels[i]+'</span>';
      }else{
        const t = box.querySelector('.t');
        if(t && (!t.textContent || /^\s*$/.test(t.textContent))) t.textContent = labels[i] || '';
      }
    });
  }
  window.addEventListener('load', labelCounters);
  setTimeout(labelCounters,500);
  document.addEventListener('click',()=>setTimeout(labelCounters,300));
})();


/* ===== direciona-retomada-js ===== */
(function(){
let historyFiles=[],lastFile=null,lastAnalysis=null;
function $(id){return document.getElementById(id)}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function status(t){let e=$("diaStatus");if(e)e.textContent=t}

function counts(){if($("historyCount"))$("historyCount").textContent=String(historyFiles.length);if($("lastCount"))$("lastCount").textContent=lastFile?"1":"0";renderFileLists();updateFlowHint()}
function renderFileLists(){
  const h=$("historyFileList"),l=$("lastFileList");
  if(h)h.innerHTML=historyFiles.map((f,i)=>`<div class="dia-file-chip"><span>📎 ${esc(f.name||("contexto "+(i+1)))}</span><button class="dia-file-remove" type="button" data-kind="history" data-index="${i}">×</button></div>`).join("");
  if(l)l.innerHTML=lastFile?`<div class="dia-file-chip"><span>📌 ${esc(lastFile.name||"última conversa")}</span><button class="dia-file-remove" type="button" data-kind="last">×</button></div>`:"";
}
function updateFlowHint(){
  const hint=$("diaFlowHint"), analyze=$("btnAiAnalyzeMain"), retomada=$("btnRetomadaMain");
  if(!hint||!analyze||!retomada)return;
  analyze.classList.remove("dia-primary-focus");retomada.classList.remove("dia-primary-focus");
  if(lastFile){retomada.classList.add("dia-primary-focus");hint.innerHTML='Última conversa anexada. Para mandar mensagem agora, clique em <b>Gerar retomada</b>.'}
  else{analyze.classList.add("dia-primary-focus");hint.innerHTML='Quer entender o lead? Clique em <b>Analisar conversa</b>. Para gerar retomada, anexe a última conversa.'}
}
function b64(file){return new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(String(r.result||"").split(",")[1]||"");r.onerror=no;r.readAsDataURL(file)})}

function guessMime(file){
  const name=String(file&&file.name||'').toLowerCase();
  const type=String(file&&file.type||'').toLowerCase();
  if(type==='image/jpeg'||type==='image/png'||type==='image/webp'||type==='image/gif')return type;
  if(name.endsWith('.jpg')||name.endsWith('.jpeg'))return 'image/jpeg';
  if(name.endsWith('.png'))return 'image/png';
  if(name.endsWith('.webp'))return 'image/webp';
  if(name.endsWith('.gif'))return 'image/gif';
  return '';
}
function isTextFile(file){
  const name=String(file&&file.name||'').toLowerCase();
  const type=String(file&&file.type||'').toLowerCase();
  return type.startsWith('text/')||name.endsWith('.txt');
}
function readTextFile(file){
  return new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(String(r.result||'').slice(0,12000));r.onerror=no;r.readAsText(file)});
}
async function addFileToContent(content,file,label){
  const mime=guessMime(file);
  if(mime){
    content.push({type:"text",text:label+" (imagem): "+(file.name||"print")});
    content.push({type:"image_url",image_url:{url:"data:"+mime+";base64,"+await b64(file)}});
    return true;
  }
  if(isTextFile(file)){
    content.push({type:"text",text:label+" (texto):\\n"+await readTextFile(file)});
    return true;
  }
  content.push({type:"text",text:label+" ignorado: arquivo não suportado. Use JPG/PNG/WEBP ou TXT."});
  return false;
}

function busy(btn,on,text){if(!btn)return;btn.disabled=!!on;btn.textContent=on?"Analisando...":text}
async function callOpenAI(mode){
let msg=($("clientMessage")?.value||"").trim();
if(!msg&&!historyFiles.length&&!lastFile){alert("Cole uma observação, anexe contexto ou a última conversa.");status("Falta mensagem, contexto ou última conversa.");return null}
let retomada=mode==="retomada";
let prompt=retomada?
`Você é especialista em vendas imobiliárias de alto padrão e retomada por WhatsApp.
Tarefa: gerar SOMENTE mensagens de retomada para o corretor enviar ao cliente.
Use CONTEXTO + ÚLTIMA CONVERSA, dando prioridade máxima absoluta à última conversa.
A retomada deve continuar exatamente do ponto onde a conversa parou, sem parecer mensagem genérica.
Se houver análise prévia, use como apoio, mas não repita diagnóstico interno.
Responda APENAS JSON válido:
{"situacao":"curta","temperatura":"Frio|Morno|Quente","perfil":"curto","risco":"curto","objetivo":"curto","proximo_passo":"curto","evitar":"curto","retomadas":[{"label":"Premium","texto":"mensagem pronta para WhatsApp","dica":"curta"},{"label":"Direta","texto":"mensagem pronta para WhatsApp","dica":"curta"},{"label":"Consultiva","texto":"mensagem pronta para WhatsApp","dica":"curta"}]}
Regras: português brasileiro, natural, elegante, blocos curtos, sem inventar dados, sem usar "faz sentido", sem pressionar grosseiramente.`:
`Você é especialista em vendas imobiliárias de alto padrão.
Tarefa: fazer ANÁLISE INTERNA ESTRATÉGICA do lead para orientar o corretor.
NÃO gere mensagem pronta para o cliente neste botão.
A análise precisa ser útil comercialmente, específica e baseada no que aparece na conversa.
Identifique: momento atual da negociação, objeção real, intenção provável, nível de interesse, risco de abordagem errada e próximo movimento específico.
Responda APENAS JSON válido:
{"situacao":"diagnóstico específico da conversa em 1 frase","temperatura":"Frio|Morno|Quente","perfil":"perfil comercial provável, com motivo","risco":"Baixo|Médio|Alto + motivo","objetivo":"o que o corretor deve buscar agora","proximo_passo":"ação prática e específica para o próximo contato","evitar":"o que o corretor deve evitar nesta negociação","respostas":[]}
Regras: português brasileiro, consultivo, direto, sem texto de WhatsApp, sem inventar dados, sem usar "faz sentido", não seja vago.`;
let content=[{type:"text",text:prompt+"\n\nObservação do corretor:\n"+(msg||"Sem observação.")+"\n\nAnálise prévia disponível:\n"+(lastAnalysis?JSON.stringify(lastAnalysis):"Nenhuma.")+"\n\nPrints de contexto são histórico. Última conversa é prioridade máxima."}];
for(let f of historyFiles){await addFileToContent(content,f,"PRINT DE CONTEXTO")}
if(lastFile){await addFileToContent(content,lastFile,"ÚLTIMA CONVERSA / PRIORIDADE MÁXIMA")}
let authToken=(window.SB_KEY||SB_KEY);try{const ss=await window.AUTH_CLIENT?.auth?.getSession?.();authToken=ss?.data?.session?.access_token||authToken}catch(e){}let res=await fetch(`${(window.SB_URL||SB_URL)}/functions/v1/direciona-openai`,{method:"POST",headers:{"Content-Type":"application/json","apikey":(window.SB_KEY||SB_KEY),"Authorization":"Bearer "+authToken},body:JSON.stringify({model:"gpt-4o-mini",temperature:0.32,max_tokens:2600,messages:[{role:"user",content}]})});
if(!res.ok)throw new Error(await res.text().catch(()=>("HTTP "+res.status)));
let j=await res.json();let txt=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content?j.choices[0].message.content:"").trim();let parsed;try{parsed=JSON.parse(txt)}catch(e){let m=txt.match(/\{[\s\S]*\}/);if(m)parsed=JSON.parse(m[0])}if(!parsed)throw new Error("A IA não retornou JSON válido.");return parsed}
function reading(d){$("analysisSituation").textContent=d.situacao||"Análise concluída.";$("analysisHeat").textContent=d.temperatura||"—";$("analysisProfile").textContent=d.perfil||"—";$("analysisRisk").textContent=d.risco||"—";$("analysisGoal").textContent=d.objetivo||"—";$("analysisNext").textContent=d.proximo_passo||"—";let a=$("analysisAvoid");if(a&&d.evitar){a.style.display="block";a.textContent="Evitar: "+d.evitar}}
function cards(id,items,empty){let area=$(id);if(!area)return;if(!items||!items.length){area.innerHTML='<div class="dia-empty">'+esc(empty)+'</div>';return}area.innerHTML=items.map((r,i)=>`<div class="dia-response"><div class="dia-response-head"><div class="dia-response-label">${esc(r.label||("Opção "+(i+1)))}</div><button class="dia-copy" type="button" data-copy="${encodeURIComponent(r.texto||"")}">Copiar</button></div><p>${esc(r.texto||"")}</p>${r.dica?`<div class="dia-tip">${esc(r.dica)}</div>`:""}</div>`).join("")}
async function analyze(){let btn=$("btnAiAnalyzeMain");try{busy(btn,true,"✨ Analisar conversa");status("Analisando conversa com IA..."); if(window.showAiLoading) showAiLoading("Analisando conversa","Lendo prints e extraindo diagnóstico comercial interno."); let d=await callOpenAI("analise");if(!d)return;lastAnalysis=d;reading(d);cards("analysisResponses",[], "Análise interna concluída. Para texto pronto ao cliente, use Gerar retomada.");status("Análise interna concluída.")}catch(e){console.error(e);alert("Erro na análise: "+(e.message||e));status("Erro na análise.")}finally{if(window.hideAiLoading) hideAiLoading();busy(btn,false,"✨ Analisar conversa")}}
async function retomada(){let btn=$("btnRetomadaMain");try{busy(btn,true,"🔁 Gerar retomada");status("Gerando retomada com prioridade para a última conversa..."); if(window.showAiLoading) showAiLoading("Gerando retomada","Criando uma mensagem de reabertura baseada na última conversa."); let d=await callOpenAI("retomada");if(!d)return;reading(d);cards("retomadaOutput",d.retomadas,"Sem retomadas retornadas.");status("Retomada gerada.")}catch(e){console.error(e);alert("Erro na retomada: "+(e.message||e));status("Erro na retomada.")}finally{if(window.hideAiLoading) hideAiLoading();busy(btn,false,"🔁 Gerar retomada")}}
function clearAll(){historyFiles=[];lastFile=null;lastAnalysis=null;if($("clientMessage"))$("clientMessage").value="";if($("historyPrintInput"))$("historyPrintInput").value="";if($("lastPrintInput"))$("lastPrintInput").value="";counts();status("Aguardando mensagem, contexto ou última conversa.");$("analysisSituation").textContent="Cole uma mensagem ou anexe prints.";$("analysisHeat").textContent="—";$("analysisProfile").textContent="—";$("analysisRisk").textContent="—";$("analysisGoal").textContent="—";$("analysisNext").textContent="—";let a=$("analysisAvoid");if(a){a.style.display="none";a.textContent=""}$("analysisResponses").innerHTML='<div class="dia-empty">A análise aparecerá aqui.</div>';$("retomadaOutput").innerHTML='<div class="dia-empty">A retomada aparecerá aqui.</div>'}
document.addEventListener("change",e=>{if(e.target&&e.target.id==="historyPrintInput"){historyFiles=historyFiles.concat(Array.from(e.target.files||[]));e.target.value="";counts();status(historyFiles.length+" print(s) de contexto anexado(s).")}if(e.target&&e.target.id==="lastPrintInput"){lastFile=(e.target.files&&e.target.files[0])?e.target.files[0]:null;e.target.value="";counts();status(lastFile?"Última conversa anexada.":"Nenhuma última conversa anexada.")}});
document.addEventListener("click",e=>{let rm=e.target.closest(".dia-file-remove");if(rm){let kind=rm.dataset.kind;if(kind==="history"){historyFiles.splice(Number(rm.dataset.index),1)}else{lastFile=null}counts();status("Anexo removido.");return}let c=e.target.closest(".dia-copy");if(c){let t=decodeURIComponent(c.getAttribute("data-copy")||"");navigator.clipboard.writeText(t).then(()=>{c.textContent="Copiado";setTimeout(()=>c.textContent="Copiar",1200)});return}if(e.target&&e.target.id==="btnAiAnalyzeMain")analyze();if(e.target&&e.target.id==="btnRetomadaMain")retomada();if(e.target&&e.target.id==="btnClearAnalyzer")clearAll()});
document.addEventListener("paste",e=>{let a=document.activeElement;if(!a||a.id!=="clientMessage")return;let imgs=Array.from((e.clipboardData&&e.clipboardData.items)||[]).filter(i=>i.type&&i.type.startsWith("image/")).map(i=>i.getAsFile()).filter(Boolean);if(imgs.length){historyFiles=historyFiles.concat(imgs);counts();status(historyFiles.length+" print(s) de contexto anexado(s) por Ctrl+V.")}});
setTimeout(updateFlowHint,600);
})();


/* ===== levecrm-safe-recovery-js ===== */
(function(){
  function norm(txt){
    return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }
  function root(){
    return document.querySelector('#dlg,.modal,.dialog,.lead-modal');
  }
  function fieldByLabel(labelText){
    const r = root();
    if(!r) return null;
    const target = norm(labelText);
    const labels = Array.from(r.querySelectorAll('label'));
    for(const label of labels){
      if(norm(label.textContent).includes(target)){
        return label.closest('.field,.form-field,.input-group,.form-group,.col,.row') || label.parentElement;
      }
    }
    return null;
  }
  function etapaValue(){
    const r = root();
    if(!r) return '';
    const labels = Array.from(r.querySelectorAll('label'));
    for(const label of labels){
      if(norm(label.textContent).includes('etapa')){
        const box = label.closest('.field,.form-field,.input-group,.form-group,.col,.row') || label.parentElement;
        const select = box && box.querySelector('select');
        if(select) return norm(select.value || (select.options[select.selectedIndex] && select.options[select.selectedIndex].text) || '');
      }
    }
    return '';
  }
  function cleanModal(){
    const r = root();
    if(!r) return;
    const resp = fieldByLabel('Responsavel');
    if(resp) resp.style.display = 'none';

    const motivo = fieldByLabel('Motivo de perda');
    if(motivo){
      const etapa = etapaValue();
      motivo.style.display = (etapa.includes('perdido') || etapa.includes('perda')) ? '' : 'none';
    }
  }
  function updateDireciona(){
    const d = document.getElementById('view-direciona');
    const active = !!d && (d.classList.contains('active') || d.style.display === 'block' || getComputedStyle(d).display !== 'none');
    document.body.classList.toggle('view-direciona-active', active);
  }
  const oldSwitch = window.switchView;
  if(typeof oldSwitch === 'function' && !oldSwitch.__safeRecoveryWrapped){
    const wrapped = function(){
      const r = oldSwitch.apply(this, arguments);
      setTimeout(updateDireciona, 0);
      setTimeout(updateDireciona, 150);
      return r;
    };
    wrapped.__safeRecoveryWrapped = true;
    window.switchView = wrapped;
  }
  document.addEventListener('change', function(e){
    if(e.target && e.target.matches('select')) setTimeout(cleanModal, 60);
  }, true);
  document.addEventListener('click', function(){
    setTimeout(cleanModal, 80);
    setTimeout(updateDireciona, 80);
  }, true);
  window.addEventListener('load', function(){
    setTimeout(cleanModal, 800);
    setTimeout(updateDireciona, 800);
  });
  setInterval(cleanModal, 1200);
})();


/* ===== levecrm-ai-loading-safe-final ===== */
(function(){
  window.showAiLoading = function(title,text){
    const o=document.getElementById('aiLoadingOverlay');
    if(!o) return;
    const t=document.getElementById('aiLoadingTitle');
    const p=document.getElementById('aiLoadingText');
    if(t) t.textContent=title||'Analisando com IA';
    if(p) p.textContent=text||'Processando informações...';
    o.style.display='flex';
  };
  window.hideAiLoading = function(){
    const o=document.getElementById('aiLoadingOverlay');
    if(o) o.style.display='none';
  };
  function limparChipsFalsosDeAnexo(){
    document.querySelectorAll('.lead-attachment-clean-chip').forEach(el=>el.remove());
  }
  document.addEventListener('click', function(e){
    if(e.target.closest('#attachBtn,#btnClose,#btnCancel,#btnSave,.card')){
      setTimeout(limparChipsFalsosDeAnexo, 80);
    }
  }, true);
  window.addEventListener('load', limparChipsFalsosDeAnexo);
})();


/* ===== levecrm-loading-forcado-js ===== */
(function(){
  let timer=null;
  function ensureOverlay(){
    let el=document.getElementById('aiLoadingOverlayForced');
    if(!el){
      const wrap=document.createElement('div');
      wrap.innerHTML='<div id="aiLoadingOverlayForced"><div class="ai-load-card"><div class="ai-load-spinner"></div><div class="ai-load-title" id="aiLoadingForcedTitle">Analisando com IA</div><div class="ai-load-text" id="aiLoadingForcedText">Lendo os prints e montando a melhor orientação comercial.</div></div></div>';
      document.body.appendChild(wrap.firstElementChild);
      el=document.getElementById('aiLoadingOverlayForced');
    }
    return el;
  }
  window.leveShowLoading=function(title,text){
    const el=ensureOverlay();
    const t=document.getElementById('aiLoadingForcedTitle');
    const p=document.getElementById('aiLoadingForcedText');
    if(t)t.textContent=title||'Analisando com IA';
    if(p)p.textContent=text||'Processando informações...';
    el.style.display='flex';
    clearTimeout(timer);
    timer=setTimeout(()=>window.leveHideLoading(),90000);
  };
  window.leveHideLoading=function(){
    const el=document.getElementById('aiLoadingOverlayForced');
    if(el)el.style.display='none';
    clearTimeout(timer);
  };
  document.addEventListener('click',function(e){
    const btn=e.target.closest('#btnAiAnalyzeMain,#btnRetomadaMain');
    if(!btn)return;
    if(btn.id==='btnAiAnalyzeMain'){
      window.leveShowLoading('Analisando conversa','Lendo contexto, interpretando o cliente e criando o diagnóstico comercial.');
    }else{
      window.leveShowLoading('Gerando retomada','Criando uma mensagem natural baseada na última conversa do cliente.');
    }
  },true);
  const oldFetch=window.fetch;
  if(typeof oldFetch==='function'&&!oldFetch.__leveLoadingWrapped){
    const wrapped=function(){
      const args=arguments;
      const url=String(args[0]||'');
      const isAi=url.includes('api.openai.com');
      return oldFetch.apply(this,args).then(function(res){
        if(isAi)setTimeout(()=>window.leveHideLoading(),900);
        return res;
      }).catch(function(err){
        if(isAi)setTimeout(()=>window.leveHideLoading(),300);
        throw err;
      });
    };
    wrapped.__leveLoadingWrapped=true;
    window.fetch=wrapped;
  }
  window.addEventListener('error',function(){setTimeout(()=>window.leveHideLoading(),500)});
  window.addEventListener('unhandledrejection',function(){setTimeout(()=>window.leveHideLoading(),500)});
})();


/* ===== levecrm-loading-cancel-js ===== */
(function(){
  window.leveAiAbortController = null;

  function ensureCancelButton(){
    const box = document.querySelector('#aiLoadingOverlayForced .ai-load-card') || document.querySelector('#aiLoadingBox');
    if(!box) return;
    if(box.querySelector('.ai-load-cancel')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-load-cancel';
    btn.textContent = 'Cancelar análise';
    btn.addEventListener('click', function(){
      try{
        if(window.leveAiAbortController){
          window.leveAiAbortController.abort();
          window.leveAiAbortController = null;
        }
      }catch(e){}

      if(typeof window.leveHideLoading === 'function') window.leveHideLoading();
      if(typeof window.hideAiLoading === 'function') window.hideAiLoading();

      const status = document.getElementById('diaStatus');
      if(status) status.textContent = 'Análise cancelada pelo usuário.';

      const b1 = document.getElementById('btnAiAnalyzeMain');
      const b2 = document.getElementById('btnRetomadaMain');
      if(b1){ b1.disabled = false; b1.textContent = '✨ Analisar conversa'; }
      if(b2){ b2.disabled = false; b2.textContent = '🔁 Gerar retomada'; }
    });

    box.appendChild(btn);
  }

  const oldShow = window.leveShowLoading;
  window.leveShowLoading = function(title,text){
    if(typeof oldShow === 'function') oldShow(title,text);
    setTimeout(ensureCancelButton, 30);
  };

  const oldShow2 = window.showAiLoading;
  window.showAiLoading = function(title,text){
    if(typeof oldShow2 === 'function') oldShow2(title,text);
    setTimeout(ensureCancelButton, 30);
  };

  const originalFetch = window.fetch;
  if(typeof originalFetch === 'function' && !originalFetch.__leveCancelWrapped){
    const wrapped = function(input, init){
      const url = String(input || '');
      const isAi = url.includes('api.openai.com');

      if(isAi){
        window.leveAiAbortController = new AbortController();
        init = init || {};
        init.signal = window.leveAiAbortController.signal;
      }

      return originalFetch(input, init).finally(function(){
        if(isAi) window.leveAiAbortController = null;
      });
    };
    wrapped.__leveCancelWrapped = true;
    window.fetch = wrapped;
  }

  document.addEventListener('click', function(e){
    const btn = e.target.closest('#btnAiAnalyzeMain,#btnRetomadaMain');
    if(btn) setTimeout(ensureCancelButton, 120);
  }, true);

  window.addEventListener('load', function(){
    setTimeout(ensureCancelButton, 800);
  });
})();


/* ===== levecrm-safe-ui-v31-js ===== */
(function(){
  function safe(fn){try{fn()}catch(e){console.warn('LeveCRM ajuste seguro ignorado:',e)}}
  function norm(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}

  function removeBanner(){
    var el=document.getElementById('alertBanner');
    if(el) el.style.display='none';
  }

  function oneLupa(){
    var inp=document.getElementById('searchQ') || Array.from(document.querySelectorAll('input')).find(i=>/busca|buscar|search/i.test(i.placeholder||''));
    if(!inp || inp.dataset.oneLupaOk)return;
    inp.placeholder='Busca...';
    var p=inp.parentElement;
    if(p){
      var icons=Array.from(p.querySelectorAll('span,i,svg,button')).filter(el=>/🔎|🔍/.test(el.textContent||'')||/search|lupa|magnif/i.test(String(el.className||'')));
      icons.slice(1).forEach(el=>el.style.display='none');
    }
    inp.dataset.oneLupaOk='1';
  }

  function touchedToday(){
    var d=new Date(),dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0');
    document.querySelectorAll('.card').forEach(function(c){
      var t=norm(c.innerText);
      c.classList.toggle('touched-today',t.includes('hoje')||t.includes(dd+'/'+mm));
    });
  }

  function ensureLateModal(){
    if(document.getElementById('lateModalSafe'))return;
    var m=document.createElement('div');
    m.id='lateModalSafe';
    m.innerHTML='<div class="box"><div class="head"><h2>Atrasados / Hoje</h2><button type="button" id="lateCloseSafe">Fechar</button></div><div id="lateListSafe"></div></div>';
    document.body.appendChild(m);
    var close=document.getElementById('lateCloseSafe');
    if(close)close.onclick=function(){m.classList.remove('open')};
    m.addEventListener('click',function(e){if(e.target===m)m.classList.remove('open')});
  }

  function getLate(){
    if(typeof getOverdue==='function') return getOverdue();
    return [];
  }

  function openLate(){
    ensureLateModal();
    var modal=document.getElementById('lateModalSafe'),list=document.getElementById('lateListSafe');
    if(!modal||!list)return;
    var items=getLate();
    list.innerHTML=items.length?items.map(function(l){
      var nome=String(l.nome||'Lead');
      var emp=String(l.empreendimento||'');
      var pc=String(l.proximo_contato||'');
      return '<div class="row" data-id="'+l.id+'"><b>'+nome+'</b><small>'+emp+' · Próximo contato: '+pc+'</small></div>';
    }).join(''):'<div class="row"><b>Nenhum lead em atraso/hoje</b><small>Não há contatos pendentes.</small></div>';
    list.querySelectorAll('[data-id]').forEach(function(row){
      row.onclick=function(){
        modal.classList.remove('open');
        if(typeof openEdit==='function')openEdit(row.getAttribute('data-id'));
      };
    });
    modal.classList.add('open');
  }

  function ensureMenu(){
    if(document.getElementById('lateSafeBtn')) {
      var b=document.querySelector('#lateSafeBtn .nav-badge');
      if(b)b.textContent=String(getLate().length);
      return;
    }
    var agenda=document.getElementById('agendaTabBtnSide');
    if(!agenda||!agenda.parentElement)return;
    var btn=document.createElement('button');
    btn.className='nav-tab';
    btn.id='lateSafeBtn';
    btn.type='button';
    btn.innerHTML='<span>⏰</span><span class="side-label">Atrasados</span><span class="nav-badge">'+String(getLate().length)+'</span>';
    btn.onclick=openLate;
    agenda.parentElement.insertBefore(btn,agenda.nextSibling);
  }

  function moreLayer(){
    var wrap=document.getElementById('moreWrap'),menu=document.getElementById('moreMenu'),btn=document.getElementById('moreToggle');
    if(!wrap||!menu||!btn)return;
    menu.style.zIndex='1000000';
    if(!btn.dataset.safeMore){
      btn.dataset.safeMore='1';
      btn.addEventListener('click',function(){
        setTimeout(function(){
          if(wrap.classList.contains('open')){
            var r=btn.getBoundingClientRect();
            menu.style.position='fixed';
            menu.style.top=(r.bottom+8)+'px';
            menu.style.left=Math.max(8,Math.min(r.left,window.innerWidth-230))+'px';
            menu.style.right='auto';
          }
        },0);
      },true);
    }
  }

  function run(){
    safe(removeBanner);safe(oneLupa);safe(touchedToday);safe(ensureMenu);safe(moreLayer);
  }
  window.addEventListener('load',function(){setTimeout(run,600)});
  document.addEventListener('click',function(){setTimeout(run,100)},true);
  document.addEventListener('input',function(){setTimeout(run,100)},true);
  setInterval(run,1500);
})();


/* ===== levecrm-ai-progress-v1-js ===== */
(function(){
  let progressTimer = null;
  let progressValue = 0;
  let startedAt = 0;
  let active = false;
  let hideTimer = null;

  function $(id){ return document.getElementById(id); }

  function ensureOverlay(){
    let el = $('aiLoadingOverlayForced');
    if(!el){
      const wrap = document.createElement('div');
      wrap.innerHTML = '<div id="aiLoadingOverlayForced"><div class="ai-load-card"><div class="ai-load-title" id="aiLoadingForcedTitle">Analisando conversa</div><div class="ai-load-text" id="aiLoadingForcedText">Lendo os prints, contexto e histórico do lead.</div></div></div>';
      document.body.appendChild(wrap.firstElementChild);
      el = $('aiLoadingOverlayForced');
    }

    const card = el.querySelector('.ai-load-card');
    if(card && !card.querySelector('.ai-progress-ring')){
      const ring = document.createElement('div');
      ring.className = 'ai-progress-ring';
      ring.style.setProperty('--leve-progress','0%');
      ring.innerHTML = '<span class="ai-progress-percent">0%</span>';
      card.insertBefore(ring, card.firstChild);
    }
    if(card && !card.querySelector('.ai-progress-track')){
      const track = document.createElement('div');
      track.className = 'ai-progress-track';
      track.innerHTML = '<div class="ai-progress-bar"></div>';
      const text = card.querySelector('.ai-load-text');
      if(text) text.insertAdjacentElement('afterend', track);
      else card.appendChild(track);
    }
    if(card && !card.querySelector('.ai-progress-step')){
      const step = document.createElement('div');
      step.className = 'ai-progress-step';
      step.textContent = 'Preparando arquivos';
      const track = card.querySelector('.ai-progress-track');
      if(track) track.insertAdjacentElement('afterend', step);
      else card.appendChild(step);
    }
    if(card && !card.querySelector('.ai-progress-note')){
      const note = document.createElement('div');
      note.className = 'ai-progress-note';
      note.textContent = 'Pode levar alguns segundos, principalmente com prints anexados.';
      const step = card.querySelector('.ai-progress-step');
      if(step) step.insertAdjacentElement('afterend', note);
      else card.appendChild(note);
    }
    return el;
  }

  function setProgress(n, forcedStep){
    progressValue = Math.max(0, Math.min(100, Math.round(n)));
    const el = ensureOverlay();
    const ring = el.querySelector('.ai-progress-ring');
    const pct = el.querySelector('.ai-progress-percent');
    const bar = el.querySelector('.ai-progress-bar');
    const step = el.querySelector('.ai-progress-step');
    if(ring) ring.style.setProperty('--leve-progress', progressValue + '%');
    if(pct) pct.textContent = progressValue + '%';
    if(bar) bar.style.width = progressValue + '%';
    if(step){
      step.textContent = forcedStep || currentStep(progressValue);
    }
  }

  function currentStep(p){
    if(p < 18) return 'Preparando arquivos';
    if(p < 38) return 'Lendo prints e contexto';
    if(p < 62) return 'Interpretando intenção do cliente';
    if(p < 82) return 'Montando diagnóstico comercial';
    if(p < 98) return 'Aguardando resposta final da IA';
    return 'Concluído';
  }

  function tick(){
    if(!active) return;
    const elapsed = Date.now() - startedAt;
    let cap = 88;
    let inc = 1;
    if(elapsed < 2500){ cap = 42; inc = 4 + Math.random()*4; }
    else if(elapsed < 7000){ cap = 70; inc = 2 + Math.random()*3; }
    else if(elapsed < 16000){ cap = 86; inc = 1 + Math.random()*1.8; }
    else { cap = 93; inc = Math.random()*0.8; }

    if(progressValue < cap){
      setProgress(Math.min(cap, progressValue + inc));
    }
  }

  function start(title, text){
    const el = ensureOverlay();
    const t = $('aiLoadingForcedTitle');
    const p = $('aiLoadingForcedText');
    if(t) t.textContent = title || 'Analisando conversa';
    if(p) p.textContent = text || 'Lendo os prints, contexto e histórico do lead.';

    // Esconde o loading antigo para não ficar duplicado.
    const old = $('aiLoadingOverlay');
    if(old) old.style.display = 'none';

    clearTimeout(hideTimer);
    el.style.display = 'flex';

    if(!active){
      active = true;
      startedAt = Date.now();
      progressValue = 6;
      setProgress(progressValue, 'Preparando arquivos');
      clearInterval(progressTimer);
      progressTimer = setInterval(tick, 650);
    }
  }

  function finish(mode){
    const el = ensureOverlay();
    clearInterval(progressTimer);
    progressTimer = null;
    active = false;

    if(mode === 'cancel'){
      setProgress(Math.max(progressValue, 100), 'Análise cancelada');
    }else{
      setProgress(100, 'Concluído');
    }

    clearTimeout(hideTimer);
    hideTimer = setTimeout(function(){
      el.style.display = 'none';
      progressValue = 0;
      setProgress(0, 'Preparando arquivos');
    }, 520);
  }

  window.leveShowLoading = function(title, text){ start(title, text); };
  window.showAiLoading = function(title, text){ start(title, text); };
  window.leveHideLoading = function(){ finish(); };
  window.hideAiLoading = function(){ finish(); };

  // Cancelamento também para a função do Supabase usada pelo Direciona.
  const originalFetch = window.fetch;
  if(typeof originalFetch === 'function' && !originalFetch.__leveProgressWrapped){
    const wrapped = function(input, init){
      const rawUrl = typeof input === 'string' ? input : (input && input.url) ? input.url : '';
      const url = String(rawUrl || '');
      const isDireciona = url.includes('/functions/v1/direciona-openai') || url.includes('direciona-openai');
      if(isDireciona){
        try{
          window.leveAiAbortController = new AbortController();
          init = init || {};
          init.signal = window.leveAiAbortController.signal;
        }catch(e){}
      }
      return originalFetch.call(this, input, init).finally(function(){
        if(isDireciona) window.leveAiAbortController = null;
      });
    };
    wrapped.__leveProgressWrapped = true;
    window.fetch = wrapped;
  }

  document.addEventListener('click', function(e){
    const cancel = e.target.closest && e.target.closest('.ai-load-cancel');
    if(cancel){
      try{
        if(window.leveAiAbortController){
          window.leveAiAbortController.abort();
          window.leveAiAbortController = null;
        }
      }catch(err){}
      finish('cancel');
    }
  }, true);
})();


/* ===== mobile-cleanup-2804-script ===== */
(function(){
  function isMobileWidth(){
    return window.innerWidth <= 900;
  }

  function updateMobileNewLeadFields(){
    var form = document.getElementById('leadForm');
    if(!form) return;

    if(!isMobileWidth() || !form.classList.contains('is-new-lead')){
      form.classList.remove('show-mobile-motivo');
      return;
    }

    var etapa = form.querySelector('[name="etapa"]');
    var etapaVal = etapa ? String(etapa.value || '').trim().toUpperCase() : '';

    if(etapaVal === 'PERDIDO'){
      form.classList.add('show-mobile-motivo');
    }else{
      form.classList.remove('show-mobile-motivo');
      var motivo = form.querySelector('[name="motivo_perda"]');
      if(motivo) motivo.value = '';
    }
  }

  function scheduleUpdate(){
    setTimeout(updateMobileNewLeadFields, 0);
    setTimeout(updateMobileNewLeadFields, 60);
  }

  document.addEventListener('DOMContentLoaded', function(){
    var btnNew = document.getElementById('btnNew');
    var btnNewMobile = document.getElementById('btnNewMobile');
    var etapa = document.querySelector('#leadForm [name="etapa"]');
    var dlg = document.getElementById('dlg');

    if(btnNew) btnNew.addEventListener('click', scheduleUpdate);
    if(btnNewMobile) btnNewMobile.addEventListener('click', scheduleUpdate);
    if(etapa) etapa.addEventListener('change', updateMobileNewLeadFields);
    if(dlg) dlg.addEventListener('close', function(){
      var form = document.getElementById('leadForm');
      if(form) form.classList.remove('show-mobile-motivo');
    });

    scheduleUpdate();
  });
})();


/* ===== patch-dnd-robusto-2804 ===== */
(function(){
  var dragId = null;
  var suppressClickUntil = 0;
  function clearDragging(){
    document.querySelectorAll('.card.dragging').forEach(function(c){ c.classList.remove('dragging'); });
    document.querySelectorAll('.dropzone.dragover').forEach(function(z){ z.classList.remove('dragover'); });
  }
  function moveLeadTo(id, etapaDestino){
    if(!id || !Array.isArray(window.ALL)) return;
    var lead = window.ALL.find(function(x){ return String(x.id) === String(id); });
    if(!lead) return;
    var newE = window.normEtapa ? window.normEtapa(etapaDestino) : etapaDestino;
    var oldE = window.normEtapa ? window.normEtapa(lead.etapa) : lead.etapa;
    if(newE === oldE) return;
    if(newE === 'PERDIDO'){
      if(typeof window.openEdit === 'function') window.openEdit(id,true);
      return;
    }
    try{ if(typeof window.addHistory === 'function') window.addHistory(id, oldE + ' → ' + newE); }catch(e){}
    var ordem = (typeof window.orderForTop === 'function') ? window.orderForTop(newE) : Date.now();
    if(typeof window.upsertLead === 'function') window.upsertLead(Object.assign({}, lead, {etapa:newE, ordem:ordem}));
  }
  window.wireDnD = function(){
    document.querySelectorAll('.card[data-id]').forEach(function(c){
      c.setAttribute('draggable','true');
      c.ondragstart = function(e){
        dragId = c.dataset.id;
        c.classList.add('dragging');
        suppressClickUntil = Date.now() + 450;
        try{ e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); }catch(err){}
      };
      c.ondragend = function(){ suppressClickUntil = Date.now() + 450; clearDragging(); dragId = null; };
      c.onclick = function(e){
        if(Date.now() < suppressClickUntil) return;
        if(e.target.closest('.wa-btn')) return;
        if(typeof window.openEdit === 'function') window.openEdit(c.dataset.id);
      };
    });
    document.querySelectorAll('.dropzone').forEach(function(z){
      z.ondragover = function(e){ e.preventDefault(); try{ e.dataTransfer.dropEffect='move'; }catch(err){} z.classList.add('dragover'); };
      z.ondragenter = function(e){ e.preventDefault(); z.classList.add('dragover'); };
      z.ondragleave = function(e){ if(!z.contains(e.relatedTarget)) z.classList.remove('dragover'); };
      z.ondrop = function(e){
        e.preventDefault();
        var id = '';
        try{ id = e.dataTransfer.getData('text/plain'); }catch(err){}
        id = id || dragId;
        z.classList.remove('dragover');
        suppressClickUntil = Date.now() + 450;
        moveLeadTo(id, z.dataset.drop);
        clearDragging();
        dragId = null;
      };
    });
  };
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ try{ window.wireDnD(); }catch(e){} }, 250); });
  window.addEventListener('load', function(){ setTimeout(function(){ try{ window.wireDnD(); }catch(e){} }, 600); });
})();


/* Reorganiza automaticamente quando alternar entre desktop e mobile */
let __lastMobileKanban = null;
window.addEventListener('resize',()=>{
  const nowMobile = isMobileKanban();
  if(__lastMobileKanban===null){__lastMobileKanban=nowMobile;return;}
  if(nowMobile!==__lastMobileKanban){__lastMobileKanban=nowMobile;render();}
});


/* ===== levecrm-ajustes-combinados-2904-script ===== */
(function(){
  function form(){ return document.getElementById('leadForm'); }
  function etapaAtual(){
    var f=form();
    var el=f ? f.querySelector('[name="etapa"]') : null;
    return el ? String(el.value || '').trim().toUpperCase() : '';
  }
  function atualizarMotivoMobile(){
    var f=form();
    if(!f) return;
    var mostrar = etapaAtual() === 'PERDIDO';
    f.classList.toggle('show-mobile-motivo', mostrar);
    var motivo = f.querySelector('[name="motivo_perda"]');
    if(motivo){
      motivo.disabled = !mostrar;
      motivo.required = mostrar;
      if(!mostrar) motivo.value = '';
    }
  }
  window.addEventListener('load', function(){
    var etapa = document.querySelector('#leadForm [name="etapa"]');
    var dlg = document.getElementById('dlg');
    if(etapa) etapa.addEventListener('change', function(){ setTimeout(atualizarMotivoMobile,0); setTimeout(atualizarMotivoMobile,80); });
    if(dlg) dlg.addEventListener('close', function(){ var f=form(); if(f) f.classList.remove('show-mobile-motivo'); });
    document.addEventListener('click', function(){ setTimeout(atualizarMotivoMobile,120); }, true);
    setTimeout(atualizarMotivoMobile,200);
  });

  var recognition = null;
  var gravando = false;
  var finalBuffer = '';

  function inserirTextoObservacao(txt){
    txt = String(txt || '').trim();
    if(!txt) return;
    var ta = document.querySelector('#leadForm [name="observacao"]');
    if(!ta) return;
    var val = String(ta.value || '');
    var start = typeof ta.selectionStart === 'number' ? ta.selectionStart : val.length;
    var end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : val.length;
    if(!val.trim() && typeof window.obsPfx === 'function'){
      txt = window.obsPfx() + ' - ' + txt;
    }
    var before = val.slice(0,start);
    var after = val.slice(end);
    var glueBefore = before && !/[\s\n]$/.test(before) ? ' ' : '';
    var glueAfter = after && !/^[\s\n]/.test(after) ? ' ' : '';
    ta.value = before + glueBefore + txt + glueAfter + after;
    ta.focus();
    var pos = (before + glueBefore + txt).length;
    try{ ta.setSelectionRange(pos,pos); }catch(e){}
  }

  function setBotaoGravacao(on){
    var btn = document.getElementById('btnGravarAtendimento');
    if(!btn) return;
    btn.classList.toggle('is-recording', !!on);
    btn.textContent = on ? '⏹️ Parar' : '🎙️ Gravar';
  }

  function iniciarReconhecimento(){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){
      alert('Este navegador não liberou transcrição por voz. Teste no Chrome/Android ou no Chrome do computador.');
      return;
    }
    recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    finalBuffer = '';
    recognition.onresult = function(event){
      for(var i = event.resultIndex; i < event.results.length; i++){
        var trecho = event.results[i][0] ? event.results[i][0].transcript : '';
        if(event.results[i].isFinal) finalBuffer += ' ' + trecho;
      }
    };
    recognition.onerror = function(){
      gravando = false;
      setBotaoGravacao(false);
    };
    recognition.onend = function(){
      var texto = finalBuffer.trim();
      gravando = false;
      setBotaoGravacao(false);
      if(texto) inserirTextoObservacao(texto);
    };
    try{
      recognition.start();
      gravando = true;
      setBotaoGravacao(true);
    }catch(e){
      gravando = false;
      setBotaoGravacao(false);
    }
  }

  window.addEventListener('load', function(){
    var btn = document.getElementById('btnGravarAtendimento');
    if(!btn) return;
    btn.addEventListener('click', function(){
      if(gravando && recognition){
        try{ recognition.stop(); }catch(e){}
        return;
      }
      iniciarReconhecimento();
    });
  });
})();


/* ===== levecrm-correcao-final-mobile-2904-v4-script ===== */
(function(){
  function form(){ return document.getElementById('leadForm'); }
  function dlg(){ return document.getElementById('dlg'); }
  function etapaEl(){ var f=form(); return f ? f.querySelector('[name="etapa"]') : null; }
  function motivoEl(){ var f=form(); return f ? f.querySelector('[name="motivo_perda"]') : null; }
  function isPerdido(){ var e=etapaEl(); return e && String(e.value||'').trim().toUpperCase()==='PERDIDO'; }
  function applyMotivo(){
    var f=form(), d=dlg(), m=motivoEl(), show=isPerdido();
    if(f) f.classList.toggle('show-mobile-motivo', show);
    if(d) d.classList.toggle('show-mobile-motivo', show);
    if(m){
      m.disabled = !show;
      m.required = !!show;
      if(!show) m.value = '';
    }
  }
  function applyButtons(){
    var b=document.getElementById('btnNovoAtendimento');
    if(b) b.textContent='Atendimento';
  }
  function applyAll(){ applyMotivo(); applyButtons(); }

  document.addEventListener('change', function(ev){
    if(ev.target && ev.target.name === 'etapa') setTimeout(applyMotivo,0);
  }, true);
  document.addEventListener('input', function(ev){
    if(ev.target && ev.target.name === 'etapa') setTimeout(applyMotivo,0);
  }, true);
  document.addEventListener('click', function(){ setTimeout(applyAll,80); }, true);
  window.addEventListener('load', function(){
    applyAll();
    setTimeout(applyAll,200);
    setTimeout(applyAll,700);
    setInterval(applyAll,1200);
  });
})();


/* ===== levecrm-patch-3004-mobile-premium-audio-script ===== */
(function(){
  function byId(id){return document.getElementById(id)}
  function isMob(){return window.matchMedia&&window.matchMedia('(max-width: 640px)').matches}
  function getEtapa(v){try{return normEtapa(v)}catch(e){return String(v||'').trim().toUpperCase()}}
  function setSelValue(sel,val){if(!sel)return; sel.value=val; if(sel.value!==val){var o=document.createElement('option');o.value=val;o.textContent=val;sel.appendChild(o);sel.value=val;}}
  function applyPerdidoRules(){
    var f=byId('leadForm'), d=byId('dlg'); if(!f)return;
    var etapa=f.querySelector('[name="etapa"]'), prio=f.querySelector('[name="prioridade"]'), mot=f.querySelector('[name="motivo_perda"]');
    var perdido=etapa&&getEtapa(etapa.value)==='PERDIDO';
    f.classList.toggle('show-mobile-motivo',!!perdido); if(d)d.classList.toggle('show-mobile-motivo',!!perdido);
    if(perdido&&prio)setSelValue(prio,'Baixa');
    if(mot){mot.required=!!perdido;mot.disabled=!perdido;if(!perdido)mot.value='';}
  }
  document.addEventListener('change',function(ev){if(ev.target&&ev.target.name==='etapa')setTimeout(applyPerdidoRules,0)},true);
  document.addEventListener('click',function(){setTimeout(applyPerdidoRules,90)},true);

  try{
    var oldUpsert=upsertLead;
    upsertLead=function(payload,opts){
      payload=payload||{};
      if(getEtapa(payload.etapa)==='PERDIDO')payload.prioridade='Baixa';
      return oldUpsert.call(this,payload,opts);
    };
  }catch(e){}

  function esc(txt){try{return escH(txt)}catch(e){return String(txt||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}}
  function setFilter(kind,val){
    var fPri=byId('fPri'), mfPri=byId('mfPri');
    if(kind==='prio'){
      SHOW_LOST=false;SHOW_SB=false;setSelValue(fPri,val);setSelValue(mfPri,val);
    }else{
      setSelValue(fPri,'');setSelValue(mfPri,'');
      if(kind==='lost'){SHOW_LOST=true;SHOW_SB=false;}
      if(kind==='sb'){SHOW_SB=true;SHOW_LOST=false;}
    }
    try{syncMobileFiltersFromDesktop()}catch(e){}
    render();
  }
  function mobileDashHTML(allList,visibleList){
    var total=Math.max(1,allList.length), activePri='';
    try{activePri=(byId('fPri')||{}).value||''}catch(e){}
    var defs=[
      ['Fechado','prio','✅'],['Altíssima','prio','🔥'],['Alta','prio','⚡'],['Média','prio','📌'],['Baixa','prio','🌿'],['PERDIDO','lost','✖'],['STAND BY','sb','⏸']
    ];
    var cards=defs.map(function(d){
      var label=d[0], kind=d[1], icon=d[2];
      var count=allList.filter(function(l){var e=getEtapa(l.etapa); if(kind==='lost')return e==='PERDIDO'; if(kind==='sb')return e==='STAND BY'; return e!=='PERDIDO'&&e!=='STAND BY'&&String(l.prioridade||'Baixa')===label;}).length;
      var pct=Math.round((count/total)*100);
      var active=(kind==='prio'&&activePri===label)||(kind==='lost'&&SHOW_LOST)||(kind==='sb'&&SHOW_SB);
      var title=label==='PERDIDO'?'Perdido':(label==='STAND BY'?'Standby':label);
      return '<button type="button" class="mp-card '+(active?'is-active':'')+'" data-kind="'+kind+'" data-filter="'+esc(label)+'"><div class="mp-top"><div class="mp-label">'+esc(title)+'</div><div class="mp-icon">'+icon+'</div></div><div class="mp-num">'+count+'</div><div class="mp-bottom"><div class="mp-bar"><div class="mp-fill" style="width:'+Math.max(5,pct)+'%"></div></div><div class="mp-pct">'+pct+'%</div></div></button>';
    }).join('');
    return '<div class="mobile-priority-dashboard">'+cards+'</div><div class="mobile-list-title"><strong>Leads</strong><span>'+visibleList.length+' na lista</span></div>';
  }
  try{
    var oldRender=render;
    render=function(){
      if(!isMob())return oldRender();
      var leads=filtered();
      var ativos=leads.filter(function(l){return getEtapa(l.etapa)!=='PERDIDO'}).length;
      var perdidos=leads.filter(function(l){return getEtapa(l.etapa)==='PERDIDO'}).length;
      var nAtivos=byId('nAtivos'),nPerdidos=byId('nPerdidos'),nTotal=byId('nTotal');
      if(nAtivos)nAtivos.textContent=ativos;if(nPerdidos)nPerdidos.textContent=perdidos;if(nTotal)nTotal.textContent=ativos+perdidos;
      var btL=byId('btnToggleLost'),btS=byId('btnToggleSb');if(btL)btL.textContent=SHOW_LOST?'Ocultar perdidos':'Mostrar perdidos';if(btS)btS.textContent=SHOW_SB?'Ocultar Stand by':'Mostrar Stand by';
      try{updateAlertBanner();updateAgendaBadge()}catch(e){}
      var visible=sortMobilePriority(leads.filter(function(l){var e=getEtapa(l.etapa); if(e==='PERDIDO')return SHOW_LOST; if(e==='STAND BY')return SHOW_SB; return true;}));
      var board=byId('board'); if(!board)return;
      board.innerHTML='';
      var sec=document.createElement('section');sec.className='col mobile-priority-col';sec.dataset.etapa='MOBILE_PRIORITY';
      sec.innerHTML='<div class="col-head"><span class="cname">LEADS POR PRIORIDADE</span><span class="cnt">'+visible.length+'</span></div><div class="dropzone mobile-priority-list">'+mobileDashHTML(leads,visible)+visible.map(cardHTML).join('')+'</div>';
      board.appendChild(sec);
      sec.querySelectorAll('.mp-card').forEach(function(btn){btn.addEventListener('click',function(){var kind=btn.dataset.kind, val=btn.dataset.filter; if(kind==='prio')setFilter('prio',val); if(kind==='lost')setFilter('lost',val); if(kind==='sb')setFilter('sb',val);});});
      wireMobileCards();
      if(currentView==='dashboard')renderDashboard();
    };
  }catch(e){}

  function normalizeText(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
  var rec=null, recording=false, manualStop=false, seen={}, restarting=false;
  function insertObs(txt){
    txt=String(txt||'').trim(); if(!txt)return;
    var ta=document.querySelector('#leadForm [name="observacao"]'); if(!ta)return;
    var val=String(ta.value||'');
    if(!val.trim()&&typeof obsPfx==='function')txt=obsPfx()+' - '+txt;
    var needsSpace=val&&!/[\s\n]$/.test(val);
    ta.value=val+(needsSpace?' ':'')+txt;
    ta.focus(); try{ta.setSelectionRange(ta.value.length,ta.value.length)}catch(e){}
  }
  function setBtn(on){var b=byId('btnGravarAtendimento'); if(!b)return; b.classList.toggle('is-recording',!!on); b.textContent=on?'⏹️ Parar':'🎙️ Gravar';}
  function makeRec(){
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert('Este navegador não liberou transcrição por voz. Teste no Chrome/Android.');return null;}
    var r=new SR(); r.lang='pt-BR'; r.continuous=true; r.interimResults=false; r.maxAlternatives=1;
    r.onresult=function(ev){
      for(var i=ev.resultIndex;i<ev.results.length;i++){
        if(!ev.results[i].isFinal)continue;
        var t=(ev.results[i][0]&&ev.results[i][0].transcript)||''; var key=normalizeText(t);
        if(!key||seen[key])continue; seen[key]=true; insertObs(t.trim());
      }
    };
    r.onerror=function(ev){ if(!recording)return; if(ev&&ev.error==='not-allowed'){recording=false;setBtn(false);return;} };
    r.onend=function(){
      rec=null;
      if(recording&&!manualStop){
        restarting=true; setTimeout(function(){restarting=false;if(recording&&!manualStop)startRec(true);},220);
      }else{recording=false;manualStop=false;setBtn(false);}
    };
    return r;
  }
  function startRec(keepSeen){
    if(!keepSeen)seen={};
    rec=makeRec(); if(!rec)return;
    try{rec.start();recording=true;manualStop=false;setBtn(true);}catch(e){if(!restarting){recording=false;setBtn(false);}}
  }
  function stopRec(){manualStop=true;recording=false;setBtn(false);try{if(rec)rec.stop()}catch(e){}}
  function installVoice(){
    var old=byId('btnGravarAtendimento'); if(!old)return;
    var btn=old.cloneNode(true); old.parentNode.replaceChild(btn,old); btn.textContent='🎙️ Gravar';
    btn.addEventListener('click',function(){ if(recording)stopRec(); else startRec(false); });
  }
  function fixLabels(){var b=byId('btnNovoAtendimento'); if(b)b.textContent='Atendimento';}
  window.addEventListener('load',function(){fixLabels();installVoice();applyPerdidoRules();setTimeout(function(){try{render()}catch(e){}},250);});
})();
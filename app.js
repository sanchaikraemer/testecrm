/* LeveCRM v43 — base persistente, segurança RLS, histórico, propostas e correções gerais.
   Pacote revisado e validado em 23/06/2026. */

/* ===== main ===== */
const F = (name) => document.querySelector(`[name="${name}"]`) || document.getElementById(name);
let currentView = 'kanban';
let MOBILE_STAGE_FILTER = '';
let ALL = [];
let ATTACHES = [];
let ATTACHES_BY_LEAD = {};
let editingId = null;
let origSnap = null;
let SELECTED_LEAD_ID = null;
const NOTIFICATION_TIMERS = new Map();
const dlg = document.getElementById('dlg');
const leadForm = document.getElementById('leadForm');
let aiImgB64 = null;
let aiImgType = null;
let aiExtracted = {nome:'',fone:'',emp:'',obs:''};

/* ══════════════════════════════════════
   CONFIG SUPABASE
   A chave anon é pública por design: o Supabase a exige no cliente.
   A segurança real fica nas políticas RLS (Row Level Security) do banco —
   cada usuário só acessa os próprios registros via auth.uid().
══════════════════════════════════════ */
const SB_URL='https://hoxngbfukvbhvmzmptqn.supabase.co';
window.SB_URL=SB_URL;
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhveG5nYmZ1a3ZiaHZtem1wdHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzk4MjAsImV4cCI6MjA5ODkxNTgyMH0.h1z3OQqG9L4Jn9pBmq9X3AUmSNByRKCQ2-KEaQcgmqU';
const TBL='leads';
const ATT_TBL='lead_attachments';
window.SB_KEY=SB_KEY;
const ATT_BKT='lead-attachments';
const AG_TBL='agenda_eventos';
const HIST_TBL='lead_history';
const SETTINGS_TBL='crm_settings';
const PROPOSAL_TBL='proposals';
const AI_TBL='ai_analyses';
const PUSH_TBL='push_subscriptions';
const ACCESS_SESSION_KEY='levecrm_access_session_v1';
const INITIAL_LEADS_URL='./leads-iniciais.json?v=56';
const INITIAL_IMPORT_MARKER='__LEADS_V43_IMPORTED__';

/* ══════════════════════════════════════
   LISTAS
══════════════════════════════════════ */
const LISTS={
  empreendimento:[],
  etapa:['Prioritário','Qualificação','Retomada','Sem foco'],
  prioridade:['Altíssima','Alta','Média','Baixa'],
  origem:[],
  responsavel:[],
  visita:['Não','Corretor','Senger','Ambos'],
  motivo_perda:[]
};
const ETAPA_MAP={
  'Prioritario':'Prioritário','Prioritário':'Prioritário',
  'Qualificacao':'Qualificação','Qualificação':'Qualificação',
  'Retomada':'Retomada','Sem foco':'Sem foco',
  'Novo':'Qualificação','NOVO / INICIAL':'Qualificação',
  'Em atendimento':'Qualificação','ATENDIMENTO':'Qualificação','Contato feito':'Qualificação',
  'Evoluindo':'Prioritário','VISITA / PROPOSTA':'Prioritário','Visitou':'Prioritário','Proposta':'Prioritário',
  'Negociação':'Prioritário','NEGOCIAÇÃO':'Prioritário','Fechado':'Prioritário','FECHADO':'Prioritário','FECHADO / GANHO':'Prioritário','Ganho':'Prioritário',
  'Stand by':'Retomada','STAND BY':'Retomada','Perdido':'Sem foco','PERDIDO':'Sem foco'
};
const MOTIVO_MAP={'Preço':'Investimento baixo','Parcelamento':'Parcelamento direto','Financiamento':'Parcelamento direto','Nunca respondeu':'Após valor some','Escolheu outro':'Comprou outro','Comprou outro':'Comprou outro','Sumiu':'Após valor some'};


/* ══════════════════════════════════════
   NORMALIZAÇÃO
══════════════════════════════════════ */
function normEtapa(e){const s=String(e||'').trim();if(LISTS.etapa.includes(s))return s;if(ETAPA_MAP[s])return ETAPA_MAP[s];return'Qualificação';}
function stagePriority(etapa){const e=normEtapa(etapa);return e==='Prioritário'?'Altíssima':e==='Qualificação'?'Alta':e==='Retomada'?'Média':'Baixa';}
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
function prioRank(p){return p==='Altíssima'?4:p==='Alta'?3:p==='Média'?2:1;}
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
  clearLeveCrmLocalData();
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
          <div class="adm-item-name">${escH(ACCESS_USER.nome)} <span class="chip" style="background:rgba(185,255,0,.14);color:#B9FF00;border-color:rgba(185,255,0,.35)">ADMIN</span></div>
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
  const raw=await r.text();
  return raw?JSON.parse(raw):null;
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
    const fp=`${ACCESS_USER.id}/${leadId}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${safe}`;
    const {error:uploadError}=await AUTH_CLIENT.storage.from(ATT_BKT).upload(fp,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
    if(uploadError)throw new Error(`${file.name}: ${uploadError.message}`);
    try{
      const meta={access_user_id:ACCESS_USER.id,lead_id:leadId,file_name:file.name,file_path:fp,file_type:file.type||''};
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
  const d=daysSince(lead.ultima_interacao_em||lead.atualizado_em||lead.criado_em||lead.data_inicio||'');
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
  if(!lead || normEtapa(lead.etapa)==='FECHADO / GANHO')return false;
  const etapa=normEtapa(lead.etapa);
  if(etapa==='PERDIDO'||etapa==='STAND BY')return false;
  if(hasActiveScheduledContact(lead))return false;
  const d=daysSince(leadActivityAt(lead));
  return d>7;
}
function prioVisual(p){
  if(p==='Fechado')return{cls:'p-done',lbl:`<span class="card-prio prio-done">Fechado</span>`};
  if(p==='Altíssima')return{cls:'p-top',lbl:`<span class="card-prio prio-top">Altíssima</span>`};
  if(p==='Alta')return{cls:'p-high',lbl:`<span class="card-prio prio-high">Alta</span>`};
  if(p==='Média')return{cls:'p-med',lbl:`<span class="card-prio prio-med">Média</span>`};
  return{cls:'p-low',lbl:`<span class="card-prio prio-low">Baixa</span>`};
}
function blockVisual(etapa){
  const e=normEtapa(etapa);
  if(e==='Prioritário')return{cls:'p-top',lbl:'<span class="card-prio prio-top">Prioritário</span>'};
  if(e==='Qualificação')return{cls:'p-high',lbl:'<span class="card-prio prio-high">Qualificação</span>'};
  if(e==='Retomada')return{cls:'p-med',lbl:'<span class="card-prio prio-med">Retomada</span>'};
  return{cls:'p-low',lbl:'<span class="card-prio prio-low">Sem foco</span>'};
}

function waSvg(){return`<svg viewBox="0 0 32 32"><path d="M16 .5C7.4.5.5 7.4.5 16c0 2.8.7 5.5 2.1 7.9L.5 31.5l7.8-2.1c2.3 1.3 4.9 2 7.7 2 8.6 0 15.5-6.9 15.5-15.5S24.6.5 16 .5zm0 28.4c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.6 1.2 1.2-4.5-.3-.5c-1.3-2.1-2-4.4-2-6.9 0-7.2 5.8-13 13-13s13 5.8 13 13-5.8 13-13 13zm7.3-9.8c-.4-.2-2.4-1.2-2.8-1.3-.4-.2-.7-.2-1 .2s-1.1 1.3-1.4 1.6c-.3.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.5-2.2-2.9-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.2-.4.3-.6.1-.2 0-.5-.1-.7-.2-.2-1-.8-1.4-1.1-.3-.3-.7-.3-1-.3-.3 0-.6 0-.9.3-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.7c.2.3 2.3 3.6 5.6 5 .8.3 1.4.5 1.9.6.8.2 1.6.2 2.2.1.7-.1 2.4-1 2.7-2 .3-1 .3-1.9.2-2.1-.1-.2-.4-.3-.8-.5z"/></svg>`;}

function shortLeadName(nome,max=28){
  const n=String(nome||'').replace(/\s+/g,' ').trim();
  if(n.length<=max)return n;
  return n.slice(0,max-1).trimEnd()+'…';
}

function wasTouchedToday(lead){
  const d=parseDate(leadActivityAt(lead));if(!d)return false;
  const today=new Date();return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate();
}
function cardHTML(l){
  const etapa=normEtapa(l.etapa);
  const isPerd=etapa==='PERDIDO';const isSB=etapa==='STAND BY';
  const scheduled=hasActiveScheduledContact(l)&&!isPerd;
  const pvBase=blockVisual(etapa);
  const pv=scheduled?{cls:'p-scheduled',lbl:pvBase.lbl}:pvBase;
  const wa=l.telefone?`<a class="wa-btn" href="https://wa.me/${normPhone(l.telefone)}" target="_blank" onclick="event.stopPropagation()">${waSvg()}</a>`:'';
  const nc=nextContact(l);
  const ncHTML=nc?`<span class="chip ${escH(nc.cls)}">${escH(nc.text)}</span>`:'';
  const att=attCount(l.id);const attHTML=att?`<span class="chip chip-attach">📎 ${att}</span>`:'';
  const overdue=isOverdueContact(l);

  if(isSB){
    return`<div class="card ${pv.cls}${overdue?' overdue-contact':''}${wasTouchedToday(l)?' touched-today':''}" draggable="true" data-id="${l.id}">
      <div class="card-row1"><div class="sb-row"><div class="sb-nm" title="${escH(l.nome)}">${escH(shortLeadName(l.nome,26))}</div><div class="sb-sep">—</div><div class="sb-emp">${escH(l.empreendimento||'—')}</div></div></div>
      <div class="card-row2"><div class="card-chips">${ncHTML}${attHTML}</div>${wa}</div>
    </div>`;}

  if(isPerd){
    const mot=l.motivo_perda?`<div style="margin-top:5px;font-size:11px;color:#9A9CA3">Motivo: <b>${escH(l.motivo_perda)}</b></div>`:'';
    return`<div class="card ${pv.cls}${wasTouchedToday(l)?' touched-today':''}" draggable="true" data-id="${l.id}">
      <div class="card-row1"><div class="card-nm" style="padding-left:6px" title="${escH(l.nome)}">${escH(shortLeadName(l.nome,28))}</div></div>
      <div class="card-row2"><div class="card-chips"><div class="card-emp">${escH(l.empreendimento||'—')}</div>${ncHTML}${attHTML}</div>${wa}</div>${mot}
    </div>`;}

  const b=badgeInfo(l);
  return`<div class="card ${pv.cls}${overdue?' overdue-contact':''}${wasTouchedToday(l)?' touched-today':''}" draggable="true" data-id="${l.id}">
    <div class="card-row1"><div class="card-nm" title="${escH(l.nome)}">${escH(shortLeadName(l.nome,28))}</div></div>
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
  return ALL.filter(l=>{
    if(term&&!`${l.nome||''} ${l.telefone||''}`.toLowerCase().includes(term))return false;
    if(fE&&l.empreendimento!==fE)return false;
    if(fO&&l.origem!==fO)return false;
    return true;
  });
}

/* ══════════════════════════════════════
   RENDER KANBAN
══════════════════════════════════════ */
function isMobileKanban(){
  return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
}


function setSelectValue(select,value){
  if(!select)return;
  select.value=value;
  if(value&&select.value!==value){
    const option=document.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);select.value=value;
  }
}
function setMobilePriorityFilter(kind,value){
  const stage=kind==='stage'?normEtapa(value):'';
  MOBILE_STAGE_FILTER=MOBILE_STAGE_FILTER===stage?'':stage;
  render();
}
function mobilePriorityDashboardHTML(allLeads,visibleLeads){
  const total=Math.max(1,allLeads.length);
  const cards=LISTS.etapa.map((value,index)=>{
    const count=allLeads.filter(l=>normEtapa(l.etapa)===value).length;
    const pct=Math.round(count/total*100);
    const active=MOBILE_STAGE_FILTER===value;
    const icon=['↑','?','↻','—'][index]||'•';
    return `<button type="button" class="mp-card ${active?'is-active':''}" data-kind="stage" data-filter="${escH(value)}"><div class="mp-top"><div class="mp-label">${escH(value)}</div><div class="mp-icon">${icon}</div></div><div class="mp-num">${count}</div><div class="mp-bottom"><div class="mp-bar"><div class="mp-fill" style="width:${Math.max(5,pct)}%"></div></div><div class="mp-pct">${pct}%</div></div></button>`;
  }).join('');
  return `<div class="mobile-priority-dashboard">${cards}</div><div class="mobile-list-title"><strong>${MOBILE_STAGE_FILTER?escH(MOBILE_STAGE_FILTER):'Todos os leads'}</strong><span>${visibleLeads.length} na lista</span></div>`;
}
function wireMobilePriorityFilters(container){
  container.querySelectorAll('.mp-card').forEach(btn=>btn.addEventListener('click',()=>setMobilePriorityFilter(btn.dataset.kind,btn.dataset.filter)));
}

function render(){
  const leads=filtered();
  const counts=Object.fromEntries(LISTS.etapa.map(etapa=>[etapa,leads.filter(l=>normEtapa(l.etapa)===etapa).length]));
  const setCount=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value);};
  setCount('nPrioritario',counts['Prioritário']||0);
  setCount('nQualificacao',counts['Qualificação']||0);
  setCount('nRetomada',counts['Retomada']||0);
  setCount('nSemFoco',counts['Sem foco']||0);
  setCount('nTotal',leads.length);
  updateAlertBanner();
  updateAgendaBadge();

  const board=document.getElementById('board');board.innerHTML='';

  if(isMobileKanban()){
    const mobileLeads=sortMobilePriority(leads.filter(l=>!MOBILE_STAGE_FILTER||normEtapa(l.etapa)===MOBILE_STAGE_FILTER));
    const sec=document.createElement('section');
    sec.className='col mobile-priority-col';
    sec.dataset.etapa='MOBILE_BLOCKS';
    sec.innerHTML=`<div class="col-head"><span class="cname">BLOCOS COMERCIAIS</span><span class="cnt">${mobileLeads.length}</span></div><div class="dropzone mobile-priority-list">${mobilePriorityDashboardHTML(leads,mobileLeads)}${mobileLeads.map(cardHTML).join('')}</div>`;
    board.appendChild(sec);
    wireMobilePriorityFilters(sec);
    wireMobileCards();
    if(currentView==='dashboard')renderDashboard();
    return;
  }

  LISTS.etapa.forEach(etapa=>{
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
let isDragging=false;
let dragLeadId=null;
let suppressCardClickUntil=0;
function clearDragState(){
  document.querySelectorAll('.card.dragging').forEach(c=>c.classList.remove('dragging'));
  document.querySelectorAll('.dropzone.dragover').forEach(z=>z.classList.remove('dragover'));
  isDragging=false;dragLeadId=null;
}
function wireDnD(){
  document.querySelectorAll('.card[data-id]').forEach(card=>{
    card.draggable=true;
    card.ondragstart=e=>{
      isDragging=true;dragLeadId=card.dataset.id;suppressCardClickUntil=Date.now()+450;card.classList.add('dragging');
      try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragLeadId);}catch(_e){}
    };
    card.ondragend=()=>{suppressCardClickUntil=Date.now()+450;clearDragState();};
    card.onclick=e=>{if(isDragging||Date.now()<suppressCardClickUntil||e.target.closest('.wa-btn'))return;openEdit(card.dataset.id);};
  });
  document.querySelectorAll('.dropzone[data-drop]').forEach(zone=>{
    zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragover');try{e.dataTransfer.dropEffect='move';}catch(_e){}};
    zone.ondragenter=e=>{e.preventDefault();zone.classList.add('dragover');};
    zone.ondragleave=e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('dragover');};
    zone.ondrop=async e=>{
      e.preventDefault();
      let id='';try{id=e.dataTransfer.getData('text/plain');}catch(_e){}id=id||dragLeadId;
      suppressCardClickUntil=Date.now()+450;zone.classList.remove('dragover');
      const lead=ALL.find(x=>String(x.id)===String(id));const newStage=normEtapa(zone.dataset.drop);
      if(!lead||!newStage||newStage===normEtapa(lead.etapa)){clearDragState();return;}
      if(newStage==='PERDIDO'){clearDragState();openEdit(id,true);return;}
      try{
        await addHistory(id,`${normEtapa(lead.etapa)} → ${newStage}`);
        await upsertLead({...lead,etapa:newStage,ordem:orderForTop(newStage)});
      }catch(err){console.error(err);showToast('Não foi possível mover o lead.',4000);}
      clearDragState();
    };
  });
}

/* ══════════════════════════════════════
   HISTÓRICO DE MOVIMENTAÇÃO
══════════════════════════════════════ */

function ensureLateModal(){
  let modal=document.getElementById('lateModalSafe');if(modal)return modal;
  modal=document.createElement('div');modal.id='lateModalSafe';
  const box=document.createElement('div');box.className='box';
  const head=document.createElement('div');head.className='head';
  const title=document.createElement('h2');title.textContent='Atrasados / Hoje';
  const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.addEventListener('click',()=>modal.classList.remove('open'));
  head.append(title,close);const list=document.createElement('div');list.id='lateListSafe';box.append(head,list);modal.append(box);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});document.body.append(modal);return modal;
}
function updateLateBadge(){const badge=document.getElementById('lateBadge');if(badge)badge.textContent=String(getOverdue().length);}
function openLate(){
  const modal=ensureLateModal(),list=modal.querySelector('#lateListSafe'),items=getOverdue();list.replaceChildren();
  if(!items.length){const row=document.createElement('div');row.className='row';const name=document.createElement('b');name.textContent='Nenhum lead em atraso/hoje';const detail=document.createElement('small');detail.textContent='Não há contatos pendentes.';row.append(name,detail);list.append(row);}
  else items.forEach(lead=>{const row=document.createElement('button');row.type='button';row.className='row';const name=document.createElement('b');name.textContent=lead.nome||'Lead';const detail=document.createElement('small');detail.textContent=`${lead.empreendimento||'Sem empreendimento'} · Próximo contato: ${lead.proximo_contato||'—'}`;row.append(name,detail);row.addEventListener('click',()=>{modal.classList.remove('open');openEdit(lead.id);});list.append(row);});
  modal.classList.add('open');
}

/* ══════════════════════════════════════
   ALERT BANNER
══════════════════════════════════════ */
function getOverdue(){
  const today=dayStart(new Date());
  return ALL.filter(l=>{
    const etapa=normEtapa(l.etapa);
    if(etapa==='PERDIDO'||etapa==='STAND BY'||etapa==='FECHADO / GANHO')return false;
    const nc=normProx(l.proximo_contato);if(!nc)return false;
    const date=parseDate(nc);if(!date)return false;
    return dayStart(date)<=today;
  }).sort((a,b)=>(parseDate(normProx(a.proximo_contato))?.getTime()||0)-(parseDate(normProx(b.proximo_contato))?.getTime()||0));
}
function updateAlertBanner(){
  updateLateBadge();
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
function toggleMotivo(){
  F('motivo_perda').disabled=true;F('motivo_perda').required=false;F('motivo_perda').value='';
  F('prioridade').value=stagePriority(F('etapa').value);
  leadForm.classList.remove('show-mobile-motivo');document.getElementById('dlg')?.classList.remove('show-mobile-motivo');
}

function fillFormSelects(){
  const fields={prioridade:LISTS.prioridade,empreendimento:LISTS.empreendimento,etapa:LISTS.etapa,origem:LISTS.origem,responsavel:LISTS.responsavel,visita:LISTS.visita,motivo_perda:LISTS.motivo_perda};
  Object.entries(fields).forEach(([name,items])=>{const s=leadForm.querySelector(`[name="${name}"]`);s.innerHTML=items.map(v=>`<option value="${escH(v)}">${escH(v)}</option>`).join('');});
}

function openNew(){
  editingId=null;origSnap=null;leadForm.classList.add('is-new-lead');document.getElementById('dlgTitle').textContent='Novo Lead';document.getElementById('btnDelete').style.display='none';
  fillFormSelects();
  F('data_inicio').value=todayISO();F('proximo_contato').value='';F('nome').value='';F('telefone').value='';
  F('empreendimento').value=LISTS.empreendimento[0]||'Outros';F('etapa').value='Qualificação';F('prioridade').value=stagePriority('Qualificação');
  F('origem').value=LISTS.origem[0]||'';F('responsavel').value=LISTS.responsavel[0]||'Corretor';
  F('visita').value='Não';F('motivo_perda').value='';F('observacao').value='';
  toggleMotivo();document.getElementById('attachList').innerHTML='';document.getElementById('attachHint').textContent=' Salve o lead primeiro.';document.getElementById('attachBtn').disabled=true;
  if(document.getElementById('historyLog')) document.getElementById('historyLog').innerHTML='<div style="font-size:11px;color:#9A9CA3;padding:4px">Salve o lead para ver o histórico.</div>';
  origSnap=formSnap();dlg.showModal();
}

function openEdit(id,forcePerd=false){
  const l=ALL.find(x=>x.id===id);if(!l)return;
  editingId=id;leadForm.classList.remove('is-new-lead');document.getElementById('dlgTitle').textContent='Editar Lead';document.getElementById('btnDelete').style.display='inline-flex';
  fillFormSelects();
  F('data_inicio').value=l.data_inicio||todayISO();F('proximo_contato').value=normProx(l.proximo_contato)||'';
  F('nome').value=l.nome||'';F('telefone').value=l.telefone||'';F('empreendimento').value=l.empreendimento||'Outros';
  F('etapa').value=normEtapa(l.etapa||'Qualificação');
  F('prioridade').value=stagePriority(l.etapa);F('origem').value=l.origem||'';
  F('responsavel').value=l.responsavel||LISTS.responsavel[0];F('visita').value=normVisita(l.visita||'Não');
  F('motivo_perda').value=normMotivo(l.motivo_perda||'');F('observacao').value=l.observacao||'';
  document.querySelectorAll('.lead-attachment-clean-chip').forEach(el=>el.remove());
  toggleMotivo();syncAttachUI();renderHistory(id);
  origSnap=leadSnap({...l,etapa:normEtapa(l.etapa||'Qualificação'),prioridade:stagePriority(l.etapa)});
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
  const active=[...ALL];
  const overdue=getOverdue();
  const counts=Object.fromEntries(LISTS.etapa.map(etapa=>[etapa,active.filter(l=>normEtapa(l.etapa)===etapa).length]));
  const funnel=[...LISTS.etapa];
  const fColors=['#B9FF00','#10D5D5','#6EA000','#3D3F45'];
  const fCounts=funnel.map(e=>counts[e]||0);
  const maxF=Math.max(...fCounts,1);

  const contacts=active.filter(l=>normProx(l.proximo_contato)).map(l=>{
    const d=dayStart(parseDate(normProx(l.proximo_contato)));
    const diff=Math.floor((d-today)/86400000);
    return{...l,_diff:diff,_d:d};
  }).sort((a,b)=>a._diff-b._diff).slice(0,10);

  const origCounts={};active.forEach(l=>{if(l.origem)origCounts[l.origem]=(origCounts[l.origem]||0)+1;});
  const origSorted=Object.entries(origCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxOrig=origSorted[0]?.[1]||1;

  const respCounts={};LISTS.responsavel.forEach(r=>{respCounts[r]=active.filter(l=>l.responsavel===r).length;});

  el.innerHTML=`
    <div class="dash-stats">
      <div class="stat-card c-amber"><div class="stat-lbl">Prioritário</div><div class="stat-val">${counts['Prioritário']||0}</div><div class="stat-sub">Atender primeiro</div></div>
      <div class="stat-card c-blue"><div class="stat-lbl">Qualificação</div><div class="stat-val">${counts['Qualificação']||0}</div><div class="stat-sub">Entender necessidade e condição</div></div>
      <div class="stat-card c-green"><div class="stat-lbl">Retomada</div><div class="stat-val">${counts['Retomada']||0}</div><div class="stat-sub">Conversas para reabrir</div></div>
      <div class="stat-card c-red"><div class="stat-lbl">Sem foco</div><div class="stat-val">${counts['Sem foco']||0}</div><div class="stat-sub">Baixo sinal comercial</div></div>
    </div>

    <div class="dash-2col">
      <div class="dpanel">
        <div class="dpanel-head">Distribuição comercial<span class="dpanel-badge">${active.length} leads</span></div>
        ${funnel.map((e,i)=>`<div class="funnel-row"><div class="funnel-lbl">${e.toUpperCase()}</div><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(Math.round(fCounts[i]/maxF*100),3)}%;background:${fColors[i]}">${fCounts[i]>0?fCounts[i]:''}</div></div><div class="funnel-cnt">${fCounts[i]}</div></div>`).join('')}
      </div>

      <div class="dpanel">
        <div class="dpanel-head">Próximos contatos<span class="dpanel-badge">${contacts.length} agendados</span></div>
        ${contacts.length===0?`<div style="padding:16px;font-size:12px;color:var(--muted);text-align:center">Nenhum contato agendado</div>`:
          contacts.map(l=>{
            const dc=l._diff<0?'past':l._diff===0?'today':'soon';
            const ds=l._diff<0?`${Math.abs(l._diff)}d atraso`:l._diff===0?'HOJE':`${pad2(l._d.getDate())}/${pad2(l._d.getMonth()+1)}`;
            return`<div class="contact-row" onclick="openEdit('${escH(l.id)}')"><div class="cdot ${dc}"></div><div style="flex:1;min-width:0"><div class="cname">${escH(l.nome)}</div><div class="cinfo">${escH(l.empreendimento||'—')} · ${escH(l.etapa||'—')}</div></div><div class="cdate ${dc}">${ds}</div></div>`;
          }).join('')}
      </div>
    </div>

    <div class="dash-2col">
      <div class="dpanel">
        <div class="dpanel-head">Leads por origem</div>
        ${origSorted.map(([o,c])=>`<div class="origin-bar"><div class="origin-lbl">${escH(o)}</div><div class="origin-track"><div class="origin-fill" style="width:${Math.round(c/maxOrig*100)}%"></div></div><div class="origin-pct">${c}</div></div>`).join('')}
        ${!origSorted.length?'<div style="padding:12px;font-size:12px;color:var(--muted)">Sem dados</div>':''}
      </div>

      <div class="dpanel">
        <div class="dpanel-head">Por responsável</div>
        <div class="resp-grid">${LISTS.responsavel.map(r=>`<div class="resp-item"><div class="resp-lbl">${escH(r)}</div><div class="resp-cnt">${respCounts[r]||0}</div></div>`).join('')}</div>
      </div>
    </div>

    <div class="dpanel">
      <div class="dpanel-head">Insight semanal (IA)<span class="dpanel-badge" onclick="aiInsight()" style="cursor:pointer">Gerar</span></div>
      <div class="insight-box" id="insightBox">Clique em “Gerar” para analisar a distribuição dos leads e sugerir ações práticas.</div>
    </div>

    <div class="dpanel">
      <div class="dpanel-head">Compromissos de hoje<span class="dpanel-badge" onclick="openAgenda()" style="cursor:pointer">Ver agenda →</span></div>
      <div id="dashToday" style="padding:4px 0"></div>
    </div>
  `;

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
    prio:`Assistente de CRM imobiliário. Classifique o lead em um único bloco: Prioritário (sinal concreto e sem trava pesada), Qualificação (precisa entender dinheiro, prazo, produto ou trava), Retomada (conversa parada ou aguardando retorno) ou Sem foco (pouco dado ou baixo sinal de compra). Cliente: ${nome}. Imóvel: ${emp}. Histórico: ${obs}. Formato: BLOCO: nome; Motivo: texto.`
  };
  try{
    const text=await callClaude(prompts[type],220);resultEl.textContent=text;
    if(type==='prio'){
      const m=text.match(/BLOCO:\s*(Prioritário|Prioritario|Qualificação|Qualificacao|Retomada|Sem foco)/i);
      if(m){const val=normEtapa(m[1]);F('etapa').value=val;toggleMotivo();showToast(`Bloco: ${val}`);}
    }
  }catch(e){resultEl.textContent=`Erro: ${e.message}`;}
  finally{['aiBtnResumo','aiBtnAcao','aiBtnPrio'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=false;});}
}
async function aiInsight(){
  const el=document.getElementById('insightBox');if(!el)return;
  el.textContent='Gerando insight…';
  const counts=Object.fromEntries(LISTS.etapa.map(etapa=>[etapa,ALL.filter(l=>normEtapa(l.etapa)===etapa).length]));
  const ctx=`Total: ${ALL.length}; Prioritário: ${counts['Prioritário']||0}; Qualificação: ${counts['Qualificação']||0}; Retomada: ${counts['Retomada']||0}; Sem foco: ${counts['Sem foco']||0}; Contatos vencidos: ${getOverdue().length}; Empreendimentos: ${[...new Set(ALL.map(l=>l.empreendimento).filter(Boolean))].slice(0,6).join(', ')}`;
  try{el.textContent='💡 '+await callClaude(`Consultor imobiliário: escreva um insight prático de 2 ou 3 frases para melhorar os resultados nesta semana, priorizando os quatro blocos comerciais. ${ctx}`,180);}
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
    ordem:orderForTop('Qualificação'),
    data_inicio:todayISO(),
    proximo_contato:null,
    nome,
    telefone,
    empreendimento,
    etapa:'Qualificação',
    prioridade:'Baixa',
    origem:LISTS.origem[0]||'',
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
  if(!nome){document.getElementById('qlNome').style.borderColor='#FF5D5D';setTimeout(()=>document.getElementById('qlNome').style.borderColor='',1500);return;}
  const fone=document.getElementById('qlFone').value.trim();
  const prioridade=document.getElementById('qlPrioridade').value||'Baixa';
  const btn=document.getElementById('qlSaveBtn');const txt=document.getElementById('qlSaveTxt');
  btn.disabled=true;txt.innerHTML=`<span class="ql-spinner"></span> Salvando…`;
  const ok=await upsertLead({id:cid(),ordem:orderForTop('Qualificação'),data_inicio:todayISO(),proximo_contato:null,nome,telefone:fone.replace(/\D/g,''),empreendimento:'Outros',etapa:'Qualificação',prioridade,origem:LISTS.origem[0]||'',responsavel:LISTS.responsavel[0]||'Corretor',visita:'Não',motivo_perda:'',observacao:'',criado_em:nowISO(),atualizado_em:nowISO()});
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
function agMapRow(r){return{id:String(r.id),lead_id:r.lead_id?String(r.lead_id):'',date:String(r.data||''),time:String(r.hora||'').slice(0,5),desc:String(r.descricao||''),notify:Number(r.notify||0)};}
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
    const d=await sbFetch(`${AG_TBL}?select=id,lead_id,data,hora,descricao,notify&order=data.asc,hora.asc`);
    AG_CACHE=(Array.isArray(d)?d:[]).map(agMapRow);
    return AG_CACHE;
  }catch(e){
    // Bancos antigos podem ainda não ter a coluna lead_id: tenta de novo sem ela.
    try{
      const d=await sbFetch(`${AG_TBL}?select=id,data,hora,descricao,notify&order=data.asc,hora.asc`);
      AG_CACHE=(Array.isArray(d)?d:[]).map(agMapRow);
      return AG_CACHE;
    }catch(e2){
      console.error('Agenda load error',e2);
      showToast('Erro ao carregar agenda.');
      AG_CACHE=[];
      return AG_CACHE;
    }
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
  const leadSel=document.getElementById('agLead');if(leadSel){leadSel.innerHTML='<option value="">Sem vínculo</option>'+ALL.filter(l=>normEtapa(l.etapa)!=='PERDIDO').map(l=>`<option value="${escH(l.id)}">${escH(l.nome)}${l.empreendimento?' — '+escH(l.empreendimento):''}</option>`).join('');if(SELECTED_LEAD_ID)leadSel.value=SELECTED_LEAD_ID;}
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
        <div class="ag-event-main-title">${escH(e.desc)}</div>${e.lead_id?`<div class="ag-event-main-desc">Lead: ${escH(ALL.find(l=>String(l.id)===String(e.lead_id))?.nome||'Vínculo removido')}</div>`:''}
        <div class="ag-event-main-desc">Compromisso agendado para ${parts[2]}/${parts[1]}/${parts[0]} ${e.time?'às '+e.time:'sem horário'}.</div>
        <div class="ag-event-main-meta"><span class="ag-mini-tag">Agenda</span></div>
      </div>
      <div class="ag-event-actions">
        <button class="ag-action-btn primary" data-ag-reuse="1" data-date="${escH(e.date)}" data-time="${escH(e.time)}" data-desc="${encodeURIComponent(String(e.desc||''))}">Reagendar</button>
        <button class="ag-action-btn danger" onclick="agDelete('${e.id}')">Remover</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-ag-reuse]').forEach(btn=>btn.addEventListener('click',()=>agUseDate(btn.dataset.date,btn.dataset.time,btn.dataset.desc)));
}

function agUseDate(date,time,desc){
  agSelDay=date;syncAgDateInput();
  const dateInp=document.getElementById('agDate'); if(dateInp)dateInp.value=date||'';
  const timeInp=document.getElementById('agTime'); if(timeInp)timeInp.value=time||'';
  const descInp=document.getElementById('agDesc'); if(descInp)descInp.value=decodeURIComponent(desc||'');
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
  if(time&&notify!==0&&'Notification' in window){try{if(Notification.permission==='default')await Notification.requestPermission();if(Notification.permission==='granted')await ensurePushSubscription();}catch(e){console.warn('Push indisponível, usando lembrete local.',e);}}
  try{
    const body={data:date,descricao:desc,notify,access_user_id:ACCESS_USER.id,lead_id:document.getElementById('agLead')?.value||null};
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
  const max=24*60*60*1000;
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
    b.style.background = c>0 ? '#FF5D5D' : '#3D3F45';
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
      return`<div class="adm-item"><div class="adm-item-name">👤 ${escH(nome)}</div><div class="adm-item-detail">${it.fone?escH(it.fone)+' · ':''}${it.creci?'CRECI:'+escH(it.creci)+' · ':''}<span style="color:#B9FF00">${leadsAtivos} leads</span></div><button class="adm-del" onclick="removeResp(${i})">✕</button></div>`;
    }).join(''):'<div style="font-size:12px;color:var(--muted);padding:8px">Nenhum cadastrado.</div>';
  }
  if(tab==='imoveis'){
    const items=getAdminEmps();const el=document.getElementById('listEmp');
    const sc={'Disponível':'#77E69A','Lançamento':'#B9FF00','Em obras':'#FFB020','Entregue':'#10D5D5','Esgotado':'#FF5D5D'};
    el.innerHTML=items.length?items.map((it,i)=>{const nome=it.nome||it;const c=ALL.filter(l=>l.empreendimento===nome).length;
      return`<div class="adm-item"><div class="adm-item-name">🏠 ${escH(nome)}</div><div class="adm-item-detail">${it.tipo?`<span style="background:rgba(16,213,213,.14);color:#10D5D5;padding:1px 7px;border-radius:999px;font-size:10px">${escH(it.tipo)}</span> `:''}${it.valor?escH(it.valor)+' · ':''}<span style="color:${sc[it.status]||'#77E69A'}">${escH(it.status||'Disponível')}</span>${c?' · '+c+' leads':''}</div><button class="adm-del" onclick="removeEmp(${i})">✕</button></div>`;
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
  input.value=[`Cliente: ${lead.nome||'—'}`,`Telefone: ${lead.telefone||'—'}`,`Empreendimento: ${lead.empreendimento||'—'}`,`Bloco comercial: ${normEtapa(lead.etapa)}`,`Próximo contato: ${lead.proximo_contato||'—'}`,'','Histórico do atendimento:',lead.observacao||'Sem histórico registrado.'].join('\n');
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
  document.body.classList.toggle('view-direciona-active',name==='direciona');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-tab[data-view]').forEach(t=>t.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelector(`.nav-tab[data-view="${name}"]`)?.classList.add('active');
  const bar=document.getElementById('kanbanBar');if(bar)bar.style.display=name==='kanban'?'flex':'none';
  const mob=document.getElementById('mobileActions');if(mob)mob.style.display=name==='kanban'&&window.innerWidth<=640?'grid':'none';
  if(name==='dashboard')renderDashboard();
  if(name==='admin'){renderAdmin('responsaveis');renderAdmin('imoveis');renderAdmin('origens');if(ACCESS_USER?.is_admin)loadAccessAdmin();}
  if(name==='kanban'){render();syncMobileFiltersFromDesktop();}
  if(name==='direciona')populateDirecionaFromLead(selectedLead());
  if(name==='propostas')setTimeout(sendSelectedLeadToProposal,120);
  if(window.innerWidth<=640)document.body.classList.remove('sidebar-open');
}
function fillSel(id,items,label){const s=document.getElementById(id);if(!s)return;s.innerHTML=`<option value="">${label}</option>`+items.map(v=>`<option value="${escH(v)}">${escH(v)}</option>`).join('');}
function syncFilterSelects(){
  fillSel('fEmp',LISTS.empreendimento,'Empreendimento');
  fillSel('fOrig',LISTS.origem,'Origem');
  fillSel('mfEmp',LISTS.empreendimento,'Empreendimento');
  fillSel('mfOrig',LISTS.origem,'Origem');
}
function syncMobileFiltersFromDesktop(){
  [['fEmp','mfEmp'],['fOrig','mfOrig']].forEach(([a,b])=>{
    const sa=document.getElementById(a), sb=document.getElementById(b); if(sa&&sb) sb.value=sa.value;
  });
}
function syncDesktopFiltersFromMobile(){
  [['mfEmp','fEmp'],['mfOrig','fOrig']].forEach(([a,b])=>{
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

function exportCSV(){
  const fields=[
    {key:'nome',label:'Nome'},
    {key:'telefone',label:'Telefone'},
    {key:'empreendimento',label:'Empreendimento'},
    {key:'etapa',label:'Bloco Comercial'},
    {key:'prioridade',label:'Prioridade'},
    {key:'origem',label:'Origem'},
    {key:'responsavel',label:'Responsavel'},
    {key:'visita',label:'Visita'},
    {key:'motivo_perda',label:'Motivo de Perda'},
    {key:'proximo_contato',label:'Proximo Contato'},
    {key:'data_inicio',label:'Data Inicio'},
    {key:'observacao',label:'Historico de Atendimento'},
    {key:'criado_em',label:'Criado Em'},
    {key:'atualizado_em',label:'Atualizado Em'},
    {key:'id',label:'ID'},
  ];
  const allLeads=[...ALL];
  if(!allLeads.length){showToast('Nenhum lead para exportar.');return;}
  const header=fields.map(f=>csvEsc(f.label)).join(',');
  const rows=allLeads.map(r=>fields.map(f=>csvEsc(r[f.key])).join(','));
  const bom='﻿';
  const blob=new Blob([bom+[header,...rows].join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`levecrm-todos-leads-${todayISO()}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast(`${allLeads.length} leads exportados ✓`);
}
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
      const etapa=normEtapa(r.etapa||r.bloco_comercial||'Qualificação');
      const payload={
        id:existing?.id||cid(),ordem:Number(r.ordem)||existing?.ordem||orderForTop(etapa),
        data_inicio:normProx(r.data_inicio)||existing?.data_inicio||todayISO(),proximo_contato:normProx(r.proximo_contato),
        nome:String(r.nome||'').trim(),telefone:phone,empreendimento:String(r.empreendimento||'Outros').trim()||'Outros',
        etapa,prioridade:stagePriority(etapa),origem:String(r.origem||'').trim(),
        responsavel:String(r.responsavel||LISTS.responsavel[0]||ACCESS_USER?.nome||'').trim(),visita:normVisita(r.visita),
        motivo_perda:'',observacao:String(r.observacao||r.historico_de_atendimento||'').trim(),
        criado_em:existing?.criado_em||r.criado_em||nowISO(),atualizado_em:nowISO()
      };
      if(await upsertLead(payload,{silent:true}))saved++;else failed++;
    }catch(e){console.error('Falha ao importar linha',r,e);failed++;}
  }
  render();showToast(`${saved} lead(s) importado(s).`,2400);
  alert(`Importação concluída.\nSalvos: ${saved}\nFalhas: ${failed}`);
}
function applyBrandIdentity(){
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#0A0A0B');
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
    const reg=await navigator.serviceWorker.register('./service-worker.js?v=62');
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

document.addEventListener('click',e=>{
  const mw=document.getElementById('moreWrap'); if(mw && !mw.contains(e.target)) mw.classList.remove('open');
});

// Nav
document.querySelectorAll('.nav-tab[data-view]').forEach(t=>t.addEventListener('click',()=>switchView(t.dataset.view)));
const agendaTop=document.getElementById('agendaTabBtn'); if(agendaTop) agendaTop.addEventListener('click',openAgenda);
const agendaSide=document.getElementById('agendaTabBtnSide'); if(agendaSide) agendaSide.addEventListener('click',openAgenda);
const lateSide=document.getElementById('lateSafeBtn'); if(lateSide) lateSide.addEventListener('click',openLate);
function syncSidebarUtilityState(){
  const rawName=String(ACCESS_USER?.nome||ACCESS_USER?.name||ACCESS_USER?.displayName||'').trim();
  const nameEl=document.getElementById('sideAccountName');if(nameEl)nameEl.textContent=rawName||'Não conectado';
  const installBtn=document.getElementById('sideInstallApp');if(installBtn)installBtn.style.display=document.body.classList.contains('app-installed')?'none':'flex';
}
const sideToggleMain=document.getElementById('sideToggleMain'); if(sideToggleMain) sideToggleMain.addEventListener('click',()=>toggleSidebar());
const sideToggleNav=document.getElementById('sideToggleNav'); if(sideToggleNav) sideToggleNav.addEventListener('click',()=>toggleSidebar());
const sideLogo=document.getElementById('sideLogoHome'); if(sideLogo) sideLogo.addEventListener('click',goHomeFromLogo);
const topLogo=document.getElementById('topLogoHome'); if(topLogo){ topLogo.addEventListener('click',goHomeFromLogo); topLogo.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goHomeFromLogo();}}); }
const sideImportPrint=document.getElementById('sideImportPrint'); if(sideImportPrint) sideImportPrint.addEventListener('click',()=>document.getElementById('btnAiImport')?.click());
const sideInstallApp=document.getElementById('sideInstallApp'); if(sideInstallApp) sideInstallApp.addEventListener('click',()=>document.getElementById('btnInstallApp')?.click());
const sideLogoutBtn=document.getElementById('sideLogoutBtn'); if(sideLogoutBtn) sideLogoutBtn.addEventListener('click',()=>document.getElementById('btnLogoutAccess')?.click());
syncSidebarUtilityState();
const sideBackdrop=document.getElementById('sideBackdrop'); if(sideBackdrop) sideBackdrop.addEventListener('click',()=>toggleSidebar(false));
window.addEventListener('resize',syncSidebarState);
const btnLeadDireciona=document.getElementById('btnLeadDireciona');
const btnLeadProposta=document.getElementById('btnLeadProposta');
if(btnLeadDireciona)btnLeadDireciona.addEventListener('click',()=>openLeadInModule('direciona'));
if(btnLeadProposta)btnLeadProposta.addEventListener('click',()=>openLeadInModule('propostas'));
bindEl('agendaBtnMobile','click',openAgenda);
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
bindEl('btnExport','click',()=>{const mw=document.getElementById('moreWrap'); if(mw) mw.classList.remove('open');exportCSV();});
bindEl('mfExport','click',()=>{closeMobileFilters();exportCSV();});
bindEl('btnImport','click',()=>{const mw=document.getElementById('moreWrap'); if(mw) mw.classList.remove('open');document.getElementById('csvInput').value='';document.getElementById('csvInput').click();});
bindEl('mfImport','click',()=>{closeMobileFilters();document.getElementById('csvInput').value='';document.getElementById('csvInput').click();});
bindEl('mfAiImport','click',()=>{closeMobileFilters();document.getElementById('btnAiImport').click();});
bindEl('csvInput','change',async e=>{const f=e.target.files?.[0];if(!f)return;await importCSV(await f.text());});

// Search
bindEl('searchQ','input',e=>{const sc=document.getElementById('searchClear'); if(sc) sc.classList.toggle('show',!!e.target.value.trim());render();});
bindEl('searchClear','click',()=>{const sq=document.getElementById('searchQ'); const sc=document.getElementById('searchClear'); if(sq)sq.value=''; if(sc)sc.classList.remove('show');render();});
['fEmp','fOrig'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('change',()=>{syncMobileFiltersFromDesktop();render();});});
['mfEmp','mfOrig'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('change',()=>{syncDesktopFiltersFromMobile();render();});});
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
  if(ALL.some(l=>l.id!==editingId&&(l.nome||'').trim().toLowerCase()===nome.toLowerCase())){
    if(!confirm(`Já existe lead ativo com "${nome}". Salvar mesmo assim?`))return;
  }
  if(origSnap&&formSnap()===origSnap){closeDialog(true);return;}
  const prevEtapa=editingId?normEtapa(ALL.find(x=>x.id===editingId)?.etapa||''):null;
  const newEtapa=normEtapa(F('etapa').value);
  if(editingId&&prevEtapa&&prevEtapa!==newEtapa)addHistory(editingId,`${prevEtapa} → ${newEtapa}`);
  const payload={id:editingId||cid(),ordem:editingId?(ALL.find(x=>x.id===editingId)?.ordem??Date.now()):orderForTop(newEtapa),data_inicio:F('data_inicio').value||todayISO(),proximo_contato:normProx(F('proximo_contato').value),nome,telefone:F('telefone').value.trim(),empreendimento:F('empreendimento').value,etapa:newEtapa,prioridade:stagePriority(newEtapa),origem:F('origem').value,responsavel:F('responsavel').value,visita:normVisita(F('visita').value),motivo_perda:'',observacao:F('observacao').value,criado_em:editingId?(ALL.find(x=>x.id===editingId)?.criado_em||nowISO()):nowISO(),atualizado_em:nowISO()};
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

function switchAgTab(tab){
  document.querySelectorAll('.ag-tab').forEach(el=>el.classList.toggle('active',el.dataset.agtab===tab));
  document.querySelectorAll('[data-ag-panel]').forEach(el=>el.classList.toggle('active',el.dataset.agPanel===tab));
}

// Admin tabs
document.querySelectorAll('.adm-tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.adm-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  document.querySelectorAll('.adm-sec').forEach(x=>x.classList.remove('active'));
  const s=document.getElementById(`adm-${t.dataset.tab}`);if(s)s.classList.add('active');
  if(t.dataset.tab==='access')loadAccessAdmin();
  else renderAdmin(t.dataset.tab);
}));

const btnSalvarAcesso=document.getElementById('btnSalvarAcesso'); if(btnSalvarAcesso) btnSalvarAcesso.addEventListener('click',saveAccessUser);

let voiceRecognition=null;
let voiceRecording=false;
let voiceManualStop=false;
let voiceSeen=new Set();
function normalizeVoiceText(text){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function setVoiceButton(active){const btn=document.getElementById('btnGravarAtendimento');if(!btn)return;btn.classList.toggle('is-recording',active);btn.textContent=active?'⏹️ Parar':'🎙️ Gravar';}
function appendVoiceObservation(text){
  text=String(text||'').trim();if(!text)return;const field=F('observacao');const current=String(field.value||'');
  const prefix=!current.trim()?`${obsPfx()} - `:'';field.value=current+(current&&!/[\s\n]$/.test(current)?' ':'')+prefix+text;field.focus();field.setSelectionRange?.(field.value.length,field.value.length);
}
function createVoiceRecognition(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){alert('A transcrição por voz exige Chrome ou outro navegador compatível.');return null;}
  const recognition=new SpeechRecognition();recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++){if(!event.results[i].isFinal)continue;const text=event.results[i][0]?.transcript||'';const key=normalizeVoiceText(text);if(!key||voiceSeen.has(key))continue;voiceSeen.add(key);appendVoiceObservation(text);}};
  recognition.onerror=event=>{if(event?.error==='not-allowed'){voiceRecording=false;voiceManualStop=true;setVoiceButton(false);}};
  recognition.onend=()=>{voiceRecognition=null;if(voiceRecording&&!voiceManualStop)setTimeout(()=>startVoiceRecognition(true),250);else{voiceRecording=false;voiceManualStop=false;setVoiceButton(false);}};
  return recognition;
}
function startVoiceRecognition(keepSeen=false){
  if(!keepSeen)voiceSeen=new Set();voiceRecognition=createVoiceRecognition();if(!voiceRecognition)return;
  try{voiceRecognition.start();voiceRecording=true;voiceManualStop=false;setVoiceButton(true);}catch(err){voiceRecording=false;setVoiceButton(false);console.warn(err);}
}
function stopVoiceRecognition(){voiceManualStop=true;voiceRecording=false;setVoiceButton(false);try{voiceRecognition?.stop();}catch(_e){}}
function installVoiceRecognition(){
  const btn=document.getElementById('btnGravarAtendimento');if(!btn||btn.dataset.voiceReady==='1')return;btn.dataset.voiceReady='1';btn.addEventListener('click',()=>voiceRecording?stopVoiceRecognition():startVoiceRecognition());
}
function normalizeStaticUi(){
  const search=document.getElementById('searchQ');if(search)search.placeholder='Busca...';
  const quick=document.getElementById('btnNovoAtendimento');if(quick)quick.textContent='Atendimento';
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */

try{
  document.title='LeveCRM';
  const statusbar=document.getElementById('statusbar');
  if(statusbar) statusbar.style.display='none';
}catch(e){}

function initApp(){
  if(appBooted)return;
  appBooted=true;
  loadAdminData();
  syncFilterSelects();
  syncMobileFiltersFromDesktop();
  setupPaste();
  installVoiceRecognition();
  normalizeStaticUi();
  updateLateBadge();
  registerSW();
  applyBrandIdentity();
  updateInstallBtn();
  setInterval(()=>{document.querySelectorAll('.card').forEach(c=>{const id=c.dataset.id;const l=ALL.find(x=>x.id===id);if(!l)return;const nc=nextContact(l);const ncEl=c.querySelector('.chip-nc-neutral,.chip-nc-green,.chip-nc-red');if(ncEl&&nc){ncEl.className=`chip ${nc.cls}`;ncEl.textContent=nc.text;}});},60000);
  setInterval(updateAgendaBadge,60000);
  agLoad().then(()=>{rescheduleAllNotifs();updateAgendaBadge();});
  loadAll().then(()=>{syncMobileFiltersFromDesktop();const mob=document.getElementById('mobileActions');if(mob)mob.style.display=currentView==='kanban'&&window.innerWidth<=640?'grid':'none';});
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
  return new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>{const full=String(r.result||'');const safe=full.length<=50000?full:(full.slice(0,10000)+'\n\n[...trecho intermediário reduzido para caber na análise...]\n\n'+full.slice(-40000));ok(safe);};r.onerror=no;r.readAsText(file)});
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
const DIRECIONA_FORBIDDEN_PHRASES=[
  "lembrei de você",
  "lembrei que",
  "estive pensando",
  "fiquei pensando",
  "faz sentido",
  "ainda tem interesse",
  "segue interessado",
  "passando para saber",
  "caso não tenha agradado",
  "qualquer dúvida",
  "fico à disposição",
  "estou à disposição"
];
const DIRECIONA_MODEL_DIAGNOSTICO=(window.DIRECIONA_MODEL_DIAGNOSTICO||localStorage.getItem('direciona_model_diagnostico')||window.DIRECIONA_MODEL||localStorage.getItem('direciona_model')||'gpt-4o');
const DIRECIONA_MODEL_RESPOSTAS=(window.DIRECIONA_MODEL_RESPOSTAS||localStorage.getItem('direciona_model_respostas')||window.DIRECIONA_MODEL||localStorage.getItem('direciona_model')||DIRECIONA_MODEL_DIAGNOSTICO);

function onlyJsonInstruction(){
  return 'Responda APENAS um JSON válido, sem markdown, sem comentários antes ou depois.';
}
function stripAccents(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function parseAIJson(txt){
  txt=String(txt||'').trim();
  if(!txt)throw new Error('Resposta vazia da IA.');
  try{return JSON.parse(txt)}catch(e){}
  const fenced=txt.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if(fenced){try{return JSON.parse(fenced[1])}catch(e){}}
  const first=txt.indexOf('{'),last=txt.lastIndexOf('}');
  if(first>=0&&last>first){return JSON.parse(txt.slice(first,last+1))}
  throw new Error('A IA não retornou JSON válido.');
}
function normalizeListText(v){
  if(Array.isArray(v))return v.filter(Boolean).join('; ');
  return String(v||'').trim();
}
function normalizeDirecionaResult(d){
  d=d&&typeof d==='object'?d:{};
  const estrategia=d.estrategia_comercial||d.raciocinio_comercial||d.camada_estrategica||{};
  const prob=d.probabilidade_de_venda||d.probabilidade||d.nivel_interesse||'';
  const etapa=d.etapa_do_funil||d.etapa_comercial||'';
  const principal=d.produto_principal||'';
  const obj=d.principal_objecao||d.objecao||d.objeção||'';
  const pend=d.pendencia_financeira||d.pendência_financeira||'';
  const agir=d.quem_deve_agir_agora||d.proxima_acao_de||d.proximo_passo_de||'';
  const ret=Array.isArray(d.retomadas)?d.retomadas:(Array.isArray(d.sugestoes)?d.sugestoes:(Array.isArray(d.sugestões)?d.sugestões:[]));
  return {
    situacao:String(d.situacao||d.diagnostico_curto||d.diagnóstico_curto||estrategia.resumo||'Análise comercial concluída.').trim(),
    temperatura:String(d.temperatura||mapInterestToHeat(prob)||'—').trim(),
    perfil:String(d.perfil||d.perfil_cliente||d.objetivo_real_cliente||estrategia.objetivo_real_cliente||'—').trim(),
    risco:String(d.risco||d.risco_comercial||estrategia.risco||'—').trim(),
    objetivo:String(d.objetivo||d.objetivo_da_retomada||estrategia.melhor_estrategia_agora||'—').trim(),
    proximo_passo:String(d.proximo_passo||d.próximo_passo||estrategia.proximo_movimento||estrategia.melhor_estrategia_agora||'—').trim(),
    evitar:String(d.evitar||d.erro_a_evitar||estrategia.erro_que_o_corretor_nao_pode_cometer||'').trim(),
    ultimo_falante:String(d.ultimo_falante||d.último_falante||d.ultima_pessoa_a_falar||'indefinido').trim(),
    ultimo_compromisso_cliente:String(d.ultimo_compromisso_cliente||d.último_compromisso_cliente||'').trim(),
    informacao_prometida:String(d.informacao_prometida||d.informação_prometida||d.ultima_informacao_prometida||'').trim(),
    produto_principal:String(principal||'').trim(),
    produtos_paralelos:normalizeListText(d.produtos_paralelos||d.produtos_secundarios||d.produtos_secundários||''),
    objecao:String(obj||'Sem objeção explícita.').trim(),
    pendencia_financeira:String(pend||'Não há pendência financeira.').trim(),
    proxima_acao_de:String(agir||'indefinido').trim(),
    etapa_comercial:String(etapa||'interesse').trim(),
    nivel_interesse:String(prob||d.nivel_interesse||'Médio').trim(),
    justificativa:String(d.justificativa||d.motivo||estrategia.justificativa||'').trim(),
    raciocinio_comercial:estrategia,
    respostas:Array.isArray(d.respostas)?d.respostas:[],
    retomadas:ret.map((r,i)=>({
      label:String(r.label||r.titulo||r.título||['Principal','Direta','Consultiva'][i]||('Opção '+(i+1))).trim(),
      texto:String(r.texto||r.mensagem||r.resposta||'').trim(),
      dica:String(r.dica||r.porque_funciona||r.por_que_funciona||r.justificativa||'').trim()
    })).filter(r=>r.texto)
  };
}
function mapInterestToHeat(v){
  v=stripAccents(v);
  if(v.includes('muito alta')||v.includes('alta'))return 'Quente';
  if(v.includes('media')||v.includes('morna'))return 'Morno';
  if(v.includes('baixa')||v.includes('fria'))return 'Frio';
  return '';
}
async function buildDirecionaContext(){
  let msg=($('clientMessage')?.value||'').trim();
  if(!msg&&!historyFiles.length&&!lastFile){alert('Cole uma observação, anexe contexto ou a última conversa.');status('Falta mensagem, contexto ou última conversa.');return null}
  const content=[{type:'text',text:'Observação do corretor:\n'+(msg||'Sem observação.')+'\n\nArquivos de contexto são histórico. A última conversa e o texto colado devem ser lidos integralmente e têm prioridade para definir o próximo passo real.'}];
  for(let f of historyFiles){await addFileToContent(content,f,'PRINT/ARQUIVO DE CONTEXTO')}
  if(lastFile){await addFileToContent(content,lastFile,'ÚLTIMA CONVERSA / PRIORIDADE MÁXIMA')}
  return content;
}
function direBasePrompt(){
  return `Você é um especialista comercial em vendas imobiliárias e atua como gerente comercial experiente de construtora.
Sua função NÃO é resumir conversas. Sua função é entender o contexto comercial completo de uma conversa de WhatsApp entre corretor e cliente e decidir o melhor próximo movimento para aumentar a chance de venda.

Leia TODA a conversa, do início ao fim, incluindo textos, áudios transcritos, observações e documentos. Nunca analise apenas as últimas mensagens.

REGRAS FIXAS:
- Não invente informações.
- Nunca suponha objeções que o cliente não demonstrou.
- Nunca faça perguntas que já foram respondidas.
- Considere todo o histórico antes de responder.
- Descubra quem ficou responsável pelo próximo passo.
- Continue exatamente de onde a conversa parou.
- Se existe compromisso aberto do cliente, use isso como gancho.
- Se o cliente falou no plural, escreva no plural.
- Não invente pendência financeira quando ela não apareceu.
- Não sugira proposta, simulação ou negociação se o próximo movimento real for visita.
- As mensagens devem parecer de corretor experiente, não de robô.
- Jamais usar: "lembrei de você", "lembrei que", "estive pensando", "fiquei pensando", "faz sentido", "ainda tem interesse?", "segue interessado?", "passando para saber", "caso não tenha agradado", "qualquer dúvida", "fico à disposição".
- Evite retomadas genéricas. A resposta precisa nascer da última pendência real.`;
}
function diagnosticoPrompt(){
  return `${direBasePrompt()}

CAMADA DE RACIOCÍNIO COMERCIAL OBRIGATÓRIA:
Antes de sugerir qualquer mensagem, responda internamente com precisão:
1. Qual era o objetivo real do cliente?
2. Esse objetivo mudou durante a conversa?
3. O que está impedindo a venda hoje?
4. O cliente esfriou ou apenas ficou aguardando?
5. Existe algum compromisso quebrado ou aberto?
6. Existe alguma oportunidade comercial que o corretor não percebeu?
7. Existe alguma informação importante que nunca foi explorada?
8. A melhor estratégia agora é perguntar, informar, convidar para visita, negociar, simular proposta ou esperar?
9. Qual erro o corretor não pode cometer neste lead?
10. Qual gancho exato deve ser usado na retomada?

Identifique também obrigatoriamente:
- última pessoa a falar;
- último compromisso do cliente;
- última informação prometida pelo corretor;
- produto principal;
- produtos paralelos;
- principal objeção, ou "Sem objeção explícita.";
- pendência financeira, ou "Não há pendência financeira.";
- quem deve agir agora, com motivo;
- etapa do funil: descoberta, interesse, comparação, visita, análise financeira, negociação, decisão ou pós-venda;
- probabilidade de venda: muito baixa, baixa, média, alta ou muito alta, com justificativa.

${onlyJsonInstruction()}
Formato obrigatório:
{
  "situacao":"diagnóstico comercial em 1 frase, específico para esta conversa",
  "temperatura":"Frio|Morno|Quente",
  "perfil":"perfil do cliente e motivo comercial",
  "risco":"Baixo|Médio|Alto + motivo",
  "objetivo":"objetivo imediato do próximo contato",
  "proximo_passo":"ação específica do corretor, sem generalidade",
  "evitar":"erro específico que o corretor deve evitar",
  "ultimo_falante":"cliente|corretor|indefinido",
  "ultimo_compromisso_cliente":"último compromisso real assumido pelo cliente, ou 'Nenhum compromisso explícito.'",
  "informacao_prometida":"última informação/ação prometida pelo corretor, ou 'Nenhuma informação prometida.'",
  "produto_principal":"produto principal de interesse",
  "produtos_paralelos":"produtos secundários citados, se houver",
  "objecao":"objeção real, ou 'Sem objeção explícita.'",
  "pendencia_financeira":"pendência financeira real, ou 'Não há pendência financeira.'",
  "proxima_acao_de":"cliente|corretor|indefinido + motivo curto",
  "etapa_comercial":"descoberta|interesse|comparação|visita|análise financeira|negociação|decisão|pós-venda",
  "nivel_interesse":"Muito baixa|Baixa|Média|Alta|Muito alta",
  "justificativa":"por que essa classificação foi escolhida",
  "raciocinio_comercial":{
    "objetivo_real_cliente":"...",
    "objetivo_mudou":"sim|não|indefinido + explicação",
    "trava_real_hoje":"...",
    "cliente_esfriou_ou_aguardando":"...",
    "compromisso_aberto":"...",
    "oportunidade_nao_percebida":"...",
    "informacao_nao_explorada":"...",
    "melhor_estrategia_agora":"perguntar|informar|convidar para visita|negociar|simular proposta|esperar + motivo",
    "gancho_exato":"frase/assunto da conversa que deve abrir a retomada",
    "linguagem_cliente":"singular|plural|indefinida"
  },
  "respostas":[]
}`;
}
function mensagensPrompt(diagnostico){
  return `${direBasePrompt()}

Você já recebeu o DIAGNÓSTICO COMERCIAL abaixo. Use-o como verdade operacional, mas confira a conversa para não inventar nada.

DIAGNÓSTICO COMERCIAL:
${JSON.stringify(diagnostico,null,2)}

Agora gere exatamente 3 mensagens de WhatsApp, cada uma com função diferente:
1. Principal: natural, equilibrada e com maior chance de resposta.
2. Direta: mais objetiva e prática.
3. Consultiva: conduz com um pouco mais de contexto comercial, sem ficar longa.

REGRAS DAS MENSAGENS:
- Entre 250 e 450 caracteres aproximadamente.
- Apenas uma pergunta principal por mensagem.
- Sem emojis.
- Sem frases proibidas.
- Não perguntar o que já foi respondido.
- Não abrir saída fácil.
- Não pressionar.
- Continuar do ponto exato em que a conversa parou.
- Usar o gancho real identificado no diagnóstico.
- Se o próximo passo for visita, conduzir naturalmente para agendamento.
- Se existir pendência financeira real, retomar exatamente esse assunto.
- Se não existir pendência financeira, não falar de entrada, parcelas, financiamento ou simulação.
- As 3 mensagens precisam ser realmente diferentes entre si, não variações cosméticas.

${onlyJsonInstruction()}
Formato obrigatório:
{
  "situacao":"copie ou refine o diagnóstico em 1 frase",
  "temperatura":"Frio|Morno|Quente",
  "perfil":"...",
  "risco":"...",
  "objetivo":"...",
  "proximo_passo":"...",
  "evitar":"...",
  "ultimo_falante":"...",
  "ultimo_compromisso_cliente":"...",
  "informacao_prometida":"...",
  "produto_principal":"...",
  "produtos_paralelos":"...",
  "objecao":"...",
  "pendencia_financeira":"...",
  "proxima_acao_de":"...",
  "etapa_comercial":"...",
  "nivel_interesse":"...",
  "justificativa":"...",
  "raciocinio_comercial":{},
  "retomadas":[
    {"label":"Principal","texto":"mensagem pronta","dica":"por que funciona neste caso específico"},
    {"label":"Direta","texto":"mensagem pronta","dica":"por que funciona neste caso específico"},
    {"label":"Consultiva","texto":"mensagem pronta","dica":"por que funciona neste caso específico"}
  ]
}`;
}
function correcaoPrompt(diagnostico, resposta, problemas){
  return `${direBasePrompt()}

As mensagens abaixo foram reprovadas pelo validador do Direciona. Corrija sem mudar o diagnóstico comercial.

DIAGNÓSTICO:
${JSON.stringify(diagnostico,null,2)}

MENSAGENS REPROVADAS:
${JSON.stringify(resposta,null,2)}

PROBLEMAS ENCONTRADOS:
${problemas.map((p,i)=>(i+1)+'. '+p).join('\n')}

Reescreva exatamente 3 mensagens. Elas devem corrigir todos os problemas, continuar do ponto exato da conversa e manter o tom de corretor experiente.

${onlyJsonInstruction()}
Formato obrigatório igual ao anterior, com a chave "retomadas" contendo Principal, Direta e Consultiva.`;
}
async function requestDirecionaAI(stage,content,opts){
  opts=opts||{};
  const diaPayload={
    stage,
    model:opts.model||DIRECIONA_MODEL_DIAGNOSTICO,
    temperature:opts.temperature??0.22,
    max_tokens:opts.max_tokens||2600,
    response_format:{type:'json_object'},
    messages:[{role:'user',content}]
  };
  const diaEndpoints=[];
  if(window.SB_URL||SB_URL) diaEndpoints.push({url:`${(window.SB_URL||SB_URL)}/functions/v1/direciona-openai`,supabase:true});
  diaEndpoints.push({url:'https://testecrm-ten.vercel.app/api/direciona-openai',supabase:false});
  let j=null,diaLastErr='';
  for(const ep of diaEndpoints){
    try{
      const headers={'Content-Type':'application/json'};
      if(ep.supabase){
        let authToken=(window.SB_KEY||SB_KEY);try{const ss=await window.AUTH_CLIENT?.auth?.getSession?.();authToken=ss?.data?.session?.access_token||authToken}catch(e){}
        headers.apikey=(window.SB_KEY||SB_KEY);headers.Authorization='Bearer '+authToken;
      }
      let res=await fetch(ep.url,{method:'POST',headers,body:JSON.stringify(diaPayload)});
      if(!res.ok){diaLastErr=await res.text().catch(()=>('HTTP '+res.status));continue}
      j=await res.json();break;
    }catch(e){diaLastErr=e.message||String(e)}
  }
  if(!j)throw new Error(diaLastErr||'Falha ao chamar IA.');
  const txt=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content?j.choices[0].message.content:'').trim();
  return parseAIJson(txt);
}
async function gerarDiagnosticoComercial(contextContent){
  const content=[{type:'text',text:diagnosticoPrompt()}].concat(contextContent||[]);
  const raw=await requestDirecionaAI('diagnostico_comercial',content,{model:DIRECIONA_MODEL_DIAGNOSTICO,temperature:0.18,max_tokens:3200});
  return normalizeDirecionaResult(raw);
}
async function gerarMensagensComerciais(contextContent,diagnostico){
  const content=[{type:'text',text:mensagensPrompt(diagnostico)}].concat(contextContent||[]);
  const raw=await requestDirecionaAI('mensagens_retomada',content,{model:DIRECIONA_MODEL_RESPOSTAS,temperature:0.34,max_tokens:3000});
  const out=normalizeDirecionaResult(Object.assign({},diagnostico,raw,{raciocinio_comercial:diagnostico.raciocinio_comercial||raw.raciocinio_comercial}));
  if(!out.retomadas.length&&Array.isArray(raw.retomadas))out.retomadas=raw.retomadas;
  return out;
}
function questionCount(t){return (String(t||'').match(/\?/g)||[]).length}
function wordSet(t){return new Set(stripAccents(t).replace(/[^a-z0-9áéíóúâêôãõç\s]/gi,' ').split(/\s+/).filter(w=>w.length>3))}
function jaccard(a,b){a=wordSet(a);b=wordSet(b);if(!a.size||!b.size)return 0;let inter=0;for(const w of a)if(b.has(w))inter++;return inter/(a.size+b.size-inter)}
function validarRetomadasLocal(diagnostico,resposta){
  const problemas=[];
  const ret=(resposta&&Array.isArray(resposta.retomadas))?resposta.retomadas:[];
  if(ret.length!==3)problemas.push('A IA precisa entregar exatamente 3 sugestões.');
  const rac=diagnostico.raciocinio_comercial||{};
  const plural=stripAccents(rac.linguagem_cliente||'').includes('plural');
  const estrategia=stripAccents((rac.melhor_estrategia_agora||'')+' '+(diagnostico.proximo_passo||'')+' '+(diagnostico.etapa_comercial||''));
  const semFinanceiro=stripAccents(diagnostico.pendencia_financeira||'').includes('nao ha pendencia financeira');
  ret.forEach((r,i)=>{
    const label=r.label||('Opção '+(i+1));
    const texto=String(r.texto||'').trim();
    const norm=stripAccents(texto);
    if(!texto)problemas.push(label+': mensagem vazia.');
    if(texto.length>520)problemas.push(label+': passou muito de 450 caracteres.');
    if(texto.length<90)problemas.push(label+': ficou curta demais e provavelmente genérica.');
    if(questionCount(texto)>1)problemas.push(label+': tem mais de uma pergunta.');
    DIRECIONA_FORBIDDEN_PHRASES.forEach(p=>{if(norm.includes(stripAccents(p)))problemas.push(label+': usou frase proibida "'+p+'".')});
    if(plural&&!(/\b(voces|vocês|vcs)\b/i.test(texto)))problemas.push(label+': a conversa indica plural, mas a mensagem não fala com "vocês".');
    if(estrategia.includes('visita')&&!/(visita|visitar|olhar|conhecer|acompanhar|loteamento|local)/i.test(texto))problemas.push(label+': o próximo passo parece ser visita, mas a mensagem não conduz para isso.');
    if(semFinanceiro&&/(financiamento|entrada|parcela|parcelas|simulaç|simulac|proposta)/i.test(texto))problemas.push(label+': mencionou financeiro/proposta sem pendência financeira explícita.');
  });
  for(let i=0;i<ret.length;i++)for(let j=i+1;j<ret.length;j++)if(jaccard(ret[i].texto,ret[j].texto)>0.72)problemas.push('As opções '+(i+1)+' e '+(j+1)+' estão parecidas demais.');
  return problemas;
}
async function validarOuCorrigirMensagens(contextContent,diagnostico,resposta){
  let out=normalizeDirecionaResult(Object.assign({},diagnostico,resposta));
  let problemas=validarRetomadasLocal(diagnostico,out);
  if(!problemas.length)return out;
  const content=[{type:'text',text:correcaoPrompt(diagnostico,out,problemas)}].concat(contextContent||[]);
  const raw=await requestDirecionaAI('validacao_correcao_retomada',content,{model:DIRECIONA_MODEL_RESPOSTAS,temperature:0.28,max_tokens:3000});
  const corr=normalizeDirecionaResult(Object.assign({},diagnostico,raw,{raciocinio_comercial:diagnostico.raciocinio_comercial}));
  const problemas2=validarRetomadasLocal(diagnostico,corr);
  if(problemas2.length){corr.evitar=(corr.evitar?corr.evitar+' | ':'')+'Validador ainda encontrou pontos de atenção: '+problemas2.slice(0,3).join(' ')}
  return corr;
}
async function callOpenAI(mode){
  const contextContent=await buildDirecionaContext();
  if(!contextContent)return null;
  let retomada=mode==='retomada';
  status(retomada?'Camada 1/3: lendo a conversa e definindo a estratégia comercial...':'Lendo a conversa inteira e montando diagnóstico comercial...');
  const diagnostico=await gerarDiagnosticoComercial(contextContent);
  lastAnalysis=diagnostico;
  if(!retomada)return diagnostico;
  status('Camada 2/3: escrevendo 3 respostas com base na pendência real...');
  const resposta=await gerarMensagensComerciais(contextContent,diagnostico);
  status('Camada 3/3: validando frases proibidas, repetição e coerência comercial...');
  return await validarOuCorrigirMensagens(contextContent,diagnostico,resposta);
}
function reading(d){$("analysisSituation").textContent=d.situacao||"Análise concluída.";$("analysisHeat").textContent=d.temperatura||"—";$("analysisProfile").textContent=d.perfil||"—";$("analysisRisk").textContent=d.risco||"—";$("analysisGoal").textContent=d.objetivo||"—";$("analysisNext").textContent=d.proximo_passo||"—";let a=$("analysisAvoid");if(a&&d.evitar){a.style.display="block";a.textContent="Evitar: "+d.evitar}}
function cards(id,items,empty){let area=$(id);if(!area)return;if(!items||!items.length){area.innerHTML='<div class="dia-empty">'+esc(empty)+'</div>';return}area.innerHTML=items.map((r,i)=>`<div class="dia-response"><div class="dia-response-head"><div class="dia-response-label">${esc(r.label||("Opção "+(i+1)))}</div><button class="dia-copy" type="button" data-copy="${encodeURIComponent(r.texto||"")}">Copiar</button></div><p>${esc(r.texto||"")}</p>${r.dica?`<div class="dia-tip">${esc(r.dica)}</div>`:""}</div>`).join("")}
async function analyze(){let btn=$("btnAiAnalyzeMain");try{busy(btn,true,"✨ Analisar conversa");status("Analisando conversa com IA..."); if(typeof window.showAiLoading==='function') window.showAiLoading("Analisando conversa","Lendo prints e extraindo diagnóstico comercial interno."); let d=await callOpenAI("analise");if(!d)return;lastAnalysis=d;reading(d);cards("analysisResponses",[], "Análise interna concluída. Para texto pronto ao cliente, use Gerar retomada.");await window.persistAiResult?.("analise",d,($('clientMessage')?.value||''));status("Análise interna concluída e salva.")}catch(e){console.error(e);alert("Erro na análise: "+(e.message||e));status("Erro na análise.")}finally{if(typeof window.hideAiLoading==='function') window.hideAiLoading();busy(btn,false,"✨ Analisar conversa")}}
async function retomada(){let btn=$("btnRetomadaMain");try{busy(btn,true,"🔁 Gerar retomada");status("Gerando retomada com prioridade para a última conversa..."); if(typeof window.showAiLoading==='function') window.showAiLoading("Gerando retomada","Criando uma mensagem de reabertura baseada na última conversa."); let d=await callOpenAI("retomada");if(!d)return;reading(d);cards("retomadaOutput",d.retomadas,"Sem retomadas retornadas.");await window.persistAiResult?.("retomada",d,($('clientMessage')?.value||''));status("Retomada gerada e salva.")}catch(e){console.error(e);alert("Erro na retomada: "+(e.message||e));status("Erro na retomada.")}finally{if(typeof window.hideAiLoading==='function') window.hideAiLoading();busy(btn,false,"🔁 Gerar retomada")}}
function clearAll(){historyFiles=[];lastFile=null;lastAnalysis=null;if($("clientMessage"))$("clientMessage").value="";if($("historyPrintInput"))$("historyPrintInput").value="";if($("lastPrintInput"))$("lastPrintInput").value="";counts();status("Aguardando mensagem, contexto ou última conversa.");$("analysisSituation").textContent="Cole uma mensagem ou anexe prints.";$("analysisHeat").textContent="—";$("analysisProfile").textContent="—";$("analysisRisk").textContent="—";$("analysisGoal").textContent="—";$("analysisNext").textContent="—";let a=$("analysisAvoid");if(a){a.style.display="none";a.textContent=""}$("analysisResponses").innerHTML='<div class="dia-empty">A análise aparecerá aqui.</div>';$("retomadaOutput").innerHTML='<div class="dia-empty">A retomada aparecerá aqui.</div>'}
document.addEventListener("change",e=>{if(e.target&&e.target.id==="historyPrintInput"){const files=Array.from(e.target.files||[]);const zip=files.find(isZipFile);if(zip){e.target.value="";processWhatsAppZipForDireciona(zip);return;}historyFiles=historyFiles.concat(files);e.target.value="";counts();status(historyFiles.length+" arquivo(s) de contexto anexado(s).")}if(e.target&&e.target.id==="lastPrintInput"){const f=(e.target.files&&e.target.files[0])?e.target.files[0]:null;e.target.value="";if(f&&isZipFile(f)){processWhatsAppZipForDireciona(f);return;}lastFile=f;counts();status(lastFile?"Última conversa anexada.":"Nenhuma última conversa anexada.")}if(e.target&&e.target.id==="whatsappZipInput"){const f=(e.target.files&&e.target.files[0])?e.target.files[0]:null;e.target.value="";if(f)processWhatsAppZipForDireciona(f);}});
document.addEventListener("click",e=>{let rm=e.target.closest(".dia-file-remove");if(rm){let kind=rm.dataset.kind;if(kind==="history"){historyFiles.splice(Number(rm.dataset.index),1)}else{lastFile=null}counts();status("Anexo removido.");return}let c=e.target.closest(".dia-copy");if(c){let t=decodeURIComponent(c.getAttribute("data-copy")||"");navigator.clipboard.writeText(t).then(()=>{c.textContent="Copiado";setTimeout(()=>c.textContent="Copiar",1200)});return}if(e.target&&e.target.id==="btnAiAnalyzeMain")analyze();if(e.target&&e.target.id==="btnRetomadaMain")retomada();if(e.target&&e.target.id==="btnClearAnalyzer")clearAll()});
document.addEventListener("paste",e=>{let a=document.activeElement;if(!a||a.id!=="clientMessage")return;let imgs=Array.from((e.clipboardData&&e.clipboardData.items)||[]).filter(i=>i.type&&i.type.startsWith("image/")).map(i=>i.getAsFile()).filter(Boolean);if(imgs.length){historyFiles=historyFiles.concat(imgs);counts();status(historyFiles.length+" print(s) de contexto anexado(s) por Ctrl+V.")}});


/* ===== Importação ZIP WhatsApp + transcrição de áudio para o Direciona ===== */
const DIRECIONA_ZIP_KEYS=["/__direciona_shared_zip__","./__direciona_shared_zip__","__direciona_shared_zip__"];
const DIRECIONA_SHARE_CACHE="direciona-sharetarget-stable";
const DIRECIONA_AUDIO_RE=/\.(opus|ogg|mp3|m4a|wav|aac|webm)$/i;
function isZipFile(file){
  const name=String(file&&file.name||"").toLowerCase();
  const type=String(file&&file.type||"").toLowerCase();
  return name.endsWith(".zip")||type.includes("zip")||type==="application/octet-stream";
}
function setClientText(text){
  const area=$("clientMessage");
  if(area)area.value=text;
}
function appendStatusLine(t){
  status(t);
  const area=$("clientMessage");
  if(area) area.dataset.whatsappImportStatus=t;
}
async function ensureDirecionaJSZip(){
  if(window.JSZip)return window.JSZip;
  await new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="./vendor/jszip.min.js?v=57";
    s.onload=resolve;
    s.onerror=()=>reject(new Error("Não consegui carregar a leitura de ZIP. Envie a pasta vendor/jszip.min.js junto com o sistema."));
    document.head.appendChild(s);
  });
  return window.JSZip;
}
function normalizeZipName(name){return String(name||"").split(/[\\/]/).pop().trim();}
function mimeFromAudioName(name){
  const n=String(name||"").toLowerCase();
  if(n.endsWith(".opus"))return "audio/ogg";
  if(n.endsWith(".ogg"))return "audio/ogg";
  if(n.endsWith(".mp3"))return "audio/mpeg";
  if(n.endsWith(".m4a"))return "audio/mp4";
  if(n.endsWith(".wav"))return "audio/wav";
  if(n.endsWith(".aac"))return "audio/aac";
  if(n.endsWith(".webm"))return "audio/webm";
  return "application/octet-stream";
}
function arrayBufferToBase64(buffer){
  let binary="";const bytes=new Uint8Array(buffer);const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));}
  return btoa(binary);
}
async function transcribeAudioBuffer(name,buffer){
  const payload={fileName:normalizeZipName(name),mimeType:mimeFromAudioName(name),base64:arrayBufferToBase64(buffer)};
  const endpoints=[];
  if(window.SB_URL) endpoints.push(`${window.SB_URL}/functions/v1/direciona-transcrever-audio`);
  if(window.SB_URL) endpoints.push(`${window.SB_URL}/functions/v1/direciona-audio-transcribe`);
  endpoints.push("./api/transcrever-audio");
  endpoints.push("https://testecrm-ten.vercel.app/api/transcrever-audio");
  let lastErr="";
  for(const url of endpoints){
    try{
      const headers={"Content-Type":"application/json"};
      if(url.includes("supabase.co")){
        const token=(window.SB_KEY||SB_KEY||"");
        headers.apikey=token;headers.Authorization="Bearer "+token;
      }
      const res=await fetch(url,{method:"POST",headers,body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      if(res.ok&&(data.text||data.transcription||data.transcript))return String(data.text||data.transcription||data.transcript).trim();
      lastErr=data.error||data.details||("HTTP "+res.status);
    }catch(e){lastErr=e.message||String(e);}
  }
  throw new Error(lastErr||"sem endpoint de transcrição configurado");
}
function parseWhatsAppDate(line){
  const m=String(line||"").match(/^\[?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]?\s*-?/);
  if(!m)return "";
  return `${m[1].padStart(2,"0")}/${m[2].padStart(2,"0")}/${m[3]} ${m[4]}`;
}
function injectAudioTranscripts(txt,transcripts){
  let out=String(txt||"");
  const used=new Set();
  for(const item of transcripts){
    const base=normalizeZipName(item.name);
    if(!item.text)continue;
    const safe=`[Áudio transcrito - ${base}] ${item.text}`;
    if(out.includes(base)){
      const lines=out.split(/\r?\n/).map(line=>{
        if(line.includes(base)&&!used.has(base)){used.add(base);return line+"\n"+safe;}
        return line;
      });
      out=lines.join("\n");
    }
  }
  const leftovers=transcripts.filter(i=>i.text&&!used.has(normalizeZipName(i.name)));
  if(leftovers.length){
    out += "\n\n--- ÁUDIOS TRANSCRITOS NÃO VINCULADOS A UMA LINHA DO TXT ---\n" + leftovers.map(i=>`[${normalizeZipName(i.name)}] ${i.text}`).join("\n");
  }
  return out;
}
async function processWhatsAppZipForDireciona(file,{autoAnalyze=false}={}){
  if(!file)return;
  try{
    if(typeof window.switchView==="function")window.switchView("direciona");
  }catch(_){ }
  try{
  appendStatusLine("Lendo exportação do WhatsApp...");
  const JSZip=await ensureDirecionaJSZip();
  const zip=await JSZip.loadAsync(file);
  const txtEntries=[],audioEntries=[];
  zip.forEach((path,entry)=>{
    if(entry.dir)return;
    if(/\.txt$/i.test(path))txtEntries.push([path,entry]);
    else if(DIRECIONA_AUDIO_RE.test(path))audioEntries.push([path,entry]);
  });
  if(!txtEntries.length)throw new Error("O ZIP não tem arquivo .txt da conversa. Exporte a conversa do WhatsApp com mídia.");
  txtEntries.sort((a,b)=>a[0].length-b[0].length);
  const txtName=txtEntries[0][0];
  let conversation=await txtEntries[0][1].async("string");
  conversation=conversation.replace(/^\uFEFF/,"");
  const transcripts=[];
  const total=audioEntries.length;
  const limit=Math.min(total,30);
  for(let i=0;i<limit;i++){
    const [name,entry]=audioEntries[i];
    appendStatusLine(`Transcrevendo áudio ${i+1}/${limit}...`);
    try{
      const buffer=await entry.async("arraybuffer");
      const text=await transcribeAudioBuffer(name,buffer);
      transcripts.push({name,text});
    }catch(e){
      transcripts.push({name,text:"",error:e.message||String(e)});
    }
  }
  let imported=injectAudioTranscripts(conversation,transcripts);
  const failed=transcripts.filter(t=>!t.text).length;
  const ok=transcripts.filter(t=>t.text).length;
  const header=[
    "[EXPORTAÇÃO DO WHATSAPP IMPORTADA PELO DIRECIONA]",
    `Arquivo ZIP: ${file.name||"conversa.zip"}`,
    `TXT lido: ${normalizeZipName(txtName)}`,
    `Áudios encontrados no ZIP: ${total}`,
    `Áudios enviados para transcrição: ${limit}`,
    `Áudios transcritos: ${ok}`,
    failed?`Áudios sem transcrição: ${failed}`:"",
    total>limit?`Observação: limite de segurança desta importação: ${limit} áudios. Os demais ficaram fora desta análise.`:"",
    "--- INÍCIO DA CONVERSA ---"
  ].filter(Boolean).join("\n");
  const footer="\n--- FIM DA CONVERSA ---";
  imported=header+"\n"+imported+footer;
  const safe=imported.length<=120000?imported:(imported.slice(0,25000)+"\n\n[... trecho intermediário reduzido para caber na análise ...]\n\n"+imported.slice(-90000));
  setClientText(safe);
  lastFile=new File([safe],"whatsapp-importado-transcrito.txt",{type:"text/plain"});
  counts();
  appendStatusLine(ok?`WhatsApp importado: ${ok} áudio(s) transcrito(s). Clique em Analisar conversa.`:`WhatsApp importado. Nenhum áudio foi transcrito; confira configuração da transcrição.`);
  if(autoAnalyze) setTimeout(()=>document.getElementById("btnAiAnalyzeMain")?.click(),350);
}catch(e){
  console.error(e);
  alert("Erro ao importar WhatsApp: "+(e.message||e));
  status("Erro ao importar exportação do WhatsApp.");
}
}
async function checkSharedWhatsAppZip(){
  const params=new URLSearchParams(location.search);
  const came=params.has("shared")||params.get("source")==="share-target"||params.get("view")==="direciona";
  if(!came||!("caches" in window))return;
  try{
    const names=await caches.keys();
    const list=[DIRECIONA_SHARE_CACHE,...names.filter(n=>n!==DIRECIONA_SHARE_CACHE&&n.includes("sharetarget"))];
    for(const cacheName of list){
      const cache=await caches.open(cacheName);
      for(const key of DIRECIONA_ZIP_KEYS){
        const cached=await cache.match(key);
        if(!cached)continue;
        const blob=await cached.blob();
        const name=decodeURIComponent(cached.headers.get("X-File-Name")||"conversa-whatsapp.zip");
        for(const k of DIRECIONA_ZIP_KEYS){try{await cache.delete(k)}catch(_){}}
        try{history.replaceState(null,"",location.pathname)}catch(_){ }
        await processWhatsAppZipForDireciona(new File([blob],name,{type:blob.type||"application/zip"}),{autoAnalyze:false});
        return;
      }
    }
  }catch(e){console.warn("Falha ao ler ZIP compartilhado",e);}
}
window.DirecionaWhatsAppImport={processZip:processWhatsAppZipForDireciona,checkShared:checkSharedWhatsAppZip};

setTimeout(updateFlowHint,600);
setTimeout(checkSharedWhatsAppZip,900);
})();


/* ===== Progresso visual das análises de IA ===== */

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

})();




/* Reorganiza automaticamente quando alternar entre desktop e mobile */
let __lastMobileKanban = null;
window.addEventListener('resize',()=>{
  const nowMobile = isMobileKanban();
  if(__lastMobileKanban===null){__lastMobileKanban=nowMobile;return;}
  if(nowMobile!==__lastMobileKanban){__lastMobileKanban=nowMobile;render();}
});






/* ===== LeveCRM v43 — persistência e endurecimento ===== */
var HISTORY_CACHE={};
var SETTINGS_CACHE={responsavel:[],empreendimento:[],origem:[]};
var PROPOSALS_CACHE=[];

function clearLeveCrmLocalData(){
  const keep=new Set(['levecrm_v43_cleaned','levecrm_v43_cache_reset_done']);
  Object.keys(localStorage).forEach(k=>{if((k.startsWith('crm_')||k.startsWith('levecrm_'))&&!keep.has(k))localStorage.removeItem(k);});
}

function loadAdminData(){
  LISTS.responsavel=[];LISTS.empreendimento=[];LISTS.origem=[];
}
function getAdminResp(){return SETTINGS_CACHE.responsavel.map(x=>({...x}));}
function getAdminEmps(){return SETTINGS_CACHE.empreendimento.map(x=>({...x}));}
function getAdminOrigs(){return SETTINGS_CACHE.origem.map(x=>x.nome||x.name||'').filter(Boolean);}

async function loadSettings(){
  if(!ACCESS_USER?.id)return;
  SETTINGS_CACHE={responsavel:[],empreendimento:[],origem:[]};
  let rows;
  try{
    rows=await sbFetch(`${SETTINGS_TBL}?select=id,category,name,payload&order=created_at.asc`);
  }catch(e){
    console.warn('Configurações indisponíveis (tabela crm_settings ausente no Supabase?). Carregando o CRM sem elas.',e);
    return;
  }
  (rows||[]).forEach(r=>{
    if(String(r.name||'').startsWith('__'))return;
    const item={id:r.id,nome:r.name,...(r.payload||{})};
    if(SETTINGS_CACHE[r.category])SETTINGS_CACHE[r.category].push(item);
  });
  LISTS.responsavel=SETTINGS_CACHE.responsavel.map(x=>x.nome);
  LISTS.empreendimento=SETTINGS_CACHE.empreendimento.map(x=>x.nome);
  LISTS.origem=SETTINGS_CACHE.origem.map(x=>x.nome);
  syncFilterSelects();
}
function mergeLeadOptionsIntoLists(){
  const uniq=items=>[...new Set(items.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  LISTS.responsavel=uniq([...LISTS.responsavel,...ALL.map(l=>l.responsavel),ACCESS_USER?.nome||'']);
  LISTS.empreendimento=uniq([...LISTS.empreendimento,...ALL.map(l=>l.empreendimento)]);
  LISTS.origem=uniq([...LISTS.origem,...ALL.map(l=>l.origem)]);
  syncFilterSelects();
}
async function getInitialImportMarker(){
  try{
    const rows=await sbFetch(`${SETTINGS_TBL}?select=id,payload&category=eq.origem&name=eq.${encodeURIComponent(INITIAL_IMPORT_MARKER)}&limit=1`);
    return rows?.[0]||null;
  }catch(e){
    console.warn('Não foi possível ler o marcador de importação (crm_settings ausente?).',e);
    return null;
  }
}
async function importInitialLeadsIfNeeded(existingRows=[]){
  if(!ACCESS_USER?.id||!ADMIN_EMAILS.includes(String(ACCESS_USER.email||'').toLowerCase()))return false;
  const response=await fetch(INITIAL_LEADS_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`Não consegui abrir a base inicial (${response.status}).`);
  const source=await response.json();
  if(!Array.isArray(source?.leads)||source.leads.length!==200)throw new Error('A base inicial não contém exatamente 200 leads.');

  const expectedCounts={'Prioritário':7,'Qualificação':29,'Retomada':22,'Sem foco':142};
  const sourceCounts=source.leads.reduce((acc,item)=>{const etapa=normEtapa(item.etapa);acc[etapa]=(acc[etapa]||0)+1;return acc;},{});
  for(const [etapa,total] of Object.entries(expectedCounts)){
    if(Number(sourceCounts[etapa]||0)!==total)throw new Error(`Base inicial inválida em ${etapa}: ${sourceCounts[etapa]||0} de ${total}.`);
  }

  const sourceIds=new Set(source.leads.map(item=>String(item.id||'')));
  const currentSourceRows=(existingRows||[]).filter(row=>sourceIds.has(String(row.id||'')));
  const unrelated=(existingRows||[]).filter(row=>!sourceIds.has(String(row.id||'')));
  const marker=await getInitialImportMarker();

  // Só considera concluído quando os 200 registros realmente existem. Um marcador antigo,
  // inclusive de reset, nunca pode esconder uma base vazia.
  if(currentSourceRows.length===200){
    const currentCounts=currentSourceRows.reduce((acc,item)=>{const etapa=normEtapa(item.etapa);acc[etapa]=(acc[etapa]||0)+1;return acc;},{});
    const complete=Object.entries(expectedCounts).every(([etapa,total])=>Number(currentCounts[etapa]||0)===total);
    if(complete)return false;
  }
  if(marker?.payload?.disabled===true&&currentSourceRows.length>0)return false;
  if(unrelated.length)return false;

  showToast(`Importando ${200-currentSourceRows.length} leads restantes...`,6000);
  for(let i=0;i<source.leads.length;i+=20){
    const chunk=source.leads.slice(i,i+20).map(item=>{
      const clean={...item};
      delete clean._pontuacao_operacional;delete clean._ordem_geral;
      clean.access_user_id=ACCESS_USER.id;
      clean.etapa=normEtapa(clean.etapa);
      clean.prioridade=stagePriority(clean.etapa);
      clean.responsavel=clean.responsavel||ACCESS_USER.nome||'';
      clean.motivo_perda='';
      clean.data_fechamento=null;
      return clean;
    });
    const {error}=await AUTH_CLIENT.from(TBL).upsert(chunk,{onConflict:'id',ignoreDuplicates:false});
    if(error)throw new Error(`Falha ao importar leads ${i+1} a ${Math.min(i+20,200)}: ${error.message}`);
  }

  const {data:check,error:checkError}=await AUTH_CLIENT.from(TBL).select('id,etapa');
  if(checkError)throw checkError;
  const imported=(check||[]).filter(row=>sourceIds.has(String(row.id||'')));
  const importedCounts=imported.reduce((acc,item)=>{const etapa=normEtapa(item.etapa);acc[etapa]=(acc[etapa]||0)+1;return acc;},{});
  const valid=imported.length===200&&Object.entries(expectedCounts).every(([etapa,total])=>Number(importedCounts[etapa]||0)===total);
  if(!valid)throw new Error(`Importação incompleta: ${imported.length}/200. Prioritário ${importedCounts['Prioritário']||0}/7, Qualificação ${importedCounts['Qualificação']||0}/29, Retomada ${importedCounts['Retomada']||0}/22, Sem foco ${importedCounts['Sem foco']||0}/142.`);

  try{
    await sbFetch(`${SETTINGS_TBL}?on_conflict=access_user_id,category,name`,{
      method:'POST',
      body:{access_user_id:ACCESS_USER.id,category:'origem',name:INITIAL_IMPORT_MARKER,payload:{version:'v43',count:200,counts:expectedCounts,imported_at:nowISO()}},
      prefer:'resolution=merge-duplicates,return=minimal'
    });
  }catch(e){console.warn('Leads importados, mas não foi possível gravar o marcador (crm_settings ausente?).',e);}
  return true;
}

async function loadHistory(){
  HISTORY_CACHE={};
  if(!ALL.length)return;
  try{
    const rows=await sbFetch(`${HIST_TBL}?select=id,lead_id,action,metadata,created_at&order=created_at.desc`);
    (rows||[]).forEach(r=>(HISTORY_CACHE[r.lead_id]||=[]).push({id:r.id,date:r.created_at,action:r.action,metadata:r.metadata||{}}));
  }catch(e){console.warn('Histórico indisponível (tabela lead_history ausente?).',e);}
}
function getHistory(id){return (HISTORY_CACHE[id]||[]).slice();}
async function addHistory(id,action,metadata={}){
  if(!id||!ACCESS_USER?.id)return;
  const temp={id:cid(),date:nowISO(),action,metadata};
  (HISTORY_CACHE[id]||=[]).unshift(temp);
  try{
    const rows=await sbFetch(HIST_TBL,{method:'POST',body:{access_user_id:ACCESS_USER.id,lead_id:id,action,metadata}});
    if(rows?.[0])Object.assign(temp,{id:rows[0].id,date:rows[0].created_at||temp.date});
  }catch(e){
    HISTORY_CACHE[id]=(HISTORY_CACHE[id]||[]).filter(x=>x!==temp);
    console.error('Falha ao gravar histórico',e);
    throw e;
  }
}
function renderHistory(id){
  const el=document.getElementById('historyLog');if(!el)return;
  const h=getHistory(id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(!h.length){el.textContent='Nenhuma movimentação registrada.';return;}
  el.replaceChildren(...h.map(e=>{
    const row=document.createElement('div');row.className='history-entry';
    const d=parseDate(e.date),ds=d?`${pad2(d.getDate())}/${pad2(d.getMonth()+1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`:'';
    const dt=document.createElement('span');dt.className='h-date';dt.textContent=ds;
    const ac=document.createElement('span');ac.className='h-action';ac.textContent=e.action||'';
    row.append(dt,ac);return row;
  }));
}

function leadActivityAt(l){return l?.ultima_interacao_em||l?.atualizado_em||l?.criado_em||l?.data_inicio||'';}
function leadAttentionScore(l){
  if(!l||['PERDIDO','FECHADO / GANHO'].includes(normEtapa(l.etapa)))return -999999;
  let score=prioRank(l.prioridade)*100;
  const nc=normProx(l.proximo_contato),today=dayStart(new Date());
  if(nc){const diff=Math.floor((dayStart(parseDate(nc))-today)/86400000);score+=diff<=0?500:Math.max(0,120-diff*10);}
  const idle=daysSince(leadActivityAt(l));score+=Math.min(idle,30)*8;
  if(l.proxima_acao_de==='corretor')score+=100;
  if(l.nivel_interesse==='Alto')score+=80;else if(l.nivel_interesse==='Médio')score+=35;
  return score;
}
function sortLeads(leads,etapa){
  const e=normEtapa(etapa);
  return leads.filter(l=>normEtapa(l.etapa)===e).sort((a,b)=>Number(a.ordem||0)-Number(b.ordem||0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}
function sortMobilePriority(leads){
  return [...leads].sort((a,b)=>LISTS.etapa.indexOf(normEtapa(a.etapa))-LISTS.etapa.indexOf(normEtapa(b.etapa))||Number(a.ordem||0)-Number(b.ordem||0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}

async function loadAll(){
  try{
    const {data:sessionResult,error:sessionError}=await AUTH_CLIENT.auth.getSession();if(sessionError)throw sessionError;
    if(!sessionResult?.session?.user?.id||!ACCESS_USER?.id){ALL=[];ATTACHES=[];render();lockAccess('Sua sessão expirou.');return;}
    const {error:accessError}=await AUTH_CLIENT.rpc('levecrm_assert_access');
    if(accessError){
      const accMsg=String(accessError.message||accessError.hint||'');
      const fnMissing=accessError.code==='PGRST202'||/could not find the function|schema cache|does not exist/i.test(accMsg);
      if(!fnMissing)throw accessError;
      console.warn('levecrm_assert_access indisponível no banco; seguindo sem o gate server-side.',accessError);
    }
    let [{data:rows,error},_settings]=await Promise.all([AUTH_CLIENT.from(TBL).select('*'),loadSettings()]);if(error)throw error;
    let imported=false;
    try{imported=await importInitialLeadsIfNeeded(rows||[]);}
    catch(impErr){console.warn('Importação inicial não executada:',impErr);}
    if(imported){
      const reload=await AUTH_CLIENT.from(TBL).select('*');
      if(reload.error)throw reload.error;
      rows=reload.data||[];
    }
    ALL=(rows||[]).map(l=>({...l,etapa:normEtapa(l.etapa),prioridade:stagePriority(l.etapa),motivo_perda:'',visita:normVisita(l.visita),ordem:Number(l.ordem)||Date.now(),proximo_contato:normProx(l.proximo_contato),data_fechamento:null}));
    mergeLeadOptionsIntoLists();
    await Promise.all([loadAttaches(),loadHistory()]);
    render();setStatus('ok','');
    if(imported)showToast('200 leads importados e conferidos.',3500);
  }catch(e){
    console.error(e);ALL=[];ATTACHES=[];HISTORY_CACHE={};refreshAttMap();render();
    if(/acesso|expirado|bloqueado/i.test(e?.message||''))lockAccess(e.message);else showToast(`Erro ao carregar: ${e?.message||'falha desconhecida'}`,6000);
  }
}

async function upsertLead(payload,{silent=false}={}){
  if(!payload.nome?.trim()){alert('Nome é obrigatório.');return false;}
  const previous=ALL.find(x=>x.id===payload.id);
  payload={...payload};
  payload.etapa=normEtapa(payload.etapa);payload.prioridade=stagePriority(payload.etapa);payload.motivo_perda='';payload.proximo_contato=normProx(payload.proximo_contato);payload.visita=normVisita(payload.visita);
  payload.access_user_id=ACCESS_USER?.id||payload.access_user_id;
  payload.atualizado_em=nowISO();payload.ordem=Number(payload.ordem)||Date.now();
  const observationChanged=!previous||String(previous.observacao||'')!==String(payload.observacao||'');
  payload.ultima_interacao_em=observationChanged?nowISO():(previous?.ultima_interacao_em||payload.ultima_interacao_em||null);
  payload.data_fechamento=null;
  try{
    let row;
    if(previous){const{id,...body}=payload;const rows=await sbFetch(`${TBL}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body});row=rows?.[0]||payload;ALL[ALL.findIndex(x=>x.id===id)]={...previous,...row};}
    else{payload.id=payload.id||cid();payload.criado_em=payload.criado_em||nowISO();const rows=await sbFetch(TBL,{method:'POST',body:payload});row=rows?.[0]||payload;ALL.unshift(row);await addHistory(row.id,'Lead criado');}
    if(!silent){showToast('Lead salvo ✓');render();}
    return true;
  }catch(e){console.error(e);alert(`Erro ao salvar: ${e?.message||'verifique o Supabase.'}`);return false;}
}

async function addSetting(category,name,payload={}){
  const rows=await sbFetch(SETTINGS_TBL,{method:'POST',body:{access_user_id:ACCESS_USER.id,category,name,payload}});
  await loadSettings();return rows?.[0];
}
async function removeSetting(category,id){await sbFetch(`${SETTINGS_TBL}?id=eq.${encodeURIComponent(id)}&category=eq.${encodeURIComponent(category)}`,{method:'DELETE',prefer:'return=minimal'});await loadSettings();}
async function addResp(){const n=document.getElementById('newRespNome').value.trim();if(!n)return alert('Informe o nome.');try{await addSetting('responsavel',n,{fone:document.getElementById('newRespFone').value.trim(),creci:document.getElementById('newRespCreci').value.trim()});document.getElementById('newRespNome').value='';renderAdmin('responsaveis');showToast('Corretor adicionado.');}catch(e){alert(e.message);}}
async function removeResp(i){const it=getAdminResp()[i];if(!it||!confirm(`Remover "${it.nome}"?`))return;await removeSetting('responsavel',it.id);renderAdmin('responsaveis');}
async function addEmp(){const n=document.getElementById('newEmpNome').value.trim();if(!n)return alert('Informe o nome.');try{await addSetting('empreendimento',n,{tipo:document.getElementById('newEmpTipo').value,valor:document.getElementById('newEmpValor').value.trim(),status:document.getElementById('newEmpStatus').value});document.getElementById('newEmpNome').value='';renderAdmin('imoveis');showToast('Imóvel adicionado.');}catch(e){alert(e.message);}}
async function removeEmp(i){const it=getAdminEmps()[i];if(!it||!confirm(`Remover "${it.nome}"?`))return;await removeSetting('empreendimento',it.id);renderAdmin('imoveis');}
async function addOrig(){const n=document.getElementById('newOrigNome').value.trim();if(!n)return alert('Informe a origem.');try{await addSetting('origem',n,{});document.getElementById('newOrigNome').value='';renderAdmin('origens');showToast('Origem adicionada.');}catch(e){alert(e.message);}}
async function removeOrig(i){const it=SETTINGS_CACHE.origem[i];if(!it||!confirm(`Remover "${it.nome}"?`))return;await removeSetting('origem',it.id);renderAdmin('origens');}

window.persistAiResult=async function(kind,result,input=''){
  if(!ACCESS_USER?.id)return;
  const lead=selectedLead();
  await sbFetch(AI_TBL,{method:'POST',body:{access_user_id:ACCESS_USER.id,lead_id:lead?.id||null,kind,input_excerpt:String(input).slice(0,2000),result}});
  if(lead?.id&&result){
    const patch={...lead,
      ultimo_falante:result.ultimo_falante==='cliente'||result.ultimo_falante==='corretor'?result.ultimo_falante:'',
      proxima_acao_de:result.proxima_acao_de==='cliente'||result.proxima_acao_de==='corretor'?result.proxima_acao_de:'',
      etapa_comercial:String(result.etapa_comercial||''),
      nivel_interesse:['Baixo','Médio','Alto'].includes(result.nivel_interesse)?result.nivel_interesse:'',
    };
    await upsertLead(patch,{silent:true});
  }
};

async function loadProposals(leadId){
  if(!leadId){PROPOSALS_CACHE=[];return[];}
  const rows=await sbFetch(`${PROPOSAL_TBL}?select=*&lead_id=eq.${encodeURIComponent(leadId)}&order=updated_at.desc`);PROPOSALS_CACHE=rows||[];return PROPOSALS_CACHE;
}
async function saveProposal(payload){
  const lead=selectedLead();if(!lead)throw new Error('Selecione um lead antes de salvar a proposta.');
  const body={access_user_id:ACCESS_USER.id,lead_id:lead.id,status:payload.status||'rascunho',title:'Proposta comercial',payload,total_venda:Number(payload.total_venda||0),total_nominal:Number(payload.total_nominal||0),total_corrigido:payload.total_corrigido==null?null:Number(payload.total_corrigido)};
  let rows;
  if(payload.id){const{id,...patch}=body;rows=await sbFetch(`${PROPOSAL_TBL}?id=eq.${encodeURIComponent(payload.id)}`,{method:'PATCH',body:patch});}
  else{const existing=await loadProposals(lead.id);body.version=Math.max(0,...existing.map(item=>Number(item.version)||0))+1;rows=await sbFetch(PROPOSAL_TBL,{method:'POST',body});}
  return rows?.[0];
}
window.addEventListener('message',async event=>{
  if(location.protocol!=='file:'&&event.origin!==location.origin)return;
  const data=event.data||{};const frame=document.getElementById('proposalFrame');
  try{
    if(data.type==='LEVECRM_PROPOSAL_READY'){sendSelectedLeadToProposal();const lead=selectedLead();const items=lead?await loadProposals(lead.id):[];frame?.contentWindow?.postMessage({type:'LEVECRM_PROPOSALS_LIST',items},location.protocol==='file:'?'*':location.origin);}
    if(data.type==='LEVECRM_PROPOSAL_SAVE'){const saved=await saveProposal(data.payload||{});const items=await loadProposals(saved.lead_id);frame?.contentWindow?.postMessage({type:'LEVECRM_PROPOSAL_SAVED',saved,items},location.protocol==='file:'?'*':location.origin);showToast('Proposta salva ✓');}
    if(data.type==='LEVECRM_PROPOSALS_REQUEST'){const lead=selectedLead();const items=lead?await loadProposals(lead.id):[];frame?.contentWindow?.postMessage({type:'LEVECRM_PROPOSALS_LIST',items},location.protocol==='file:'?'*':location.origin);}
  }catch(e){frame?.contentWindow?.postMessage({type:'LEVECRM_PROPOSAL_ERROR',message:e.message},location.protocol==='file:'?'*':location.origin);}
});

async function resetCurrentAccountData(){
  if(!confirm('Isso apagará definitivamente todos os leads, anexos, agenda, propostas, análises e cadastros comerciais desta conta. Continuar?'))return;
  const typed=prompt('Digite ZERAR para confirmar.');if(typed!=='ZERAR')return;
  const {error}=await AUTH_CLIENT.rpc('levecrm_reset_my_data');if(error)return alert(error.message);
  try{
    await sbFetch(`${SETTINGS_TBL}?on_conflict=access_user_id,category,name`,{
      method:'POST',
      body:{access_user_id:ACCESS_USER.id,category:'origem',name:INITIAL_IMPORT_MARKER,payload:{version:'v43',count:0,disabled:true,reset_at:nowISO()}},
      prefer:'resolution=merge-duplicates,return=minimal'
    });
  }catch(markerError){console.warn('Não foi possível gravar o marcador pós-reset.',markerError);}
  clearLeveCrmLocalData();ALL=[];ATTACHES=[];HISTORY_CACHE={};SETTINGS_CACHE={responsavel:[],empreendimento:[],origem:[]};loadAdminData();syncFilterSelects();render();showToast('Sistema zerado.');
}
window.resetCurrentAccountData=resetCurrentAccountData;


function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function ensurePushSubscription(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||Notification.permission!=='granted'||!ACCESS_USER?.id)return null;
  const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
  if(!sub){
    const session=await AUTH_CLIENT.auth.getSession();const token=session?.data?.session?.access_token;if(!token)return null;
    const r=await fetch(`${SB_URL}/functions/v1/push-public-key`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}});if(!r.ok)return null;
    const {publicKey}=await r.json();if(!publicKey)return null;
    sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(publicKey)});
  }
  const json=sub.toJSON();
  await sbFetch(`${PUSH_TBL}?on_conflict=access_user_id,endpoint`,{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:{access_user_id:ACCESS_USER.id,endpoint:sub.endpoint,subscription:json}});
  return sub;
}
window.ensurePushSubscription=ensurePushSubscription;

// Agenda: lembretes são sempre mostrados dentro do CRM. A notificação do navegador é apenas reforço enquanto o app está ativo.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){agLoad().then(()=>{rescheduleAllNotifs();updateAgendaBadge();});}});

// Limpeza única de vestígios locais das versões anteriores.
if(localStorage.getItem('levecrm_v43_cleaned')!=='1'){clearLeveCrmLocalData();localStorage.setItem('levecrm_v43_cleaned','1');}

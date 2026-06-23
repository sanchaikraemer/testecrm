'use strict';

let aportes=[];
let currentLead=null;
let currentProposalId=null;
let proposalItems=[];
const $=id=>document.getElementById(id);

function money(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);}
function num(id){return Number.parseFloat($(id)?.value)||0;}
function txt(id){return String($(id)?.value||'').trim();}
function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function parseLocalDate(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):null;}
function fmtDate(value){const d=parseLocalDate(value);return d?d.toLocaleDateString('pt-BR'):'--/--/----';}
function monthDiff(from,to){return Math.max(0,(to.getFullYear()-from.getFullYear())*12+(to.getMonth()-from.getMonth()));}
function correctedPayment(value,months,rate=.0095){return (Number(value)||0)*Math.pow(1+rate,Math.max(0,months));}

function addAporte(){aportes.push({valor:0,data:''});drawAportes();render();}
function removeAporte(index){aportes.splice(index,1);drawAportes();render();}
function updateAporte(index,field,value){if(!aportes[index])return;aportes[index][field]=field==='valor'?(Number.parseFloat(value)||0):String(value||'');render();}

function drawAportes(){
  const container=$('aportes-list');container.replaceChildren();
  aportes.forEach((a,i)=>{
    const row=document.createElement('div');row.className='aporte-item';
    const wrap=document.createElement('div');wrap.className='input-with-prefix';
    const prefix=document.createElement('span');prefix.className='input-prefix';prefix.textContent='R$';
    const value=document.createElement('input');value.type='number';value.step='0.01';value.placeholder='Valor';value.value=a.valor||'';value.addEventListener('input',()=>updateAporte(i,'valor',value.value));
    wrap.append(prefix,value);
    const date=document.createElement('input');date.type='date';date.value=/^\d{4}-\d{2}-\d{2}$/.test(a.data||'')?a.data:'';date.addEventListener('input',()=>updateAporte(i,'data',date.value));
    const del=document.createElement('button');del.type='button';del.className='btn-icon';del.textContent='×';del.setAttribute('aria-label','Remover aporte');del.addEventListener('click',()=>removeAporte(i));
    row.append(wrap,date,del);container.append(row);
  });
}

function nominalTotals(){
  const venda=num('f-valor-apto')+num('f-valor-box');
  const mensal=num('f-parcelas-mensais')*num('f-valor-parcela-mensal');
  const semestral=num('f-parcelas-semestrais')*num('f-valor-parcela-semestral');
  const anual=num('f-parcelas-anuais')*num('f-valor-parcela-anual');
  const aportesTotal=aportes.reduce((sum,a)=>sum+(Number(a.valor)||0),0);
  const composto=num('f-entrada')+num('f-permuta')+num('f-chaves')+mensal+semestral+anual+aportesTotal;
  return {venda,mensal,semestral,anual,aportesTotal,composto,saldo:venda-composto};
}

function projectedCorrectedTotal(){
  const correction=$('f-correcao').value;
  const nominal=nominalTotals();
  if(!correction)return nominal.composto;
  if(correction!=='0.95')return null;
  let total=num('f-entrada')+num('f-permuta')+num('f-chaves');
  const emission=parseLocalDate(txt('f-data-emissao'))||new Date();
  aportes.forEach(a=>{const d=parseLocalDate(a.data);total+=correctedPayment(a.valor,d?monthDiff(emission,d):0);});
  const nm=Math.max(0,Math.floor(num('f-parcelas-mensais'))),vm=num('f-valor-parcela-mensal');
  for(let i=1;i<=nm;i++)total+=correctedPayment(vm,i);
  const ns=Math.max(0,Math.floor(num('f-parcelas-semestrais'))),vs=num('f-valor-parcela-semestral');
  for(let i=1;i<=ns;i++)total+=correctedPayment(vs,i*6);
  const na=Math.max(0,Math.floor(num('f-parcelas-anuais'))),va=num('f-valor-parcela-anual');
  for(let i=1;i<=na;i++)total+=correctedPayment(va,i*12);
  return total;
}

function addPaymentRow(tbody,title,description,value){
  if((Number(value)||0)<=0&&!description)return;
  const tr=document.createElement('tr');
  const left=document.createElement('td');
  const ti=document.createElement('div');ti.className='item-title';ti.textContent=title;
  const de=document.createElement('div');de.className='item-desc';de.textContent=description||'';
  left.append(ti,de);
  const right=document.createElement('td');right.className='item-value';right.textContent=money(value);
  tr.append(left,right);tbody.append(tr);
}

function render(){
  const cliente=txt('f-cliente')||'Nome do Cliente',empreendimento=txt('f-empreendimento')||'--',apto=txt('f-apto')||'--',box=txt('f-box')||'--';
  const totals=nominalTotals(),corrected=projectedCorrectedTotal(),correction=$('f-correcao').value;
  $('m-cliente').textContent=cliente;$('m-empreendimento').textContent=empreendimento;$('m-apto').textContent=apto;$('m-box').textContent=box;
  $('m-emissao').textContent=`Data: ${fmtDate(txt('f-data-emissao'))}`;$('m-validade').textContent=txt('f-validade')?`Validade: ${txt('f-validade')}`:'';
  $('m-valor-apto').textContent=money(num('f-valor-apto'));$('m-valor-box').textContent=money(num('f-valor-box'));$('m-total-venda').textContent=money(totals.venda);
  $('m-saldo-restante').textContent=money(totals.saldo);$('saldo-card').style.display=Math.abs(totals.saldo)<.01?'none':'block';

  const tbody=$('neg-body');tbody.replaceChildren();
  addPaymentRow(tbody,'Entrada / Ato','Pagamento inicial para fechamento do negócio.',num('f-entrada'));
  if(num('f-permuta')>0||txt('f-permuta-desc'))addPaymentRow(tbody,'Permuta',txt('f-permuta-desc')||'Bem recebido como parte do pagamento.',num('f-permuta'));
  aportes.forEach((a,i)=>{if(a.valor||a.data)addPaymentRow(tbody,`Aporte / Reforço ${i+1}`,a.data?`Programado para ${fmtDate(a.data)}.`:'Pagamento programado.',a.valor);});
  addPaymentRow(tbody,'Chaves','Pagamento na entrega da unidade.',num('f-chaves'));
  const suffix=correction==='INCC'?' corrigidas pelo INCC (índice futuro não incluído no total nominal).':correction==='0.95'?' corrigidas a 0,95% a.m. conforme o prazo de cada parcela.':correction==='IGPM'?' corrigidas por IGP-M + 1% a.m. (IGP-M futuro não incluído no total nominal).':'.';
  if(num('f-parcelas-mensais')>0)addPaymentRow(tbody,'Parcelamento Mensal',`${Math.floor(num('f-parcelas-mensais'))} parcelas mensais de ${money(num('f-valor-parcela-mensal'))}${suffix}`,totals.mensal);
  if(num('f-parcelas-semestrais')>0)addPaymentRow(tbody,'Parcelamento Semestral',`${Math.floor(num('f-parcelas-semestrais'))} parcelas semestrais de ${money(num('f-valor-parcela-semestral'))}${suffix}`,totals.semestral);
  if(num('f-parcelas-anuais')>0)addPaymentRow(tbody,'Parcelamento Anual',`${Math.floor(num('f-parcelas-anuais'))} parcelas anuais de ${money(num('f-valor-parcela-anual'))}${suffix}`,totals.anual);
  if(!tbody.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=2;td.style.cssText='text-align:center;color:#999;padding:20px;font-size:12px';td.textContent='Nenhuma condição de pagamento definida.';tr.append(td);tbody.append(tr);}

  $('ft-label-composto').textContent=corrected!==null&&correction==='0.95'?'Total projetado corrigido':'Total nominal composto';
  $('ft-composto').textContent=money(corrected??totals.composto);$('ft-total').textContent=money(totals.venda);
  const note=$('correction-note');
  if(correction==='INCC'||correction==='IGPM'){note.textContent='O total exibido é nominal. O índice futuro é variável e será aplicado conforme o contrato, sem estimativa fictícia.';note.style.display='block';}
  else if(correction==='0.95'){note.textContent='Projeção calculada a 0,95% ao mês conforme o vencimento estimado de cada parcela.';note.style.display='block';}
  else note.style.display='none';
  const obs=txt('f-obs');$('obs-container').style.display=obs?'block':'none';$('m-obs').textContent=obs;
}

function collectPayload(){
  const totals=nominalTotals(),corrected=projectedCorrectedTotal();
  return {
    id:currentProposalId,lead_id:currentLead?.id||null,status:$('f-status').value,
    cliente:txt('f-cliente'),empreendimento:txt('f-empreendimento'),apto:txt('f-apto'),box:txt('f-box'),
    valor_apto:num('f-valor-apto'),valor_box:num('f-valor-box'),entrada:num('f-entrada'),permuta:num('f-permuta'),permuta_desc:txt('f-permuta-desc'),
    aportes:aportes.map(a=>({valor:Number(a.valor)||0,data:a.data||''})),chaves:num('f-chaves'),
    parcelas_mensais:Math.floor(num('f-parcelas-mensais')),valor_parcela_mensal:num('f-valor-parcela-mensal'),
    parcelas_semestrais:Math.floor(num('f-parcelas-semestrais')),valor_parcela_semestral:num('f-valor-parcela-semestral'),
    parcelas_anuais:Math.floor(num('f-parcelas-anuais')),valor_parcela_anual:num('f-valor-parcela-anual'),
    correcao:$('f-correcao').value,data_emissao:txt('f-data-emissao'),validade:txt('f-validade'),observacoes:txt('f-obs'),
    total_venda:totals.venda,total_nominal:totals.composto,total_corrigido:$('f-correcao').value==='0.95'?corrected:null
  };
}

function saveProposal(){
  if(!currentLead){setProposalStatus('Selecione um lead no CRM antes de salvar.',true);return;}
  setProposalStatus('Salvando…');
  parent.postMessage({type:'LEVECRM_PROPOSAL_SAVE',payload:collectPayload()},location.protocol==='file:'?'*':location.origin);
}
function setProposalStatus(message,error=false){const el=$('proposal-save-status');el.textContent=message||'';el.style.color=error?'#b91c1c':'#496070';}
function clearForm(confirmFirst=true){
  if(confirmFirst&&!confirm('Deseja limpar todos os campos?'))return;
  document.querySelectorAll('.sidebar input,.sidebar textarea').forEach(el=>el.value='');
  $('f-correcao').value='';$('f-status').value='rascunho';aportes=[];currentProposalId=null;drawAportes();$('f-data-emissao').value=isoToday();
  if(currentLead){$('f-cliente').value=currentLead.nome||'';$('f-empreendimento').value=currentLead.empreendimento||'';$('f-obs').value=currentLead.observacao||'';}
  render();setProposalStatus('Nova proposta.');
}
function applyProposal(row){
  const p=row?.payload||row||{};currentProposalId=row?.id||p.id||null;
  const values={
    'f-cliente':p.cliente,'f-empreendimento':p.empreendimento,'f-apto':p.apto,'f-box':p.box,'f-valor-apto':p.valor_apto,'f-valor-box':p.valor_box,
    'f-entrada':p.entrada,'f-permuta':p.permuta,'f-permuta-desc':p.permuta_desc,'f-chaves':p.chaves,'f-parcelas-mensais':p.parcelas_mensais,
    'f-valor-parcela-mensal':p.valor_parcela_mensal,'f-parcelas-semestrais':p.parcelas_semestrais,'f-valor-parcela-semestral':p.valor_parcela_semestral,
    'f-parcelas-anuais':p.parcelas_anuais,'f-valor-parcela-anual':p.valor_parcela_anual,'f-correcao':p.correcao,'f-data-emissao':p.data_emissao,
    'f-validade':p.validade,'f-obs':p.observacoes,'f-status':row?.status||p.status||'rascunho'
  };
  Object.entries(values).forEach(([id,v])=>{if($(id))$(id).value=v??'';});aportes=Array.isArray(p.aportes)?p.aportes.map(a=>({...a})):[];drawAportes();render();setProposalStatus(`Versão ${row?.version||''} carregada.`);
}
function drawProposalHistory(){
  const box=$('proposal-history-list');box.replaceChildren();
  if(!proposalItems.length){const empty=document.createElement('div');empty.className='proposal-history-empty';empty.textContent='Nenhuma proposta salva para este lead.';box.append(empty);return;}
  proposalItems.forEach(row=>{
    const btn=document.createElement('button');btn.type='button';btn.className='proposal-history-item';
    const top=document.createElement('strong');top.textContent=`Versão ${row.version||1} · ${String(row.status||'rascunho')}`;
    const sub=document.createElement('span');const d=new Date(row.updated_at||row.created_at||Date.now());sub.textContent=`${d.toLocaleDateString('pt-BR')} · ${money(row.total_venda)}`;
    btn.append(top,sub);btn.addEventListener('click',()=>applyProposal(row));box.append(btn);
  });
}

window.addAporte=addAporte;window.removeAporte=removeAporte;window.updateAporte=updateAporte;window.render=render;window.clearForm=clearForm;window.saveProposal=saveProposal;

document.addEventListener('DOMContentLoaded',()=>{
  $('f-data-emissao').value=isoToday();
  document.querySelectorAll('.sidebar input,.sidebar textarea,.sidebar select').forEach(el=>el.addEventListener('input',render));
  render();drawProposalHistory();
  parent.postMessage({type:'LEVECRM_PROPOSAL_READY'},location.protocol==='file:'?'*':location.origin);
});
window.addEventListener('message',event=>{
  if(location.protocol!=='file:'&&event.origin!==location.origin)return;
  const data=event.data||{};
  if(data.type==='LEVECRM_LEAD'){
    currentLead=data.lead||null;clearForm(false);parent.postMessage({type:'LEVECRM_PROPOSALS_REQUEST'},location.protocol==='file:'?'*':location.origin);
  }
  if(data.type==='LEVECRM_PROPOSALS_LIST'){proposalItems=data.items||[];drawProposalHistory();}
  if(data.type==='LEVECRM_PROPOSAL_SAVED'){currentProposalId=data.saved?.id||currentProposalId;proposalItems=data.items||proposalItems;drawProposalHistory();setProposalStatus(`Proposta versão ${data.saved?.version||''} salva.`);}
  if(data.type==='LEVECRM_PROPOSAL_ERROR')setProposalStatus(data.message||'Erro ao salvar.',true);
});

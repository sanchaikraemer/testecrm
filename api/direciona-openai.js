// API opcional para deploy em Vercel/Node.
// Recebe {model, max_tokens, messages} e repassa para a OpenAI,
// devolvendo a resposta no mesmo formato do Chat Completions.
// Configure OPENAI_API_KEY no ambiente do deploy.
export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };


function modelFromEnv(stage){
  const s = String(stage || '').toLowerCase();
  if(s.includes('diagnostico') || s.includes('diagnóstico')){
    return process.env.OPENAI_MODEL_DIAGNOSTICO || process.env.OPENAI_MODEL || 'gpt-5.5-pro';
  }
  if(s.includes('mensagem') || s.includes('retomada') || s.includes('correcao') || s.includes('correção')){
    return process.env.OPENAI_MODEL_RESPOSTAS || process.env.OPENAI_MODEL || 'gpt-5.5';
  }
  return process.env.OPENAI_MODEL || 'gpt-5.5';
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(204).end();
  try{
    if(req.method !== 'POST'){
      res.setHeader('Allow','POST');
      return res.status(405).json({ error:'Método não permitido.' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if(!apiKey) return res.status(500).json({ error:'OPENAI_API_KEY não configurada no servidor.' });
    const body = req.body || {};
    if(!Array.isArray(body.messages) || !body.messages.length){
      return res.status(400).json({ error:'messages vazio.' });
    }
    const model = body.model || modelFromEnv(body.stage);
    const stage = String(body.stage || '').toLowerCase();
    const isReasoningModel = /^gpt-5|^o[0-9]/i.test(model);
    const reasoningEffort = body.reasoning_effort || body.reasoning?.effort || (
      stage.includes('diagnostico') || stage.includes('diagnóstico')
        ? (process.env.OPENAI_REASONING_DIAGNOSTICO || 'high')
        : (process.env.OPENAI_REASONING_RESPOSTAS || 'high')
    );

    const payload = {
      model,
      max_completion_tokens: body.max_completion_tokens || body.max_tokens || 2600,
      response_format: body.response_format || { type: 'json_object' },
      messages: body.messages
    };
    if(isReasoningModel){
      if(reasoningEffort && reasoningEffort !== 'none') payload.reasoning_effort = reasoningEffort;
    }else{
      payload.temperature = body.temperature ?? 0.32;
    }

    let r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    let data = await r.json().catch(()=>({}));

    // Fallback de compatibilidade: se o modelo rejeitar parâmetros opcionais,
    // tenta novamente com a carga mínima, mantendo o mesmo modelo.
    const errText = JSON.stringify(data || {}).toLowerCase();
    if(!r.ok && (errText.includes('reasoning_effort') || errText.includes('temperature') || errText.includes('max_completion_tokens') || errText.includes('max_tokens'))){
      const fallbackPayload = {
        model,
        messages: body.messages,
        response_format: body.response_format || { type: 'json_object' }
      };
      const limit = body.max_completion_tokens || body.max_tokens || 2600;
      if(errText.includes('max_tokens')) fallbackPayload.max_completion_tokens = limit;
      else if(errText.includes('max_completion_tokens')) fallbackPayload.max_tokens = limit;
      else fallbackPayload.max_completion_tokens = limit;
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
        body: JSON.stringify(fallbackPayload)
      });
      data = await r.json().catch(()=>({}));
    }

    // Fallback de acesso/modelo: se GPT-5.5 Pro não estiver liberado na conta,
    // cai para GPT-5.5 sem quebrar a análise do corretor.
    const modelErr = JSON.stringify(data || {}).toLowerCase();
    if(!r.ok && model === 'gpt-5.5-pro' && (modelErr.includes('model') || modelErr.includes('access') || modelErr.includes('not found') || modelErr.includes('does not exist'))){
      const fallbackModel = process.env.OPENAI_MODEL_DIAGNOSTICO_FALLBACK || 'gpt-5.5';
      const fallbackPayload = {
        ...payload,
        model: fallbackModel
      };
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
        body: JSON.stringify(fallbackPayload)
      });
      data = await r.json().catch(()=>({}));
    }

    return res.status(r.status).json(data);
  }catch(e){
    return res.status(500).json({ error:e.message || String(e) });
  }
}

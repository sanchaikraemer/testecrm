// API opcional para deploy em Vercel/Node.
// Recebe {model, temperature, max_tokens, messages} e repassa para a OpenAI,
// devolvendo a resposta no mesmo formato do Chat Completions.
// Configure OPENAI_API_KEY no ambiente do deploy.
export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };


function modelFromEnv(stage){
  const s = String(stage || '').toLowerCase();
  if(s.includes('diagnostico') || s.includes('diagnóstico')){
    return process.env.OPENAI_MODEL_DIAGNOSTICO || process.env.OPENAI_MODEL || 'gpt-4o';
  }
  if(s.includes('mensagem') || s.includes('retomada') || s.includes('correcao') || s.includes('correção')){
    return process.env.OPENAI_MODEL_RESPOSTAS || process.env.OPENAI_MODEL || 'gpt-4o';
  }
  return process.env.OPENAI_MODEL || 'gpt-4o';
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
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
      body: JSON.stringify({
        model: body.model || modelFromEnv(body.stage),
        temperature: body.temperature ?? 0.32,
        max_tokens: body.max_tokens || 2600,
        response_format: body.response_format || { type: 'json_object' },
        messages: body.messages
      })
    });
    const data = await r.json().catch(()=>({}));
    return res.status(r.status).json(data);
  }catch(e){
    return res.status(500).json({ error:e.message || String(e) });
  }
}

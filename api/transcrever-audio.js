// API opcional para deploy em Vercel/Node.
// Recebe { fileName, mimeType, base64 } e retorna { ok:true, text }.
// Configure OPENAI_API_KEY no ambiente do deploy.
export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(204).end();
  try{
    if(req.method !== 'POST'){
      res.setHeader('Allow','POST');
      return res.status(405).json({ ok:false, error:'Método não permitido.' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if(!apiKey) return res.status(500).json({ ok:false, error:'OPENAI_API_KEY não configurada no servidor.' });
    const { fileName='audio.ogg', mimeType='audio/ogg', base64='' } = req.body || {};
    if(!base64) return res.status(400).json({ ok:false, error:'Áudio vazio.' });
    const bin = Buffer.from(base64, 'base64');
    if(!bin.length) return res.status(400).json({ ok:false, error:'Áudio inválido.' });
    const blob = new Blob([bin], { type: mimeType || 'application/octet-stream' });
    const form = new FormData();
    form.append('model','gpt-4o-mini-transcribe');
    form.append('file', blob, String(fileName || 'audio.ogg'));
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:'POST',
      headers:{ Authorization:`Bearer ${apiKey}` },
      body: form
    });
    const data = await r.json().catch(()=>({}));
    if(!r.ok) return res.status(r.status).json({ ok:false, error:data.error?.message || data.error || 'Falha na transcrição.' });
    return res.status(200).json({ ok:true, text:data.text || '' });
  }catch(e){
    return res.status(500).json({ ok:false, error:e.message || String(e) });
  }
}

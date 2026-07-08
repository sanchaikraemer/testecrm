# LeveCRM v62 — Direciona com raciocínio comercial em camadas

## O que mudou
- Substituído o motor antigo de análise/retomada do Direciona por um fluxo em camadas:
  1. Diagnóstico comercial profundo da conversa inteira.
  2. Definição da estratégia de próxima ação.
  3. Geração de 3 mensagens realmente diferentes.
  4. Validação automática antes de exibir as respostas.

## Correções comerciais aplicadas
- A IA agora deve continuar exatamente de onde a conversa parou.
- Identifica última fala útil, compromisso aberto, quem deve agir, produto principal, produtos paralelos, objeção real e pendência financeira real.
- Não inventa trava financeira quando ela não apareceu.
- Se o cliente falou no plural, as mensagens devem falar com “vocês”.
- Se o próximo passo real for visita, a resposta conduz para agendamento em vez de sugerir proposta/simulação genérica.
- Bloqueio/validação contra frases proibidas: “faz sentido”, “lembrei”, “ainda tem interesse?”, “fico à disposição”, entre outras.
- Validador local detecta mensagens parecidas demais, excesso de perguntas, tamanho inadequado e incoerência com o diagnóstico.

## API OpenAI
- `api/direciona-openai.js` agora aceita `stage` e `response_format`.
- Modelo padrão alterado para `gpt-4o`, com suporte a variáveis de ambiente:
  - `OPENAI_MODEL`
  - `OPENAI_MODEL_DIAGNOSTICO`
  - `OPENAI_MODEL_RESPOSTAS`

## Cache/versão
- Versão atualizada para v62.
- `app.js` atualizado para `?v=62`.
- Service worker atualizado para `levecrm-v62-direciona-ai`.

# Alterações v63 — Direciona com modelo forte de análise

## Ajuste principal
- Troca do padrão do motor Direciona de `gpt-4o` para `gpt-5.5`.
- Diagnóstico comercial agora envia `reasoning_effort: xhigh` por padrão.
- Geração e validação das respostas usam `reasoning_effort: high` por padrão.

## Variáveis de ambiente recomendadas
```env
OPENAI_MODEL_DIAGNOSTICO=gpt-5.5
OPENAI_MODEL_RESPOSTAS=gpt-5.5
OPENAI_REASONING_DIAGNOSTICO=xhigh
OPENAI_REASONING_RESPOSTAS=high
```

Se a conta/API não tiver acesso ao modelo mais novo, configure temporariamente:
```env
OPENAI_MODEL_DIAGNOSTICO=gpt-4o
OPENAI_MODEL_RESPOSTAS=gpt-4o
```

## Compatibilidade
- O endpoint `api/direciona-openai.js` agora aceita `reasoning_effort`.
- Se algum parâmetro novo não for aceito pelo deploy/modelo, o endpoint tenta uma chamada de fallback sem esses parâmetros antes de devolver erro.

## Cache
- Atualizado para v63 para forçar o navegador/PWA a carregar a nova versão.

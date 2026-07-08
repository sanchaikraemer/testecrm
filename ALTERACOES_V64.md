# Alterações v64 — Direciona com análise máxima

## Ajuste principal
- O diagnóstico comercial do Direciona agora usa `gpt-5.5-pro` por padrão.
- O diagnóstico envia `reasoning_effort: xhigh` para forçar leitura mais profunda antes das respostas.
- As respostas e a validação continuam no motor forte do Direciona, com `gpt-5.5`/modelo configurável e `reasoning_effort: high`.

## Fallback seguro
- Se a conta OpenAI não tiver acesso ao `gpt-5.5-pro`, o endpoint tenta automaticamente `gpt-5.5` via `OPENAI_MODEL_DIAGNOSTICO_FALLBACK`.

## Variáveis recomendadas
```env
OPENAI_MODEL_DIAGNOSTICO=gpt-5.5-pro
OPENAI_MODEL_DIAGNOSTICO_FALLBACK=gpt-5.5
OPENAI_MODEL_RESPOSTAS=gpt-5.5
OPENAI_REASONING_DIAGNOSTICO=xhigh
OPENAI_REASONING_RESPOSTAS=high
```

## Cache
- Atualizado para v64 para forçar navegador/PWA a carregar a nova versão.

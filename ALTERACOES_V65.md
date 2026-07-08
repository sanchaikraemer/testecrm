# Alterações v65 — Correção OpenAI temperatura

- Corrigido erro `Unsupported value: temperature` nos modelos de raciocínio.
- O frontend do Direciona não envia mais `temperature` quando o modelo começa com `gpt-5` ou `o`.
- O endpoint `api/direciona-openai.js` também remove `temperature` para modelos de raciocínio.
- Ajustado `reasoning_effort` padrão do diagnóstico para `high`, evitando valor não suportado.
- Mantido o fluxo de diagnóstico profundo → estratégia → 3 mensagens → validação.
- Cache e versão visual atualizados para v65.

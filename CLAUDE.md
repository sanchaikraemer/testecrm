# Instruções do projeto

## Idioma
**Sempre responder em português (português brasileiro).** Toda comunicação com
o usuário neste repositório deve ser em pt-BR.

## Sobre o projeto
LeveCRM — CRM para corretores de imóveis. App estático (HTML/CSS/JS puro)
hospedado no GitHub Pages, com backend no Supabase (PostgREST + Auth + Storage).

- `index.html` / `app.js` — aplicação principal (quadro de leads, agenda, etc.).
- `propostas.html` / `propostas.js` — gerador de propostas comerciais.
- `service-worker.js` — cache offline (PWA).
- `leads-iniciais.json` — base inicial de 200 leads (importada só para admin).
- `*.sql` — scripts de migração/segurança para rodar no SQL Editor do Supabase.

### Tabelas usadas no Supabase
`leads`, `lead_attachments`, `agenda_eventos`, `lead_history`, `crm_settings`,
`proposals`, `ai_analyses`, `push_subscriptions`.

### Versionamento de cache
A versão fica em vários lugares (`?v=NN`, `CACHE='levecrm-vNN'`,
`application-version`, `side-version`). Ao publicar mudança em JS/CSS, **suba a
versão** para o navegador baixar o código novo. **Não** alterar os marcadores
`__LEADS_V43_IMPORTED__`, `levecrm_v43_cleaned` e `levecrm_v43_cache_reset_done`
(mudá-los re-dispara importação/limpeza local).

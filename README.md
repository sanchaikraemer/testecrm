# LeveCRM v34 corrigido

## Correção desta versão
A migração v34 falhava em bancos onde algumas colunas de usuário estavam como `text` e o Supabase retornava `auth.uid()` como `uuid`.

A v34 normaliza as comparações para texto e corrige também os vínculos entre leads e anexos. O script é idempotente e pode ser executado mesmo depois da tentativa da v34.

## Publicação
Envie **todos os arquivos e pastas deste pacote** para a mesma pasta do Vercel/GitHub Pages. O arquivo inicial é `index.html`.

## Supabase
1. Abra o SQL Editor.
2. Apague o conteúdo da consulta anterior.
3. Cole e execute `supabase-seguranca-v34.sql` inteiro.
4. Confirme a mensagem de sucesso.
5. Teste com duas contas diferentes: uma conta não deve visualizar leads, agenda nem anexos da outra.

## Antes de liberar para usuários
- Confirme que a Edge Function `direciona-openai` possui a chave da OpenAI apenas nos Secrets do Supabase.
- Confirme que o bucket `lead-attachments` existe e está privado.

## Limite técnico dos lembretes
Um site estático não consegue acordar sozinho quando navegador e PWA estão totalmente encerrados. Para alertas garantidos com o aplicativo fechado, é necessário usar notificações push disparadas por backend/cron.

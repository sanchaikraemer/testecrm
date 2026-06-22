# LeveCRM v35 — pacote plano para GitHub Pages

Esta versão foi preparada sem a pasta `assets`, porque no upload anterior os arquivos dessa pasta não foram enviados ao repositório. Sem `styles.css`, `app.js` e `levecrm-logo.png`, o navegador mostrou apenas o HTML cru.

## Publicação no GitHub

1. Exclua os arquivos atuais do repositório ou substitua todos eles.
2. Extraia este ZIP no computador.
3. Em **Add file → Upload files**, envie todos os arquivos extraídos para a raiz do repositório.
4. Confirme que aparecem na mesma tela: `index.html`, `styles.css`, `app.js` e `levecrm-logo.png`.
5. Aguarde o GitHub Pages concluir o deploy.
6. Abra o site e pressione **Ctrl + F5**.

Não crie pasta `assets`. Todos os arquivos desta versão ficam na raiz.

## Supabase

O arquivo `supabase-seguranca-v35.sql` contém a migração corrigida. Se a migração v34 já executou com sucesso, não é necessário repetir. Caso ainda tenha falhado, execute a v35 inteira no SQL Editor.

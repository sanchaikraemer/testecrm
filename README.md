# LeveCRM v36 — recuperação dos leads antigos

A v35 passou a usar o UUID do Supabase Auth para filtrar os leads. Os registros antigos continuaram com o identificador do acesso anterior e ficaram invisíveis. O pacote não contém comando de exclusão dos leads.

## Ordem correta

1. No Supabase, abra **SQL Editor**.
2. Cole e execute todo o arquivo `recuperar-leads-v36.sql`.
3. No resultado final, confira `total_leads_recuperados`.
4. Envie para a raiz do GitHub Pages os arquivos da v36, substituindo os anteriores.
5. Aguarde o deploy e pressione `Ctrl + F5`.

O `app.js` da v36 também deixou de repetir no navegador o filtro de proprietário. A partir desta versão, o isolamento é feito pelo RLS do Supabase, que é o local correto para essa segurança.

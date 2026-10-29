# Atualização: questões completas, paginação e barra lateral

Substitua `bank-api.js`, `public/bank.html`, `public/bank.js`, `public/bank.css`, `public/index.html` e `public/styles.css` na pasta `estudo-em-dupla` do GitHub.

O Render deve redeployar automaticamente. Não é preciso SQL.

- São exibidas até **10 questões completas** por página.
- A navegação anterior/próxima mantém histórico de respostas, recuperado do Supabase.
- Aplicar ou mudar um filtro permite responder novamente (sem apagar as tentativas anteriores) e sinaliza respostas passadas.
- Sem filtro, exibe questões publicadas por ordem de cadastro.
- Barra lateral na página inicial e no banco; no desktop expande ao passar mouse; no celular abre via botão.
- Estatísticas acessadas pela navegação.

Nota: o histórico requer Supabase configurado. Questões não publicadas ou sem gabarito não aparecem.

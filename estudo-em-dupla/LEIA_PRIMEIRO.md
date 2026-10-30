# Correção das fórmulas LaTeX — Estudo em Dupla

Esta atualização é **aditiva**: não substitua seus arquivos atuais `bank.js`, `app.js`, `bank.html` ou `index.html` por versões antigas.

1. Envie o arquivo `public/math-support.js` para a pasta `estudo-em-dupla/public/` do repositório GitHub.
2. No arquivo `estudo-em-dupla/public/bank.html`, adicione antes de `</head>`:

   `<script src="/math-support.js" defer></script>`

3. Faça o mesmo em `estudo-em-dupla/public/index.html`.
4. Faça commit; aguarde o Render publicar; pressione Ctrl+F5.

Funciona para fórmulas LaTeX que venham delimitadas por `\\(...\\)`, `\\[...\\]` ou `$$...$$`. Exemplos: `\\(p \\leftrightarrow q\\)`, `\\(p \\vee q\\)`, `\\(\\neg p\\)`.

Não corrige automaticamente LaTeX malformado ou texto que contenha apenas comandos soltos sem delimitadores. No JSON, preserve as barras invertidas escapadas, como `"\\\\(p \\\\vee q\\\\)"`.

A renderização utiliza KaTeX via CDN, portanto requer conexão e que o navegador consiga carregar arquivos de cdn.jsdelivr.net. Caso o CDN esteja bloqueado, o texto original permanece visível.

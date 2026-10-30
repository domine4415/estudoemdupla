# Exibir comentários nas salas — atualização pontual

Substitua os arquivos `public/app.js` e `public/styles.css` no repositório GitHub (pasta `estudo-em-dupla`).

A atualização usa o comentário já presente nas questões importadas. O servidor somente envia o comentário quando a questão está com respostas reveladas; o convidado também o recebe. A caixa abaixo das alternativas passa a mostrar um resumo do resultado e a seção **COMENTÁRIO DO PROFESSOR**, interpretando `##`, `###`, `**negrito**`, `==grifo==` e `__sublinhado__` como texto seguro.

Se a questão não tem comentário, aparece um aviso. Não precisa alterar o Supabase ou rodar SQL. Teste depois do Render chegar a Live, com Ctrl+F5. A atualização parte do ZIP anterior de riscar alternativas; se você adicionou outras mudanças a app.js/styles.css desde então, mescle as alterações em vez de substituir cegamente.

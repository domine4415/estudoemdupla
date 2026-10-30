# Atualização: evitar duplicação por código original

1. Antes da migração, faça backup/exportação das tabelas `dupla_bank_questions` e `dupla_bank_attempts` no Supabase. Recomenda-se um backup completo do projeto.
2. Abra **Supabase > SQL Editor** e execute `ATIVAR_ID_UNICO.sql` **uma única vez**. Ele vincula as questões antigas pelos códigos de `data.originalId`; se houver registros duplicados com o mesmo código, mantém o mais antigo, transfere todas as tentativas para ele e exclui os duplicados.
3. No GitHub, substitua `estudo-em-dupla/bank-api.js` e `estudo-em-dupla/public/bank.js` pelos dois arquivos incluídos nesta atualização.
4. Faça commit, aguarde o Render ficar Live e recarregue a página com Ctrl+F5.
5. Importe novamente um JSON cujo ID original seja numérico. O resultado da importação agora informa `created`, `updated` e `duplicatesInFile` na resposta da API. Questões com código já cadastrado são atualizadas, com o mesmo UUID e histórico de respostas.

Regras: código original primeiro; sem código, usa hash do enunciado. Código não numérico de questão manual fica sem ID original. Arquivos precisam ter autorização de uso/redistribuição. A migração é uma alteração real no banco: faça backup antes.

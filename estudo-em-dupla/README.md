# Estudo em Dupla

Aplicativo Node.js com salas de estudo ao vivo, banco individual de questões, login e histórico no Supabase.

## Executar no computador

Instale Node.js 20 ou superior. Abra `INICIAR_WINDOWS.bat` ou execute `npm start` nesta pasta. Acesse http://localhost:3000 e mantenha o servidor aberto. Não abra os arquivos HTML diretamente.

Não é necessário instalar bibliotecas para executar: o servidor usa recursos nativos do Node.js. O login e o banco permanente dependem da configuração do Supabase.

## Configurar Supabase

No SQL Editor do seu projeto, execute os arquivos necessários nesta ordem:

1. `supabase.sql`: armazenamento das salas.
2. `BANCO_SQL.sql`: questões, respostas individuais e funções de estatísticas.
3. `ATIVAR_ID_UNICO.sql`: identifica questões pelo código original e reúne duplicatas, preservando as tentativas. Faça backup antes, pois esse script altera registros existentes.
4. `ATIVAR_EXCLUSAO_LOTES.sql`: rastreamento das novas importações para exclusão por lote.

Os scripts são mantidos para instalação e manutenção; não são executados automaticamente pelo aplicativo. Não é necessário executá-los novamente só por publicar mudanças de interface.

Em Authentication, habilite o provedor Email. Configure a Site URL com o endereço do aplicativo. Se a confirmação de e-mail estiver habilitada, confirme a conta antes de entrar.

Configure as variáveis no ambiente do servidor:

| Variável | Finalidade |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta, utilizada somente no servidor |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública para autenticação |
| `ADMIN_EMAIL` | E-mail da conta administradora; há um padrão definido em `server.js` |
| `ADMIN_USER_ID` | Opcional: restringe o administrador ao UUID da conta |
| `PORT` | Porta do servidor; padrão 3000 |

A conta administradora precisa ter e-mail confirmado. Não publique chaves secretas ou arquivos `.env`. Sem Supabase configurado, as salas usam memória e o banco permanente fica indisponível; o uso autenticado exige configurar o login.

## Publicar

Envie o projeto ao GitHub mantendo `server.js`, `bank-api.js`, `topic.js`, `package.json` e a pasta `public` na mesma estrutura. No Render, use um serviço web Node.js com `npm install` como comando de construção e `npm start` como inicialização. O arquivo `render.yaml` também descreve o serviço.

O Root Directory deve apontar para a pasta que contém `package.json`: deixe vazio se os arquivos estão na raiz do repositório; use `estudo-em-dupla` se estão nessa subpasta. Configure as variáveis do Supabase no serviço.

Após publicar, aguarde o serviço ficar disponível e atualize o navegador. `/api/health` informa o estado de configuração do armazenamento e da autenticação; também teste login, banco e salas para verificar o funcionamento completo.

## Utilizar

- **Banco de questões:** filtre, responda e consulte gabarito e comentário. O histórico é individual.
- **Estatísticas:** filtre por matéria, tópico, banca e período das respostas. Acertos e erros consideram a última resposta de cada questão dentro do período, no horário de Brasília.
- **Administrador:** em Gerenciar questões, importe JSON, crie e edite questões, renomeie tópicos e exclua seleções. Questões sem gabarito ficam como rascunho.
- **Renomear tópico:** selecione a disciplina, o tópico atual e o novo nome. Para reunir tópicos, use o mesmo novo nome em cada um. As respostas são preservadas.
- **Salas:** o administrador cria e controla a sala; outra conta entra como convidada. É possível importar JSON ou carregar questões publicadas no banco.
- **Alternativas:** dois cliques rápidos riscam ou desriscam uma alternativa. A marcação é temporária no navegador.

Importe somente questões próprias ou com autorização de disponibilização. `exemplo_questoes_autorais.json` serve para testar o formato. `PROMPTQUESTÕES.txt` é um material auxiliar para preparar questões; não é utilizado pelo servidor.

## Arquivos

| Arquivo ou pasta | Uso |
|---|---|
| `server.js` | Servidor, autenticação, salas e entrega das páginas |
| `bank-api.js` | Banco de questões e operações administrativas |
| `topic.js` | Normalização e filtros de tópicos |
| `public/` | Páginas, estilos e funcionalidades no navegador |
| `package.json` | Comando de inicialização e versão mínima do Node.js |
| `render.yaml` | Configuração de publicação |
| `INICIAR_WINDOWS.bat` | Inicialização local no Windows |
| `*.sql` | Instalação e manutenção do banco |

## Resolver problemas

Se não conectar, confira se o servidor está aberto e se você está usando o endereço dele, em vez de abrir HTML diretamente. Na hospedagem, publique o projeto completo: enviar apenas `public/` não executa o servidor.

Se login ou gravação falharem, confira as variáveis, tabelas, confirmação do e-mail e os registros do serviço. Mantenha os JSONs originais e backups do Supabase. Salas antigas podem depender do token salvo no navegador original; novas salas são associadas às contas.

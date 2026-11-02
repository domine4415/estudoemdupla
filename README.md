# ESTUDO POLICIAL

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

O Root Directory deve apontar para a pasta que contém `package.json`: deixe vazio se os arquivos estão na raiz do repositório; informe o nome exato da subpasta se os arquivos não estão na raiz. Configure as variáveis do Supabase no serviço.

Após publicar, aguarde o serviço ficar disponível e atualize o navegador. `/api/health` informa o estado de configuração do armazenamento e da autenticação; também teste login, banco e salas para verificar o funcionamento completo.

## Utilizar

- **Banco de questões:** filtre, responda e consulte gabarito e comentário. O histórico é individual.
- **Estatísticas:** filtre por matéria, tópico, banca e período das respostas. Acertos e erros consideram a última resposta de cada questão dentro do período, no horário de Brasília.
- **Administrador:** em Gerenciar questões, importe JSON, crie e edite questões, renomeie tópicos e exclua seleções. Questões sem gabarito ficam como rascunho.
- **Renomear tópico:** selecione a disciplina, o tópico atual e o novo nome. Para reunir tópicos, use o mesmo novo nome em cada um. As respostas são preservadas.
- **Salas:** qualquer conta autenticada pode criar, definir capacidade e senha opcional. As questões são selecionadas do banco; importação por JSON e acesso ao gabarito não estão disponíveis na sala.
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


## Aulas de teoria

Execute `TEORIA_SQL.sql` no SQL Editor do Supabase para criar a tabela de aulas (sem alterar as questões ou salas). Publique também `theory-api.js`, `server.js`, a pasta `public` atualizada e os demais arquivos necessários do projeto.

Acesse **Teoria** na página inicial ou no menu do banco. O administrador verá **Criar aula**. Informe título, disciplina e tópico, cole o conteúdo em Markdown e use **Inserir imagem** para adicionar PNG, JPG ou WebP na posição do cursor. Imagens são otimizadas e guardadas na própria aula, até 4 MB no total. O modelo de formatação fica no editor. Ao colar com Ctrl+V, o editor converte conteúdo formatado ou HTML para o formato seguro das aulas. Títulos, listas, tabelas e quadros identificáveis são aproveitados; código ativo não é executado.

Confira a prévia e salve como rascunho ou marque **Publicar para os alunos**. Só administradores podem ver rascunhos, editar e excluir. Alunos autenticados podem filtrar e abrir as aulas publicadas. **Imprimir / Salvar PDF** permite usar a impressão do navegador para exportação. O formato visual das aulas é padronizado automaticamente, incluindo a página de impressão.


### Copiar aulas e quadros do ChatGPT

Na edição da aula, copie a resposta do ChatGPT e cole no conteúdo com Ctrl+V. A conversão aproveita a formatação disponível na área de transferência e mostra a prévia automaticamente. Quadros com bordas ou cores e grades identificáveis são convertidos para blocos padronizados. Uma cópia apenas em texto não inclui as cores ou o desenho original; para garantir mapas e quadros específicos, use o botão **Copiar instruções para o ChatGPT**, gere a aula e cole a resposta inteira. Não é preciso montar cada bloco manualmente.

É possível colar imagens diretamente no campo. Imagens que vierem como arquivo ou dados são salvas com a aula; imagens copiadas como link HTTPS dependem da disponibilidade e permissão do endereço original. A cópia de um texto não garante que as imagens também venham. O editor informa quando identificar imagens ausentes.

Os modelos opcionais incluem quadros de resumo, mapas com blocos verdes/vermelhos/azuis/amarelos, tabelas e imagens lado a lado. Também é possível importar arquivos .md ou .txt. Não há alteração do banco de dados para essa atualização; publique `public/theory.html`, `public/theory.js` e `public/theory.css`.


### Grifos dos usuários

Execute novamente `TEORIA_SQL.sql` atualizado para criar `policial_lesson_highlights`. Publique `server.js`, `theory-api.js` e os arquivos atualizados de `public/`, incluindo `theory-highlights.js`. Na leitura da aula, o usuário seleciona o texto e escolhe amarelo, verde ou azul; para apagar, seleciona o trecho e usa Remover grifo. O salvamento no Supabase é automático e vinculado à conta e à aula. Os grifos podem ser recuperados em outros dispositivos. O servidor sempre usa o usuário autenticado; não aceita outro identificador de conta enviado pelo navegador. Se o texto da aula mudar, grifos cuja posição não corresponde mais ao trecho original não são exibidos.


### Organização da Central de Teoria

A entrada mostra disciplinas; cada disciplina abre seus tópicos. Dentro de um tópico aparecem os subtópicos e as aulas cadastradas sem subtópico. O campo Subtópico é opcional no editor. Exemplo: Língua Portuguesa → Sintaxe → Sujeito → Tipos de sujeito. As aulas existentes ficam diretamente nos tópicos até serem reclassificadas. Execute novamente TEORIA_SQL.sql para adicionar a coluna subtopic e publique theory-api.js e os arquivos atualizados da pasta public.


### Concursos na teoria

Execute TEORIA_SQL.sql atualizado para criar policial_contests e adicionar contest_id às aulas. Publique theory-api.js e public/theory.html, public/theory.js e public/theory.css atualizados. O administrador cadastra e edita concursos no botão Gerenciar concursos, com nome e imagem por link direto HTTPS do Imgur (por exemplo https://i.imgur.com/abc123.png). Links de álbuns não são aceitos. A imagem permanece no Imgur; apenas a URL é armazenada no Supabase. Na edição da aula, escolha o concurso. Aulas anteriores ficam em Conteúdo geral até serem classificadas. A navegação passa a Concurso → Disciplina → Tópico → Subtópico opcional → Aula. Somente aulas publicadas são listadas para os alunos; concursos cadastrados podem aparecer mesmo quando ainda não possuem aulas publicadas.


### Compartilhar aulas entre concursos

Execute TEORIA_SQL.sql atualizado e publique theory-api.js e os arquivos theory.html, theory.js e theory.css de public. No editor, marque todos os concursos em Concursos desta aula. A aula permanece com um único registro; aparece nas disciplinas e tópicos de cada concurso marcado, e qualquer edição atualiza o mesmo conteúdo em todos eles. Os vínculos antigos são preservados pela migração. Sem concursos marcados, fica em Conteúdo geral. Os grifos continuam associados à mesma aula e à conta do usuário.


### Chamada de voz nas salas

Publique server.js, public/index.html, public/app.js, public/room-voice.js e public/styles.css atualizados. Cada participante entra na mesma sala, clica em Entrar na chamada e autoriza o microfone. Pode silenciar e sair da chamada sem sair da sala. Sair da sala ou fechar a página interrompe a captura do microfone. A voz usa WebRTC entre os dois participantes, sem gravação no banco. A negociação passa pelo servidor da sala e exige autenticação e credenciais da sala.

O site deve ser aberto por HTTPS (ou localhost para desenvolvimento). O servidor STUN padrão auxilia a conexão direta. Algumas redes bloqueiam conexões diretas; para suportá-las, configure VOICE_ICE_SERVERS no ambiente do servidor com um array JSON de servidores ICE, incluindo TURN com credenciais válidas. Exemplo de formato: [{"urls":"stun:seu-servidor:3478"},{"urls":"turn:seu-servidor:3478","username":"usuario","credential":"senha"}]. Credenciais ICE são entregues somente aos participantes autenticados; use credenciais TURN com prazo limitado quando disponíveis. Não é necessário SQL para ativar a chamada. Valide o áudio com duas contas em dispositivos e redes diferentes após publicar.


## Salas em grupo — regras atuais

- Qualquer conta com login pode criar uma sala e participar das salas de outras contas.
- O criador define a capacidade de 2 a 20 pessoas, contando com ele, e escolhe entrada aberta ou protegida por senha (4 a 100 caracteres). A senha é armazenada como hash com salt; o login continua obrigatório.
- Cada sala carrega somente questões publicadas no banco. Não aceita importação JSON, edição de questões ou edição/consulta de gabarito. Nenhum participante, nem o dono, recebe gabarito ou comentário da questão pela API da sala. O banco individual mantém suas regras próprias.
- O dono escolhe questões, navega e pode revelar as escolhas dos participantes. Quando todos respondem, as escolhas também são reveladas. Isso não revela o gabarito.
- A sala encerra após 30 minutos sem atividade de nenhum participante. Entrar, responder, navegar, escolher questões e interagir na página atualiza a atividade. Consultas automáticas de estado e a conexão aberta não impedem a expiração. A verificação periódica ocorre a cada 30 segundos, e os acessos também verificam o prazo.
- Quem sai libera a vaga, exceto o dono, que mantém a propriedade da sala. O encerramento é persistido no Supabase; a sala sai do catálogo. Salas antigas são adaptadas ao serem acessadas.
- A chamada de voz usa uma conexão WebRTC para cada par de participantes. Redes que bloqueiam conexão direta podem exigir configurar TURN. Teste o áudio em dispositivos reais depois da publicação.

Para publicar esta versão, envie `server.js`, o novo `rooms-api.js`, `topic.js` e a pasta `public` atualizada. Não exige novo SQL: as configurações e participantes são guardados no estado JSON da tabela de salas existente. As mudanças nas salas não alteram as permissões de administração do banco e das aulas.

Verificação automatizada das regras: `node --test tests/rooms-api.test.cjs`.


## Comunidade, perfis e conquistas

Antes de publicar, execute `COMUNIDADE_SQL.sql` no Supabase SQL Editor (é separado dos scripts de teoria). O script cria perfis, amizades, convites, respostas elegíveis e troféus, com acesso somente pelo servidor. Publique `server.js`, `rooms-api.js`, o novo `community-api.js` e a pasta `public` completa, incluindo community.html, community.js, community.css e presence.js.

Acesse **Comunidade e perfil** na Home ou na barra lateral. Em **Meu perfil**, escolha o nome público, a biografia e uma foto do celular/computador. O navegador recorta a foto em quadrado e reduz para 256 pixels antes do envio; ela é salva no Supabase e aparece também ao lado do nome na sala. Perfis novos começam com um nome genérico até a pessoa editar. O e-mail de autenticação não é retornado pelos perfis públicos.

A aba Pessoas lista usuários com perfil, com busca pelo nome e filtro online. A presença é renovada a cada 45 segundos nas abas visíveis; sem renovação por 90 segundos o usuário deixa de constar como online. O visto por último usa a última presença visível. O modo invisível esconde tanto online quanto visto por último de outras pessoas, sem esconder a biografia ou os troféus.

Amizades exigem solicitação e aceitação. É possível cancelar, recusar e desfazer amizade. Convites podem ser enviados a outras pessoas para salas abertas em que o remetente participa. Expiram em 30 minutos, não ignoram senha ou capacidade e podem ser dispensados. Solicitações e convites aparecem na Comunidade e são indicados no botão da navegação. Abrir o perfil de outra pessoa mostra nome, foto, biografia e conquistas; na sala, clique no nome do participante para abrir o perfil.

Troféus iniciais: primeira questão, 100 questões, 1.000 questões, 10 acertos seguidos e 20 acertos seguidos em salas. A contagem começa após ativar esta atualização; não reconstrói respostas antigas. A mesma questão na mesma sala conta uma vez, considerando a primeira resposta. Questões em salas diferentes contam como novas participações. A verificação é feita no servidor, usando o gabarito interno, sem enviar a resposta correta ao navegador. Uma função transacional no banco impede contagens duplicadas e mantém as sequências entre salas. Sem gabarito interno, a questão não gera conquista. Os totais são de todas as salas, não de uma única sala.

Verificação das regras de salas e comunidade: `node --test tests/rooms-api.test.cjs tests/community-api.test.cjs`.


### Home e navegação das salas

A Home concentra os cartões de acesso e os botões Perfil e Sair da conta. Sem e-mail exibido, sem barra extra de navegação e sem formulários ou listagem de salas nessa tela. Salas ao vivo abre /?view=salas; Criar sala abre /?action=criar. O nome do participante vem do perfil e não pode ser alterado no formulário da sala; para mudar, use Meu perfil. O servidor usa o perfil autenticado mesmo que alguém tente enviar outro nome.


### Voz, avisos e controles das salas

A lista de participantes mostra barras animadas conforme o volume real de cada microfone na chamada, tanto local quanto remoto. Na página de salas/criação, o cabeçalho redundante fica oculto; dentro da sala, ficam somente Sala, código e Copiar link, além da navegação lateral e do botão Voltar.

O dono pode definir, trocar ou remover a senha em Editar senha da sala, sem desconectar quem já entrou. Pode também Expulsar um participante: corta sua conexão com a sala e o áudio e libera a vaga. Expulsão não bloqueia a conta; a pessoa pode entrar novamente se houver vaga e respeitando a senha atual.

Solicitações de amizade e convites mostram contador vermelho nos acessos da comunidade e nas abas correspondentes. Um novo aviso aparece dentro do site e toca um som curto, após a primeira interação com a página liberar o áudio. Os eventos são enviados por conexão persistente, com verificação a cada 10 segundos como alternativa. Esse aviso é do site aberto, não uma notificação do sistema com o navegador fechado.

Para atualizar, publique rooms-api.js, community-api.js e a pasta public atualizada. Não exige novo SQL em relação à versão da Comunidade.


### Atualização de exibição e embaralhamento nas salas

Comunidade aparece por último na navegação. Os itens laterais ganham brilho ao passar o mouse ou receber foco. As escolhas dos participantes são mostradas somente na lista Ao vivo; foram removidas a cópia dessas escolhas abaixo da questão e as mensagens redundantes de Informações da sala.

A correção agora é exibida para todos após a revelação: gabarito e comentário da questão, quando disponíveis. Antes disso, esses campos continuam ausentes, inclusive para o dono. A lista interna de questões do dono também não inclui o gabarito. Os contadores C (acertos) e X (erros) ao lado do participante somam somente questões já reveladas do conjunto atual.

Ao carregar um conjunto do banco, a ordem das questões e as alternativas são embaralhadas no servidor, uma vez para toda a sala, sem alterar as questões originais do banco. A letra correta acompanha o texto da alternativa após a reorganização. Certo/errado mantém suas letras semânticas C/E. Opções que dependem de ordem ou referências a outras alternativas são preservadas. A ordem fica salva junto da sala. Para aplicar às salas que já possuem questões, carregue novamente o conjunto.

Publique rooms-api.js, o novo room-questions.js e a pasta public atualizada. Não precisa de SQL novo.


### Estatísticas incluindo respostas das salas

Execute COMUNIDADE_SQL.sql atualizado para adicionar matéria, tópico e banca ao registro de respostas das salas. Publique bank-api.js, community-api.js e public/bank.html. O resumo e as estatísticas passam a somar o banco individual e as salas. O banco usa a última resposta por questão no período; cada sala contribui com a primeira resposta por questão, sem contar reenvios. Filtros de data, matéria, tópico e banca se aplicam às duas origens. Registros antigos de salas usam a classificação da questão correspondente no banco quando ela ainda está disponível; sem correspondência, aparecem como Não classificada no total sem filtros.


### Chat recolhível da sala

O botão Chat abre o histórico da sala. Quando fechado, uma nova mensagem de outra pessoa aparece por 6,5 segundos num balão, com nome e texto, e incrementa o contador de não lidas. Abrir o chat zera o contador. As últimas 100 mensagens são salvas no estado da sala no Supabase, com até 1.000 caracteres por mensagem. O envio atualiza a atividade da sala. Somente participantes atuais têm acesso; ao sair ou ser expulso, o chat é fechado e deixa de receber mensagens. O texto é mostrado sem executar HTML.

Publique server.js, rooms-api.js e a pasta public atualizada, incluindo room-chat.js e room-chat.css. Não exige SQL novo.


### Filtros avançados para carregar questões nas salas

O dono pode combinar disciplina e assunto com banca, ano, tipo (certo/errado ou múltipla escolha), excluir desatualizadas e somente inéditas. Histórico: todas, não resolvidas pelo dono, não resolvidas nesta sala, ou não resolvidas por um participante atual escolhido pelo nome. O histórico de uma pessoa combina banco individual e respostas das salas. O histórico da sala considera qualquer resposta registrada nela, inclusive em conjuntos carregados anteriormente. O servidor valida que a pessoa selecionada ainda pertence à sala e não retorna o histórico detalhado aos outros participantes.

As marcações de inédita e desatualizada são editoriais: ficam no editor administrativo da questão e também podem vir do JSON pelos campos booleanos isOriginal/inedita e isOutdated/desatualizada. “Somente inéditas” não significa “ainda não resolvidas”: só inclui questões explicitamente classificadas. “Remover desatualizadas” exclui as marcadas como tal. Questões antigas sem marcação de inédita ficam fora desse filtro. As duas opções também estão nos filtros do banco individual.

A seleção procura questões elegíveis além da primeira página do banco até preencher o limite ou esgotar os resultados; o conjunto selecionado continua sendo embaralhado. Publique rooms-api.js, o novo room-bank-filter.js, bank-api.js e a pasta public atualizada. Não exige SQL novo, pois as classificações usam o JSON já armazenado nas questões e o histórico existente.


### Troca de resposta antes da revelação

O participante pode trocar a alternativa escolhida enquanto a questão não foi revelada. Quando todos respondem ou o dono revela as escolhas, a resposta fica definitiva. Acertos, erros, estatísticas e troféus usam a última escolha registrada antes da revelação. Avançar para outra questão, trocar o conjunto ou encerrar a sala também finaliza as respostas existentes. Publique rooms-api.js e public/app.js atualizados; não exige SQL novo.

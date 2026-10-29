# Conectar o Estudo em Dupla ao Supabase

Esta atualização permite que as salas (questões importadas, respostas, gabaritos e nomes) sobrevivam aos reinícios do Render. O aplicativo mantém sincronização em tempo real enquanto uma sala está ativa.

## 1) Supabase: criar a tabela

1. No projeto `estudoemdupla`, acesse **SQL Editor** → **New query**.
2. Abra `supabase.sql` deste ZIP, copie todo o conteúdo, cole no editor e clique em **Run**.
3. Vá a **Table Editor**: a tabela `dupla_rooms` deverá aparecer.

## 2) Render: configurar segredo sem expô-lo

1. Supabase: **Project Settings** → **API Keys** → copie uma **Secret key** (`sb_secret_...`). Se não tiver, crie uma na página API Keys.
2. Render: abra o serviço **estudoemdupla** → **Environment** → **Add Environment Variable**:

   - `SUPABASE_URL` = a Project URL mostrada no Supabase (começa em `https://` e termina em `.supabase.co`)
   - `SUPABASE_SECRET_KEY` = chave **Secret** começando com `sb_secret_...`

3. Salve e faça deploy. **NUNCA** envie a chave para GitHub, screenshot, chat ou JavaScript do navegador. Não é necessário alterar `package.json`.

## 3) Atualizar GitHub

1. Abra o repositório **estudoemdupla** e entre na pasta `estudo-em-dupla`.
2. Substitua os arquivos `server.js`, `public/app.js`, `public/index.html`, `public/styles.css` pelos do ZIP. Acrescente `supabase.sql` se quiser documentação no repositório. **Não envie chaves nem .env**.
3. Faça Commit changes. O Render costuma implantar automaticamente, ou use Manual Deploy → Deploy latest commit.

> Se o GitHub mantiver uma pasta `estudo-em-dupla` como raiz de execução, mantenha o campo Root Directory do Render em `estudo-em-dupla`.

## 4) Verificar

Abra `https://SEU-SERVICO.onrender.com/api/health`.

- `{"status":"ok","storage":"supabase"}` → banco configurado.
- `{"status":"ok","storage":"memory"}` → funcionando sem banco; confira as variáveis no Render.

Crie uma sala, importe um JSON, responda uma questão, anote o link da sala. Reinicie o serviço Render e abra o mesmo link **no mesmo navegador**: as questões e respostas devem retornar.

## Observações importantes

- O histórico está associado ao **código da sala e ao token salvo no navegador**, não a uma conta com login. Se limpar os dados do navegador ou clicar em “Sair desta sala”, você poderá perder o acesso à sala como anfitrião, embora ela permaneça no banco. Guarde o navegador e o link da sala.
- O banco grava salas completas. Ainda **não existe** uma biblioteca de cadernos entre salas, cadastro de usuários ou tela de pesquisa de questões; essas funções podem ser adicionadas depois.
- A expiração de 12 horas passa a descartar somente a cópia em memória, **não os dados guardados no Supabase**.
- O servidor usa a chave secreta, e o banco tem RLS habilitada. Cada participante usa um token de sala no navegador. Não compartilhe links/tokens com desconhecidos.
- O projeto do Supabase pode ficar inativo conforme as regras do plano; acompanhe os avisos no painel. Para evitar perda acidental, exporte seus arquivos de questões periodicamente.
- Se a gravação no Supabase falhar, a API retornará erro; confira os logs no Render. Para não perder dados durante a configuração, guarde seu JSON original.
- A reutilização de questões de terceiros deve respeitar os termos da plataforma e permissões aplicáveis.

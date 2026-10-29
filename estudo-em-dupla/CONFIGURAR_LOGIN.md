# Login com Supabase Auth — Estudo em Dupla

## 1. Supabase

Abra **Authentication → Providers → Email** e habilite login por e-mail/senha.
Se **Confirm email** estiver ativo, o Supabase envia confirmação; o cadastro só poderá entrar depois da confirmação.
Em **Authentication → URL Configuration**, configure a **Site URL** com o endereço HTTPS do seu app no Render (ex.: `https://SEU-SERVICO.onrender.com`).

## 2. Render → Environment

Além das variáveis que já estavam configuradas, inclua esta terceira:

| Key | Valor |
|---|---|
| `SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
| `SUPABASE_SECRET_KEY` | Sua chave secreta `sb_secret_...` (NUNCA colocar no GitHub) |
| `SUPABASE_PUBLISHABLE_KEY` | Sua chave pública `sb_publishable_...` (Supabase → Configurações → Chaves de API) |

**NÃO** substitua a `SUPABASE_SECRET_KEY` pela pública: o aplicativo utiliza as duas para finalidades distintas.

Salve as variáveis e publique novamente.

## 3. Atualização do GitHub

Extraia o ZIP. Na pasta `estudo-em-dupla` do seu repositório, substitua os arquivos `server.js`, `public/app.js`, `public/styles.css` e `public/index.html`; inclua este documento.

Se o Render estiver configurado com root directory `estudo-em-dupla`, mantenha a mesma estrutura.

## 4. O que o login protege

- Para usar as salas, criar sala, enviar JSON ou responder, precisa entrar em uma conta válida.
- Cada sala passa a ser vinculada à conta do criador e à conta do convidado.
- O código de convite só permite uma nova entrada de convidado quando houver vaga; não dá acesso às respostas ou aos controles sem login.
- Salas antigas podem ser recuperadas por quem ainda possui o token da sala no mesmo navegador.
- A sessão de login é mantida em cookies HttpOnly e renovada pelo servidor.

**Importante:** a migração de salas antigas exige que o usuário que as criou tenha o token original no navegador. O login não migra todas as salas automaticamente para uma conta. Para recuperar histórico em outros dispositivos, as salas novas ficam associadas à identidade do usuário. O banco `dupla_rooms` continua sendo necessário para armazenamento permanente.

## 5. Testes

1. Entre em `https://SEU-SERVICO.onrender.com/api/health` e confirme `"auth":"supabase"` e `"storage":"supabase"`.
2. Crie uma conta por **Criar conta**. Se solicitado, confirme o e-mail.
3. Faça login e crie uma sala.
4. Abra o link no celular de seu amigo e peça para ele cadastrar uma conta diferente e entrar.
5. Atualize a página; a sala deve continuar acessível.

## Observação

Esta versão não implementa a recuperação de senha por e-mail na interface. Use o painel do Supabase para administrar usuários caso a senha se perca, ou adicione um fluxo de redefinição de senha em uma próxima versão.

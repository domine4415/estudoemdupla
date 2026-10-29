# Administrador e salas abertas — Estudo em Dupla

## O que mudou

- Somente a conta Supabase com e-mail **domineoliveira.mcz@gmail.com** confirmado pode criar salas.
- Os outros usuários entram com suas contas, veem **Salas abertas** e clicam em **Entrar**.
- Cada sala aceita somente **1 convidado por vez**, como na versão anterior. Salas ocupadas aparecem com o status **Ocupada**; não é possível entrar nelas enquanto tiver convidado vinculado.
- O administrador pode importar JSON, controlar questões, revelar gabarito e **Encerrar sala**. Salas encerradas saem da lista, mas seus dados continuam salvos no Supabase.
- O catálogo de salas é consultado no servidor com Supabase. Não precisa criar tabela adicional nem executar SQL novo se `dupla_rooms` já existe.

## Segurança do administrador

O servidor valida e-mail e **email_confirmed_at** no Supabase Auth (não confia apenas em dados enviados pelo navegador). A configuração opcional `ADMIN_USER_ID` no Render pode restringir mais a permissão ao UUID de uma única conta. Se definir `ADMIN_USER_ID`, mantenha o e-mail `ADMIN_EMAIL` correto. Para confirmar o e-mail do administrador, use Supabase → Authentication → Users.

Variáveis do Render: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` (já existentes). `ADMIN_EMAIL` é opcional; o e-mail informado já é o padrão. Recomenda-se adicionar `ADMIN_USER_ID` para reforço.

## Atualizar no GitHub

1. Extraia o ZIP.
2. Entre em `estudoemdupla / estudo-em-dupla` no GitHub.
3. Substitua **server.js**, **public/index.html**, **public/app.js**, **public/styles.css** e adicione este `README_ADMIN.md` mantendo a mesma estrutura.
4. Salve (**Commit changes**). O Render deve publicar automaticamente.
5. Aguarde **Live**, faça login com o e-mail de admin e confira o botão Criar sala.
6. Faça login com outra conta, confirme a lista Salas abertas e teste Entrar.

### Observações

O antigo endpoint `/api/health` só confirma a configuração das variáveis. É preciso testar login e salas no site real. Nenhuma chave do Supabase deve entrar no repositório.

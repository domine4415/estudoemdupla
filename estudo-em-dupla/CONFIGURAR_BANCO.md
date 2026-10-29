# Estudo em Dupla — Banco individual de questões

Esta versão acrescenta um banco de questões independente das salas. **Não apaga salas existentes.** O login, o administrador e o Render continuam os mesmos.

## 1. Criar as novas tabelas no Supabase

No projeto Supabase que já está em uso, abra **SQL Editor → New query**, cole TODO o conteúdo de `BANCO_SQL.sql` e clique em **Run**. Você verá as tabelas `dupla_bank_questions` e `dupla_bank_attempts` no Table Editor. O SQL pode ser executado novamente sem apagar dados, mas convém guardar backup antes de alterações futuras.

Não use `supabase.sql` antigo nesta etapa: o novo arquivo **BANCO_SQL.sql** adiciona as tabelas do banco e não altera as salas existentes.

## 2. Atualizar o GitHub

O repositório atual tem a pasta `estudo-em-dupla` configurada no **Root Directory** do Render. No GitHub, atualize **dentro dessa pasta**:

- `server.js` (substituir)
- `bank-api.js` (adicionar)
- `public/index.html`, `public/app.js`, `public/styles.css` (substituir)
- `public/bank.html`, `public/bank.js`, `public/bank.css` (adicionar)
- `BANCO_SQL.sql`, `CONFIGURAR_BANCO.md`, `exemplo_questoes_autorais.json` (adicionar, facultativos para executar)

Não crie `estudo-em-dupla/estudo-em-dupla`. Se o GitHub não substituir arquivos pelo upload, abra o arquivo, clique em editar e faça o commit, ou utilize o GitHub Desktop. **Nunca suba `.env` ou suas chaves do Supabase.**

## 3. Aguardar Render

O Render deve publicar automaticamente após o commit. Mantenha:

- Root Directory: `estudo-em-dupla`
- Build Command: `npm install`
- Start Command: `npm start`
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` já configuradas.
- `ADMIN_EMAIL=domineoliveira.mcz@gmail.com` é opcional, pois este e-mail está no padrão do servidor. Você pode configurá-lo explicitamente no Render.

Espere o status **Live**. Abra `https://estudoemdupla.onrender.com/banco` e entre na sua conta.

## 4. Como funciona

**Administrador**: acessa **Banco de questões → Gerenciar questões**, importa JSONs e edita gabaritos, comentários e classificação. O arquivo de exemplo contém **duas questões originais** prontas para teste. Questões sem gabarito ficam como rascunho, invisíveis aos alunos. Também é possível **Criar questão original manualmente**.

**Participantes**: entram em `/banco`, filtram por **disciplina, tópico, banca, ano e palavras do enunciado**, respondem sozinhos e recebem gabarito/comentário após a resposta. O histórico é individual e permanente no Supabase.

**Salas**: continuam funcionando. Agora o administrador também pode carregar as questões publicadas no banco diretamente para uma sala usando o formulário **Carregar do banco**.

## 5. Formato do JSON

```json
{
  "questions": [
    {
      "statement": "Enunciado de questão autoral ou com uso autorizado",
      "type": "multiple_choice",
      "alternatives": [
        {"letter": "A", "text": "Primeira alternativa"},
        {"letter": "B", "text": "Segunda alternativa"}
      ],
      "correct": "A",
      "commentary": "Explicação original, revisada, da resposta.",
      "subject": "Direito Penal",
      "topic": "Crimes contra a vida",
      "board": "Banca de referência",
      "year": "2026"
    }
  ]
}
```

O aplicativo também consegue organizar JSONs com campos `statementHtml` e `metadata` de formatos antigos. É necessário revisar o resultado antes de publicar. Não adivinha gabaritos: se estiver ausente, a questão vira rascunho.

## Uso de material de terceiros

Importe e publique somente conteúdo que você criou, de domínio público ou que tenha **autorização de redistribuição**. Uma assinatura pessoal de um site de questões pode não autorizar cópia e publicação a terceiros. Os termos do TEC Concursos proíbem extração automatizada e fornecimento de conteúdo a sistemas de IA sem autorização expressa. Busque provas e materiais oficiais com direitos de reprodução adequados, ou elabore questões originais.

## Checklist de testes

1. Confirme `https://estudoemdupla.onrender.com/api/health`.
2. Acesse `/banco` com seu login de administrador.
3. Importe `exemplo_questoes_autorais.json` e marque a confirmação de autorização.
4. Entre com conta de usuário normal em outro navegador/celular.
5. Confira os filtros, responda, veja gabarito/comentário.
6. Feche, entre novamente e confira histórico.
7. Tente criar/editar questão pela conta comum: ela não deve ter acesso.
8. Crie sala e carregue as questões publicadas do banco.

### Observações

- Não geramos os comentários automaticamente no servidor; você pode criar comentários por conta própria ou com assistência de IA e colá-los no campo `commentary`, revisando as informações antes de publicar.
- A pontuação individual considera a **última resposta de cada questão**, não o total de tentativas.
- As salas antigas permanecem na tabela `dupla_rooms`. O novo banco usa as tabelas `dupla_bank_questions` e `dupla_bank_attempts`.

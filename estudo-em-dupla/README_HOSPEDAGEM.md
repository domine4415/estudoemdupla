# Publicar Estudo em Dupla no Render (plano gratuito)

## 1 — GitHub

1. Abra https://github.com/new e crie um repositório chamado `estudo-em-dupla`. Recomenda-se **Private**.
2. Extraia este ZIP.
3. No repositório, clique **Add file > Upload files** e envie o **conteúdo da pasta** `estudo-em-dupla` (incluindo a pasta `public`). Não envie o ZIP como um arquivo único.
4. Clique **Commit changes**. Confira que `server.js` e `package.json` estejam **na raiz do repositório** e que `public/index.html` exista na pasta `public`.
5. Não envie seus arquivos JSON de questões ao GitHub: importe-os só quando entrar na sala.

## 2 — Render

1. Abra https://dashboard.render.com/ e conecte sua conta do GitHub se solicitado.
2. Clique **New > Web Service** (não escolha Static Site).
3. Selecione o repositório `estudo-em-dupla` e configure:
   - Language/Runtime: `Node`
   - Branch: `main`
   - Root Directory: deixe em branco (porque `server.js` está na raiz)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type/Plan: **Free**
   - Health Check Path (se houver): `/api/health`
4. Clique **Create Web Service** e aguarde o status **Live**.
5. Abra o endereço `https://<nome-gerado>.onrender.com` fornecido pelo Render.
6. Teste `https://<nome-gerado>.onrender.com/api/health` — deve mostrar `{"status":"ok"}`.
7. Entre no aplicativo, clique **Criar sala**, importe seu JSON e clique **Copiar link** para enviar ao seu amigo. O celular deve abrir o endereço HTTPS do Render.

## Como testar

Abra a sala no computador e, em outro dispositivo/navegador, entre como convidado com o link. Responda às mesmas questões em cada dispositivo. As escolhas só ficam visíveis quando ambos responderem ou o anfitrião revelar.

## Avisos

- Render Free pode desligar o serviço após ~15 min sem solicitações recebidas e demorar para religar. A versão deste ZIP faz uma consulta a cada minuto enquanto a aba de estudo está visível, para manter a sessão ativa.
- As salas e respostas ficam **apenas na memória**, sem banco de dados. Reinicialização, atualização ou suspensão do servidor pode apagar a sala. Salve seu JSON original no computador.
- O link só dá acesso à sala; não divulgue o link ou o código para desconhecidos.
- Consulte as permissões aplicáveis antes de distribuir questões de terceiros.
- `INICIAR_WINDOWS.bat` serve apenas para executar localmente. O Render usa `npm start`.

# Estudo em Dupla

Aplicativo de estudos que importa o **JSON que você já captura**, separa os enunciados das alternativas e permite que duas pessoas respondam às mesmas questões, em tempo real.

## Começar no computador

1. Instale o **Node.js 20 ou superior**: https://nodejs.org/
2. Extraia esta pasta ZIP. No Windows, clique duas vezes em `INICIAR_WINDOWS.bat` (não abra `index.html` diretamente).
3. Abra um terminal dentro da pasta `estudo-em-dupla` e execute:

   ```bash
   node server.js
   ```

4. Abra http://localhost:3000 no navegador.
5. Clique em **Criar sala**, selecione seu arquivo `.json` e aguarde a importação. O arquivo de captura original é aceito **sem precisar editar**.
6. Clique em **Copiar link** para enviar ao amigo.

**Importante:** `localhost` funciona só no seu computador. Para seu amigo entrar em **outra rede** pelo celular, publique este projeto em um servidor Node.js com URL HTTPS, como Render, Railway ou similar. Se os dois estiverem na mesma rede Wi-Fi, o amigo pode abrir `http://IP-DO-SEU-COMPUTADOR:3000/?room=CODIGO`, desde que o firewall permita.

## Publicar online (exemplo em serviço com suporte a Node.js)

- Envie os arquivos deste projeto para um repositório privado no GitHub, sem subir JSON de questões ou outros dados pessoais.
- Crie um serviço web Node.js apontando para o repositório.
- Comando de inicialização: `node server.js`.
- Configure a variável de ambiente `PORT` caso a hospedagem exija (a maioria fornece automaticamente).
- Use o endereço HTTPS público gerado pelo serviço. Assim o link de sala abre também no celular em outra rede.

Este protótipo **não tem banco de dados**. As salas, questões e respostas ficam **em memória** no servidor. Reiniciar o serviço apaga as salas; salas inativas expiram após 12 horas. Não há autenticação por conta, criptografia local nem controle completo de acesso: não use para dados sensíveis. O endereço HTTPS fornece proteção de transporte quando configurado pela hospedagem.

## O que ele faz

- Importa JSON no formato exportado pelo seu capturador, com os campos `statement`, `statementHtml`, `alternatives`, `type`, `metadata`, `result`.
- Aproveita o HTML para capturar apenas o enunciado, sem menus, e recuperar banca, concurso, ano e ID original.
- Remove a repetição da letra nas alternativas (`A A resposta...` vira `A resposta...`).
- Reconhece questões de **certo ou errado** e acrescenta os botões **Certo / Errado** quando o JSON não os possui.
- Permite corrigir manualmente as questões mal capturadas.
- Salva as respostas independentes do anfitrião e do amigo. As escolhas são reveladas automaticamente após ambos responderem, ou manualmente pelo anfitrião.
- Avança e volta nas questões, sincronizando os dois dispositivos.
- Permite definir um gabarito manualmente; calcula pontuação somente quando há gabarito.
- Exporta uma versão limpa e organizada do JSON.

## Limitações

- **Não captura nada diretamente do TEC**: o aplicativo apenas aceita o arquivo `.json` fornecido por você.
- O arquivo original de exemplo tem **dois registros**. Na segunda questão as alternativas chegam vazias, mas como `type: true_false` o app acrescenta Certo / Errado.
- Um `result: null` significa que **não há gabarito importado**. O app não inventa a resposta.
- É recomendado revisar visualmente os enunciados que vierem truncados no próprio JSON.
- O conteúdo de terceiros só deve ser reutilizado ou compartilhado conforme as permissões e os termos aplicáveis.

## Estrutura

- `server.js` — servidor Node.js de sala e sincronização por SSE
- `public/index.html` — telas de criação, entrada e simulado
- `public/app.js` — importador, limpeza do JSON, navegação e votação
- `public/styles.css` — visual responsivo para computador e celular

Não há instalação de pacotes: o aplicativo usa somente recursos nativos do Node.js e do navegador.

## Se aparecer “Failed to fetch” ou “Não foi possível conectar ao servidor”

- **Não abra `public/index.html` diretamente** e não use a visualização estática de um editor ou serviço de hospedagem. As salas só funcionam com o servidor Node.js em execução.
- No Windows, inicie o arquivo `INICIAR_WINDOWS.bat` e **mantenha a janela do terminal aberta**.
- No navegador do PC, acesse exatamente **http://localhost:3000**. Não confunda com `file:///`, `localhost:5500` ou outro endereço.
- Caso o `INICIAR_WINDOWS.bat` feche ou exiba um erro, copie o texto do terminal. A porta 3000 pode estar ocupada ou o Node.js pode não estar instalado.
- **Se estiver hospedado online**, o servidor Node.js precisa estar publicado também. Apenas publicar os arquivos da pasta `public/` não funciona para criar salas.
- Se a página abre mas o erro persiste, experimente **http://localhost:3000/api/health**. O resultado correto é `{"status":"ok"}`.

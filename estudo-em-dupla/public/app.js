'use strict';
// Todas as informações trazidas do JSON são renderizadas como texto (nunca HTML externo).
const $ = id => document.getElementById(id);
let code=null,token=null,role=null,view=null,es=null,lastImported=null,toastTimer=null;
let signedIn=false,isAdminAccount=false,authMode='login';
function alertUser(text,error=false){const box=$('toast');box.textContent=text;box.className='toast'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.add('hidden'),4500);}
function connectionHint(){
  if(location.protocol==='file:')return 'O arquivo HTML foi aberto diretamente. Inicie pelo INICIAR_WINDOWS.bat e use http://localhost:3000.';
  if(['localhost','127.0.0.1'].includes(location.hostname) && location.port!=='3000')return 'Você abriu outra porta ('+(location.port||'padrão')+'). Use http://localhost:3000 com o servidor Node.js aberto.';
  if(['localhost','127.0.0.1'].includes(location.hostname))return 'O servidor pode ter sido encerrado. Inicie o aplicativo pelo INICIAR_WINDOWS.bat e mantenha a janela preta aberta.';
  return 'Este endereço não está conseguindo acessar o servidor Node.js. Uma hospedagem só de arquivos estáticos não permite criar salas.';
}
function networkError(e){
  if(e instanceof TypeError && /fetch|network|load/i.test(e.message))return new Error('Não foi possível conectar ao servidor. '+connectionHint());
  return e;
}

async function request(endpoint,method='GET',body){
  const url='/api/room/'+encodeURIComponent(code)+endpoint;
  let response;
  try{response=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}
  catch(e){throw networkError(e);}
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))throw Error('O endereço aberto não está respondendo como o servidor do aplicativo. '+connectionHint());
  let obj={};try{obj=await response.json();}catch{throw Error('O servidor retornou uma resposta inválida.');}
  if(!response.ok) throw new Error(obj.error||'Erro de comunicação.');
  return obj;
}
function credentials(){return role==='host'?{hostToken:token}:{token};}
function roomLink(){return location.origin+'/?room='+encodeURIComponent(code);}
function setSession(c,t,r){if(!signedIn){showAuthMessage('Entre na conta antes de acessar a sala.',true);return;}code=c;token=t;role=r;localStorage.setItem('dupla_'+code,JSON.stringify({token,role}));localStorage.setItem('dupla_last_room',code);history.replaceState(null,'','/?room='+code);$('landing').classList.add('hidden');$('workspace').classList.remove('hidden');$('topRoom').classList.remove('hidden');$('roomCode').textContent=code;document.body.classList.toggle('guest',role==='guest');$('roomTitle').textContent=role==='host'?'Sala '+code:'Sala '+code;connect();refresh();}
function connect(){if(es)es.close();es=new EventSource('/api/room/'+encodeURIComponent(code)+'/events?token='+encodeURIComponent(token));es.addEventListener('refresh',()=>refresh());es.onerror=()=>{};}
let ongoing=null,refreshQueued=false;
async function refresh(){
  if(ongoing){refreshQueued=true;return ongoing;}
  ongoing=request('/state?token='+encodeURIComponent(token)).then(v=>{view=v;render(v);}).catch(e=>alertUser(e.message,true)).finally(()=>{ongoing=null;if(refreshQueued){refreshQueued=false;refresh();}});
  return ongoing;
}
async function command(action,data={}){try{await request('/'+action,'POST',{...credentials(),...data});await refresh();}catch(e){alertUser(e.message,true);}}
async function createRoom(){if(!signedIn||!isAdminAccount)return;try{
  const name=$('hostName').value.trim()||'Administrador';
  const title=$('roomName').value.trim();
  let r;
  try{r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,title})});}
  catch(e){throw networkError(e);}
  if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('Não foi possível criar a sala: o site foi aberto sem o servidor Node.js. '+connectionHint());
  const v=await r.json();if(!r.ok)throw Error(v.error||'Erro ao criar sala.');
  setSession(v.code,v.token,'host');alertUser('Sala criada! Envie o link ao seu amigo.');
}catch(e){alertUser(e.message,true);}}
async function joinRoom(){if(!signedIn)return;try{
  const c=$('joinCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'').trim();
  if(c.length!==6)throw Error('Digite o código de 6 caracteres.');
  const previousCode=code;
  code=c;
  let v;
  try{v=await request('/join','POST',{name:$('joinName').value.trim()||'Amigo'});}
  catch(e){code=previousCode;throw e;}
  setSession(c,v.token,'guest');alertUser('Você entrou na sala!');
}catch(e){alertUser(e.message,true);}}
function clean(t){return String(t||'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').replace(/\n[ \t]*\n[ \t]*\n+/g,'\n\n').trim();}
function htmlDoc(html){return new DOMParser().parseFromString(html||'','text/html');}
function tidyStatement(doc,raw){
  const container=doc.querySelector('.questao-enunciado-texto');
  if(container){const blocks=[...container.querySelectorAll('p,blockquote,li')].filter(el=>!el.closest('li li'));
    const lines=blocks.map(el=>clean(el.textContent)).filter(Boolean);
    const text=lines.length?lines.join('\n\n'):clean(container.textContent);
    if(text)return text;
  }
  // Plano B: se só houver a propriedade statement, remover o início de interface quando reconhecível.
  let text=clean(raw);
  const index=text.search(/#[0-9]{4,}\s/);
  if(index>=0)text=text.substring(index).replace(/^#[0-9]+\s+[^\n]*?\s+(?=(?:A |O |No |Na |Em |Acerca|Sobre))/,'');
  text=text.replace(/\s*Encontrou algum erro nesta questão\? Fale conosco\s*$/i,'').trim();
  return text;
}
function lookupHeader(doc){
  const idLink=doc.querySelector('a.id-questao');
  const originalId=(idLink?.textContent||'').replace(/\D/g,'');
  const board=clean(doc.querySelector('a[href*="/bancas/"]')?.textContent);
  const exam=clean(doc.querySelector('a[href*="/concursos/"]')?.textContent);
  const year=(exam.match(/\b(?:19|20)\d{2}\b/)||[])[0]||'';
  const subject=clean(doc.querySelector('.questao-cabecalho-informacoes-assunto-link a span')?.textContent||doc.querySelector('.questao-cabecalho-informacoes-assunto-link')?.textContent);
  return {originalId,board,exam,year,subject,link:idLink?.href||''};
}
function normalizeRecord(raw,index){
  const doc=htmlDoc(raw.statementHtml||'');const details=lookupHeader(doc);
  const type=raw.type==='true_false'?'true_false':'multiple_choice';
  let alternatives=Array.isArray(raw.alternatives)?raw.alternatives.map((a,j)=>{
    const letter=clean(a.letter||String.fromCharCode(65+j)).toUpperCase();
    let text=clean(a.text);
    if(letter){const re=new RegExp('^'+letter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[\\s.)\\-:]+)','i');text=text.replace(re,'').trim();}
    return{letter,text};
  }).filter(a=>a.letter&&a.text):[];
  if(!alternatives.length && type==='true_false'){
    alternatives=[{letter:'C',text:'Certo'},{letter:'E',text:'Errado'}];
  }
  if(!alternatives.length){
    const lis=[...doc.querySelectorAll('.questao-enunciado-alternativas li')];
    alternatives=lis.map((li,j)=>({letter:String.fromCharCode(65+j),text:clean(li.textContent)})).filter(a=>a.text);
  }
  const text=tidyStatement(doc,raw.statement||'');
  const result=typeof raw.result==='string'?raw.result.toUpperCase().trim():'';
  let correct=alternatives.some(a=>a.letter===result)?result:null;
  // O campo result pode ter apenas "correta" ou um objeto; nada é adivinhado.
  const originalId=details.originalId||(String(raw.originalId||'').replace(/\D/g,''));
  return {id:String(raw.id||index+1),originalId,statement:text,alternatives,type,
    board:details.board||clean(raw.board),exam:details.exam||clean(raw.exam),year:details.year||clean(raw.year),
    subject:details.subject||clean(raw.metadata?.subject||raw.subject),
    link:details.link||'',correct,needsReview:alternatives.length<2};
}
function normalizeFile(data){
  let records=Array.isArray(data)?data: (Array.isArray(data.questions)?data.questions: (data.statement?[data]:null));
  if(!records||!records.length)throw Error('Não encontrei questões. Use uma lista de questões ou {"questions": [...]}.');
  if(records.length>400)throw Error('Importe no máximo 400 questões por sessão.');
  const qs=records.map(normalizeRecord);
  if(qs.some(q=>!q.statement))throw Error('Uma questão está sem enunciado. Confira o arquivo.');
  return qs;
}
async function importFile(file){
  if(role!=='host')return;
  if(!file || !file.name.toLowerCase().endsWith('.json')){alertUser('Selecione um arquivo .json.',true);return;}
  try{
    const raw=await file.text(); const questions=normalizeFile(JSON.parse(raw));
    await request('/import','POST',{...credentials(),questions});
    await refresh();
    lastImported=questions;
    const review=questions.filter(q=>q.needsReview).length;
    $('importMessage').textContent=`${questions.length} questões organizadas. ${review?review+' precisam de revisão.':'Todas têm alternativas.'}`;
    $('exportJson').classList.remove('hidden');
    alertUser(`${questions.length} questões importadas e organizadas!`);
  }catch(e){$('importMessage').textContent='Não foi possível importar.';alertUser('Falha ao ler arquivo: '+e.message,true);}
}
function div(className,text){const el=document.createElement('div');if(className)el.className=className;el.textContent=text;return el;}
function render(q){
  if(q.isOpen===false){leaveRoom('Esta sala foi encerrada pelo administrador.');return;}
  $('questionTotal').textContent=q.questionsCount;
  $('memberStatus').textContent=q.guestName?`${q.hostName} e ${q.guestName} conectados`:'Aguardando seu amigo entrar...';
  $('scoreHost').textContent=q.scores.host;$('scoreGuest').textContent=q.scores.guest;
  $('scoreHostName').textContent=q.hostName;$('scoreGuestName').textContent=q.guestName||'Amigo';
  $('playerOneName').textContent=q.hostName;$('playerTwoName').textContent=q.guestName||'Amigo';
  $('sessionSubtitle').textContent=q.questionsCount?`${q.questionsCount} questão(ões) importada(s) • questão ${q.index+1} de ${q.questionsCount}`:'Importe seu arquivo JSON para começar';
  $('scoreDetail').textContent=q.scores.count?`${q.scores.count} questão(ões) corrigida(s) com gabarito disponível.`:'A pontuação aparece quando houver gabarito e respostas reveladas.';
  const one=q.revealed?(q.answers.host?'Resposta: '+q.answers.host:'Não respondeu'):(q.answered.host?'Resposta registrada':'Ainda não respondeu');
  const two=q.guestName?(q.revealed?(q.answers.guest?'Resposta: '+q.answers.guest:'Não respondeu'):(q.answered.guest?'Resposta registrada':'Ainda não respondeu')):'Aguardando entrar';
  $('playerOneState').textContent=one;$('playerTwoState').textContent=two;
  $('playerOneIcon').textContent=q.answered.host?'✓':'○';$('playerOneIcon').className='status-icon'+(q.answered.host?' ok':'');
  $('playerTwoIcon').textContent=q.answered.guest?'✓':'○';$('playerTwoIcon').className='status-icon'+(q.answered.guest?' ok':'');
  $('resultExplanation').textContent=q.revealed?'Respostas reveladas para os dois participantes. Confira o gabarito, quando houver.':'Responda sem ver a alternativa do outro. As respostas são reveladas quando os dois marcarem ou o anfitrião liberar.';
  if(role==='host')renderList(q);
  $('emptyState').classList.toggle('hidden',!!q.question);
  $('questionArea').classList.toggle('hidden',!q.question);
  if(!q.question){$('emptyDescription').textContent=q.role==='host'?'Importe o JSON que você já captura do TEC e as questões aparecerão aqui organizadas.':'Seu amigo ainda não importou o arquivo. A questão aparecerá automaticamente aqui.';return;}
  const data=q.question;
  $('questionNumber').textContent='QUESTÃO '+String(q.index+1).padStart(2,'0')+' DE '+q.questionsCount;
  $('questionType').textContent=data.type==='true_false'?'CERTO OU ERRADO':'MÚLTIPLA ESCOLHA';
  $('questionMeta').textContent=[data.board,data.exam,data.subject].filter(Boolean).join(' • ');
  $('questionStatement').textContent=data.statement;
  const parent=$('answerOptions');parent.replaceChildren();
  for(const opt of data.alternatives){
    const b=document.createElement('button');b.type='button';b.className='answer';
    const selected=q.myAnswer===opt.letter;
    if(selected)b.classList.add('selected');
    if(q.revealed&&data.correct){if(opt.letter===data.correct)b.classList.add('correct');else if(selected)b.classList.add('wrong');}
    b.append(div('letter',opt.letter),div('answer-label',opt.text));
    b.disabled=q.revealed;b.onclick=()=>command('answer',{choice:opt.letter,index:q.index});parent.append(b);
  }
  $('incompleteNotice').classList.toggle('hidden',!data.needsReview);
  $('feedback').classList.toggle('hidden',!q.revealed);
  if(q.revealed){
    const a=q.answers;
    let t=`${q.hostName}: ${a.host||'não respondeu'} • ${q.guestName||'Amigo'}: ${a.guest||'não respondeu'}`;
    if(data.correct)t+='\nGabarito: '+data.correct;
    else t+='\nGabarito não informado. Compare as respostas e confira a questão original.';
    $('feedback').textContent=t;
  }
  if(role==='host'){
    $('prevQuestion').disabled=q.index===0;$('nextQuestion').disabled=q.index>=q.questionsCount-1;
    $('revealAnswers').disabled=q.revealed;
    const select=$('keySelect');select.replaceChildren(new Option('Não informado no JSON',''));
    for(const o of data.alternatives)select.add(new Option(`${o.letter} — ${o.text.slice(0,80)}`,o.letter));
    // A chave só é enviada ao cliente depois da revelação; seleção local preservada até lá.
    select.value=q.hostCorrect||'';
    const link=$('originalLink');link.classList.toggle('hidden',!data.link);
    if(data.link)link.href=data.link;
  }
}
function renderList(q){
  const list=$('questionList');list.replaceChildren();
  for(let i=0;i<q.questions.length;i++){
    const item=q.questions[i];const button=document.createElement('button');button.type='button';
    if(i===q.index)button.classList.add('active');
    const n=div('item-n',String(i+1).padStart(2,'0'));
    const container=div('item-summary','');
    const title=document.createElement('strong');title.textContent=item.subject||item.board||'Questão '+(i+1);
    const details=document.createElement('small');details.textContent=(item.originalId?'#'+item.originalId+' • ':'')+(item.needsReview?'⚠ Revisar alternativas':item.type==='true_false'?'Certo / errado':'Múltipla escolha');
    if(item.needsReview)details.classList.add('attention');container.append(title,details);button.append(n,container);
    button.onclick=()=>command('navigate',{index:i});list.append(button);
  }
}
function downloadNormalized(){
  const qs=view?.questions||lastImported;if(!qs)return;
  const blob=new Blob([JSON.stringify(qs.map(q=>({id:q.id,originalId:q.originalId,statement:q.statement,alternatives:q.alternatives,type:q.type,subject:q.subject,exam:q.exam,board:q.board,year:q.year,link:q.link,correct:q.correct||null})),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='questoes_organizadas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function showEdit(){
  if(role!=='host'||!view.question)return;
  $('editStatement').value=view.question.statement;
  $('editAlternatives').value=view.question.alternatives.map(a=>a.letter+') '+a.text).join('\n');
  $('editDialog').showModal();
}
async function saveEdit(e){e.preventDefault();
  const text=$('editStatement').value.trim();
  const alts=$('editAlternatives').value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,i)=>{
    const m=line.match(/^([A-H])\s*[).:\-]\s*(.+)$/i);
    return{letter:m?m[1].toUpperCase():String.fromCharCode(65+i),text:m?m[2].trim():line};
  });
  if(alts.length<2){alertUser('Informe pelo menos duas alternativas.',true);return;}
  const question={...view.question,statement:text,alternatives:alts,needsReview:false};
  await command('edit',{index:view.index,question});$('editDialog').close();
}

function leaveRoom(message=''){
  if(es){es.close();es=null;}
  if(code){localStorage.removeItem('dupla_'+code);}
  localStorage.removeItem('dupla_last_room');
  code=null;token=null;role=null;view=null;
  $('topRoom').classList.add('hidden');
  $('workspace').classList.add('hidden');$('landing').classList.remove('hidden');
  document.body.classList.remove('guest');history.replaceState(null,'','/');
  loadRooms();
  if(message)alertUser(message);
}
function roomCard(room){
  const item=document.createElement('div');item.className='directory-room';
  const info=document.createElement('div');info.className='directory-info';
  const title=document.createElement('strong');title.textContent=room.title||'Sala '+room.code;
  const meta=document.createElement('small');
  meta.textContent=`Código ${room.code} • ${room.hostName} • ${room.questionsCount} questão(ões)`;
  info.append(title,meta);
  const status=document.createElement('span');status.className='room-status '+(room.occupied?'busy':'free');
  status.textContent=room.occupied?'Ocupada':'1 vaga disponível';
  const action=document.createElement('button');action.type='button';action.className='btn btn-small '+(room.mine?'btn-soft':'btn-primary');
  action.textContent=room.mine?'Continuar':room.occupied?'Lotada':'Entrar';
  action.disabled=room.occupied&&!room.mine || (isAdminAccount&&!room.mine);
  if(isAdminAccount&&!room.mine)action.textContent='Somente o criador';
  action.onclick=async()=>{
    if(action.disabled)return;
    action.disabled=true;
    try{
      if(room.mine){
        const result=await fetch('/api/room/'+encodeURIComponent(room.code)+'/restore',{cache:'no-store'});
        const data=await result.json();if(!result.ok)throw Error(data.error||'Não foi possível abrir esta sala.');
        setSession(data.code,data.token,data.role);
      }else{
        $('joinCode').value=room.code;
        await joinRoom();
      }
    }catch(e){alertUser(e.message,true);}
    finally{action.disabled=false;}
  };
  item.append(info,status,action);return item;
}
let roomsLoading=false;
async function loadRooms(){
  if(!signedIn||roomsLoading||!$('landing')||$('landing').classList.contains('hidden'))return;
  roomsLoading=true;
  const notice=$('roomsNotice');
  try{
    const r=await fetch('/api/rooms',{cache:'no-store',credentials:'same-origin'});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível carregar salas.');
    const list=$('roomsList');list.replaceChildren();
    for(const room of data.rooms)list.append(roomCard(room));
    notice.textContent=data.rooms.length?'':isAdminAccount?'Nenhuma sala aberta. Crie sua primeira sala acima.':'Nenhuma sala aberta no momento. Quando o administrador criar uma sala, ela aparecerá aqui.';
    notice.classList.toggle('hidden',Boolean(data.rooms.length));
  }catch(e){notice.textContent='Falha ao carregar as salas. Clique em Atualizar. '+e.message;notice.classList.remove('hidden');}
  finally{roomsLoading=false;}
}

// Consulta periódica enquanto a sala está aberta. Além de tolerar quedas da conexão
// de eventos, isso mantém atividade de entrada durante sessões no plano gratuito.
setInterval(() => {
  if (code && token && document.visibilityState === 'visible') refresh();
}, 60 * 1000);
setInterval(()=>{if(signedIn&&!code&&document.visibilityState==='visible')loadRooms();},15000);

$('createRoom').addEventListener('click',createRoom);$('joinRoom').addEventListener('click',joinRoom);
$('refreshRooms').addEventListener('click',loadRooms);
$('closeRoom').addEventListener('click',async()=>{
  if(role!=='host'||!confirm('Encerrar esta sala? Ela deixará de aparecer para os participantes.'))return;
  await command('close');
});
$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
$('jsonFile').addEventListener('change',e=>{if(e.target.files?.[0])importFile(e.target.files[0]);e.target.value='';});
$('dropZone').addEventListener('dragover',e=>{e.preventDefault();$('dropZone').classList.add('dragging')});
$('dropZone').addEventListener('dragleave',()=>$('dropZone').classList.remove('dragging'));
$('dropZone').addEventListener('drop',e=>{e.preventDefault();$('dropZone').classList.remove('dragging');if(e.dataTransfer.files?.[0])importFile(e.dataTransfer.files[0]);});
$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomLink());alertUser('Link copiado! Envie ao seu amigo.');}catch{prompt('Copie o link:',roomLink());}});
$('prevQuestion').addEventListener('click',()=>command('navigate',{index:view.index-1}));
$('nextQuestion').addEventListener('click',()=>command('navigate',{index:view.index+1}));
$('revealAnswers').addEventListener('click',()=>command('reveal'));
$('keySelect').addEventListener('change',e=>command('key',{correct:e.target.value||null}));
$('editQuestion').addEventListener('click',showEdit);
$('editForm').addEventListener('submit',saveEdit);
$('closeDialog').addEventListener('click',()=>$('editDialog').close());
$('exportJson').addEventListener('click',downloadNormalized);
$('exitRoom').addEventListener('click',()=>leaveRoom());
async function checkBackend(){
  const notice=$('serverNotice');
  try{
    if(location.protocol==='file:')throw Error(connectionHint());
    const response=await fetch('/api/health',{cache:'no-store'});
    if(!response.ok || !(response.headers.get('content-type')||'').includes('application/json'))throw Error(connectionHint());
    const data=await response.json();if(data.status!=='ok')throw Error(connectionHint());
    notice.classList.toggle('hidden',data.storage!=='memory');
    if(data.storage==='memory')notice.textContent='⚠ Questões ainda não estão sendo salvas no Supabase. Configure as variáveis SUPABASE_URL e SUPABASE_SECRET_KEY no Render.';
  }catch(e){notice.textContent='⚠ Problema de conexão: '+connectionHint();notice.classList.remove('hidden');}
}
async function initializeApp(){
  checkBackend();
  loadRooms();
  const search=new URLSearchParams(location.search), c=(search.get('room')||'').toUpperCase();
  if(!c) {
    const last=localStorage.getItem('dupla_last_room');
    if(last && localStorage.getItem('dupla_'+last)) {
      $('resumeRoom').textContent='Retomar sala '+last;
      $('resumeRoom').classList.remove('hidden');
      $('resumeRoom').onclick=()=>{location.href='/?room='+encodeURIComponent(last);};
    }
  }
  if(c){
    $('joinCode').value=c;
    const session=localStorage.getItem('dupla_'+c);
    if(session) {try{const s=JSON.parse(session);if(s.token){setSession(c,s.token,s.role);return;}}catch{localStorage.removeItem('dupla_'+c);}}
    // Novo navegador, mesmo usuário: recuperar sala de forma autenticada.
    try{const r=await fetch('/api/room/'+encodeURIComponent(c)+'/restore',{cache:'no-store'});
      if(r.ok){const v=await r.json();setSession(c,v.token,v.role);return;}
    }catch{}
  }
}
function showAuthMessage(msg,error=false){const el=$('authMessage');el.textContent=msg;el.className='auth-message'+(error?' error':'');}
function switchAuthMode(mode){
  authMode=mode;
  $('tabLogin').classList.toggle('active',mode==='login');
  $('tabRegister').classList.toggle('active',mode==='register');
  $('authHeading').textContent=mode==='login'?'Bem-vindo de volta!':'Crie sua conta';
  $('authDescription').textContent=mode==='login'?'Entre com seu e-mail e sua senha para continuar.':'Cadastre-se para participar das salas de estudo.';
  $('authSubmit').textContent=mode==='login'?'Entrar na minha conta →':'Criar minha conta →';
  $('authPassword').autocomplete=mode==='login'?'current-password':'new-password';
  $('authMessage').classList.add('hidden');
}
async function authFetch(endpoint,method='GET',body){
  let res;
  try{res=await fetch('/api/auth/'+endpoint,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});}
  catch(e){throw networkError(e);}
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Não foi possível autenticar.');
  return data;
}
async function onAuthSubmit(e){
  e.preventDefault();
  const button=$('authSubmit'),email=$('authEmail').value.trim(),password=$('authPassword').value;
  button.disabled=true;$('authMessage').classList.add('hidden');
  try {
    const result=await authFetch(authMode,'POST',{email,password});
    if(result.confirmationRequired) {
      showAuthMessage('Cadastro recebido! Confira seu e-mail (inclusive spam) para confirmar a conta e depois faça login.');
      $('authPassword').value='';
      return;
    }
    await verifyLogin();
  }catch(error){showAuthMessage(error.message,true);}
  finally{button.disabled=false;}
}
async function verifyLogin(){
  const result=await authFetch('me');
  if(!result.authenticated)throw Error('Não foi possível confirmar seu login.');
  signedIn=true;isAdminAccount=Boolean(result.isAdmin);
  $('authGate').classList.add('hidden');$('landing').classList.remove('hidden');
  $('adminCreateCard').classList.toggle('hidden',!isAdminAccount);
  $('joinCard').classList.toggle('hidden',isAdminAccount);
  $('landingDescription').textContent=isAdminAccount?'Crie salas, importe questões e acompanhe as respostas em tempo real.':'Escolha uma sala aberta e responda às questões com o administrador.';
  $('accountBar').classList.remove('hidden');$('accountEmail').textContent=(isAdminAccount?'ADMIN • ':'')+(result.user.email||'Minha conta');
  $('authPassword').value='';
  await initializeApp();
}
async function boot(){
  $('tabLogin').addEventListener('click',()=>switchAuthMode('login'));
  $('tabRegister').addEventListener('click',()=>switchAuthMode('register'));
  $('authForm').addEventListener('submit',onAuthSubmit);
  $('logout').addEventListener('click',async()=>{
    try {await authFetch('logout','POST',{});}catch(e){alertUser(e.message,true);return;}
    if(es)es.close();
    code=null;token=null;role=null;view=null;signedIn=false;isAdminAccount=false;
    $('topRoom').classList.add('hidden');$('workspace').classList.add('hidden');$('landing').classList.add('hidden');
    $('accountBar').classList.add('hidden');$('authGate').classList.remove('hidden');
    history.replaceState(null,'','/');
    // Remove tokens de sala do navegador ao sair da conta.
    for(const key of Object.keys(localStorage))if(key.startsWith('dupla_'))localStorage.removeItem(key);
    switchAuthMode('login');
    alertUser('Você saiu da conta.');
  });
  try{
    const r=await authFetch('me');
    if(r.authenticated){await verifyLogin();}
    else {$('authGate').classList.remove('hidden');}
  }catch(e){showAuthMessage(e.message,true);}
}
boot();

'use strict';
// Tela de resolução individual. O conteúdo importado aparece sempre como texto.
const $=id=>document.getElementById(id);
let admin=false, filters={subjects:[],pairs:[],boards:[],years:[]},page=1,hasMore=false;
let current=null,currentId='',pendingImport=[],draftPage=1,showingDrafts=true,editingId=null,editingRecord=null;
let toastHandle;
function notify(message,isError=false){const el=$('bankToast');el.textContent=message;el.className='toast'+(isError?' error':'');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.add('hidden'),5200);}
async function api(url,method='GET',data){
  let res;
  try{res=await fetch('/api/'+url,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,credentials:'same-origin',cache:'no-store'});}
  catch{throw Error('Não foi possível comunicar com o servidor. Verifique a conexão.');}
  const result=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(result.error||'Falha ao comunicar com o servidor.');
  return result;
}
function addOption(select,value,label){select.add(new Option(label,value));}
function elt(name,cls,txt){const e=document.createElement(name);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function withAsync(button,task){return async()=>{if(button.disabled)return;button.disabled=true;try{await task();}catch(e){notify(e.message,true);}finally{button.disabled=false;}};}
function showAdmin(open){$('studyPane').classList.toggle('hidden',open);$('adminPane').classList.toggle('hidden',!open);$('adminToggle').textContent=open?'↩ Resolver questões':'⚙ Gerenciar questões';if(open)loadDrafts();else loadList();}
async function loadFacets(){try{filters=await api('bank/facets');fillDropdown('filterSubject',filters.subjects,'Todas as disciplinas');fillDropdown('filterBoard',filters.boards,'Todas as bancas');fillDropdown('filterYear',filters.years.map(String),'Todos os anos');fillTopics();}catch(e){notify('Filtros indisponíveis: '+e.message,true);}}
function fillDropdown(id,values,prompt){const select=$(id),old=select.value;select.replaceChildren();addOption(select,'',prompt);for(const v of values||[])addOption(select,String(v),String(v));if([...select.options].some(o=>o.value===old))select.value=old;}
function fillTopics(){const subject=$('filterSubject').value;const topics=[...new Set((filters.pairs||[]).filter(p=>!subject||p.subject===subject).map(p=>p.topic))].sort((a,b)=>a.localeCompare(b,'pt-BR'));fillDropdown('filterTopic',topics,'Todos os tópicos');}
async function loadProgress(){try{const p=await api('bank/progress');$('statTotal').textContent=p.total??0;$('statAnswered').textContent=p.answered??0;$('statCorrect').textContent=p.correct??0;$('statWrong').textContent=p.wrong??0;}catch(e){notify('Não foi possível recuperar seu desempenho: '+e.message,true);}}
async function loadList(){
  const q=new URLSearchParams({page:String(page)});
  for(const [key,id] of [['subject','filterSubject'],['topic','filterTopic'],['board','filterBoard'],['year','filterYear'],['search','filterSearch']]){const value=$(id).value.trim();if(value)q.set(key,value);}
  $('listMessage').textContent='Carregando questões...';$('questionCards').replaceChildren();
  try{
    const data=await api('bank/questions?'+q);
    hasMore=data.hasMore;$('pageDisplay').textContent='Página '+page;
    $('previousPage').disabled=page<=1;$('nextPage').disabled=!hasMore;
    for(const [index,r] of data.items.entries()){
      const b=elt('button','bank-item'+(r.id===currentId?' selected':''));b.type='button';
      const meta=elt('div','status-line');meta.append(elt('span','',r.subject+' • '+r.topic),elt('span','',r.hasCommentary?'Comentada':'Com gabarito'));
      const title=elt('strong','',`${(page-1)*30+index+1}. ${r.preview}${r.preview.length>=249?'…':''}`);
      const details=elt('small','',[r.board,r.year].filter(Boolean).join(' • ')||'Questão de concurso');
      b.append(meta,title,details);b.onclick=()=>openQuestion(r.id);$('questionCards').append(b);
    }
    $('listMessage').textContent=data.items.length?'':"Nenhuma questão encontrada com esses filtros. Experimente outra disciplina ou assunto.";
  }catch(e){$('listMessage').textContent='Não foi possível carregar. '+e.message;notify(e.message,true);}
}
async function openQuestion(id){
  try{
    currentId=id;const result=await api('bank/question/'+id);current=result.question;renderCurrent();
    for(const button of $('questionCards').querySelectorAll('.bank-item'))button.classList.remove('selected');
    // Não há vínculo entre os cards e a chave além da posição; atualizar quando a lista carregar.
    if(window.matchMedia('(max-width:1250px)').matches)$('questionContent').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){notify(e.message,true);}
}
function showFeedback({choice,correct,isCorrect,commentary},wasOld=false){
  const f=$('bankFeedback');f.replaceChildren();f.className='bank-feedback'+(isCorrect?'':' wrong');
  const headline=elt('strong','',isCorrect?'✓ Resposta correta!':'✕ Resposta incorreta');
  const explanation=elt('div','',`Você marcou ${choice}. Gabarito: ${correct}.`);
  f.append(headline,explanation);
  const comment=elt('div','commentary',commentary||'Esta questão ainda não possui comentário explicativo.');
  f.append(comment);f.classList.remove('hidden');
  $('repeatQuestion').classList.remove('hidden');
  for(const b of $('bankOptions').querySelectorAll('button')){
    b.disabled=true;if(b.dataset.choice===correct)b.classList.add('correct');else if(b.dataset.choice===choice)b.classList.add('wrong');
  }
  if(!wasOld)loadProgress();
}
function renderCurrent(){
  const q=current;
  $('questionEmpty').classList.add('hidden');$('questionContent').classList.remove('hidden');
  $('questionLabel').textContent=[q.subject,q.topic].filter(Boolean).join(' / ');
  $('questionBadge').textContent=q.type==='true_false'?'CERTO OU ERRADO':'MÚLTIPLA ESCOLHA';
  $('questionMetadata').textContent=[q.board,q.exam,q.year].filter(Boolean).join(' • ');
  $('bankStatement').textContent=q.statement;
  const list=$('bankOptions');list.replaceChildren();$('bankFeedback').classList.add('hidden');$('repeatQuestion').classList.add('hidden');
  $('adminEditCurrent').classList.toggle('hidden',!admin);
  for(const alt of q.alternatives){
    const b=elt('button','answer');b.type='button';b.dataset.choice=alt.letter;
    b.append(elt('span','letter',alt.letter),elt('span','answer-label',alt.text));
    b.onclick=withAsync(b,async()=>{for(const btn of list.querySelectorAll('button'))btn.disabled=true;
      try{const result=await api('bank/answer','POST',{id:q.id,choice:alt.letter});showFeedback(result);}catch(e){for(const btn of list.querySelectorAll('button'))btn.disabled=false;throw e;}
    });
    list.append(b);
  }
  if(q.lastAttempt && q.correct){
    showFeedback({choice:q.lastAttempt.choice,correct:q.correct,isCorrect:q.lastAttempt.isCorrect,commentary:q.commentary},true);
  }
}
function resetAttempt(){if(!current)return;current.lastAttempt=null;current.correct=null;current.commentary=null;renderCurrent();}
function clean(s){return String(s??'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').replace(/\n[ \t]*\n[ \t]*\n+/g,'\n\n').trim();}
function parsedFromHtml(raw){
  const doc=new DOMParser().parseFromString(raw.statementHtml||'','text/html');
  const container=doc.querySelector('.questao-enunciado-texto');
  let statement=clean(raw.statement);
  if(container){
    const blocks=[...container.querySelectorAll('p,li,blockquote')];
    statement=(blocks.map(el=>clean(el.textContent)).filter(Boolean).join('\n\n')||clean(container.textContent)||statement);
  }else{
    statement=statement.replace(/^[\s\S]*?#[0-9]{4,}\s+(?:IGEDUC|CEBRASPE|FGV|FCC|VUNESP)\s*[-–][^\n]*?\s+(?=(?:A |O |No |Na |Em |De |Conforme |Segundo |Acerca |Sobre ))/i,'');
    statement=statement.replace(/\s*Encontrou algum erro nesta questão\? Fale conosco\s*$/i,'');
  }
  const exam=clean(doc.querySelector('a[href*="/concursos/"]')?.textContent)||clean(raw.exam);
  const topic=clean(doc.querySelector('.questao-cabecalho-informacoes-assunto-link')?.textContent)||clean(raw.topic||raw.assunto);
  const subject=clean(doc.querySelector('.questao-cabecalho-informacoes-materia a')?.textContent)||clean(raw.subject)||'Não classificada';
  const board=clean(doc.querySelector('a[href*="/bancas/"]')?.textContent)||clean(raw.board);
  const originalId=(clean(doc.querySelector('a.id-questao')?.textContent)||clean(raw.originalId)).replace(/\D/g,'');
  const year=(exam.match(/\b(?:19|20)\d{2}\b/)||[])[0]||clean(raw.year);
  return {statement,subject,topic,board,exam,originalId,year,link:clean(doc.querySelector('a.id-questao')?.href)||clean(raw.link)};
}
function parseRecord(raw,index){
  const extra=raw.statementHtml?parsedFromHtml(raw):{};
  const type=raw.type==='true_false'?'true_false':'multiple_choice';
  let alternatives=(Array.isArray(raw.alternatives)?raw.alternatives:[]).map((a,i)=>{
    const letter=clean(a?.letter||String.fromCharCode(65+i)).toUpperCase();
    let text=clean(a?.text);if(letter&&text.toUpperCase().startsWith(letter+' '))text=text.slice(2).trim();
    return {letter,text};
  }).filter(a=>a.letter&&a.text);
  if(!alternatives.length&&type==='true_false')alternatives=[{letter:'C',text:'Certo'},{letter:'E',text:'Errado'}];
  const possible=raw.correct??raw.gabarito??raw.answer??raw.result;
  const candidate=typeof possible==='string'?possible.toUpperCase().trim():'';
  const correct=alternatives.some(a=>a.letter===candidate)?candidate:null;
  let subject=clean(extra.subject||raw.subject||raw.metadata?.subject)||'Não classificada';
  let topic=clean(extra.topic||raw.topic||raw.assunto)||'Geral';
  if(subject==='Não classificada'&&$('subjectOverride').value.trim())subject=$('subjectOverride').value.trim();
  if(topic==='Geral'&&$('topicOverride').value.trim())topic=$('topicOverride').value.trim();
  return {id:String(raw.id||index+1),statement:clean(extra.statement||raw.statement),alternatives,type,
    correct,commentary:clean(raw.commentary||raw.explanation||raw.comentario||raw.justification),
    subject,topic,board:clean(extra.board||raw.board),exam:clean(extra.exam||raw.exam),
    year:clean(extra.year||raw.year),originalId:clean(extra.originalId||raw.originalId),link:clean(extra.link||raw.link)};
}
function extractRecords(data){const items=Array.isArray(data)?data:(Array.isArray(data.questions)?data.questions:(data.statement?[data]:null));
  if(!items?.length)throw Error('O JSON precisa ser uma lista de questões ou conter a propriedade "questions".');
  if(items.length>2500)throw Error('O limite inicial é de 2.500 questões por arquivo.');
  return items.map(parseRecord);
}
async function previewFile(){
  const file=$('adminFile').files?.[0];pendingImport=[];$('publishImport').disabled=true;
  if(!file)return;
  try{
    if(file.size>12*1024*1024)throw Error('Este JSON ultrapassa 12 MB. Divida o arquivo.');
    const qs=extractRecords(JSON.parse(await file.text()));
    pendingImport=qs;
    const valid=qs.filter(q=>q.statement&&q.alternatives?.length>=2);
    const key=valid.filter(q=>!!q.correct).length;
    const comments=valid.filter(q=>!!q.commentary).length;
    const note=`${qs.length} questões lidas.\n${valid.length} válidas • ${key} com gabarito • ${comments} com comentário.\n${valid.length-key} ficarão como rascunho para revisão.\n\nExemplo: ${valid[0]?.subject||'—'} > ${valid[0]?.topic||'—'}`;
    $('importPreview').textContent=note;
    $('publishImport').disabled=!valid.length;
  }catch(e){$('importPreview').textContent='Erro: '+e.message;notify(e.message,true);}
}
async function uploadImport(){
  if(!pendingImport.length)throw Error('Selecione um JSON válido primeiro.');
  if(!$('rightsConfirmed').checked)throw Error('Confirme a autorização de publicação.');
  const btn=$('publishImport');btn.disabled=true;
  try{
    let count=0,drafts=0,ignored=0;
    for(let i=0;i<pendingImport.length;i+=150){
      const batch=pendingImport.slice(i,i+150);
      const result=await api('bank/admin/import','POST',{questions:batch,rightsConfirmed:true});
      count+=result.imported;drafts+=result.drafts;ignored+=result.ignored;
      $('importPreview').textContent=`Importando... ${Math.min(i+150,pendingImport.length)} / ${pendingImport.length}`;
    }
    notify(`${count} questões importadas. ${drafts} rascunhos, ${ignored} ignoradas.`);
    $('importPreview').textContent=`Importação concluída: ${count} registros; ${drafts} precisam de gabarito.`;
    pendingImport=[];$('adminFile').value='';$('rightsConfirmed').checked=false;
    await Promise.all([loadDrafts(),loadFacets(),loadProgress(),loadList()]);
  }finally{btn.disabled=false;}
}
async function loadDrafts(){
  const q=new URLSearchParams({page:String(draftPage),draft:String(showingDrafts)});
  const list=$('draftList');list.replaceChildren();$('draftNotice').textContent='Carregando...';
  try{
    const data=await api('bank/admin/list?'+q);
    for(const r of data.items){const b=elt('button','bank-item');b.type='button';
      b.append(elt('strong','',r.statement),elt('small','',`${r.subject} • ${r.topic} • ${r.published?'Publicada':'Rascunho'}${r.hasCommentary?' • Comentada':''}`));
      b.onclick=()=>editItem(r.id);list.append(b);
    }
    $('draftNotice').textContent=data.items.length?'':showingDrafts?'Nenhum rascunho. Todas as questões importadas estão com gabarito.':'Nenhuma questão publicada.';
    $('moreDrafts').classList.toggle('hidden',!data.hasMore);
  }catch(e){$('draftNotice').textContent='Erro: '+e.message;}
}
function refreshKeyOptions(){const lines=$('editAlternatives').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const sel=$('editCorrect'),old=sel.value;sel.replaceChildren(new Option('Ainda não verificado (rascunho)',''));
  lines.forEach((line,i)=>{const m=line.match(/^([A-H])\s*[).:\-]\s*(.+)$/i);
    const letter=m?m[1].toUpperCase():String.fromCharCode(65+i);if(letter.length===1&&'ABCDEFGH'.includes(letter))addOption(sel,letter,letter+' — '+(m?m[2]:line).slice(0,75));});
  if([...sel.options].some(o=>o.value===old))sel.value=old;
}
function createOriginal(){
  editingId=null;editingRecord={type:'multiple_choice',exam:'',originalId:'',link:''};
  $('editSubject').value='';$('editTopic').value='';$('editBoard').value='';$('editYear').value='';
  $('editStatement').value='';$('editAlternatives').value='A) \nB) ';
  $('editCommentary').value='';refreshKeyOptions();$('editCorrect').value='';
  $('editPublished').checked=true;$('deleteQuestion').classList.add('hidden');
  $('editorDialog').showModal();
}
async function editItem(id){
  try{
    const result=await api('bank/admin/item/'+id);
    editingId=result.id;const q=result.data;editingRecord=q;$('deleteQuestion').classList.remove('hidden');
    $('editSubject').value=q.subject||'';$('editTopic').value=q.topic||'';
    $('editBoard').value=q.board||'';$('editYear').value=q.year||'';
    $('editStatement').value=q.statement||'';
    $('editAlternatives').value=(q.alternatives||[]).map(a=>`${a.letter}) ${a.text}`).join('\n');
    $('editCommentary').value=q.commentary||'';
    refreshKeyOptions();$('editCorrect').value=q.correct||'';
    $('editPublished').checked=result.published;
    $('editorDialog').showModal();
  }catch(e){notify(e.message,true);}
}
async function saveEdit(e){e.preventDefault();
  const q={...editingRecord,id:editingId,subject:$('editSubject').value,topic:$('editTopic').value,
    board:$('editBoard').value,year:$('editYear').value,statement:$('editStatement').value,
    alternatives:$('editAlternatives').value.split(/\r?\n/).map((line,i)=>{
      const m=line.trim().match(/^([A-H])\s*[).:\-]\s*(.+)$/i);return{letter:m?m[1].toUpperCase():String.fromCharCode(65+i),text:m?m[2]:line.trim()};
    }).filter(a=>a.text.trim()),correct:$('editCorrect').value,commentary:$('editCommentary').value};
  const published=$('editPublished').checked;
  try{const v=await api(editingId?'bank/admin/edit':'bank/admin/create','POST',editingId?{id:editingId,question:q,published}:{question:q,published,rightsConfirmed:true});
    $('editorDialog').close();notify(v.published?'Questão salva e publicada!':'Questão salva como rascunho.');
    await Promise.all([loadDrafts(),loadList(),loadProgress(),loadFacets()]);
    if(currentId===editingId&&v.published)await openQuestion(editingId);
  }catch(error){notify(error.message,true);}
}
async function deleteCurrent(){if(!editingId||!confirm('Excluir permanentemente esta questão e o histórico de respostas dela?'))return;
  try{await api('bank/admin/delete','POST',{id:editingId});$('editorDialog').close();
    if(currentId===editingId){currentId='';current=null;$('questionContent').classList.add('hidden');$('questionEmpty').classList.remove('hidden');}
    notify('Questão excluída.');await Promise.all([loadDrafts(),loadList(),loadProgress(),loadFacets()]);
  }catch(e){notify(e.message,true);}
}
async function boot(){
  try{
    const session=await api('auth/me');if(!session.authenticated){$('loginRequired').classList.remove('hidden');return;}
    admin=!!session.isAdmin;$('pageBody').classList.remove('hidden');$('who').textContent=(admin?'ADMIN • ':'')+session.user?.email;
    $('adminToggle').classList.toggle('hidden',!admin);
  }catch(e){$('loginRequired').classList.remove('hidden');return;}
  $('applyFilter').onclick=()=>{page=1;loadList();};$('filterSearch').onkeydown=e=>{if(e.key==='Enter'){page=1;loadList();}};
  $('filterSubject').onchange=()=>{fillTopics();page=1;loadList();};
  for(const id of ['filterTopic','filterBoard','filterYear'])$(id).onchange=()=>{page=1;loadList();};
  $('clearFilter').onclick=()=>{for(const id of ['filterSearch','filterSubject','filterTopic','filterBoard','filterYear'])$(id).value='';fillTopics();page=1;loadList();};
  $('previousPage').onclick=()=>{if(page>1){page--;loadList();}};
  $('nextPage').onclick=()=>{if(hasMore){page++;loadList();}};
  $('repeatQuestion').onclick=resetAttempt;
  $('adminEditCurrent').onclick=()=>editItem(currentId);
  $('adminToggle').onclick=()=>showAdmin($('adminPane').classList.contains('hidden'));
  $('backToStudy').onclick=()=>showAdmin(false);
  $('createOriginal').onclick=createOriginal;
  $('adminFile').onchange=previewFile;
  $('subjectOverride').onchange=previewFile;$('topicOverride').onchange=previewFile;
  $('publishImport').onclick=withAsync($('publishImport'),uploadImport);
  $('showDrafts').onclick=()=>{showingDrafts=true;draftPage=1;$('showDrafts').className='btn btn-small btn-primary';$('showPublished').className='btn btn-small btn-soft';loadDrafts();};
  $('showPublished').onclick=()=>{showingDrafts=false;draftPage=1;$('showPublished').className='btn btn-small btn-primary';$('showDrafts').className='btn btn-small btn-soft';loadDrafts();};
  $('refreshDrafts').onclick=loadDrafts;
  $('moreDrafts').onclick=()=>{draftPage++;loadDrafts();};
  $('closeEditor').onclick=()=>$('editorDialog').close();
  $('editAlternatives').addEventListener('blur',refreshKeyOptions);
  $('editorForm').addEventListener('submit',saveEdit);
  $('deleteQuestion').onclick=deleteCurrent;
  await Promise.all([loadFacets(),loadList(),loadProgress()]);
}
boot();

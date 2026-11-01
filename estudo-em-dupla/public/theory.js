'use strict';
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
let admin=false,lessons=[],current=null,editingId=null,images={},dirty=false,readGeneration=0;
async function api(path='',method='GET',body){
  const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível concluir.');return data;
}
function inline(node,value){
  const pattern=/\*\*(.+?)\*\*|==(.+?)==|__(.+?)__|`(.+?)`/g;let last=0;
  for(const match of value.matchAll(pattern)){node.append(document.createTextNode(value.slice(last,match.index)));node.append(el(match[1]?'strong':match[2]?'mark':match[3]?'u':'code',match[1]||match[2]||match[3]||match[4]));last=match.index+match[0].length;}
  node.append(document.createTextNode(value.slice(last)));return node;
}
function renderPaper(target,lesson){
  target.replaceChildren();const brand=el('div','ESTUDO POLICIAL / MATERIAL DE ESTUDO');brand.className='paper-brand';target.append(brand);
  const meta=el('div',[lesson.subject,lesson.topic].filter(Boolean).join(' / '));meta.className='paper-meta';target.append(meta,el('h1',lesson.title||'Título da aula'));
  const lines=String(lesson.content||'').replace(/\r/g,'').split('\n');let list=null;
  const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
  for(let i=0;i<lines.length;i++){
    const line=lines[i],s=line.trim();
    if(!s){list=null;continue;}
    if(s.includes('|')&&i+1<lines.length&&/^\|?\s*:?-{3,}/.test(lines[i+1].trim())&&cells(lines[i+1]).every(c=>/^:?-{3,}:?$/.test(c))){
      const wrap=el('div');wrap.className='table-scroll';const table=el('table'),head=el('thead'),tr=el('tr');cells(s).forEach(c=>tr.append(inline(el('th'),c)));head.append(tr);table.append(head);const body=el('tbody');i+=2;
      while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){const row=el('tr');cells(lines[i]).forEach(c=>row.append(inline(el('td'),c)));body.append(row);i++;}i--;table.append(body);wrap.append(table);target.append(wrap);list=null;continue;
    }
    const picture=s.match(/^!\[([^\]]*)\]\((imagem-[a-z0-9-]+)\)$/);
    if(picture){const src=lesson.images?.[picture[2]];if(typeof src==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(src)){const figure=el('figure'),img=el('img');img.src=src;img.alt=picture[1];img.loading='lazy';figure.append(img);if(picture[1])figure.append(el('figcaption',picture[1]));target.append(figure);}else target.append(el('p','[Imagem indisponível]'));list=null;continue;}
    const heading=s.match(/^(#{1,4})\s+(.+)$/);
    if(heading){target.append(inline(el('h'+Math.min(heading[1].length+1,4)),heading[2]));list=null;continue;}
    if(/^(-{3,}|\*{3,})$/.test(s)){target.append(el('hr'));list=null;continue;}
    if(s.startsWith('>')){target.append(inline(el('blockquote'),s.replace(/^>\s?/,'')));list=null;continue;}
    const bullet=s.match(/^(?:[-*]\s+|\d+[.)]\s+)(.+)$/);
    if(bullet){const tag=/^\d/.test(s)?'ol':'ul';if(!list||list.tagName.toLowerCase()!==tag){list=el(tag);target.append(list);}list.append(inline(el('li'),bullet[1]));continue;}
    list=null;const paragraph=[line];while(i+1<lines.length&&lines[i+1].trim()&&!/^(?:#{1,4}\s|>|[-*]\s|\d+[.)]\s|!\[|---|\|)/.test(lines[i+1].trim())){if(i+2<lines.length&&/^\|?\s*:?-{3,}/.test(lines[i+2].trim()))break;paragraph.push(lines[++i]);}target.append(inline(el('p'),paragraph.join('\n')));
  }
}
function options(id,values,label){const select=$(id),old=select.value;select.replaceChildren(new Option(label,''));for(const value of [...new Set(values)].sort((a,b)=>a.localeCompare(b,'pt-BR')))select.add(new Option(value,value));if([...select.options].some(o=>o.value===old))select.value=old;}
function topics(){options('topic',lessons.filter(l=>!$('subject').value||l.subject===$('subject').value).map(l=>l.topic),'Todos os tópicos');}
function cards(){
  const search=$('search').value.trim().toLocaleLowerCase('pt-BR');const visible=lessons.filter(l=>(!$('subject').value||l.subject===$('subject').value)&&(!$('topic').value||l.topic===$('topic').value)&&(!search||[l.title,l.subject,l.topic].join(' ').toLocaleLowerCase('pt-BR').includes(search)));
  $('lessonCards').replaceChildren();$('catalogCount').textContent=visible.length?`${visible.length} aulas encontradas`:'Nenhuma aula encontrada. '+(admin?'Crie uma aula ou ajuste os filtros.':'Novas aulas aparecerão aqui quando forem publicadas.');
  for(const lesson of visible){const card=el('button');card.type='button';card.className='panel lesson-card';const meta=el('div',lesson.subject+' / '+lesson.topic);meta.className='eyebrow';const foot=el('span',(lesson.published?'Aula publicada':'Rascunho • somente administrador')+' · '+new Date(lesson.updated_at).toLocaleDateString('pt-BR'));foot.className='muted';card.append(meta,el('h2',lesson.title),foot,el('span','Estudar aula →'));card.onclick=()=>openLesson(lesson.id);$('lessonCards').append(card);}
}
async function load(){lessons=(await api('theory')).items;options('subject',lessons.map(l=>l.subject),'Todas as disciplinas');topics();cards();for(const [id,key] of [['subjectOptions','subject'],['topicOptions','topic']]){$(id).replaceChildren();for(const value of new Set(lessons.map(l=>l[key]))){const option=el('option');option.value=value;$(id).append(option);}}}
function pane(id){for(const name of ['library','reader','editor'])$(name).classList.toggle('hidden',name!==id);}
async function openLesson(id){const generation=++readGeneration;$('notice').textContent='Carregando aula...';try{const result=await api('theory/'+id);if(generation!==readGeneration)return;current=result.lesson;renderPaper($('lessonPaper'),current);$('editLesson').classList.toggle('hidden',!admin);pane('reader');$('notice').textContent='';history.replaceState(null,'','#aula='+id);window.scrollTo({top:0,behavior:'smooth'});}catch(e){if(generation===readGeneration)$('notice').textContent=e.message;}}
function formLesson(){return {id:editingId,title:$('title').value,subject:$('editSubject').value,topic:$('editTopic').value,content:$('content').value,images,published:$('published').checked};}
function preview(){renderPaper($('preview'),formLesson());}
function edit(lesson){editingId=lesson?.id||null;images={...(lesson?.images||{})};for(const [id,key] of [['title','title'],['editSubject','subject'],['editTopic','topic'],['content','content']])$(id).value=lesson?.[key]||'';$('published').checked=lesson?.published||false;$('imageUpload').value='';$('deleteLesson').classList.toggle('hidden',!editingId);$('editorStatus').textContent='';dirty=false;pane('editor');preview();}
async function imageFile(file){
  if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Selecione uma imagem PNG, JPG ou WebP.');if(file.size>12*1024*1024)throw Error('Escolha uma imagem de até 12 MB.');
  const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const src=canvas.toDataURL('image/webp',.85);const content=$('content');const used=Object.entries(images).filter(([key])=>content.value.includes(']('+key+')'));if(used.reduce((n,[,v])=>n+v.length,src.length)>4*1024*1024)throw Error('Limite de imagens atingido (4 MB). Divida o conteúdo em mais aulas.');images=Object.fromEntries(used);const key='imagem-'+crypto.randomUUID();images[key]=src;const alt=file.name.replace(/\.[^.]+$/,'').replace(/[\[\]\r\n]/g,'');content.setRangeText('\n\n!['+alt+']('+key+')\n\n',content.selectionStart,content.selectionEnd,'end');dirty=true;preview();content.focus();}finally{bitmap.close();}
}
let previewTimer;
$('lessonForm').oninput=()=>{dirty=true;clearTimeout(previewTimer);previewTimer=setTimeout(preview,350);};
$('subject').onchange=()=>{topics();cards();};$('topic').onchange=cards;$('search').oninput=cards;$('lessonFilters').onsubmit=e=>e.preventDefault();
$('clearFilters').onclick=()=>{$('lessonFilters').reset();topics();cards();};
$('newLesson').onclick=()=>{if(dirty&&!confirm('Descartar as alterações não salvas?'))return;edit(null);};
$('editLesson').onclick=()=>edit(current);$('previewButton').onclick=preview;
$('imageUpload').onchange=async()=>{const input=$('imageUpload');$('saveLesson').disabled=true;try{await imageFile(input.files[0]);$('editorStatus').textContent='Imagem inserida. Você pode editar a legenda no conteúdo.';}catch(e){$('editorStatus').textContent=e.message;}finally{input.value='';$('saveLesson').disabled=false;}};
$('back').onclick=()=>{readGeneration++;history.replaceState(null,'',location.pathname);pane('library');$('notice').textContent='';};
$('cancelEdit').onclick=()=>{if(dirty&&!confirm('Descartar as alterações não salvas?'))return;dirty=false;pane(current?'reader':'library');};
$('printLesson').onclick=()=>window.print();
$('lessonForm').onsubmit=async e=>{e.preventDefault();const button=$('saveLesson');if(button.disabled)return;button.disabled=true;$('editorStatus').textContent='Salvando...';try{const result=await api('theory/save','POST',formLesson());dirty=false;editingId=result.id;await load();await openLesson(result.id);}catch(error){$('editorStatus').textContent=error.message;}finally{button.disabled=false;}};
$('deleteLesson').onclick=async()=>{if(!editingId||!confirm('Excluir esta aula permanentemente?'))return;const button=$('deleteLesson');button.disabled=true;try{await api('theory/delete','POST',{id:editingId});dirty=false;current=null;editingId=null;history.replaceState(null,'',location.pathname);await load();pane('library');}catch(e){$('editorStatus').textContent=e.message;}finally{button.disabled=false;}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
(async()=>{try{const session=await api('auth/me');if(!session.authenticated){$('notice').textContent='Entre na sua conta para estudar as aulas.';$('loginLink').classList.remove('hidden');return;}admin=!!session.isAdmin;await load();$('newLesson').classList.toggle('hidden',!admin);pane('library');const match=location.hash.match(/^#aula=([0-9a-f-]+)$/i);if(match)await openLesson(match[1]);}catch(e){$('notice').textContent=e.message;}})();

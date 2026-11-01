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
  renderBlocks(target,lesson);
}
function renderBlocks(target,lesson,depth=0){
  const lines=String(lesson.content||'').replace(/\r/g,'').split('\n');let list=null;
  const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
  for(let i=0;i<lines.length;i++){
    const line=lines[i],s=line.trim();
    if(!s){list=null;continue;}
    const frame=s.match(/^:::(quadro|mapa|verde|vermelho|azul|amarelo|imagens)(?:\s+(.+))?$/);
    if(frame&&depth<6){
      let end=i+1,nesting=1;
      for(;end<lines.length;end++){
        if(/^:::(quadro|mapa|verde|vermelho|azul|amarelo|imagens)(?:\s|$)/.test(lines[end].trim()))nesting++;
        else if(lines[end].trim()===':::'){nesting--;if(nesting===0)break;}
      }
      if(nesting===0){
        const box=el('section');box.className='study-block study-'+frame[1];
        if(frame[2]){const title=inline(el('div'),frame[2]);title.className='study-block-title';box.append(title);}
        renderBlocks(box,{...lesson,content:lines.slice(i+1,end).join('\n')},depth+1);target.append(box);i=end;list=null;continue;
      }
    }
    if(s.includes('|')&&i+1<lines.length&&/^\|?\s*:?-{3,}/.test(lines[i+1].trim())&&cells(lines[i+1]).every(c=>/^:?-{3,}:?$/.test(c))){
      const wrap=el('div');wrap.className='table-scroll';const table=el('table'),head=el('thead'),tr=el('tr');cells(s).forEach(c=>tr.append(inline(el('th'),c)));head.append(tr);table.append(head);const body=el('tbody');i+=2;
      while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){const row=el('tr');cells(lines[i]).forEach(c=>row.append(inline(el('td'),c)));body.append(row);i++;}i--;table.append(body);wrap.append(table);target.append(wrap);list=null;continue;
    }
    const picture=s.match(/^!\[([^\]]*)\]\((imagem-[a-z0-9-]+|https:\/\/[^\s)]+)\)$/);
    if(picture){const src=picture[2].startsWith('https://')?picture[2]:lesson.images?.[picture[2]];if(typeof src==='string'&&(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(src)||validImageUrl(src))){const figure=el('figure'),img=el('img');img.src=src;img.alt=picture[1];img.loading='lazy';img.referrerPolicy='no-referrer';figure.append(img);if(picture[1])figure.append(el('figcaption',picture[1]));target.append(figure);}else target.append(el('p','[Imagem indisponível]'));list=null;continue;}
    const heading=s.match(/^(#{1,4})\s+(.+)$/);
    if(heading){target.append(inline(el('h'+Math.min(heading[1].length+1,4)),heading[2]));list=null;continue;}
    if(/^(-{3,}|\*{3,})$/.test(s)){target.append(el('hr'));list=null;continue;}
    if(s.startsWith('>')){target.append(inline(el('blockquote'),s.replace(/^>\s?/,'')));list=null;continue;}
    const bullet=s.match(/^(?:[-*]\s+|\d+[.)]\s+)(.+)$/);
    if(bullet){const tag=/^\d/.test(s)?'ol':'ul';if(!list||list.tagName.toLowerCase()!==tag){list=el(tag);target.append(list);}list.append(inline(el('li'),bullet[1]));continue;}
    list=null;const paragraph=[line];while(i+1<lines.length&&lines[i+1].trim()&&!/^(?::::|#{1,4}\s|>|[-*]\s|\d+[.)]\s|!\[|---|\|)/.test(lines[i+1].trim())){if(i+2<lines.length&&/^\|?\s*:?-{3,}/.test(lines[i+2].trim()))break;paragraph.push(lines[++i]);}target.append(inline(el('p'),paragraph.join('\n')));
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
const frameTemplates={
  resumo:':::quadro RESUMO PARA MEMORIZAÇÃO\n:::verde REGRA GERAL\n- **Conceito principal:** explique aqui.\n- Exemplo para fixar.\n:::\n:::vermelho EXCEÇÕES\n- Situação que exige atenção.\n:::\n:::azul PEGADINHAS DE PROVA\n- Diferença que a banca costuma cobrar.\n:::\n:::',
  mapa:':::mapa MAPA MENTAL — TÍTULO DO ASSUNTO\n:::azul IDEIA CENTRAL\n**Regra principal em uma frase.**\n:::\n:::verde SITUAÇÃO 1\n**O que fazer**\n- Exemplo explicado.\n:::\n:::verde SITUAÇÃO 2\n**O que fazer**\n- Exemplo explicado.\n:::\n:::vermelho EXCEÇÃO 1\n**O que evitar**\n- Exemplo explicado.\n:::\n:::amarelo ATENÇÃO À PROVA\n**Ponto de atenção**\n- Pegadinha comentada.\n:::\n:::',
  imagens:':::imagens EXEMPLOS ILUSTRADOS\n\nInsira as imagens aqui usando o botão de upload. Cada imagem ficará com sua legenda.\n\n:::',
  tabela:'| Situação | Regra | Exemplo |\n| --- | --- | --- |\n| Caso 1 | Explicação | Exemplo comentado |\n| Caso 2 | Explicação | Exemplo comentado |'
};
function insertContent(value){const field=$('content');field.setRangeText('\n\n'+value+'\n\n',field.selectionStart,field.selectionEnd,'end');dirty=true;preview();field.focus();}
function validImageUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
function convertPastedHtml(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,svg,button,nav,form,input,textarea,link,meta').forEach(n=>n.remove());
  let externalImages=0,missingImages=0;
  const escapeText=text=>text.replace(/\r/g,'').replace(/:::/g,': : :');
  function convert(node,depth=0){
    if(depth>35)return '';
    if(node.nodeType===3)return escapeText(node.textContent);
    if(node.nodeType!==1)return '';
    const tag=node.tagName.toLowerCase(),children=()=>[...node.childNodes].map(n=>convert(n,depth+1)).join('');
    if(tag==='br')return '\n';
    if(/^h[1-6]$/.test(tag))return '\n\n'+'#'.repeat(Math.min(Number(tag[1]),4))+' '+children().trim()+'\n\n';
    if(tag==='strong'||tag==='b')return '**'+children().trim()+'**';
    if(tag==='u')return '__'+children().trim()+'__';
    if(tag==='mark')return '=='+children().trim()+'==';
    if(tag==='hr')return '\n\n---\n\n';
    if(tag==='pre')return '\n\n'+node.textContent+'\n\n';
    if(tag==='code')return '`'+node.textContent+'`';
    if(tag==='li')return '\n- '+children().trim()+'\n';
    if(tag==='ul'||tag==='ol')return '\n'+children()+'\n';
    if(tag==='blockquote')return '\n\n'+children().trim().split('\n').filter(Boolean).map(line=>'> '+line).join('\n')+'\n\n';
    if(tag==='table'){
      const rows=[...node.querySelectorAll('tr')].filter(row=>row.closest('table')===node).map(row=>[...row.children].filter(c=>/^(TH|TD)$/.test(c.tagName)).map(cell=>convert(cell,depth+1).trim().replace(/\n+/g,' ').replace(/\|/g,'／')));
      if(!rows.length)return '';const count=Math.max(...rows.map(r=>r.length));const line=row=>'| '+Array.from({length:count},(_,i)=>row[i]||'').join(' | ')+' |';return '\n\n'+line(rows[0])+'\n'+line(Array(count).fill('---'))+'\n'+rows.slice(1).map(line).join('\n')+'\n\n';
    }
    if(tag==='img'){
      const src=node.getAttribute('src')||'',alt=(node.getAttribute('alt')||'Imagem da aula').replace(/[\[\]\r\n]/g,'');
      if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(src)){
        const total=Object.values(images).reduce((n,v)=>n+v.length,src.length);if(total>4*1024*1024){missingImages++;return '\n\n[Imagem excede o limite da aula]\n\n';}const key='imagem-'+crypto.randomUUID();images[key]=src;return '\n\n!['+alt+']('+key+')\n\n';
      }
      if(validImageUrl(src)&&!/[\s)]/.test(src)){externalImages++;return '\n\n!['+alt+']('+src+')\n\n';}
      missingImages++;return '\n\n[Imagem não incluída na cópia]\n\n';
    }
    const style=node.getAttribute('style')||'',classes=node.getAttribute('class')||'';
    if(['div','section','article','aside','span'].includes(tag)){
      const colors=style+' '+classes;
      let color=/\b(?:green|emerald)\b/i.test(colors)?'verde':/\b(?:red|rose)\b/i.test(colors)?'vermelho':/\b(?:blue|sky|cyan)\b/i.test(colors)?'azul':/\b(?:yellow|amber|orange)\b/i.test(colors)?'amarelo':null;
      const rgb=style.match(/(?:background(?:-color)?|color)\s*:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if(!color&&rgb){const [r,g,b]=rgb.slice(1).map(Number);if(g>r*1.2&&g>b*1.1)color='verde';else if(r>g*1.3&&r>b*1.3)color='vermelho';else if(b>r*1.2&&b>g*1.1)color='azul';else if(r>b*1.4&&g>b*1.3)color='amarelo';}
      if(tag!=='span'&&(/display\s*:\s*grid/i.test(style)||/\bgrid(?:-cols-\d)?\b/.test(classes))){const kind=node.querySelectorAll('img').length>1?'imagens':'mapa';return '\n\n:::'+kind+'\n'+children().trim()+'\n:::\n\n';}
      const block=tag!=='span'&&(/border(?:-radius)?\s*:|background(?:-color)?\s*:/i.test(style)||/(?:border|rounded|bg-(?:green|red|blue|yellow|emerald|rose|sky|amber))/.test(classes));
      if(block){const inner=children().trim();if(!inner)return '';return '\n\n:::'+(color||'quadro')+'\n'+inner+'\n:::\n\n';}
    }
    const result=children();return /^(p|div|section|article|figure|figcaption|aside)$/.test(tag)?'\n\n'+result.trim()+'\n\n':result;
  }
  const content=[...doc.body.childNodes].map(n=>convert(n)).join('').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return {content,externalImages,missingImages};
}
$('content').addEventListener('paste',async event=>{
  const clipboard=event.clipboardData;if(!clipboard)return;
  const plain=clipboard.getData('text/plain'),html=clipboard.getData('text/html');
  const files=[...clipboard.files].filter(file=>file.type.startsWith('image/'));
  if(!plain&&!html&&files.length){event.preventDefault();$('saveLesson').disabled=true;try{for(const file of files)await imageFile(file);$('editorStatus').textContent='Imagens coladas e inseridas na aula.';}catch(e){$('editorStatus').textContent=e.message;}finally{$('saveLesson').disabled=false;}return;}
  let source=plain.trim();const fence=source.match(/^```(?:html|markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);if(fence)source=fence[1];
  const rawHtml=/^\s*(?:<!doctype html|<(?:html|article|section|div|table|h[1-6]|p)[\s>])/i.test(source);
  const markdown=/^:::(?:quadro|mapa|verde|vermelho|azul|amarelo|imagens)\b/m.test(source)||/^#{1,4}\s/m.test(source);
  if(!rawHtml&&(!html||markdown)&&!fence)return;
  event.preventDefault();
  try{
    const priorImages={...images};const result=rawHtml||(!markdown&&html)?convertPastedHtml(rawHtml?source:html):{content:source};
    if($('content').value.length-($('content').selectionEnd-$('content').selectionStart)+result.content.length+4>150000){images=priorImages;throw Error('O texto excede o limite de 150 mil caracteres por aula.');}
    insertContent(result.content);$('editorStatus').textContent='Conteúdo colado e formatado automaticamente. Confira a prévia.'+(result.externalImages?' Imagens por link dependem da disponibilidade no site de origem.':'')+(result.missingImages?' Algumas imagens não vieram na cópia; você pode copiar a imagem e colar diretamente neste campo.':'');
  }catch(e){$('editorStatus').textContent='Não foi possível converter: '+e.message;}
});
for(const button of document.querySelectorAll('[data-frame]'))button.onclick=()=>insertContent(frameTemplates[button.dataset.frame]);
$('importLessonText').onchange=async()=>{const input=$('importLessonText');try{const file=input.files[0];if(!file)return;if(file.size>600000)throw Error('O arquivo deve ter até 600 KB.');let text=await file.text();text=text.replace(/^\uFEFF/,'').trim();const fence=text.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);if(fence)text=fence[1];if(text.length>150000)throw Error('O conteúdo deve ter até 150 mil caracteres.');if($('content').value.trim()&&!confirm('Substituir o conteúdo atual pelo texto importado?'))return;$('content').value=text;dirty=true;preview();$('editorStatus').textContent='Texto importado. Confira a prévia; adicione as imagens usando o upload.';}catch(e){$('editorStatus').textContent=e.message;}finally{input.value='';}};
$('copyLessonPrompt').onclick=async()=>{const text='Crie uma aula esquematizada para concursos policiais sobre [ASSUNTO], na disciplina [DISCIPLINA]. Entregue apenas Markdown, sem HTML e sem envolver a aula inteira em cercas de código. Use títulos # e ##, **negrito**, listas e tabelas Markdown. Para quadros visuais, use exatamente os delimitadores abaixo, cada um em sua própria linha. Cada bloco aberto deve terminar com ::: em uma linha separada. Os blocos coloridos podem ficar dentro de um quadro ou mapa. No mapa, o primeiro bloco azul é a ideia central e ocupa a largura toda; os demais ficam lado a lado. Não crie novas variações dos delimitadores.\n\n'+frameTemplates.resumo+'\n\n'+frameTemplates.mapa+'\n\nInclua regras, exemplos, exceções e pegadinhas explicadas. Use os quadros apenas onde ajudarem o estudo. Imagens serão inseridas depois por upload; não invente links ou códigos de imagens.';try{await navigator.clipboard.writeText(text);$('editorStatus').textContent='Instruções copiadas. Cole no ChatGPT e substitua [ASSUNTO] e [DISCIPLINA].';}catch{$('editorStatus').textContent='Não foi possível copiar automaticamente. O formato dos quadros está nos modelos e na ajuda abaixo.';}};
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

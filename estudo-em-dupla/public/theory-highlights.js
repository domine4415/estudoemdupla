'use strict';
window.lessonHighlighter=(()=>{
  let userId='',lessonId='',marks=[],selection=null,loadVersion=0,ready=false;
  let saveQueue=Promise.resolve();
  const paper=()=>document.getElementById('lessonPaper');
  const status=message=>{document.getElementById('highlightStatus').textContent=message;};
  const key=()=>`policial_grifos_v1:${userId}:${lessonId}`;
  function textNodes(){const walker=document.createTreeWalker(paper(),4),nodes=[];let node;while((node=walker.nextNode()))nodes.push(node);return nodes;}
  function valid(mark,text){return mark&&['amarelo','verde','azul'].includes(mark.color)&&Number.isInteger(mark.start)&&Number.isInteger(mark.end)&&mark.start>=0&&mark.end>mark.start&&mark.end<=text.length&&mark.quote===text.slice(mark.start,mark.end);}
  function paint(){
    const root=paper();for(const mark of root.querySelectorAll('mark[data-personal-highlight]'))mark.replaceWith(...mark.childNodes);root.normalize();
    const nodes=textNodes();let offset=0;
    for(const node of nodes){const start=offset,end=start+node.textContent.length;offset=end;const overlaps=marks.filter(m=>m.start<end&&m.end>start).sort((a,b)=>a.start-b.start);if(!overlaps.length)continue;const fragment=document.createDocumentFragment();let cursor=0;
      for(const mark of overlaps){const a=Math.max(start,mark.start)-start,b=Math.min(end,mark.end)-start;if(a<cursor)continue;if(a>cursor)fragment.append(document.createTextNode(node.textContent.slice(cursor,a)));const span=document.createElement('mark');span.dataset.personalHighlight=mark.color;span.textContent=node.textContent.slice(a,b);fragment.append(span);cursor=b;}
      if(cursor<node.textContent.length)fragment.append(document.createTextNode(node.textContent.slice(cursor)));node.replaceWith(fragment);
    }
  }
  async function request(id,body){
    const response=await fetch('/api/theory/highlights/'+id,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível salvar os grifos.');return data;
  }
  function persist(){
    try{localStorage.setItem(key(),JSON.stringify(marks));}catch{}
    const id=lessonId,version=loadVersion,snapshot=marks.map(m=>({...m}));status('Salvando grifos na sua conta...');
    saveQueue=saveQueue.catch(()=>{}).then(()=>request(id,{marks:snapshot})).then(()=>{if(version===loadVersion)status('Grifos salvos na sua conta.');}).catch(error=>{if(version===loadVersion)status(error.message+' Os grifos ainda não foram salvos na conta; tente grifar novamente quando a conexão voltar.');});
  }
  function capture(){
    const s=window.getSelection(),root=paper();if(!s?.rangeCount||s.isCollapsed)return;
    const range=s.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer)){selection=null;return;}
    const before=document.createRange();before.selectNodeContents(root);before.setEnd(range.startContainer,range.startOffset);const start=before.toString().length;selection={start,end:start+range.toString().length};
  }
  function subtract(items,start,end,text){
    return items.flatMap(m=>{if(m.end<=start||m.start>=end)return [m];const parts=[];if(m.start<start)parts.push({...m,end:start,quote:text.slice(m.start,start)});if(m.end>end)parts.push({...m,start:end,quote:text.slice(end,m.end)});return parts;});
  }
  function apply(color){
    if(!userId||!lessonId)return;if(!ready){status('Aguarde o carregamento dos grifos da conta.');return;}capture();if(!selection){status('Selecione o texto da aula antes de escolher a cor ou remover o grifo.');return;}
    const text=paper().textContent,{start,end}=selection;if(end<=start||end>text.length){selection=null;return;}
    const next=subtract(marks,start,end,text);if(color!=='remove')next.push({start,end,color,quote:text.slice(start,end)});
    if(next.length>500){status('Limite de 500 grifos por aula. Remova alguns para continuar.');return;}
    marks=next.sort((a,b)=>a.start-b.start);paint();selection=null;window.getSelection()?.removeAllRanges();persist();
  }
  document.addEventListener('selectionchange',capture);
  for(const button of document.querySelectorAll('[data-highlight]')){button.addEventListener('mousedown',event=>event.preventDefault());button.onclick=()=>apply(button.dataset.highlight);}
  return {setUser(id){userId=id||'';},async open(id){
    const version=++loadVersion;lessonId=id;selection=null;marks=[];ready=false;status('Carregando grifos da sua conta...');
    try{
      await saveQueue;const data=await request(id);if(version!==loadVersion)return;
      const text=paper().textContent,stored=data.marks;
      if(Array.isArray(stored))marks=stored.slice(0,500).filter(m=>valid(m,text)).sort((a,b)=>a.start-b.start);
      marks=marks.filter((m,i)=>i===0||m.start>=marks[i-1].end);paint();ready=true;status('Selecione um trecho e escolha a cor. Seus grifos são salvos na conta.');
    }catch(error){if(version!==loadVersion)return;status(error.message+' Reabra a aula para tentar novamente.');}
  },subtract,valid};
})();

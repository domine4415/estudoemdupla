/* ESTUDO POLICIAL — fórmulas somente em trechos alterados e próximos da tela. */
(()=>{
 'use strict';
 const base='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
 const selectors='.statement,.answer-label,.rich-comment,#bankStatement,#questionStatement,#feedback,#bankFeedback';
 const pending=new Set(),visible=new WeakSet(),observed=new WeakSet(),processed=new WeakMap();
 let loading=false,ready=false,scheduled=false;
 const idle=callback=>window.requestIdleCallback?window.requestIdleCallback(callback,{timeout:600}):setTimeout(()=>callback({timeRemaining:()=>5}),16);
 const intersection=window.IntersectionObserver?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){visible.add(entry.target);queue(entry.target);}else visible.delete(entry.target);},{rootMargin:'350px'}):null;
 function loadAssets(){
  if(loading||ready)return;loading=true;
  const style=document.createElement('link');style.rel='stylesheet';style.href=base+'katex.min.css';document.head.append(style);
  function script(url,done){const node=document.createElement('script');node.src=url;node.async=true;node.onload=done;node.onerror=()=>{loading=false;console.warn('Não foi possível carregar as fórmulas.');};document.head.append(node);}
  script(base+'katex.min.js',()=>script(base+'contrib/auto-render.min.js',()=>{ready=true;schedule();}));
 }
 function queue(node){
  if(!node?.isConnected)return;
  const text=node.textContent||'';if(processed.get(node)===text||!/\\\(|\\\[|\$\$/.test(text))return;
  if(intersection&&!observed.has(node)){observed.add(node);intersection.observe(node);}
  if(intersection&&!visible.has(node))return;
  pending.add(node);if(!ready)loadAssets();else schedule();
 }
 function collect(root){
  if(root.nodeType===3){const parent=root.parentElement?.closest(selectors);if(parent)queue(parent);return;}
  if(root.nodeType!==1)return;
  if(root.matches(selectors))queue(root);
  for(const node of root.querySelectorAll(selectors))queue(node);
 }
 function schedule(){if(scheduled||!ready)return;scheduled=true;idle(render);}
 function render(deadline){
  scheduled=false;let count=0;
  for(const node of pending){
   pending.delete(node);if(!node.isConnected)continue;
   const text=node.textContent||'';if(processed.get(node)===text)continue;
   try{window.renderMathInElement(node,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,trust:false,strict:'warn'});processed.set(node,node.textContent||'');}catch{processed.set(node,text);}
   if(++count>=2||deadline.timeRemaining()<2)break;
  }
  if(pending.size)schedule();
 }
 const observer=new MutationObserver(records=>{
  for(const record of records){for(const node of record.addedNodes||[])collect(node);const parent=record.target.nodeType===1?record.target:record.target.parentElement;const candidate=parent?.closest(selectors);if(candidate)queue(candidate);}
 });
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});collect(document.body);
 window.estudoRenderMath=()=>collect(document.body);
})();

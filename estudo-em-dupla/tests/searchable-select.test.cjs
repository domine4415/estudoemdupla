const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('busca ignora acentos, seleciona resultado e sincroniza ao clicar sem erro de escopo',()=>{
 let click;const elements=[];
 const doc={activeElement:null,querySelector:()=>null,addEventListener:(type,fn)=>{if(type==='click')click=fn;}};
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.listeners={};this.value='';this.classList={add(){},toggle(){}};elements.push(this);}
  append(...nodes){this.children.push(...nodes);}before(){}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}select(){}focus(){doc.activeElement=this;}scrollIntoView(){}click(){this.onclick?.();}addEventListener(type,fn){this.listeners[type]=fn;}dispatchEvent(event){this.listeners[event.type]?.(event);}
 }
 const select=new Element('select');select.id='subject';select.dataset={searchable:'Disciplina'};select.options=[{value:'',textContent:'Todas as disciplinas'},{value:'p',textContent:'Língua Portuguesa'}];Object.defineProperty(select,'selectedOptions',{get:()=>select.options.filter(o=>o.value===select.value)});
 doc.querySelectorAll=()=>[select];doc.createElement=tag=>new Element(tag);
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/searchable-select.js'),'utf8'),{document:doc,MutationObserver:class{observe(){}},Event,setTimeout:fn=>fn()});
 const input=elements.find(e=>e.tagName==='input'),list=elements.find(e=>e.id==='subjectList');input.focus();input.onfocus();input.value='portugues';input.oninput();assert.equal(list.children.length,1);assert.equal(list.children[0].textContent,'Língua Portuguesa');input.onkeydown({key:'Enter',preventDefault(){}});assert.equal(select.value,'p');assert.equal(input.value,'Língua Portuguesa');assert.doesNotThrow(()=>click());
});

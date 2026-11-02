const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('calendário mantém datas ISO nos filtros, permite limpar e sincroniza reset',()=>{
 const created=[];let document;
 class E{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.listeners={};this.value='';this.textContent='';this.className='';this.offsetHeight=350;this.classList={add:c=>{this.className+=' '+c;},toggle:()=>{}};created.push(this);}
  append(...nodes){this.children.push(...nodes);}add(node){this.children.push(node);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;if(k==='tabindex')this.tabIndex=Number(v);}addEventListener(k,v){this.listeners[k]=v;}dispatchEvent(event){this.listeners[event.type]?.(event);}after(node){this.afterNode=node;}focus(){document.activeElement=this;}getBoundingClientRect(){return {left:30,top:30,bottom:76};}contains(node){return node===this||this.children.some(c=>c.contains?.(node));}
  querySelector(selector){const all=[];function walk(n){all.push(n);n.children.forEach(walk);}walk(this);return all.find(n=>selector==='[tabindex="0"]'?n.tabIndex===0:selector.startsWith('[data-date=')?n.dataset.date===selector.match(/"([^"]+)"/)[1]&&!n.disabled:n.tagName==='button'&&!n.disabled)||null;}
 }
 const input=new E('input');input.id='statsStart';input.value='2026-11-02';input.form=new E('form');const label={textContent:'A partir de'};
 document={body:new E('body'),activeElement:null,querySelectorAll:()=>[input],querySelector:()=>label,createElement:tag=>new E(tag),addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/date-picker.js'),'utf8'),{document,window:{innerWidth:1000,innerHeight:900,addEventListener(){}},Option:class{constructor(text,value){this.text=text;this.value=value;}},Event,setTimeout:fn=>fn()});
 const trigger=input.afterNode;assert.equal(input.hidden,true);assert.equal(trigger.textContent,'02/11/2026');trigger.onclick();const popup=created.find(e=>e.className==='date-picker-popup'),grid=created.find(e=>e.className==='date-picker-grid');assert.equal(popup.hidden,false);
 grid.children.find(e=>e.dataset.date==='2026-11-07').onclick();assert.equal(input.value,'2026-11-07');assert.equal(trigger.textContent,'07/11/2026');assert.equal(popup.hidden,true);
 trigger.onclick();created.find(e=>e.className==='date-picker-footer').children[0].onclick();assert.equal(input.value,'');assert.equal(trigger.textContent,'Selecionar data');
 input.value='2026-10-01';input.form.listeners.reset();assert.equal(trigger.textContent,'01/10/2026');
});

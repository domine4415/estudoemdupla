const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('navegação mantém a sala e permite visitar todas as páginas internas',()=>{
 class Element{constructor(){this.classList={contains:()=>false,add(){},remove(){}};this.children=[];}append(...nodes){this.children.push(...nodes);}remove(){this.removed=true;}setAttribute(){}}
 const listeners={},body=new Element(),workspace=new Element(),mute=new Element();mute.textContent='Silenciar microfone';mute.disabled=false;
 const location={href:'https://study.test/?room=ABC123',origin:'https://study.test',pathname:'/',search:'?room=ABC123'};
 const away=[];const window={roomScreen:{setAway:value=>away.push(value)},addEventListener:(event,fn)=>listeners[event]=fn,dispatchEvent(){}};window.parent=window;
 const context={window,document:{body,getElementById:id=>id==='workspace'?workspace:id==='voiceMute'?mute:null,createElement:()=>new Element(),addEventListener(){}},location,URL,history:{pushState(a,b,url){location.href=new URL(url,location.href).href;}},Event:class{},MutationObserver:class{observe(){}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/room-navigation.js','utf8'),context);
 for(const path of ['/banco','/teoria','/banco#estatisticas','/comunidade','/','/?view=salas','/?action=criar']){assert.equal(window.roomBrowse.open('https://study.test'+path),true);assert.equal(location.href,'https://study.test'+path);}
 assert.deepEqual(away,[true]);assert.equal(body.children.length,2);window.roomBrowse.close();assert.equal(location.href,'https://study.test/?room=ABC123');assert.deepEqual(away,[true,false]);
});

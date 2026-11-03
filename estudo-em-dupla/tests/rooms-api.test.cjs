const test=require('node:test');
const assert=require('node:assert/strict');
const create=require('../rooms-api');
function fixture(overrides={}){
 const rooms=new Map(),saved=new Map();
 const api=create({rooms,storageEnabled:true,parseJson:async req=>req.body,send:(res,status,data)=>Object.assign(res,{status,data}),err:(res,status,error)=>Object.assign(res,{status,data:{error}}),normalizeQuestion:q=>q,databaseRequest:async(endpoint,options)=>{
  if(options){const body=JSON.parse(options.body);saved.set(body.code,body.state);return {};}
  if(endpoint.startsWith('dupla_bank_questions'))return {json:async()=>[{data:{id:'q1',statement:'Pergunta',alternatives:[{letter:'A',text:'Opção A'},{letter:'B',text:'Opção B'}],correct:'A',commentary:'Explicação com resposta'}}]};
  const p=new URL('http://local/'+endpoint).searchParams;
  if(p.has('code'))return {json:async()=>saved.has(p.get('code').slice(3))?[{state:saved.get(p.get('code').slice(3))}]:[]};
  return {json:async()=>[...saved].map(([code,state])=>({code,state}))};
 },...overrides});
 async function call(path,user='owner',body,method=body?'POST':'GET'){const res={};await api.handle({method,body},res,new URL('http://local/api/'+path),{id:user});return res;}
 return {rooms,saved,api,call};
}
test('qualquer conta cria, protege com senha, define capacidade e oculta gabarito até a revelação',async()=>{
 const {call,rooms}=fixture();const created=await call('room','owner',{name:'Dono',maxParticipants:3,access:'password',password:'1234'});assert.equal(created.status,201);const code=created.data.code;assert.match(code,/^[A-Z0-9]{6}$/);assert.notEqual(rooms.get(code).passwordHash,'1234');
 assert.equal((await call(`room/${code}/join`,'p1',{password:'errada'})).status,403);
 const joins=await Promise.all(['p1','p2','p3'].map(id=>call(`room/${code}/join`,id,{name:id,password:'1234'})));assert.equal(joins.filter(r=>r.status===200).length,2);assert.equal(joins.filter(r=>r.status===409).length,1);
 assert.equal((await call(`room/${code}/from-bank`,'owner',{})).status,200);
 for(const who of ['owner','p1','p2']){const result=await call(`room/${code}/state`,who);assert.equal(result.data.question.correct,undefined);assert.equal(result.data.question.commentary,undefined);assert.equal(result.data.participants.length,3);if(who==='owner')assert.equal(result.data.questions[0].correct,undefined);}
 for(const action of ['key','edit','import'])assert.equal((await call(`room/${code}/${action}`,'owner',{questions:[]})).status,403);
 assert.equal((await call(`room/${code}/navigate`,'p1',{index:0})).status,403);
 await call(`room/${code}/answer`,'owner',{index:0,choice:'A'});await call(`room/${code}/answer`,'p1',{index:0,choice:'B'});assert.equal((await call(`room/${code}/state`,'owner')).data.revealed,false);await call(`room/${code}/answer`,'p2',{index:0,choice:'A'});const state=(await call(`room/${code}/state`,'owner')).data;assert.equal(state.revealed,true);assert.equal(state.question.correct,rooms.get(code).questions[0].correct);assert.equal(state.question.commentary,rooms.get(code).questions[0].commentary);assert.ok(state.participants.every(p=>p.correctCount+p.wrongCount===1));
 await call(`room/${code}/leave`,'p1',{});assert.equal((await call(`room/${code}/join`,'p3',{password:'1234'})).status,200);
});
test('inatividade encerra a sala e persiste o encerramento',async()=>{
 const {call,rooms,saved,api}=fixture();const created=await call('room','owner',{maxParticipants:4,access:'open'});const code=created.data.code;rooms.get(code).lastActivity=Date.now()-31*60*1000;await api.sweep();assert.equal(saved.get(code).isOpen,false);assert.equal((await call(`room/${code}/join`,'p1',{})).status,409);assert.equal((await call('rooms','p1')).data.rooms.length,0);
});

test('permite trocar antes da revelação e contabiliza apenas a resposta final',async()=>{
 const awards=[];const {call,rooms}=fixture({recordAnswer:async(...args)=>awards.push(args)});const created=await call('room','owner',{maxParticipants:2});const code=created.data.code;await call(`room/${code}/join`,'p1',{});await call(`room/${code}/from-bank`,'owner',{});const correct=rooms.get(code).questions[0].correct,wrong=rooms.get(code).questions[0].alternatives.find(a=>a.letter!==correct).letter;
 await call(`room/${code}/answer`,'owner',{index:0,choice:wrong});assert.equal(awards.length,0);
 assert.equal((await call(`room/${code}/answer`,'owner',{index:0,choice:correct})).status,200);assert.equal((await call(`room/${code}/state`,'owner')).data.myAnswer,correct);assert.equal(awards.length,0);
 await call(`room/${code}/answer`,'p1',{index:0,choice:wrong});assert.equal(awards.length,2);assert.equal(awards.find(a=>a[0]==='owner')[3],true);assert.equal(awards.find(a=>a[0]==='p1')[3],false);
 assert.equal((await call(`room/${code}/answer`,'owner',{index:0,choice:wrong})).status,409);await call(`room/${code}/reveal`,'owner',{});assert.equal(awards.length,2);
});

test('somente o dono altera a senha, sem desconectar participantes existentes',async()=>{
 const {call,rooms}=fixture();const created=await call('room','owner',{maxParticipants:4});const code=created.data.code;await call(`room/${code}/join`,'p1',{});
 assert.equal((await call(`room/${code}/settings`,'p1',{access:'password',password:'1234'})).status,403);
 assert.equal((await call(`room/${code}/settings`,'owner',{access:'password',password:'1234'})).status,200);assert.ok(rooms.get(code).passwordHash);
 assert.equal((await call(`room/${code}/state`,'p1')).status,200);assert.equal((await call(`room/${code}/join`,'p2',{})).status,403);
 await call(`room/${code}/settings`,'owner',{access:'open'});assert.equal(rooms.get(code).passwordHash,null);assert.equal((await call(`room/${code}/join`,'p2',{})).status,200);
});
test('dono expulsa, libera vaga, corta eventos e permite reentrada',async()=>{
 const {call,rooms}=fixture();const created=await call('room','owner',{maxParticipants:3});const code=created.data.code;await call(`room/${code}/join`,'p1',{});await call(`room/${code}/join`,'p2',{});
 assert.equal((await call(`room/${code}/kick`,'p1',{userId:'p2'})).status,403);assert.equal((await call(`room/${code}/kick`,'owner',{userId:'owner'})).status,400);
 const events=[];let ended=false;const client={roomUserId:'p1',write:event=>events.push(event),end:()=>ended=true};rooms.get(code).clients.add(client);
 assert.equal((await call(`room/${code}/kick`,'owner',{userId:'p1'})).status,200);assert.equal(ended,true);assert.ok(events.some(e=>e.includes('expelled')));assert.equal(rooms.get(code).members.length,2);
 assert.equal((await call(`room/${code}/state`,'p1')).status,403);assert.equal((await call(`room/${code}/join`,'p1',{})).status,200);assert.equal((await call(`room/${code}/join`,'p3',{})).status,409);
});
test('chat fica restrito aos participantes, persiste texto e envia evento em tempo real',async()=>{
 const {call,rooms,saved}=fixture();const created=await call('room','owner',{name:'Dono',maxParticipants:3});const code=created.data.code;await call(`room/${code}/join`,'p1',{name:'Pessoa'});
 assert.equal((await call(`room/${code}/chat`,'outsider')).status,403);assert.equal((await call(`room/${code}/chat`,'outsider',{text:'Mensagem'})).status,403);
 const events=[];rooms.get(code).clients.add({roomUserId:'p1',write:event=>events.push(event)});
 const sent=await call(`room/${code}/chat`,'owner',{text:'<script>alert(1)</script> Olá!'});assert.equal(sent.status,200);assert.equal(sent.data.message.name,'Dono');assert.equal(saved.get(code).messages.length,1);assert.ok(events.some(s=>s.includes('event: chat')));
 const history=await call(`room/${code}/chat`,'p1');assert.equal(history.data.messages[0].text,'<script>alert(1)</script> Olá!');assert.equal(history.data.messages[0].token,undefined);
 assert.equal((await call(`room/${code}/chat`,'owner',{text:'Outra mensagem'})).status,429);assert.equal((await call(`room/${code}/chat`,'p1',{text:'x'.repeat(1001)})).status,400);
 await call(`room/${code}/kick`,'owner',{userId:'p1'});assert.equal((await call(`room/${code}/chat`,'p1')).status,403);
});

test('sinalização de tela preserva mídia, sessão e destino e exige participante',async()=>{const {call,rooms}=fixture();const created=await call('room','owner',{maxParticipants:3});const code=created.data.code;await call(`room/${code}/join`,'p1',{});const events=[];rooms.get(code).clients.add({roomUserId:'p1',write:value=>events.push(value)});const result=await call(`room/${code}/voice`,'owner',{signal:{type:'ready',session:'screen-session',media:'screen',sharing:true,to:'p1'}});assert.equal(result.status,200);assert.match(events[0],/"media":"screen"/);assert.match(events[0],/"sharing":true/);assert.equal((await call(`room/${code}/voice`,'stranger',{signal:{type:'ready',session:'x',media:'screen'}})).status,403);});


test('consulta lenta de perfis não bloqueia continuar ou entrar na sala',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);let reading=false;const {call}=fixture({publicMembers:async()=>{reading=true;return pending;}});const created=await call('room','owner',{maxParticipants:3});const code=created.data.code;const state=call(`room/${code}/state`);while(!reading)await new Promise(setImmediate);
 try{const restore=await Promise.race([call(`room/${code}/restore`),new Promise((_,reject)=>setTimeout(()=>reject(Error('Restore bloqueado pela consulta de perfis')),200))]);assert.equal(restore.status,200);assert.equal((await call(`room/${code}/join`,'p1',{})).status,200);}finally{release([]);await state;}
});

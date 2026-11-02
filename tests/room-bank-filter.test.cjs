const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const select=require('../room-bank-filter');
const owner='owner',guest='guest';
const key=s=>crypto.createHash('sha256').update(s).digest('hex');
function fixture(){const calls=[];const room={code:'ABC123',hostUserId:owner,members:[{userId:owner},{userId:guest}],questions:[{statement:'Atual'}],votes:{0:{choices:{owner:'A'}}},solvedQuestionKeys:[key('Anterior')]};
 const rows=['Banco','Histórico','Atual','Anterior','Nova'].map((s,i)=>({id:String(i),data:{statement:s},statement:s}));
 const db=async endpoint=>{calls.push(endpoint);const p=new URL('http://local/'+endpoint).searchParams;let result=[];if(endpoint.startsWith('dupla_bank_questions'))result=rows;if(endpoint.startsWith('dupla_bank_attempts'))result=[{question_id:'0'}];if(endpoint.startsWith('policial_room_answers'))result=p.has('room_code')?[{question_key:key('Histórico')}]:[{question_key:key('Histórico')}];return {json:async()=>result};};return {room,db,calls};}
test('não resolvidas do participante combina banco e salas e valida participação',async()=>{
 const {room,db,calls}=fixture();const rows=await select({databaseRequest:db,room,body:{history:'participant',participantId:guest}});assert.deepEqual(rows.map(r=>r.statement),['Atual','Anterior','Nova']);assert.ok(calls.some(c=>c.includes('user_id=eq.guest')));
 await assert.rejects(select({databaseRequest:db,room,body:{history:'participant',participantId:'fora'}}),/nesta sala/);
});
test('não resolvidas nesta sala considera questões atuais e anteriores',async()=>{
 const {room,db}=fixture();const rows=await select({databaseRequest:db,room,body:{history:'room'}});assert.deepEqual(rows.map(r=>r.statement),['Banco','Nova']);
});
test('filtros editoriais, banca, ano, modo e dono são enviados corretamente',async()=>{
 const {room,db,calls}=fixture();await select({databaseRequest:db,room,body:{subject:'Português',topic:'Sintaxe',history:'owner',board:'Banca',year:'2026',type:'true_false',onlyOriginal:true,excludeOutdated:true}});const p=new URL('http://local/'+calls.find(c=>c.startsWith('dupla_bank_questions'))).searchParams;assert.equal(p.get('board'),'eq.Banca');assert.equal(p.get('exam_year'),'eq.2026');assert.equal(p.get('data->>type'),'eq.true_false');assert.equal(p.get('data->>isOriginal'),'eq.true');assert.ok(p.get('or').includes('isOutdated'));assert.ok(calls.some(c=>c.includes('user_id=eq.owner')));
});

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const create=require('../bank-api');
function setup(options={}){
 const questions=[{id:'q1',subject:'Português',topic:'Sintaxe',board:'B1',statement:'Pergunta'},{id:'q2',subject:'Legislação',topic:'Leis',board:'B2',statement:'Outra pergunta'}];
 const bank=[{id:2,question_id:'q1',is_correct:true,answered_at:'2026-11-02T14:00:00Z'},{id:1,question_id:'q1',is_correct:false,answered_at:'2026-11-01T14:00:00Z'}];
 const room=[{room_code:'ABC123',question_key:'new',subject:'Português',topic:'Sintaxe',board:'B1',is_correct:false,answered_at:'2026-11-02T15:00:00Z'},{room_code:'DEF456',question_key:crypto.createHash('sha256').update('Pergunta').digest('hex'),subject:'',topic:'',board:'',is_correct:true,answered_at:'2026-11-02T16:00:00Z'},{room_code:'GHI789',question_key:'law',subject:'Legislação',topic:'Leis',board:'B2',is_correct:true,answered_at:'2026-10-31T14:00:00Z'}];
 const api=create({storageEnabled:true,send:(res,status,data)=>Object.assign(res,{status,data}),err:(res,status,error)=>Object.assign(res,{status,error}),databaseRequest:async endpoint=>{
  if(endpoint.startsWith('policial_room_answers')&&options.missingRooms)throw Object.assign(Error('missing relation'),{databaseCode:'PGRST205'});
  const p=new URL('http://local/'+endpoint).searchParams;let rows=endpoint.startsWith('dupla_bank_questions')?questions:endpoint.startsWith('dupla_bank_attempts')?bank:room;
  if(!endpoint.startsWith('dupla_bank_questions'))assert.equal(p.get('user_id'),'eq.user');
  for(const field of ['subject','topic','board'])if(p.has(field))rows=rows.filter(r=>'eq.'+r[field]===p.get(field));
  for(const value of p.getAll('answered_at')){const greater=value.startsWith('gte.');const time=Date.parse(value.slice(greater?4:3));rows=rows.filter(r=>greater?Date.parse(r.answered_at)>=time:Date.parse(r.answered_at)<time);}
  const offset=Number(p.get('offset'));return {json:async()=>rows.slice(offset,offset+1000)};
 }});
 return async path=>{const response={};await api.handle({method:'GET'},response,new URL('http://local/api/bank/'+path),{id:'user'});return response;};
}
test('estatísticas somam banco e salas respeitando matéria, tópico, banca e data',async()=>{
 const call=setup();const result=await call('statistics?subject=Português&topic=Sintaxe&board=B1&start=2026-11-02&end=2026-11-02');assert.equal(result.status,200);assert.equal(result.data.answered,3);assert.equal(result.data.correct,2);assert.equal(result.data.wrong,1);assert.equal(result.data.roomAnswered,2);assert.equal(result.data.subjects.length,1);assert.equal(result.data.attempts,3);
});
test('resumo também conta salas e usa a última resposta do banco por questão',async()=>{
 const result=await setup()('progress');assert.equal(result.data.answered,4);assert.equal(result.data.correct,3);assert.equal(result.data.wrong,1);assert.equal(result.data.attempts,5);
});

test('tabela de salas ausente mantém os dados individuais com aviso explícito',async()=>{
 const result=await setup({missingRooms:true})('statistics');assert.equal(result.status,200);assert.equal(result.data.answered,1);assert.equal(result.data.correct,1);assert.equal(result.data.roomAnswered,0);assert.ok(result.data.warnings[0].includes('COMUNIDADE_SQL.sql'));
});

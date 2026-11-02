'use strict';
const crypto=require('node:crypto');
const {topicFilter}=require('./topic');
const clean=(v,n=180)=>typeof v==='string'?v.trim().slice(0,n):'';
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const key=q=>crypto.createHash('sha256').update(clean(q.statement,12000)).digest('hex');
module.exports=async function selectRoomQuestions({databaseRequest,room,body}){
 const mode=body.history||'all',subject=clean(body.subject),topic=clean(body.topic),board=clean(body.board,120),year=clean(body.year,4),type=body.type||'';
 if(topic&&!subject)fail('Escolha uma disciplina antes do assunto.');
 if(!['all','owner','room','participant'].includes(mode))fail('Filtro de histórico inválido.');
 if(year&&!/^\d{4}$/.test(year))fail('Ano inválido.');
 if(type&&!['true_false','multiple_choice'].includes(type))fail('Tipo de questão inválido.');
 const amount=Math.min(200,Math.max(1,parseInt(body.limit,10)||50)),seenIds=new Set(),seenKeys=new Set();
 async function all(table,params){const result=[];params.set('limit','1000');for(let offset=0;;offset+=1000){params.set('offset',String(offset));const rows=await (await databaseRequest(table+'?'+params)).json();result.push(...rows);if(rows.length<1000)return result;}}
 if(mode==='owner'||mode==='participant'){
  const target=mode==='owner'?room.hostUserId:body.participantId;
  if(!room.members.some(m=>m.userId===target))fail('Selecione uma pessoa que está nesta sala.');
  const [bank,rooms]=await Promise.all([all('dupla_bank_attempts',new URLSearchParams({select:'question_id',user_id:'eq.'+target,order:'id'})),all('policial_room_answers',new URLSearchParams({select:'question_key',user_id:'eq.'+target,order:'room_code,question_key'}))]);
  bank.forEach(a=>seenIds.add(a.question_id));rooms.forEach(a=>seenKeys.add(a.question_key));
 }
 if(mode==='room'){
  (room.solvedQuestionKeys||[]).forEach(k=>seenKeys.add(k));
  room.questions.forEach((q,i)=>{if(Object.values(room.votes[i]?.choices||{}).some(Boolean))seenKeys.add(key(q));});
  const history=await all('policial_room_answers',new URLSearchParams({select:'question_key',room_code:'eq.'+room.code,order:'user_id,question_key'}));history.forEach(a=>seenKeys.add(a.question_key));
 }
 const p=new URLSearchParams({select:'id,data,statement',published:'eq.true',order:'created_at.desc,id',limit:'500'});
 if(subject)p.set('subject','eq.'+subject);if(topic)p.set('topic',topicFilter(topic));if(board)p.set('board','eq.'+board);if(year)p.set('exam_year','eq.'+year);if(type)p.set('data->>type','eq.'+type);
 if(body.excludeOutdated===true)p.set('or','(data->>isOutdated.is.null,data->>isOutdated.eq.false)');
 if(body.onlyOriginal===true)p.set('data->>isOriginal','eq.true');
 const selected=[];
 for(let offset=0;selected.length<amount;offset+=500){p.set('offset',String(offset));const rows=await (await databaseRequest('dupla_bank_questions?'+p)).json();for(const row of rows){if(seenIds.has(row.id)||seenKeys.has(key(row.data||row)))continue;selected.push(row);if(selected.length===amount)break;}if(rows.length<500)break;}
 return selected;
};

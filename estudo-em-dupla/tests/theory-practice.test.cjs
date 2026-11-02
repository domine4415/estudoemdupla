const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const create=require('../bank-api');
const id='11111111-1111-4111-8111-111111111111';
test('modo de prática oculta resposta anterior, gabarito e comentário; responder revela e grava',async()=>{
 let writes=0;
 const api=create({storageEnabled:true,isAdmin:()=>false,parseJson:async r=>r.body,send:(r,status,data)=>Object.assign(r,{status,data}),err:(r,status,error)=>Object.assign(r,{status,error}),databaseRequest:async(endpoint,options)=>{
 if(endpoint.startsWith('dupla_bank_questions?'))return {json:async()=>[{id,subject:'Português',topic:'Hífen',statement:'Pergunta',data:{statement:'Pergunta',alternatives:[{letter:'C',text:'Certo'},{letter:'E',text:'Errado'}],correct:'C',commentary:'Explicação'}}]};
 if(options?.method==='POST'){writes++;return {};}
 return {json:async()=>[{choice:'C',is_correct:true}]};
 }});
 const fresh={};await api.handle({method:'GET'},fresh,new URL('http://local/api/bank/question/'+id+'?fresh=true'),{id:'user'});
 assert.equal(fresh.data.question.lastAttempt,null);assert.equal(fresh.data.question.correct,null);assert.equal(fresh.data.question.commentary,null);
 const normal={};await api.handle({method:'GET'},normal,new URL('http://local/api/bank/question/'+id),{id:'user'});assert.equal(normal.data.question.correct,'C');
 const answered={};await api.handle({method:'POST',body:{id,choice:'E'}},answered,new URL('http://local/api/bank/answer'),{id:'user'});assert.equal(writes,1);assert.equal(answered.data.correct,'C');assert.equal(answered.data.commentary,'Explicação');
});
function bulkHarness(pages){
 const nodes={};for(const key of ['lessonBankAddAll','lessonBankSubject','lessonBankTopic','lessonBankBoard','lessonBankSearch','lessonBankStatus'])nodes[key]={value:key==='lessonBankBoard'?'CEBRASPE':'',disabled:false};
 const calls=[];const source=fs.readFileSync('public/theory.js','utf8');
 const script=source.slice(source.indexOf('async function addAllLessonBankQuestions()'),source.indexOf("$('lessonBankAddAll').onclick=addAllLessonBankQuestions;"));
 const context={lessonQuestionFilters:()=>new URLSearchParams({board:'CEBRASPE'}),URLSearchParams,Map,Error,$:id=>nodes[id],selectedLessonQuestions:new Map(),lessonBankPage:1,dirty:false,drawSelectedLessonQuestions(){},findLessonBankQuestions:async()=>{},api:async path=>{calls.push(path);return pages.shift();}};vm.createContext(context);vm.runInContext(script,context);return {context,nodes,calls};
}
test('adicionar todas percorre páginas e mantém filtro por banca sem duplicar',async()=>{const f=bulkHarness([{items:[{id:'a',statement:'A'}],hasMore:true},{items:[{id:'a'},{id:'b',statement:'B'}],hasMore:false}]);await f.context.addAllLessonBankQuestions();assert.equal(f.context.selectedLessonQuestions.size,2);assert.equal(f.calls.length,2);for(const path of f.calls)assert.equal(new URL('http://local/'+path).searchParams.get('board'),'CEBRASPE');});
test('filtro acima do limite não adiciona lote parcial',async()=>{const f=bulkHarness([{items:Array.from({length:201},(_,i)=>({id:String(i)})),hasMore:false}]);await f.context.addAllLessonBankQuestions();assert.equal(f.context.selectedLessonQuestions.size,0);assert.match(f.nodes.lessonBankStatus.textContent,/200/);assert.equal(f.nodes.lessonBankAddAll.disabled,false);});

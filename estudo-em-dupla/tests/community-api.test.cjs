const test=require('node:test');
const assert=require('node:assert/strict');
const create=require('../community-api');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function fixture(){
 const writes=[];let relation={id:'33333333-3333-4333-8333-333333333333',sender:other,recipient:owner,status:'pending'};
 const row={user_id:owner,display_name:'Estudante',bio:'Biografia',invisible:false,last_active:new Date().toISOString(),last_seen_public:new Date().toISOString(),avatar_data:'',email:'segredo@example.com'};
 const api=create({storageEnabled:true,roomsApi:{getForInvite:async()=>null},parseJson:async req=>req.body,send:(res,status,data)=>Object.assign(res,{status,data}),err:(res,status,error)=>Object.assign(res,{status,data:{error}}),databaseRequest:async(endpoint,options)=>{
  if(options){writes.push({endpoint,options,body:JSON.parse(options.body||'{}')});return {json:async()=>{throw Error('Não ler JSON de retorno mínimo');}};}
  if(endpoint.startsWith('policial_profiles'))return {json:async()=>[row]};
  if(endpoint.startsWith('policial_friendships'))return {json:async()=>[relation]};
  return {json:async()=>[]};
 }});
 async function call(op,body,id=owner){const res={};await api.handle({method:body?'POST':'GET',body},res,new URL('http://local/api/community/'+op),{id});return res;}
 return {api,call,writes,row,setRelation:r=>relation=r};
}
test('perfil público nunca expõe e-mail, modo invisível ou presença privada',()=>{
 const row={user_id:owner,display_name:'Ana',bio:'Estudo',invisible:true,email:'segredo@example.com',last_active:new Date().toISOString(),last_seen_public:new Date().toISOString()};
 const profile=create.publicProfile(row,other);assert.equal(profile.online,false);assert.equal(profile.lastSeen,null);assert.equal(profile.invisible,undefined);assert.equal(profile.email,undefined);assert.ok(!JSON.stringify(profile).includes('segredo'));
 assert.equal(create.publicProfile(row,owner).invisible,true);row.invisible=false;assert.equal(create.publicProfile(row,other).online,true);
});
test('edição de nome, biografia, foto e invisibilidade fica vinculada à conta autenticada',async()=>{
 const {call,writes}=fixture();const result=await call('profile',{userId:other,name:'Ana',bio:'Polícia',avatar:'data:image/webp;base64,YWJj',invisible:true});assert.equal(result.status,200);const saved=writes.at(-1);assert.ok(saved.endpoint.includes(encodeURIComponent('eq.'+owner)));assert.equal(saved.body.invisible,true);assert.equal(saved.body.avatar_data,'data:image/webp;base64,YWJj');assert.equal(saved.body.user_id,undefined);
 assert.equal((await call('profile',{name:'email@example.com'})).status,400);assert.equal((await call('profile',{name:'Ana',avatar:'data:image/svg+xml;base64,YWJj'})).status,400);
});
test('amizade só pode ser aceita pelo destinatário e convites exigem participação na sala',async()=>{
 const {call,setRelation}=fixture();setRelation({id:other,sender:owner,recipient:other,status:'pending'});assert.equal((await call('friend',{action:'accept',id:other})).status,403);assert.equal((await call('invite',{userId:other,room:'ABC234'})).status,403);
});
test('registro de conquistas usa RPC privada e chave estável da questão',async()=>{
 const {api,writes}=fixture();await api.recordAnswer(owner,'ABC234',{statement:'Questão'},false);const event=writes.at(-1);assert.equal(event.endpoint,'rpc/policial_record_room_answer');assert.equal(event.body.p_user,owner);assert.equal(event.body.p_correct,false);assert.match(event.body.p_question,/^[a-f0-9]{64}$/);
});

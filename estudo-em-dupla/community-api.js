'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const TROPHIES={primeira:{title:'Primeiro passo',description:'Respondeu à primeira questão em uma sala.'},cem:{title:'Ritmo de estudo',description:'100 questões respondidas em salas.'},mil:{title:'Mil questões',description:'1.000 questões respondidas em salas.'},sequencia10:{title:'Na mira',description:'10 respostas corretas consecutivas em salas.'},sequencia20:{title:'Precisão total',description:'20 respostas corretas consecutivas em salas.'}};
function publicProfile(row,viewer,now=Date.now()){
 const own=row.user_id===viewer,visible=!row.invisible;
 return {id:row.user_id,name:row.display_name,avatar:row.avatar_data||'',bio:row.bio,online:visible&&!!row.last_active&&now-Date.parse(row.last_active)<90000,lastSeen:visible?row.last_seen_public:null,answered:row.answered,bestStreak:row.best_streak,...(own?{invisible:row.invisible}:{} )};
}
module.exports=function({databaseRequest,storageEnabled,parseJson,send,err,roomsApi}){
 async function db(table,params={},options){if(!storageEnabled)throw Object.assign(Error('Ative o Supabase e execute COMUNIDADE_SQL.sql.'),{status:503});try{const response=await databaseRequest(table+(Object.keys(params).length?'?'+new URLSearchParams(params):''),options);return options?.headers?.Prefer?.includes('return=minimal')?null:await response.json();}catch{throw Object.assign(Error('Não foi possível acessar a comunidade. Confira a conexão e execute COMUNIDADE_SQL.sql atualizado.'),{status:503});}}
 async function ensure(id){await db('policial_profiles',{on_conflict:'user_id'},{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({user_id:id,display_name:'Estudante '+id.slice(0,6)})});return (await db('policial_profiles',{select:'*',user_id:'eq.'+id,limit:'1'}))[0];}
 async function recordAnswer(userId,room,question,correct){await ensure(userId);await db('rpc/policial_record_room_answer',{}, {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({p_user:userId,p_room:room,p_question:crypto.createHash('sha256').update(question.statement).digest('hex'),p_correct:correct})});}
 async function handle(req,res,url,user){
  const op=url.pathname.slice('/api/community'.length).replace(/^\//,'');
  const me=await ensure(user.id);
  if(op==='me'&&req.method==='GET')return send(res,200,{profile:publicProfile(me,user.id)});
  if(op==='offline'&&req.method==='POST'){await db('policial_profiles',{user_id:'eq.'+user.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_active:null})});return send(res,200,{ok:true});}
  if(op==='presence'&&req.method==='POST'){
   const now=new Date().toISOString();await db('policial_profiles',{user_id:'eq.'+user.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_active:now,...(!me.invisible?{last_seen_public:now}:{})})});
   const invites=await db('policial_invitations',{select:'id',recipient:'eq.'+user.id,expires_at:'gt.'+now,limit:'100'});
   const requests=await db('policial_friendships',{select:'id',recipient:'eq.'+user.id,status:'eq.pending',limit:'100'});
   return send(res,200,{notifications:invites.length+requests.length});
  }
  if(op==='profile'&&req.method==='POST'){
   const body=await parseJson(req),name=clean(body.name,60),bio=clean(body.bio,2000);if(name.length<2||/@/.test(name))return err(res,400,'Use um nome público de 2 a 60 caracteres, sem e-mail.');
   const avatar=typeof body.avatar==='string'?body.avatar:me.avatar_data||'';
   if(avatar&&(avatar.length>150000||!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(avatar)))return err(res,400,'Foto inválida ou muito grande. Escolha outra imagem.');
   await db('policial_profiles',{user_id:'eq.'+user.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({display_name:name,bio,avatar_data:avatar,invisible:body.invisible===true,...(body.invisible?{}:{last_active:new Date().toISOString(),last_seen_public:new Date().toISOString()})})});roomsApi.refreshProfiles?.(user.id);return send(res,200,{ok:true});
  }
  if(op==='people'&&req.method==='GET'){
   const search=clean(url.searchParams.get('search'),60).replace(/[%,*()]/g,'');const page=Math.max(1,Math.min(1000,parseInt(url.searchParams.get('page'),10)||1));const params={select:'*',order:'display_name,user_id',limit:'51',offset:String((page-1)*50)};if(search)params.display_name='ilike.*'+search+'*';if(url.searchParams.get('online')==='true'){params.invisible='eq.false';params.last_active='gt.'+new Date(Date.now()-90000).toISOString();}
   const rows=await db('policial_profiles',params);return send(res,200,{items:rows.slice(0,50).map(r=>publicProfile(r,user.id)),hasMore:rows.length>50,page});
  }
  if(op.startsWith('profile/')&&req.method==='GET'){
   const id=op.slice(8);if(!UUID.test(id))return err(res,400,'Perfil inválido.');const rows=await db('policial_profiles',{select:'*',user_id:'eq.'+id});if(!rows.length)return err(res,404,'Perfil não encontrado.');const earned=await db('policial_trophies',{select:'trophy_key,earned_at',user_id:'eq.'+id});return send(res,200,{profile:publicProfile(rows[0],user.id),trophies:Object.entries(TROPHIES).map(([key,t])=>({...t,key,earnedAt:earned.find(x=>x.trophy_key===key)?.earned_at||null}))});
  }
  if(op==='friends'&&req.method==='GET'){
   const rows=await db('policial_friendships',{select:'*',or:`(sender.eq.${user.id},recipient.eq.${user.id})`,limit:'1000'});const ids=[...new Set(rows.map(r=>r.sender===user.id?r.recipient:r.sender))];const profiles=ids.length?await db('policial_profiles',{select:'*',user_id:'in.('+ids.join(',')+')',limit:'1000'}):[];return send(res,200,{items:rows.map(r=>({id:r.id,status:r.status,incoming:r.recipient===user.id,person:publicProfile(profiles.find(p=>p.user_id===(r.sender===user.id?r.recipient:r.sender)),user.id)}))});
  }
  if(op==='friend'&&req.method==='POST'){
   const body=await parseJson(req);if(body.action==='request'){
    if(!UUID.test(body.userId||'')||body.userId===user.id)return err(res,400,'Perfil inválido.');const target=await db('policial_profiles',{select:'user_id',user_id:'eq.'+body.userId});if(!target.length)return err(res,404,'Perfil não encontrado.');const existing=await db('policial_friendships',{select:'id',or:`(and(sender.eq.${user.id},recipient.eq.${body.userId}),and(sender.eq.${body.userId},recipient.eq.${user.id}))`});if(existing.length)return err(res,409,'Já existe uma amizade ou solicitação entre vocês.');await db('policial_friendships',{}, {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({sender:user.id,recipient:body.userId})});
   }else{if(!UUID.test(body.id||''))return err(res,400,'Solicitação inválida.');const rows=await db('policial_friendships',{select:'*',id:'eq.'+body.id});const r=rows[0];if(!r||r.sender!==user.id&&r.recipient!==user.id)return err(res,403,'Solicitação não disponível.');if(body.action==='accept'){if(r.recipient!==user.id)return err(res,403,'Somente quem recebeu pode aceitar.');await db('policial_friendships',{id:'eq.'+r.id},{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'accepted'})});}else if(body.action==='remove')await db('policial_friendships',{id:'eq.'+r.id},{method:'DELETE',headers:{Prefer:'return=minimal'}});else return err(res,400,'Ação inválida.');}
   return send(res,200,{ok:true});
  }
  if(op==='invitations'&&req.method==='GET'){
   const rows=await db('policial_invitations',{select:'*',recipient:'eq.'+user.id,expires_at:'gt.'+new Date().toISOString(),order:'created_at.desc',limit:'100'});const ids=[...new Set(rows.map(r=>r.sender))];const profiles=ids.length?await db('policial_profiles',{select:'user_id,display_name',user_id:'in.('+ids.join(',')+')'}):[];return send(res,200,{items:rows.map(r=>({id:r.id,room:r.room_code,from:profiles.find(p=>p.user_id===r.sender)?.display_name||'Estudante',expiresAt:r.expires_at}))});
  }
  if(op==='invite'&&req.method==='POST'){
   const body=await parseJson(req);if(!UUID.test(body.userId||'')||body.userId===user.id||! /^[A-Z0-9]{6}$/.test(body.room||''))return err(res,400,'Selecione a pessoa e a sala.');const room=await roomsApi.getForInvite(body.room,user.id);if(!room)return err(res,403,'Entre em uma sala aberta antes de convidar.');const target=await db('policial_profiles',{select:'user_id',user_id:'eq.'+body.userId});if(!target.length)return err(res,404,'Perfil não encontrado.');
   const recent=await db('policial_invitations',{select:'created_at',sender:'eq.'+user.id,recipient:'eq.'+body.userId,room_code:'eq.'+body.room});if(recent[0]&&Date.now()-Date.parse(recent[0].created_at)<60000)return err(res,429,'Aguarde um minuto para reenviar esse convite.');
   await db('policial_invitations',{on_conflict:'sender,recipient,room_code'},{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({sender:user.id,recipient:body.userId,room_code:body.room,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*60000).toISOString()})});return send(res,200,{ok:true});
  }
  if(op==='dismiss'&&req.method==='POST'){const body=await parseJson(req);if(!UUID.test(body.id||''))return err(res,400,'Convite inválido.');await db('policial_invitations',{id:'eq.'+body.id,recipient:'eq.'+user.id},{method:'DELETE',headers:{Prefer:'return=minimal'}});return send(res,200,{ok:true});}
  return err(res,404,'Página não encontrada.');
 }
 return {handle,recordAnswer,publicName:async id=>(await ensure(id)).display_name,publicMembers:async ids=>ids.length?await db('policial_profiles',{select:'user_id,display_name,avatar_data',user_id:'in.('+ids.join(',')+')',limit:'100'}):[]};
};
module.exports.publicProfile=publicProfile;

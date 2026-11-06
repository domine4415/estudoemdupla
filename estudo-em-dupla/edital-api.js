'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
module.exports=function({databaseRequest,parseJson,send,err,isAdmin,storageEnabled}){
 const json=async(path,options)=>(await databaseRequest(path,options)).json();
 return {async handle(req,res,url,user){
  if(!storageEnabled)return err(res,503,'Execute EDITAL_SQL.sql no Supabase para ativar os editais.');
  const op=url.pathname.slice('/api/edital'.length).replace(/^\//,''),admin=isAdmin(user);
  if(req.method==='GET'&&(!op||UUID.test(op))){
   const params=new URLSearchParams({select:'*',order:'updated_at.desc,id',limit:'1000'});if(op)params.set('id','eq.'+op);if(!admin)params.set('published','eq.true');
   const rows=[];for(let offset=0;;offset+=1000){params.set('offset',String(offset));const page=await json('policial_notices?'+params);rows.push(...page);if(page.length<1000)break;}
   const progress=await json('policial_notice_progress?'+new URLSearchParams({select:'notice_id,favorite,completed',user_id:'eq.'+user.id,limit:'1000'}));
   const items=rows.map(row=>{const own=progress.find(p=>p.notice_id===row.id),ids=new Set(row.sections.flatMap(s=>s.topics.map(t=>t.id))),completed=(own?.completed||[]).filter(id=>ids.has(id));const result={...row,favorite:own?.favorite||false,completed,total:ids.size,studied:completed.length};if(!op)delete result.sections;return result;});
   if(op)return items[0]?send(res,200,{item:items[0]}):err(res,404,'Edital não encontrado.');return send(res,200,{items});
  }
  if(req.method!=='POST')return err(res,404,'Página não encontrada.');
  const body=await parseJson(req);
  if(op==='progress'){
   if(!UUID.test(body.id||''))return err(res,400,'Edital inválido.');
   const params=new URLSearchParams({select:'id,sections',id:'eq.'+body.id});if(!admin)params.set('published','eq.true');const rows=await json('policial_notices?'+params);if(!rows.length)return err(res,404,'Edital não encontrado.');
   const favorite=typeof body.favorite==='boolean'?body.favorite:null,topicId=body.topicId||null;
   if(topicId&&(!UUID.test(topicId)||typeof body.done!=='boolean'||!rows[0].sections.some(s=>s.topics.some(t=>t.id===topicId))))return err(res,400,'Assunto inválido. Atualize o edital.');
   if(favorite===null&&!topicId)return err(res,400,'Informe a marcação.');
   await databaseRequest('rpc/policial_update_notice_progress',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({p_user:user.id,p_notice:body.id,p_topic:topicId,p_done:body.done===true,p_favorite:favorite})});return send(res,200,{ok:true});
  }
  if(!admin)return err(res,403,'Somente o administrador pode cadastrar editais.');
  if(op==='save'){
   if(body.id&&!UUID.test(body.id))return err(res,400,'Edital inválido.');
   const title=text(body.title,180),description=text(body.description,1000);
   if(!title||!Array.isArray(body.sections)||!body.sections.length||body.sections.length>100)return err(res,400,'Informe o título e as disciplinas do edital.');
   let existing=[];if(body.id){const rows=await json('policial_notices?'+new URLSearchParams({select:'sections',id:'eq.'+body.id}));if(!rows.length)return err(res,404,'Edital não encontrado.');existing=rows[0].sections;}
   const oldIds=new Set(existing.flatMap(s=>s.topics.map(t=>t.id))),used=new Set();let total=0;
   const sections=[];for(const section of body.sections){const name=text(section.name,180);if(!name||!Array.isArray(section.topics)||!section.topics.length)return err(res,400,'Cada disciplina precisa de nome e assuntos.');const topics=[];for(const topic of section.topics){const label=text(topic.text,1000);if(!label)return err(res,400,'Assunto sem descrição.');let id=oldIds.has(topic.id)&&!used.has(topic.id)?topic.id:crypto.randomUUID();used.add(id);topics.push({id,text:label});total++;}sections.push({name,topics});}
   if(total>3000)return err(res,400,'Limite de 3.000 assuntos por edital.');
   const params=new URLSearchParams({select:'id'});if(body.id)params.set('id','eq.'+body.id);
   const rows=await json('policial_notices?'+params,{method:body.id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({title,description,sections,published:body.published===true,updated_at:new Date().toISOString()})});return send(res,200,{id:rows[0].id});
  }
  return err(res,404,'Operação não encontrada.');
 }};
};

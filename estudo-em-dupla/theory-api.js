'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
module.exports=function({databaseRequest,parseJson,send,err,isAdmin,storageEnabled}){
  return {async handle(req,res,url,user){
    if(!storageEnabled)return err(res,503,'Configure o Supabase e execute TEORIA_SQL.sql para ativar as aulas.');
    const admin=isAdmin(user),op=url.pathname.slice('/api/theory'.length).replace(/^\//,'');
    async function query(params,options){
      try{return await databaseRequest('policial_lessons?'+params,options);}
      catch(e){throw Object.assign(new Error('Não foi possível acessar as aulas. Confira a conexão e se TEORIA_SQL.sql foi executado no Supabase.'),{status:503});}
    }
    if(op.startsWith('highlights/')&&(req.method==='GET'||req.method==='POST')){
      const lessonId=op.slice('highlights/'.length);
      if(!UUID.test(lessonId))return err(res,400,'Aula inválida.');
      const params=new URLSearchParams({select:'id',id:'eq.'+lessonId});if(!admin)params.set('published','eq.true');
      const lessons=await (await query(params)).json();if(!lessons.length)return err(res,404,'Aula não encontrada.');
      const filter=new URLSearchParams({select:'marks',user_id:'eq.'+user.id,lesson_id:'eq.'+lessonId});
      try{
        if(req.method==='GET'){
          const rows=await (await databaseRequest('policial_lesson_highlights?'+filter)).json();
          return send(res,200,{marks:rows[0]?.marks||[]});
        }
        const body=await parseJson(req);
        if(!Array.isArray(body.marks)||body.marks.length>500||JSON.stringify(body.marks).length>500000)return err(res,400,'Quantidade ou tamanho de grifos acima do limite.');
        const marks=[];
        for(const m of body.marks){
          if(!m||!Number.isInteger(m.start)||!Number.isInteger(m.end)||m.start<0||m.end<=m.start||m.end>1000000||!['amarelo','verde','azul'].includes(m.color)||typeof m.quote!=='string'||m.quote.length!==m.end-m.start)return err(res,400,'Grifo inválido.');
          marks.push({start:m.start,end:m.end,color:m.color,quote:m.quote});
        }
        marks.sort((a,b)=>a.start-b.start);
        if(marks.some((m,i)=>i&&m.start<marks[i-1].end))return err(res,400,'Os grifos não podem se sobrepor.');
        await databaseRequest('policial_lesson_highlights?on_conflict=user_id,lesson_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,lesson_id:lessonId,marks,updated_at:new Date().toISOString()})});
        return send(res,200,{ok:true});
      }catch(e){throw Object.assign(new Error('Não foi possível acessar seus grifos. Confira a conexão e execute TEORIA_SQL.sql atualizado no Supabase.'),{status:503});}
    }
    if(req.method==='GET'&&!op){
      const params=new URLSearchParams({select:'id,title,subject,topic,subtopic,published,updated_at',order:'subject,topic,title,id',limit:'1000'});
      if(!admin)params.set('published','eq.true');
      const items=[];
      for(let offset=0;;offset+=1000){params.set('offset',String(offset));const rows=await (await query(params)).json();items.push(...rows);if(rows.length<1000)break;}
      return send(res,200,{items});
    }
    if(req.method==='GET'&&UUID.test(op)){
      const params=new URLSearchParams({select:'*',id:'eq.'+op});if(!admin)params.set('published','eq.true');
      const rows=await (await query(params)).json();
      return rows[0]?send(res,200,{lesson:rows[0]}):err(res,404,'Aula não encontrada.');
    }
    if(req.method!=='POST')return err(res,404,'Página não encontrada.');
    if(!admin)return err(res,403,'Somente o administrador pode gerenciar aulas.');
    const body=await parseJson(req);
    if(op==='save'){
      const title=text(body.title,180),subject=text(body.subject,180),topic=text(body.topic,180),content=text(body.content,150000);
      if(!title||!subject||!topic||!content)return err(res,400,'Preencha título, disciplina, tópico e conteúdo.');
      if(typeof body.content!=='string'||body.content.length>150000)return err(res,400,'A aula deve ter até 150 mil caracteres.');
      if(body.id&&!UUID.test(body.id))return err(res,400,'Identificador inválido.');
      const images={};let size=0;
      for(const [key,value] of Object.entries(body.images||{})){
        if(!/^imagem-[a-z0-9-]{1,60}$/.test(key)||typeof value!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))return err(res,400,'Imagem inválida. Use PNG, JPG ou WebP.');
        // Guarda somente imagens utilizadas na aula.
        if(!content.includes(']('+key+')'))continue;
        size+=value.length;images[key]=value;
      }
      if(size>4*1024*1024)return err(res,413,'As imagens desta aula excedem 4 MB. Divida o conteúdo em mais aulas.');
      const row={title,subject,topic,subtopic:text(body.subtopic,180),content,images,published:body.published===true,updated_at:new Date().toISOString()};
      const params=new URLSearchParams({select:'id'});if(body.id)params.set('id','eq.'+body.id);
      const rows=await (await query(params,{method:body.id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)})).json();
      if(!rows.length)return err(res,404,'Aula não encontrada.');
      return send(res,200,{id:rows[0].id});
    }
    if(op==='delete'){
      if(!UUID.test(body.id||''))return err(res,400,'Identificador inválido.');
      await query(new URLSearchParams({id:'eq.'+body.id}),{method:'DELETE',headers:{Prefer:'return=minimal'}});
      return send(res,200,{ok:true});
    }
    return err(res,404,'Operação não encontrada.');
  }};
};

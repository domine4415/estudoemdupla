'use strict';
// Banco de questões autorais, de domínio público ou com permissão de publicação.
// A chave secreta do Supabase fica SOMENTE no servidor.
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH=250;
const MAX_PAGE=30;
const letters='ABCDEFGH';
function trimmed(value,max=1000){return typeof value==='string'?value.trim().slice(0,max):'';}
function normalize(q){
  if(!q||typeof q!=='object')return null;
  let alternatives=(Array.isArray(q.alternatives)?q.alternatives:[]).slice(0,8).map((a,i)=>({
    letter:trimmed(a?.letter,2).toUpperCase()||letters[i],
    text:trimmed(a?.text,3500).replace(/^[A-H]\s*[).:\-]\s*/i,'')
  })).filter(a=>letters.includes(a.letter)&&a.letter.length===1&&a.text);
  if(q.type==='true_false' && alternatives.length===0)alternatives=[{letter:'C',text:'Certo'},{letter:'E',text:'Errado'}];
  if(new Set(alternatives.map(a=>a.letter)).size!==alternatives.length)return null;
  const statement=trimmed(q.statement,12000);
  const correct=trimmed(q.correct,1).toUpperCase();
  const normalizedCorrect=alternatives.some(a=>a.letter===correct)?correct:null;
  if(!statement||alternatives.length<2)return null;
  const year=Number(q.year);
  return {
    statement, alternatives, type:q.type==='true_false'?'true_false':'multiple_choice',
    correct:normalizedCorrect,
    commentary:trimmed(q.commentary||q.explanation||q.comentario,12000),
    subject:trimmed(q.subject,180)||'Não classificada',
    topic:trimmed(q.topic||q.assunto,180)||'Geral',
    board:trimmed(q.board,120),exam:trimmed(q.exam,250),
    year:Number.isInteger(year)&&year>=1900&&year<=2100?String(year):'',
    originalId:trimmed(q.originalId,80),link:trimmed(q.link,600)
  };
}
function fingerprint(q){
  // Reimportações do mesmo enunciado atualizam o registro sem duplicar.
  return crypto.createHash('sha256').update(q.statement.toLowerCase().replace(/\s+/g,' ').trim()).digest('hex');
}
function bankRow(q,published=true){return {
  fingerprint:fingerprint(q),subject:q.subject,topic:q.topic,board:q.board,
  exam_year:q.year?Number(q.year):null,statement:q.statement,
  has_key:!!q.correct,has_commentary:!!q.commentary,
  published:published&&!!q.correct,data:q,updated_at:new Date().toISOString()
};}
function publicQuestion(row,attempt){
  const q=row.data||{};
  const answered=Boolean(attempt);
  return {id:row.id,subject:row.subject,topic:row.topic,board:row.board,year:row.exam_year,
    exam:q.exam||'',originalId:q.originalId||'',link:q.link||'',
    statement:q.statement||row.statement,alternatives:q.alternatives||[],type:q.type||'multiple_choice',
    lastAttempt:attempt?{choice:attempt.choice,isCorrect:attempt.is_correct,at:attempt.answered_at}:null,
    correct:answered?q.correct:null,
    commentary:answered?q.commentary||'':null};
}
module.exports=function createBankApi({databaseRequest,parseJson,send,err,isAdmin,storageEnabled}){
  async function query(endpoint,options){
    if(!storageEnabled)throw Object.assign(new Error('Ative o Supabase para usar o banco permanente.'),{status:503});
    return databaseRequest(endpoint,options);
  }
  async function json(endpoint,options){return (await query(endpoint,options)).json();}
  async function questionById(id,includeDraft=false){
    if(!UUID.test(id))return null;
    const params=new URLSearchParams({select:'id,subject,topic,board,exam_year,statement,published,data',id:'eq.'+id,limit:'1'});
    if(!includeDraft)params.set('published','eq.true');
    const rows=await json('dupla_bank_questions?'+params);
    return rows[0]||null;
  }
  async function latestAttempt(userId,questionId){
    const p=new URLSearchParams({select:'choice,is_correct,answered_at',user_id:'eq.'+userId,question_id:'eq.'+questionId,order:'answered_at.desc,id.desc',limit:'1'});
    const rows=await json('dupla_bank_attempts?'+p);
    return rows[0]||null;
  }
  async function handle(req,res,url,user){
    const parts=url.pathname.split('/').filter(Boolean).slice(2); // /api/bank/...
    const op=parts[0]||'';
    if(op==='facets' && req.method==='GET'){
      const d=await json('rpc/dupla_bank_facets',{method:'POST',body:'{}'});
      return send(res,200,d);
    }
    if(op==='questions'&&req.method==='GET'){
      const page=Math.min(1000,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1));
      const p=new URLSearchParams({select:'id,subject,topic,board,exam_year,statement,has_key,has_commentary',published:'eq.true',order:'created_at.desc',limit:String(MAX_PAGE+1),offset:String((page-1)*MAX_PAGE)});
      for(const [field,column,max] of [['subject','subject',180],['topic','topic',180],['board','board',120],['year','exam_year',4]]){
        const value=trimmed(url.searchParams.get(field),max);
        if(value)p.set(column,'eq.'+value);
      }
      const search=trimmed(url.searchParams.get('search'),70);
      if(search){ // Usar filtro da coluna simples, sem expor o JSON de respostas.
        const escaped=search.replace(/[%,()*]/g,' ').trim();
        if(escaped)p.set('statement','ilike.*'+escaped+'*');
      }
      const rows=await json('dupla_bank_questions?'+p);
      return send(res,200,{items:rows.slice(0,MAX_PAGE).map(x=>({id:x.id,subject:x.subject,topic:x.topic,board:x.board,
        year:x.exam_year,preview:x.statement.slice(0,250),hasKey:x.has_key,hasCommentary:x.has_commentary})),page,hasMore:rows.length>MAX_PAGE});
    }
    if(op==='question'&&parts.length===2&&req.method==='GET'){
      const row=await questionById(parts[1]);
      if(!row)return err(res,404,'Questão não encontrada.');
      const attempt=await latestAttempt(user.id,row.id);
      return send(res,200,{question:publicQuestion(row,attempt)});
    }
    if(op==='answer'&&req.method==='POST'){
      const data=await parseJson(req);
      const row=await questionById(trimmed(data.id,80));
      if(!row)return err(res,404,'Questão não encontrada.');
      const q=row.data||{};
      const choice=trimmed(data.choice,2).toUpperCase();
      if(!q.alternatives?.some(a=>a.letter===choice))return err(res,400,'Alternativa inválida.');
      if(!q.correct)return err(res,409,'Esta questão ainda não tem gabarito verificado.');
      const isCorrect=choice===q.correct;
      await query('dupla_bank_attempts',{method:'POST',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({user_id:user.id,question_id:row.id,choice,is_correct:isCorrect})});
      return send(res,200,{choice,isCorrect,correct:q.correct,commentary:q.commentary||'',
        alternatives:q.alternatives});
    }
    if(op==='progress'&&req.method==='GET'){
      // Visão da tentativa MAIS RECENTE de cada questão.
      const data=await json('rpc/dupla_bank_progress',{method:'POST',body:JSON.stringify({target_user:user.id})});
      return send(res,200,data);
    }
    if(op!=='admin')return err(res,404,'Rota do banco não encontrada.');
    if(!isAdmin(user))return err(res,403,'Somente o administrador pode gerenciar questões.');
    const action=parts[1]||'';
    if(action==='item'&&parts.length===3&&req.method==='GET'){
      const row=await questionById(parts[2],true);
      if(!row)return err(res,404,'Questão não encontrada.');
      return send(res,200,{id:row.id,published:row.published,data:row.data});
    }
    if(action==='list'&&req.method==='GET'){
      const draft=url.searchParams.get('draft')==='true';
      const page=Math.min(1000,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1));
      const p=new URLSearchParams({select:'id,subject,topic,board,exam_year,statement,has_key,has_commentary,published,data',order:'updated_at.desc',limit:'31',offset:String((page-1)*30)});
      if(draft)p.set('published','eq.false');
      const rows=await json('dupla_bank_questions?'+p);
      return send(res,200,{items:rows.slice(0,30).map(r=>({id:r.id,subject:r.subject,topic:r.topic,statement:r.statement.slice(0,240),
        published:r.published,hasKey:r.has_key,hasCommentary:r.has_commentary,...(draft?{data:r.data}:{})})),hasMore:rows.length>30,page});
    }
    if(action==='import'&&req.method==='POST'){
      const body=await parseJson(req);
      if(body.rightsConfirmed!==true)return err(res,400,'Confirme que possui autorização para publicar estas questões.');
      if(!Array.isArray(body.questions)||body.questions.length===0||body.questions.length>MAX_BATCH)
        return err(res,400,'Envie de 1 a '+MAX_BATCH+' questões por vez.');
      const normalized=body.questions.map(normalize);
      const valid=normalized.filter(Boolean);
      if(!valid.length)return err(res,400,'Nenhuma questão válida: é necessário enunciado e pelo menos duas alternativas.');
      // Tudo que ainda não tem gabarito vai para rascunhos, NÃO aparece aos estudantes.
      const unique=[...new Map(valid.map(q=>[fingerprint(q),q])).values()];
      for(let i=0;i<unique.length;i+=40){
        const chunk=unique.slice(i,i+40).map(q=>bankRow(q));
        await query('dupla_bank_questions?on_conflict=fingerprint',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(chunk)});
      }
      const pending=unique.filter(q=>!q.correct).length;
      return send(res,200,{received:body.questions.length,imported:unique.length,drafts:pending,ignored:body.questions.length-valid.length});
    }
    if(action==='create'&&req.method==='POST'){
      const body=await parseJson(req);
      if(body.rightsConfirmed!==true)return err(res,400,'Confirme a autorização de publicação.');
      const q=normalize(body.question);
      if(!q)return err(res,400,'Informe um enunciado e pelo menos duas alternativas válidas.');
      const row=bankRow(q,body.published!==false);
      await query('dupla_bank_questions?on_conflict=fingerprint',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
      return send(res,200,{ok:true,published:row.published});
    }
    if(action==='edit'&&req.method==='POST'){
      const body=await parseJson(req);
      const original=await questionById(trimmed(body.id,60),true);
      if(!original)return err(res,404,'Questão não encontrada.');
      const q=normalize(body.question);
      if(!q)return err(res,400,'Informe enunciado e pelo menos duas alternativas válidas.');
      const published=body.published!==false&&!!q.correct;
      const update={fingerprint:fingerprint(q),subject:q.subject,topic:q.topic,board:q.board,exam_year:q.year?Number(q.year):null,
        statement:q.statement,has_key:!!q.correct,has_commentary:!!q.commentary,published,data:q,
        updated_at:new Date().toISOString()};
      await query('dupla_bank_questions?id=eq.'+original.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(update)});
      return send(res,200,{ok:true,published});
    }
    if(action==='delete'&&req.method==='POST'){
      const body=await parseJson(req);
      if(!UUID.test(body.id||''))return err(res,400,'ID inválido.');
      await query('dupla_bank_questions?id=eq.'+body.id,{method:'DELETE',headers:{Prefer:'return=minimal'}});
      return send(res,200,{ok:true});
    }
    return err(res,404,'Ação administrativa não encontrada.');
  }
  return {handle};
};

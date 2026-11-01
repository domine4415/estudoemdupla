'use strict';
// Banco de questões autorais, de domínio público ou com permissão de publicação.
// A chave secreta do Supabase fica SOMENTE no servidor.
const crypto=require('node:crypto');
const {normalizeTopic,topicFilter}=require('./topic');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH=250;
const MAX_PAGE=10;
const DELETE_LIMIT=10000;
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
  const correct=trimmed(q.correct??q.correctAnswer??q.gabarito,1).toUpperCase();
  const normalizedCorrect=alternatives.some(a=>a.letter===correct)?correct:null;
  if(!statement||alternatives.length<2)return null;
  const year=Number(q.year??q.metadata?.year);
  const providedId=q.originalId??q.metadata?.originalId??q.id;
  const originalId=/^\d{3,20}$/.test(String(providedId??''))?String(providedId):'';
  return {
    statement, alternatives, type:q.type==='true_false'?'true_false':'multiple_choice',
    correct:normalizedCorrect,
    commentary:trimmed(q.commentary||q.explanation||q.comentario,12000),
    subject:trimmed(q.subject??q.metadata?.subject,180)||'Não classificada',
    topic:normalizeTopic(trimmed(q.topic||q.assunto||q.metadata?.topic,180))||'Geral',
    board:trimmed(q.board??q.metadata?.board,120),exam:trimmed(q.exam??q.metadata?.contest,250),
    year:Number.isInteger(year)&&year>=1900&&year<=2100?String(year):'',
    originalId,link:trimmed(q.link??q.sourceUrl,600)
  };
}
function fingerprint(q){
  // Reimportações do mesmo enunciado atualizam o registro sem duplicar.
  return crypto.createHash('sha256').update(q.statement.toLowerCase().replace(/\s+/g,' ').trim()).digest('hex');
}
function bankRow(q,published=true){return {
  fingerprint:fingerprint(q),source_id:q.originalId||null,subject:q.subject,topic:q.topic,board:q.board,
  exam_year:q.year?Number(q.year):null,statement:q.statement,
  has_key:!!q.correct,has_commentary:!!q.commentary,
  published:published&&!!q.correct,data:q,updated_at:new Date().toISOString()
};}
function publicQuestion(row,attempt){
  const q=row.data||{};
  const answered=Boolean(attempt);
  return {id:row.id,subject:row.subject,topic:normalizeTopic(row.topic),board:row.board,year:row.exam_year,
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
      d.pairs=[...new Map((d.pairs||[]).map(p=>{
        const pair={...p,topic:normalizeTopic(p.topic)};
        return [JSON.stringify([pair.subject,pair.topic]),pair];
      })).values()];
      return send(res,200,d);
    }
    if(op==='questions'&&req.method==='GET'){
      const page=Math.min(1000,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1));
      const p=new URLSearchParams({select:'id,subject,topic,board,exam_year,statement,has_key,has_commentary,data',published:'eq.true',order:'created_at.desc',limit:String(MAX_PAGE+1),offset:String((page-1)*MAX_PAGE)});
      for(const [field,column,max] of [['subject','subject',180],['topic','topic',180],['board','board',120],['year','exam_year',4]]){
        const value=trimmed(url.searchParams.get(field),max);
        if(value)p.set(column,field==='topic'?topicFilter(value):'eq.'+value);
      }
      const search=trimmed(url.searchParams.get('search'),70);
      if(search){ // Usar filtro da coluna simples, sem expor o JSON de respostas.
        const escaped=search.replace(/[%,()*]/g,' ').trim();
        if(escaped)p.set('statement','ilike.*'+escaped+'*');
      }
      // Histórico por usuário é consultado no servidor; nenhuma chave privilegiada é enviada ao navegador.
      const status=trimmed(url.searchParams.get('status'),15);
      const kind=trimmed(url.searchParams.get('type'),25);
      if(kind==='true_false')p.set('data->>type','eq.true_false');
      if(kind==='multiple_choice')p.set('data->>type','eq.multiple_choice');
      if(status==='unanswered'||status==='answered'){
        const attemptRows=await json('dupla_bank_attempts?'+new URLSearchParams({select:'question_id',user_id:'eq.'+user.id,limit:'100000'}));
        const ids=[...new Set(attemptRows.map(a=>a.question_id))];
        if(ids.length){
          if(status==='answered')p.set('id','in.('+ids.join(',')+')');
          else p.set('id','not.in.('+ids.join(',')+')');
        }else if(status==='answered')return send(res,200,{items:[],page,hasMore:false});
      }
      const rows=await json('dupla_bank_questions?'+p);
      const visible=rows.slice(0,MAX_PAGE);
      const attemptRows=visible.length?await json('dupla_bank_attempts?'+new URLSearchParams({select:'question_id,choice,is_correct,answered_at,id',user_id:'eq.'+user.id,question_id:'in.('+visible.map(r=>r.id).join(',')+')',order:'answered_at.desc,id.desc',limit:'10000'})):[];
      const latest=new Map();for(const a of attemptRows)if(!latest.has(a.question_id))latest.set(a.question_id,a);
      return send(res,200,{items:visible.map(x=>({id:x.id,subject:x.subject,topic:normalizeTopic(x.topic),board:x.board,
        year:x.exam_year,type:x.data?.type||'multiple_choice',preview:x.statement.slice(0,250),hasKey:x.has_key,hasCommentary:x.has_commentary, lastAttempt:latest.get(x.id)?{choice:latest.get(x.id).choice,isCorrect:latest.get(x.id).is_correct}:null,alternatives:x.data?.alternatives||[],statement:x.data?.statement||x.statement,exam:x.data?.exam||''})),page,hasMore:rows.length>MAX_PAGE});
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
    if(op==='statistics'&&req.method==='GET'){
      const questions=await json('dupla_bank_questions?'+new URLSearchParams({select:'id,subject,topic',published:'eq.true',limit:'100000'}));
      const attempts=await json('dupla_bank_attempts?'+new URLSearchParams({select:'id,question_id,is_correct,answered_at',user_id:'eq.'+user.id,order:'answered_at.desc,id.desc',limit:'100000'}));
      const latest=new Map();for(const a of attempts)if(!latest.has(a.question_id))latest.set(a.question_id,a);
      const groups=new Map();
      for(const q of questions){let g=groups.get(q.subject);if(!g){g={subject:q.subject,total:0,answered:0,correct:0,wrong:0};groups.set(q.subject,g);}g.total++;
        const a=latest.get(q.id);if(a){g.answered++;if(a.is_correct)g.correct++;else g.wrong++;}}
      return send(res,200,{total:questions.length,answered:[...groups.values()].reduce((n,g)=>n+g.answered,0),correct:[...groups.values()].reduce((n,g)=>n+g.correct,0),wrong:[...groups.values()].reduce((n,g)=>n+g.wrong,0),attempts:attempts.length,subjects:[...groups.values()].sort((a,b)=>a.subject.localeCompare(b.subject,'pt-BR'))});
    }
    if(op==='progress'&&req.method==='GET'){
      // Visão da tentativa MAIS RECENTE de cada questão.
      const data=await json('rpc/dupla_bank_progress',{method:'POST',body:JSON.stringify({target_user:user.id})});
      return send(res,200,data);
    }
    if(op!=='admin')return err(res,404,'Rota do banco não encontrada.');
    if(!isAdmin(user))return err(res,403,'Somente o administrador pode gerenciar questões.');
    const action=parts[1]||'';
    if(action==='rename-topic'&&req.method==='POST'){
      const body=await parseJson(req);
      const subject=trimmed(body.subject,180),topic=trimmed(body.topic,180);
      const newTopic=trimmed(body.newTopic,180);
      if(!subject||!topic||!newTopic||typeof body.newTopic!=='string'||body.newTopic.trim().length>180)return err(res,400,'Selecione uma disciplina e um tópico e informe um nome de até 180 caracteres.');
      if(topic===newTopic)return err(res,400,'Informe um nome diferente do tópico atual.');
      let updated=0;
      try{
        // Cada página deixa a seleção após a atualização; não usar offset.
        for(;;){
          const params=new URLSearchParams({select:'id,data',subject:'eq.'+subject,topic:'eq.'+topic,order:'id',limit:'250'});
          const rows=await json('dupla_bank_questions?'+params);
          if(!rows.length)break;
          for(const row of rows){
            await query('dupla_bank_questions?'+new URLSearchParams({id:'eq.'+row.id,subject:'eq.'+subject,topic:'eq.'+topic}),{
              method:'PATCH',headers:{Prefer:'return=minimal'},
              body:JSON.stringify({topic:newTopic,data:{...row.data,topic:newTopic},updated_at:new Date().toISOString()})
            });
            updated++;
          }
        }
      }catch(e){throw Object.assign(new Error(`${updated} questões atualizadas. Não foi possível concluir; selecione o tópico antigo e tente novamente.`),{status:502});}
      return send(res,200,{ok:true,updated,topic:newTopic});
    }
    if(action==='delete-facets'&&req.method==='GET'){
      const rows=await json('dupla_bank_questions?'+new URLSearchParams({select:'subject,topic',limit:'100000'}));
      const subjects=[...new Set(rows.map(r=>r.subject))].sort();
      const pairs=[...new Map(rows.map(r=>[r.subject+'\u0000'+r.topic,{subject:r.subject,topic:r.topic}])).values()];
      return send(res,200,{subjects,pairs});
    }
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
    async function saveUnique(q,published=true,batchId=null){
      const row=bankRow(q,published);
      // Prioridade: ID original (estável). Texto é fallback para registros antigos.
      const source=q.originalId;
      let existing=null;
      if(source){
        const matches=await json('dupla_bank_questions?'+new URLSearchParams({select:'id,data,fingerprint,source_id',source_id:'eq.'+source,limit:'1'}));
        existing=matches[0]||null;
      }
      if(!existing){
        const matches=await json('dupla_bank_questions?'+new URLSearchParams({select:'id,data,fingerprint,source_id',fingerprint:'eq.'+row.fingerprint,limit:'1'}));
        existing=matches[0]||null;
      }
      if(existing){
        if(source&&existing.source_id&&existing.source_id!==source)
          throw Object.assign(new Error('Enunciado igual já vinculado a outro código: '+existing.source_id),{status:409});
        // Preserva UUID: as tentativas já registradas continuam ligadas à questão.
        await query('dupla_bank_questions?id=eq.'+existing.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
        return 'updated';
      }
      await query('dupla_bank_questions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({...row,import_batch:batchId})});
      return 'created';
    }
    if(action==='import'&&req.method==='POST'){
      const body=await parseJson(req);
      if(body.rightsConfirmed!==true)return err(res,400,'Confirme que possui autorização para publicar estas questões.');
      if(!Array.isArray(body.questions)||body.questions.length===0||body.questions.length>MAX_BATCH)
        return err(res,400,'Envie de 1 a '+MAX_BATCH+' questões por vez.');
      const batchId=trimmed(body.batchId,50);
      if(!UUID.test(batchId))return err(res,400,'Identificador do lote inválido. Atualize o navegador.');
      const normalized=body.questions.map(normalize);
      const valid=normalized.filter(Boolean);
      if(!valid.length)return err(res,400,'Nenhuma questão válida: é necessário enunciado e pelo menos duas alternativas.');
      // Remove repetições dentro do próprio JSON, priorizando ID original.
      const unique=[...new Map(valid.map(q=>[q.originalId?'id:'+q.originalId:'text:'+fingerprint(q),q])).values()];
      let created=0,updated=0;
      for(const q of unique){
        const result=await saveUnique(q,true,batchId);
        if(result==='created')created++;else updated++;
      }
      const pending=unique.filter(q=>!q.correct).length;
      return send(res,200,{received:body.questions.length,imported:unique.length,created,updated,duplicatesInFile:valid.length-unique.length,drafts:pending,ignored:body.questions.length-valid.length});
    }
    if(action==='create'&&req.method==='POST'){
      const body=await parseJson(req);
      if(body.rightsConfirmed!==true)return err(res,400,'Confirme a autorização de publicação.');
      const q=normalize(body.question);
      if(!q)return err(res,400,'Informe um enunciado e pelo menos duas alternativas válidas.');
      const result=await saveUnique(q,body.published!==false);
      return send(res,200,{ok:true,result,published:body.published!==false&&!!q.correct});
    }
    if(action==='edit'&&req.method==='POST'){
      const body=await parseJson(req);
      const original=await questionById(trimmed(body.id,60),true);
      if(!original)return err(res,404,'Questão não encontrada.');
      const q=normalize(body.question);
      if(!q)return err(res,400,'Informe enunciado e pelo menos duas alternativas válidas.');
      const published=body.published!==false&&!!q.correct;
      const update={fingerprint:fingerprint(q),source_id:q.originalId||null,subject:q.subject,topic:q.topic,board:q.board,exam_year:q.year?Number(q.year):null,
        statement:q.statement,has_key:!!q.correct,has_commentary:!!q.commentary,published,data:q,
        updated_at:new Date().toISOString()};
      await query('dupla_bank_questions?id=eq.'+original.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(update)});
      return send(res,200,{ok:true,published});
    }
    // Prévia obrigatória antes de qualquer exclusão em lote.
    // Última importação = apenas novos registros criados no lote; questões atualizadas anteriormente permanecem.
    if(action==='deletion-preview'&&req.method==='POST' || action==='delete-group'&&req.method==='POST'){
      const body=await parseJson(req);
      const mode=trimmed(body.mode,20);
      let params;
      if(mode==='last'){
        const latest=await json('dupla_bank_questions?'+new URLSearchParams({select:'import_batch,created_at',import_batch:'not.is.null',order:'created_at.desc',limit:'1'}));
        if(!latest.length)return send(res,200,{count:0,mode:'last',batchId:null});
        params=new URLSearchParams({import_batch:'eq.'+latest[0].import_batch});
      } else if(mode==='filters'){
        const subject=trimmed(body.subject,180),topic=trimmed(body.topic,180);
        if(!subject)return err(res,400,'Selecione uma disciplina para excluir por filtros.');
        params=new URLSearchParams({subject:'eq.'+subject});
        if(topic)params.set('topic','eq.'+topic);
      } else return err(res,400,'Modo de exclusão inválido.');
      // Ler IDs para limitar a operação e usar a mesma seleção na prévia e no envio.
      params.set('select','id');params.set('limit',String(DELETE_LIMIT+1));
      const rows=await json('dupla_bank_questions?'+params);
      if(rows.length>DELETE_LIMIT)return err(res,413,'Muitas questões: reduza os filtros.');
      const ids=rows.map(r=>r.id);
      const batchId=mode==='last'?params.get('import_batch').slice(3):null;
      if(action==='deletion-preview')return send(res,200,{count:ids.length,mode,batchId});
      if(body.confirmText!=='EXCLUIR'||body.confirmCount!==ids.length)return err(res,409,'A seleção mudou ou faltou confirmação. Faça nova prévia.');
      if(mode==='last'&&body.batchId!==batchId)return err(res,409,'O último lote mudou. Faça nova prévia.');
      // Exclui os IDs exatamente apurados, com cascata de tentativas do banco.
      if(ids.length)await query('dupla_bank_questions?id=in.('+ids.join(',')+')',{method:'DELETE',headers:{Prefer:'return=minimal'}});
      return send(res,200,{ok:true,deleted:ids.length});
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

'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const {topicFilter,normalizeTopic}=require('./topic');
const IDLE=30*60*1000;
const text=(v,n=180)=>typeof v==='string'?v.trim().slice(0,n):'';
module.exports=function({rooms,databaseRequest,storageEnabled,parseJson,send,err,normalizeQuestion,recordAnswer=async()=>{},publicName=async()=>null,publicMembers=async()=>[]}){
  const locks=new Map(),writes=new Map();
  async function store(r){if(!storageEnabled)return;const {clients,...state}=r;const snapshot=JSON.stringify({code:r.code,state,updated_at:new Date().toISOString()});const prior=writes.get(r.code)||Promise.resolve();const next=prior.catch(()=>{}).then(()=>databaseRequest('dupla_rooms?on_conflict=code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:snapshot}));writes.set(r.code,next);try{await next;}finally{if(writes.get(r.code)===next)writes.delete(r.code);}}
  function notify(r){r.touched=Date.now();for(const c of r.clients)try{c.write('event: refresh\ndata: {}\n\n');}catch{r.clients.delete(c);}}
  function migrate(r){
    if(!r.members){r.members=[{userId:r.hostUserId,name:r.hostName,token:r.hostToken},...(r.guest?.userId?[r.guest]:[])];for(const v of Object.values(r.votes||{})){v.choices={[r.hostUserId]:v.host,...(r.guest?.userId?{[r.guest.userId]:v.guest}:{})};}}
    r.maxParticipants=r.maxParticipants||2;r.lastActivity=r.lastActivity||r.touched||Date.now();r.clients=r.clients||new Set();r.votes=r.votes||{};return r;
  }
  async function load(code){let r=rooms.get(code);if(!r&&storageEnabled){const rows=await (await databaseRequest('dupla_rooms?'+new URLSearchParams({select:'state',code:'eq.'+code,limit:'1'}))).json();if(rows[0]){r={...rows[0].state,clients:new Set()};rooms.set(code,r);}}if(r){migrate(r);if(r.isOpen!==false&&Date.now()-r.lastActivity>=IDLE){r.isOpen=false;await store(r);notify(r);}}return r;}
  const member=(r,user)=>r.members.find(m=>m.userId===user.id);
  function publicQuestion(q){if(!q)return null;const {correct,commentary,...clean}=q;return clean;}
  async function state(r,user){const profiles=await publicMembers(r.members.map(m=>m.userId));const vote=r.votes[r.index]||{choices:{},revealed:false};return {code:r.code,title:r.title,isOpen:r.isOpen!==false,role:r.hostUserId===user.id?'host':'guest',myUserId:user.id,index:r.index,questionsCount:r.questions.length,maxParticipants:r.maxParticipants,hasPassword:!!r.passwordHash,question:publicQuestion(r.questions[r.index]),questions:r.hostUserId===user.id?r.questions.map((q,i)=>({...publicQuestion(q),number:i+1})):undefined,myAnswer:vote.choices?.[user.id]||null,revealed:!!vote.revealed,participants:r.members.map(m=>{const p=profiles.find(p=>p.user_id===m.userId);return {userId:m.userId,name:p?.display_name||(!m.name?.includes('@')?m.name:'Participante'),avatar:p?.avatar_data||'',owner:m.userId===r.hostUserId,answered:!!vote.choices?.[m.userId],answer:vote.revealed?vote.choices?.[m.userId]||null:null};}),lastActivity:r.lastActivity};}
  async function list(user){
    let catalog;
    if(storageEnabled){catalog=await (await databaseRequest('dupla_rooms?'+new URLSearchParams({select:'code,state:state',order:'updated_at.desc',limit:'100'}))).json();catalog=catalog.map(x=>rooms.get(x.code)||{...x.state,clients:new Set()});}
    else catalog=[...rooms.values()];
    const profiles=await publicMembers([...new Set(catalog.map(r=>r.hostUserId).filter(Boolean))]);
    return catalog.map(migrate).filter(r=>r.isOpen!==false&&Date.now()-r.lastActivity<IDLE).map(r=>({code:r.code,title:r.title||'Sala '+r.code,hostName:profiles.find(p=>p.user_id===r.hostUserId)?.display_name||(!r.hostName?.includes('@')?r.hostName:'Participante'),questionsCount:r.questions.length,participants:r.members.length,maxParticipants:r.maxParticipants,occupied:r.members.length>=r.maxParticipants,mine:!!member(r,user),hasPassword:!!r.passwordHash}));
  }
  async function handle(req,res,url,user){
    if(url.pathname==='/api/rooms'&&req.method==='GET')return send(res,200,{rooms:await list(user)});
    if(url.pathname==='/api/room'&&req.method==='POST'){
      const body=await parseJson(req),max=Number(body.maxParticipants||2),password=typeof body.password==='string'?body.password:'';
      body.name=await publicName(user.id)||body.name;
      if(!Number.isInteger(max)||max<2||max>20)return err(res,400,'Escolha de 2 a 20 pessoas, incluindo você.');
      if(body.access==='password'&&(password.length<4||password.length>100))return err(res,400,'A senha da sala deve ter de 4 a 100 caracteres.');
      let code;do{code=Array.from(crypto.randomBytes(6),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');}while(rooms.has(code));
      const token=crypto.randomBytes(24).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
      const r={code,hostToken:token,hostUserId:user.id,hostName:text(body.name,30)||'Participante',members:[{userId:user.id,name:text(body.name,30)||'Participante',token}],title:text(body.title,70),maxParticipants:max,passwordSalt:body.access==='password'?salt:null,passwordHash:body.access==='password'?(await scrypt(password,salt,32)).toString('hex'):null,isOpen:true,questions:[],votes:{},index:0,lastActivity:Date.now(),touched:Date.now(),clients:new Set()};
      await store(r);rooms.set(code,r);return send(res,201,{code,token,role:'host'});
    }
    const match=url.pathname.match(/^\/api\/room\/([A-Z0-9]{6})\/([a-z-]+)$/i);if(!match)return err(res,404,'Rota não encontrada.');
    const code=match[1].toUpperCase(),action=match[2];
    // Serializa alterações e entradas para não exceder a capacidade em acessos simultâneos.
    const previous=locks.get(code)||Promise.resolve();let unlock;const lock=new Promise(resolve=>unlock=resolve);const queued=previous.then(()=>lock);locks.set(code,queued);await previous;
    try{
      const r=await load(code);if(!r)return err(res,404,'Sala não encontrada.');
      const m=member(r,user),role=r.hostUserId===user.id?'host':'guest';
      if(action==='join'&&req.method==='POST'){
        const body=await parseJson(req);if(r.isOpen===false)return err(res,409,'Sala encerrada por inatividade ou pelo dono.');if(m)return send(res,200,{code,token:m.token,role});
        if(r.members.length>=r.maxParticipants)return err(res,409,'A sala está lotada.');
        if(r.passwordHash){const supplied=await scrypt(typeof body.password==='string'?body.password.slice(0,100):'',r.passwordSalt,32);if(!crypto.timingSafeEqual(supplied,Buffer.from(r.passwordHash,'hex')))return err(res,403,'Senha da sala incorreta.');}
        const added={userId:user.id,name:await publicName(user.id)||text(body.name,30)||'Participante',token:crypto.randomBytes(24).toString('hex')};r.members.push(added);r.lastActivity=Date.now();await store(r);notify(r);return send(res,200,{code,token:added.token,role:'guest'});
      }
      if(!m)return err(res,403,'Entre na sala para acessar.');
      if(action==='state'&&req.method==='GET')return send(res,200,await state(r,user));
      if(r.isOpen===false)return err(res,409,'Sala encerrada por inatividade ou pelo dono.');
      if(action==='restore'&&req.method==='GET')return send(res,200,{code,token:m.token,role});
      if(action==='events'&&req.method==='GET'){
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.roomUserId=user.id;r.clients.add(res);res.write('event: refresh\ndata: {}\n\n');const timer=setInterval(()=>{try{res.write(': heartbeat\n\n');}catch{}},20000);req.on('close',()=>{clearInterval(timer);r.clients.delete(res);});return;
      }
      if(action==='voice-config'&&req.method==='GET'){let iceServers=[{urls:'stun:stun.l.google.com:19302'}];try{if(process.env.VOICE_ICE_SERVERS)iceServers=JSON.parse(process.env.VOICE_ICE_SERVERS);}catch{return err(res,503,'Áudio não configurado.');}return send(res,200,{iceServers,participantId:user.id});}
      if(req.method!=='POST')return err(res,404,'Rota não encontrada.');const body=await parseJson(req);
      if(['import','edit','key'].includes(action))return err(res,403,'Importação, edição e gabaritos não estão disponíveis nas salas.');
      if(action==='voice'){
        const s=body.signal;if(!s||!['ready','offer','answer','leave'].includes(s.type)||typeof s.session!=='string'||s.session.length>80||s.to!==undefined&&typeof s.to!=='string')return err(res,400,'Sinal de áudio inválido.');
        if(['offer','answer'].includes(s.type)&&(typeof s.sdp!=='string'||s.sdp.length>50000||!r.members.some(x=>x.userId===s.to)))return err(res,400,'Sinal de áudio inválido.');
        for(const c of r.clients)if(c.roomUserId!==user.id&&(!s.to||c.roomUserId===s.to))try{c.write('event: voice\ndata: '+JSON.stringify({from:user.id,type:s.type,session:s.session,to:s.to,sdp:s.sdp})+'\n\n');}catch{}
        return send(res,200,{ok:true});
      }
      if(action==='leave'){
        if(role!=='host'){
          r.members=r.members.filter(x=>x.userId!==user.id);
          for(const c of [...r.clients])if(c.roomUserId===user.id){r.clients.delete(c);try{c.end();}catch{}}
          for(const c of r.clients)try{c.write('event: voice\ndata: '+JSON.stringify({type:'leave',from:user.id,session:'*'})+'\n\n');}catch{}
        }
        r.lastActivity=Date.now();await store(r);notify(r);return send(res,200,{ok:true});
      }
      if(action==='activity'){r.lastActivity=Date.now();await store(r);return send(res,200,{ok:true});}
      if(action==='answer'){
        const q=r.questions[r.index];if(!q||body.index!==r.index||!q.alternatives.some(a=>a.letter===body.choice))return err(res,400,'Questão ou alternativa inválida.');
        const vote=r.votes[r.index]||={choices:{},revealed:false};if(vote.revealed||vote.choices[user.id])return err(res,409,'Sua resposta já foi registrada ou as escolhas foram reveladas.');
        if(q.correct)await recordAnswer(user.id,r.code,q,body.choice===q.correct);
        vote.choices[user.id]=body.choice;if(r.members.length>1&&r.members.every(x=>vote.choices[x.userId]))vote.revealed=true;
      }else{
        if(role!=='host')return err(res,403,'Somente o dono controla as questões.');
        if(action==='close')r.isOpen=false;
        else if(action==='navigate'){if(!Number.isInteger(body.index)||body.index<0||body.index>=r.questions.length)return err(res,400,'Questão inválida.');r.index=body.index;}
        else if(action==='reveal'){const vote=r.votes[r.index]||={choices:{},revealed:false};vote.revealed=true;}
        else if(action==='from-bank'){
          if(!storageEnabled)return err(res,503,'Configure o banco de questões.');
          const p=new URLSearchParams({select:'data',published:'eq.true',order:'created_at.desc',limit:String(Math.min(200,Math.max(1,parseInt(body.limit,10)||50)))});if(text(body.subject))p.set('subject','eq.'+text(body.subject));if(text(body.topic))p.set('topic',topicFilter(text(body.topic)));
          const rows=await (await databaseRequest('dupla_bank_questions?'+p)).json();if(!rows.length)return err(res,404,'Não há questões publicadas nesses filtros.');r.questions=rows.map((x,i)=>normalizeQuestion({...x.data,topic:normalizeTopic(x.data?.topic)},i)).filter(Boolean);r.index=0;r.votes={};
        }else return err(res,404,'Ação não encontrada.');
      }
      r.lastActivity=Date.now();await store(r);notify(r);return send(res,200,{ok:true});
    }finally{unlock();if(locks.get(code)===queued)locks.delete(code);}
  }
  async function sweep(){for(const r of rooms.values()){migrate(r);if(r.isOpen!==false&&Date.now()-r.lastActivity>=IDLE){r.isOpen=false;await store(r);notify(r);}}}
  return {handle,sweep,refreshProfiles:userId=>{for(const r of rooms.values())if(r.members?.some(m=>m.userId===userId))notify(r);},getForInvite:async(code,userId)=>{const r=await load(code);return r?.isOpen!==false&&r?.members.some(m=>m.userId===userId)?{code:r.code}:null;}};
};

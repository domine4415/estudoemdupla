'use strict';
// ESTUDO POLICIAL — servidor Node.js sem dependências externas.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 3000);
const createBankApi = require('./bank-api');
const createTheoryApi = require('./theory-api');
const {topicFilter,normalizeTopic}=require('./topic');
const rooms = new Map();
// Persistência opcional. Nunca envie SUPABASE_SECRET_KEY para o frontend.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const storageEnabled = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const authEnabled = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
// O admin é validado NO SERVIDOR pelo usuário autenticado e e-mail confirmado.
// ADMIN_USER_ID (opcional) permite travar a permissão também no UUID da conta.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'domineoliveira.mcz@gmail.com').trim().toLowerCase();
const ADMIN_USER_ID = (process.env.ADMIN_USER_ID || '').trim();
function isAdmin(user) {
  return Boolean(user && user.emailConfirmed && user.email.toLowerCase()===ADMIN_EMAIL && (!ADMIN_USER_ID || user.id===ADMIN_USER_ID));
}
const saveQueues = new Map();
const roomLoads = new Map();

function databaseRequest(endpoint, init={}) {
  if (!storageEnabled) throw new Error('Banco de dados não configurado');
  const url = SUPABASE_URL + '/rest/v1/' + endpoint;
  return fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      'Content-Type':'application/json',
      ...init.headers
    },
    signal: AbortSignal.timeout(12000)
  }).then(async response => {
    if (!response.ok) {
      const detail = (await response.text()).slice(0,400);
      console.error('Supabase status',response.status, detail);
      throw new Error('O banco Supabase não respondeu corretamente (HTTP '+response.status+'). Confira as tabelas do Supabase (BANCO_SQL.sql para o banco) e as variáveis do Render.');
    }
    return response;
  });
}
function storedState(room) {
  return {
    code:room.code,hostToken:room.hostToken,hostName:room.hostName,hostUserId:room.hostUserId||null,
    guest:room.guest,questions:room.questions,index:room.index,
    votes:room.votes,touched:room.touched,
    title:room.title||'',isOpen:room.isOpen!==false,
    questionsCount:room.questions.length
  };
}
async function persistRoom(room) {
  if (!storageEnabled) return;
  // Fila por sala: impede que duas respostas simultâneas gravem fora de ordem.
  const snapshot = storedState(room);
  const prior = saveQueues.get(room.code) || Promise.resolve();
  const operation = prior.catch(()=>{}).then(()=>databaseRequest('dupla_rooms?on_conflict=code', {
    method:'POST',
    headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({code:room.code,state:snapshot,updated_at:new Date().toISOString()})
  }));
  saveQueues.set(room.code,operation);
  try {await operation;} finally {
    if (saveQueues.get(room.code) === operation)saveQueues.delete(room.code);
  }
}
async function loadRoom(code) {
  if (!storageEnabled) return null;
  if (rooms.has(code)) return rooms.get(code);
  if (roomLoads.has(code)) return roomLoads.get(code);
  const load = (async()=>{
    const response = await databaseRequest('dupla_rooms?select=state&code=eq.'+encodeURIComponent(code)+'&limit=1');
    const rows = await response.json();
    if (!rows.length) return null;
    const state = rows[0].state;
    if (!state || state.code!==code || !Array.isArray(state.questions)) throw new Error('Dados inválidos de sala no banco.');
    const restored = {...state,isOpen:state.isOpen!==false,clients:new Set(),touched:Date.now()};
    rooms.set(code,restored);
    return restored;
  })();
  roomLoads.set(code,load);
  try{return await load;}finally{if(roomLoads.get(code)===load)roomLoads.delete(code);}
}

// Lista pública apenas para usuários LOGADOS, sem enunciados e sem tokens.
// A projeção JSONB evita transferir os grandes arquivos de questões para a lista.
async function listRooms(user) {
  let entries=[];
  if(storageEnabled){
    const select='code,updated_at,host_name:state->>hostName,host_user_id:state->>hostUserId,'+
      'guest_name:state->guest->>name,guest_user_id:state->guest->>userId,'+
      'title:state->>title,is_open:state->>isOpen,question_count:state->>questionsCount';
    const endpoint='dupla_rooms?select='+encodeURIComponent(select)+'&order=updated_at.desc&limit=100';
    const response=await databaseRequest(endpoint);
    entries=(await response.json()).map(x=>({
      code:x.code,hostName:x.host_name,title:x.title,
      hostUserId:x.host_user_id,guestName:x.guest_name,guestUserId:x.guest_user_id,
      isOpen:x.is_open!=='false',questionsCount:Number(x.question_count)||0,updatedAt:x.updated_at
    }));
  } else {
    entries=Array.from(rooms.values()).map(r=>({
      code:r.code,hostName:r.hostName,title:r.title,hostUserId:r.hostUserId,
      guestName:r.guest?.name||null,guestUserId:r.guest?.userId||null,
      isOpen:r.isOpen!==false,questionsCount:r.questions.length,updatedAt:new Date(r.touched).toISOString()
    })).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  return entries.filter(r=>r.isOpen).map(r=>({
    code:r.code, title:safeText(r.title,70)||'Sala '+r.code,
    hostName:safeText(r.hostName,30)||'Administrador',
    questionsCount:r.questionsCount, occupied:Boolean(r.guestName),
    guestName:r.guestName?safeText(r.guestName,30):null,
    mine:r.hostUserId===user.id||r.guestUserId===user.id,
    updatedAt:r.updatedAt
  }));
}

// Supabase Auth (email e senha). Cookies HttpOnly, SameSite=Lax; nenhuma chave
// secreta ou JWT é inserido no JavaScript público ou nos links das salas.
const COOKIE_ACCESS='dupla_auth_access';
const COOKIE_REFRESH='dupla_auth_refresh';
function cookieValue(req,name) {
  const cookie=(req.headers.cookie||'').split(';').find(part=>part.trim().startsWith(name+'='));
  if(!cookie)return '';
  try{return decodeURIComponent(cookie.trim().slice(name.length+1));}catch{return '';}
}
function useSecureCookie(req) {return process.env.RENDER==='true' || req.headers['x-forwarded-proto']==='https';}
function cookieHeader(req,name,value,age) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${useSecureCookie(req)?'; Secure':''}`;
}
function writeAuthCookies(req,res,tokens) {
  const access=String(tokens.access_token||''), refresh=String(tokens.refresh_token||'');
  if(!access||!refresh) throw new Error('A autenticação não retornou uma sessão completa.');
  const expires=Math.min(86400, Math.max(60,Number(tokens.expires_in)||3600));
  res.setHeader('Set-Cookie',[
    cookieHeader(req,COOKIE_ACCESS,access,expires),
    cookieHeader(req,COOKIE_REFRESH,refresh,60*60*24*30)
  ]);
}
function clearAuthCookies(req,res) {
  res.setHeader('Set-Cookie',[
    cookieHeader(req,COOKIE_ACCESS,'',0),cookieHeader(req,COOKIE_REFRESH,'',0)
  ]);
}
async function supabaseAuth(endpoint,method='GET',body=null,accessToken='') {
  if(!authEnabled)throw Object.assign(new Error('Configure SUPABASE_PUBLISHABLE_KEY no Render para habilitar o login.'),{status:503});
  const headers={apikey:SUPABASE_PUBLISHABLE_KEY};
  if(body!==null)headers['Content-Type']='application/json';
  if(accessToken)headers.Authorization='Bearer '+accessToken;
  const result=await fetch(SUPABASE_URL+'/auth/v1/'+endpoint,{
    method,headers,body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)
  });
  let data={};try{data=await result.json();}catch{}
  return {ok:result.ok,status:result.status,data};
}
function authError(r) {
  const code=r.data?.code||'';
  if(code==='email_not_confirmed')return 'Confirme seu e-mail para entrar. Confira sua caixa de entrada e spam.';
  if(code==='invalid_credentials'||r.status===400&&/invalid login/i.test(r.data?.msg||''))return 'E-mail ou senha incorretos.';
  if(code==='over_email_send_rate_limit')return 'Muitos e-mails enviados. Tente novamente mais tarde.';
  if(code==='user_already_exists')return 'Este e-mail já está cadastrado. Faça login.';
  return String(r.data?.msg||r.data?.message||r.data?.error_description||r.data?.error||'Falha de autenticação.').slice(0,220);
}
async function currentUser(req,res) {
  if(!authEnabled)throw Object.assign(new Error('Login não configurado no Render.'),{status:503});
  const access=cookieValue(req,COOKIE_ACCESS);
  if(access) {
    const check=await supabaseAuth('user','GET',null,access);
    if(check.ok&&check.data?.id)return {id:check.data.id,email:check.data.email||'',emailConfirmed:!!check.data.email_confirmed_at};
    if(check.status>=500)throw Object.assign(new Error('Não foi possível validar o login no Supabase.'),{status:502});
  }
  const refresh=cookieValue(req,COOKIE_REFRESH);
  if(refresh) {
    const result=await supabaseAuth('token?grant_type=refresh_token','POST',{refresh_token:refresh});
    if(result.ok && result.data?.access_token) {
      writeAuthCookies(req,res,result.data);
      const verified=await supabaseAuth('user','GET',null,result.data.access_token);
      if(verified.ok&&verified.data?.id)return {id:verified.data.id,email:verified.data.email||'',emailConfirmed:!!verified.data.email_confirmed_at};
    }
    if(result.status>=500)throw Object.assign(new Error('Não foi possível renovar o login no Supabase.'),{status:502});
    clearAuthCookies(req,res);
  }
  return null;
}
function requireSameOrigin(req,res) {
  const origin=req.headers.origin;
  if(origin) {
    let host;try{host=new URL(origin).host;}catch{host='';}
    const requestedHost=req.headers['x-forwarded-host']||req.headers.host;
    if(host!==requestedHost){err(res,403,'Origem não permitida.');return false;}
  }
  if(req.method==='POST'&&!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) {
    err(res,415,'Envie os dados como application/json.');return false;
  }
  return true;
}
async function handleAuth(req,res,url) {
  if(!authEnabled){err(res,503,'O login ainda não foi configurado. Adicione SUPABASE_PUBLISHABLE_KEY no Render.');return;}
  const action=url.pathname.slice('/api/auth/'.length);
  if(action==='me'&&req.method==='GET') {
    const user=await currentUser(req,res);
    send(res,200,{authenticated:!!user,user:user?{id:user.id,email:user.email}:null,isAdmin:isAdmin(user)});return;
  }
  if(req.method!=='POST'){err(res,404,'Ação não encontrada.');return;}
  if(action==='logout') {
    const access=cookieValue(req,COOKIE_ACCESS);
    clearAuthCookies(req,res);
    if(access)await supabaseAuth('logout','POST',{},access).catch(()=>{});
    send(res,200,{ok:true});return;
  }
  if(action!=='login'&&action!=='register'){err(res,404,'Ação não encontrada.');return;}
  const body=await parseJson(req);
  const email=safeText(body.email,254).toLowerCase();
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<6||password.length>128) {
    err(res,400,'Informe um e-mail válido e uma senha de 6 a 128 caracteres.');return;
  }
  const r=action==='login'
    ? await supabaseAuth('token?grant_type=password','POST',{email,password})
    : await supabaseAuth('signup','POST',{email,password});
  if(!r.ok){err(res,r.status===429?429:400,authError(r));return;}
  if(r.data?.access_token&&r.data?.refresh_token) {
    writeAuthCookies(req,res,r.data);
    send(res,200,{ok:true,confirmationRequired:false});return;
  }
  if(action==='register') {send(res,200,{ok:true,confirmationRequired:true});return;}
  err(res,401,'Não foi possível iniciar a sessão. Confira seu e-mail.');
}

const MAX_QUESTIONS = 400;
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  for (let j = 0; j < 20; j++) {
    const chars = crypto.randomBytes(6);
    const code = Array.from(chars, b => CHARS[b % CHARS.length]).join('');
    if (!rooms.has(code)) return code;
  }
  throw new Error('Não foi possível criar código');
}
function id() { return crypto.randomBytes(24).toString('hex'); }
function send(res, status, data) {
  const text = JSON.stringify(data);
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(text);
}
function err(res, status, msg) { send(res, status, {error: msg}); }
function parseJson(req) {
  return new Promise((resolve, reject) => {
    let size=0, chunks=[];
    req.on('data', chunk => {
      size+=chunk.length;
      if (size > 6*1024*1024) { reject(Object.assign(new Error('Arquivo muito grande'),{status:413})); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end',()=>{
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON inválido'), {status:400})); }
    });
    req.on('error',reject);
  });
}
function safeText(s, max=12000) {return typeof s==='string'? s.slice(0,max).trim():'';}
function normalizeQuestion(q,i) {
  if (!q || typeof q !== 'object') return null;
  const statement = safeText(q.statement,12000);
  const letters = new Set();
  const alternatives = (Array.isArray(q.alternatives)?q.alternatives:[]).slice(0,8).map((a,j)=>{
    const letter = safeText(a?.letter || String.fromCharCode(65+j),2).toUpperCase();
    const text = safeText(a?.text,4000);
    if (!letter || letters.has(letter) || !text) return null;
    letters.add(letter);
    return {letter,text};
  }).filter(Boolean);
  if (!statement) return null;
  const answer = typeof q.correct==='string' && alternatives.some(a=>a.letter===q.correct.toUpperCase()) ? q.correct.toUpperCase() : null;
  return {id:safeText(q.id,40)||String(i+1),originalId:safeText(q.originalId,40),statement,
    alternatives, type: q.type === 'true_false' ? 'true_false' : 'multiple_choice',
    subject:safeText(q.subject,200),topic:safeText(q.topic,200),commentary:safeText(q.commentary,10000),exam:safeText(q.exam,250),board:safeText(q.board,80),year:safeText(String(q.year||''),5),
    link: /^https:\/\/(www\.)?tecconcursos\.com\.br\/questoes\/\d+\/?$/.test(q.link||'') ? q.link : '',
    correct:answer, needsReview:alternatives.length<2 || Boolean(q.needsReview)};
}
function auth(room, token, userId) {
  if (!userId) return null;
  // Login vinculado ao criador e ao convidado. A senha da sala sozinha não basta.
  if (room.hostUserId === userId) return 'host';
  if (room.guest?.userId === userId) return 'guest';
  // A administração de salas antigas não pode ser reivindicada só com token.
  if (token && room.guest && token === room.guest.token && !room.guest.userId) {
    room.guest.userId=userId;
    persistRoom(room).catch(error=>console.error('Falha ao associar convidado antigo:',error.message));
    return 'guest';
  }
  return null;
}
function currentVoting(r) {
  return r.votes[r.index] || {host:null,guest:null,revealed:false};
}
function sanitizedState(r, role) {
  const v=currentVoting(r);
  const revealed=Boolean(v.revealed);
  const q=r.questions[r.index] || null;
  const scores={host:0,guest:0,count:0};
  for (let i=0;i<r.questions.length;i++) {
    const x=r.votes[i]; const key=r.questions[i].correct;
    if (x?.revealed && key) {
      scores.count++;
      if (x.host===key) scores.host++;
      if (x.guest===key) scores.guest++;
    }
  }
  return {
    code:r.code, role, hostName:r.hostName, guestName:r.guest?.name||null,
    index:r.index, questionsCount:r.questions.length, isOpen:r.isOpen!==false, title:r.title||'',
    questions:role==='host'? r.questions.map(({id,originalId,subject,topic,commentary,exam,board,year,link,needsReview,statement,alternatives,type,correct},i)=>({id,originalId,subject,topic,commentary,exam,board,year,link,needsReview,statement,alternatives,type,correct,number:i+1})) : undefined,
    question:q ? {...q,correct: revealed?q.correct:null,commentary:revealed?q.commentary:null}:null,
    hostCorrect:role==='host'&&q ? q.correct : undefined,
    answered:{host:!!v.host,guest:!!v.guest}, myAnswer:v[role],
    revealed, answers: revealed?{host:v.host,guest:v.guest}:null,
    scores
  };
}
function notify(r) {
  r.touched=Date.now();
  for(const client of r.clients) {
    try {client.write('event: refresh\ndata: {}\n\n');} catch {r.clients.delete(client);}
  }
}
async function findRoom(code,res) {
  const r=rooms.get(code) || await loadRoom(code);
  if(!r) {err(res,404,'Sala não encontrada ou expirada.'); return null;}
  return r;
}
function requireHost(r,body,res,role,user) {
  if(!isAdmin(user)||role!=='host'||body.hostToken!==r.hostToken) {err(res,403,'Somente o criador da sala pode fazer isso.');return false;}
  return true;
}
async function handleApi(req,res,url,user) {
  const segments=url.pathname.split('/').filter(Boolean);
  if(segments[1]==='rooms'&&segments.length===2&&req.method==='GET') {
    send(res,200,{rooms:await listRooms(user)});return;
  }
  if(segments[1]==='room' && segments.length===2 && req.method==='POST') {
    if(!isAdmin(user)){err(res,403,'Somente o administrador pode criar salas.');return;}
    const body=await parseJson(req);
    const code=makeCode(), hostToken=id();
    const room={code,hostToken,hostUserId:user.id,hostName:safeText(body.name,30)||'Administrador',
      title:safeText(body.title,70),isOpen:true,guest:null,questions:[],index:0,votes:{},clients:new Set(),touched:Date.now()};
    await persistRoom(room);
    rooms.set(code,room); send(res,201,{code,token:hostToken}); return;
  }
  if(segments[1]!=='room'||!segments[2]) {err(res,404,'Rota não encontrada');return;}
  const room=await findRoom(segments[2].toUpperCase(),res); if(!room) return;
  const action=segments[3]||'';
  if(action==='restore' && req.method==='GET') {
    const access=auth(room,null,user.id);
    if (!access) {err(res,403,'Você não é participante dessa sala.');return;}
    send(res,200,{code:room.code,role:access,token:access==='host'?room.hostToken:room.guest.token});return;
  }
  if(action==='events' && req.method==='GET') {
    const role=auth(room,url.searchParams.get('token'),user.id);
    if(!role) {err(res,401,'Token inválido');return;}
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('event: refresh\ndata: {}\n\n');room.clients.add(res);
    const heartbeat=setInterval(()=>{try{res.write(': heartbeat\n\n')}catch{}},20000);
    req.on('close',()=>{clearInterval(heartbeat);room.clients.delete(res)});return;
  }
  if(action==='state'&&req.method==='GET') {
    const role=auth(room,url.searchParams.get('token'),user.id);
    if(!role) {err(res,401,'Você precisa entrar na sala.');return;}
    send(res,200,sanitizedState(room,role));return;
  }
  if(action==='join'&&req.method==='POST') {
    const body=await parseJson(req);
    if(room.isOpen===false){err(res,409,'Esta sala foi encerrada pelo administrador.');return;}
    if(room.hostUserId===user.id) {err(res,409,'Você já é o criador desta sala.');return;}
    if(room.guest) {
      if(room.guest.userId===user.id) {send(res,200,{code:room.code,token:room.guest.token});return;}
      err(res,409,'Esta sala já tem dois participantes.');return;
    }
    const token=id(); room.guest={name:safeText(body.name,30)||'Amigo',token,userId:user.id};
    await persistRoom(room);
    send(res,200,{code:room.code,token});notify(room);return;
  }
  const body=await parseJson(req);
  const role=auth(room,body.token||body.hostToken,user.id);
  if(!role) {err(res,401,'Credencial inválida.');return;}
  if(action==='close'&&req.method==='POST') {
    if(!requireHost(room,body,res,role,user))return;
    room.isOpen=false;
    await persistRoom(room);notify(room);send(res,200,{ok:true});return;
  }
  if(room.isOpen===false){err(res,409,'Esta sala foi encerrada.');return;}
  if(action==='import'&&req.method==='POST') {
    if(!requireHost(room,body,res,role,user))return;
    if(!Array.isArray(body.questions)||body.questions.length===0||body.questions.length>MAX_QUESTIONS) {err(res,400,`Envie entre 1 e ${MAX_QUESTIONS} questões.`);return;}
    const cleaned=body.questions.map(normalizeQuestion);
    if(cleaned.some(x=>!x)) {err(res,400,'Há questão sem enunciado.');return;}
    room.questions=cleaned;room.index=0;room.votes={};
    await persistRoom(room);notify(room);
    send(res,200,{imported:cleaned.length});return;
  }
  if(action==='from-bank'&&req.method==='POST') {
    if(!requireHost(room,body,res,role,user))return;
    if(!storageEnabled){err(res,503,'Configure o Supabase para carregar questões do banco.');return;}
    const amount=Math.min(200,Math.max(1,Number.parseInt(body.limit,10)||50));
    const p=new URLSearchParams({select:'data',published:'eq.true',order:'created_at.desc',limit:String(amount)});
    const selectedSubject=safeText(body.subject,180),selectedTopic=safeText(body.topic,180);
    if(selectedSubject)p.set('subject','eq.'+selectedSubject);
    if(selectedTopic)p.set('topic',topicFilter(selectedTopic));
    const rows=await (await databaseRequest('dupla_bank_questions?'+p)).json();
    if(!rows.length){err(res,404,'Não existem questões publicadas com esses filtros.');return;}
    const normalized=rows.map((r,i)=>normalizeQuestion({...r.data,topic:normalizeTopic(r.data?.topic)},i)).filter(Boolean);
    room.questions=normalized;room.index=0;room.votes={};
    await persistRoom(room);notify(room);
    send(res,200,{imported:normalized.length});return;
  }
  if(action==='answer'&&req.method==='POST') {
    const q=room.questions[room.index];
    if(!q) {err(res,400,'A sala ainda não possui questões.');return;}
    if(body.index!==room.index) {err(res,409,'A questão mudou. Atualize a tela.');return;}
    if(!q.alternatives.some(a=>a.letter===body.choice)) {err(res,400,'Alternativa inválida.');return;}
    const vote=room.votes[room.index] ||= {host:null,guest:null,revealed:false};
    if(vote.revealed) {err(res,409,'As respostas já foram reveladas.');return;}
    vote[role]=body.choice;
    if(vote.host&&vote.guest) vote.revealed=true;
    await persistRoom(room);notify(room);send(res,200,{ok:true});return;
  }
  if(!requireHost(room,body,res,role,user))return;
  if(action==='navigate'&&req.method==='POST') {
    const index=Number(body.index);
    if(!Number.isInteger(index)||index<0||index>=room.questions.length){err(res,400,'Questão não existe.');return;}
    room.index=index;await persistRoom(room);notify(room);send(res,200,{index});return;
  }
  if(action==='reveal'&&req.method==='POST') {
    if(!room.questions.length){err(res,400,'Importe questões antes.');return;}
    const vote=room.votes[room.index] ||= {host:null,guest:null,revealed:false};
    vote.revealed=true;await persistRoom(room);notify(room);send(res,200,{ok:true});return;
  }
  if(action==='key'&&req.method==='POST') {
    const q=room.questions[room.index];
    if(!q) {err(res,400,'Importe questões antes.');return;}
    if(body.correct!==null&&!q.alternatives.some(a=>a.letter===body.correct)){err(res,400,'Gabarito inválido.');return;}
    q.correct=body.correct;
    await persistRoom(room);notify(room);send(res,200,{ok:true});return;
  }
  if(action==='edit'&&req.method==='POST') {
    const index=Number(body.index);
    if(!Number.isInteger(index)||index<0||index>=room.questions.length){err(res,400,'Questão inválida.');return;}
    const q=normalizeQuestion(body.question,index);
    if(!q){err(res,400,'Informe um enunciado válido.');return;}
    const old=room.questions[index];
    const validCorrect=q.alternatives.some(a=>a.letter===old.correct);
    room.questions[index]={...q,correct:q.correct||(validCorrect?old.correct:null)};
    room.votes[index]=undefined;await persistRoom(room);notify(room);send(res,200,{ok:true});return;
  }
  err(res,404,'Ação não encontrada.');
}
const bankApi=createBankApi({databaseRequest,parseJson,send,err,isAdmin,storageEnabled});
const theoryApi=createTheoryApi({databaseRequest,parseJson,send,err,isAdmin,storageEnabled});
const files={'/banco':'bank.html','/banco.html':'bank.html','/bank.js':'bank.js','/bank.css':'bank.css','/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};
Object.assign(files,{'/teoria':'theory.html','/theory.js':'theory.js','/theory.css':'theory.css'});
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/health' && req.method==='GET')return send(res,200,{status:'ok',storage:storageEnabled?'supabase':'memory',auth:authEnabled?'supabase':'unconfigured'});
    if(url.pathname.startsWith('/api/')) {
      if(req.method==='POST'&&!requireSameOrigin(req,res))return;
      if(url.pathname.startsWith('/api/auth/'))return await handleAuth(req,res,url);
      const user=await currentUser(req,res);
      if(!user){err(res,401,'Entre na sua conta para acessar as salas.');return;}
      if(url.pathname.startsWith('/api/bank/'))return await bankApi.handle(req,res,url,user);
      if(url.pathname==='/api/theory'||url.pathname.startsWith('/api/theory/'))return await theoryApi.handle(req,res,url,user);
      return await handleApi(req,res,url,user);
    }
    const filename=files[url.pathname];
    if(!filename||req.method!=='GET'){err(res,404,'Página não encontrada.');return;}
    const content=fs.readFileSync(path.join(__dirname,'public',filename));
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)],'Content-Length':content.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(content);
  } catch(e) {
    console.error(e);
    if(!res.headersSent)err(res,e.status||500,e.status?e.message:'Erro inesperado do servidor.');
  }
});
setInterval(()=>{
  for(const [code,r] of rooms) if(Date.now()-r.touched>ROOM_TTL_MS) {
    for(const c of r.clients) {try{c.end();}catch{}}
    rooms.delete(code);
  }
},60000).unref();
server.on('error',e=>{
  if(e.code==='EADDRINUSE')console.error(`ERRO: a porta ${PORT} já está sendo usada. Feche a outra instância do app ou execute novamente.`);
  else console.error('Não foi possível iniciar o servidor:',e.message);
  process.exitCode=1;
});
server.listen(PORT,'0.0.0.0',()=>{
  console.log(`ESTUDO POLICIAL disponível em http://localhost:${PORT}`);
  console.log('Armazenamento: '+(storageEnabled?'Supabase configurado':'temporário (memória) — configure SUPABASE_URL e SUPABASE_SECRET_KEY no Render'));
  console.log('Mantenha esta janela aberta enquanto estiver estudando.');
  if(process.argv.includes('--open')&&process.platform==='win32'){
    require('node:child_process').exec(`start "" "http://localhost:${PORT}"`,{shell:'cmd.exe'},(err)=>{
      if(err)console.log(`Abra manualmente: http://localhost:${PORT}`);
    });
  }
});

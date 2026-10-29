'use strict';
// Estudo em Dupla — servidor Node.js sem dependências externas.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
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
    subject:safeText(q.subject,200),exam:safeText(q.exam,250),board:safeText(q.board,80),year:safeText(String(q.year||''),5),
    link: /^https:\/\/(www\.)?tecconcursos\.com\.br\/questoes\/\d+\/?$/.test(q.link||'') ? q.link : '',
    correct:answer, needsReview:alternatives.length<2 || Boolean(q.needsReview)};
}
function auth(room, token) {
  if (!token || typeof token!=='string') return null;
  if (token === room.hostToken) return 'host';
  if (room.guest && token === room.guest.token) return 'guest';
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
    index:r.index, questionsCount:r.questions.length,
    questions:role==='host'? r.questions.map(({id,originalId,subject,exam,board,year,link,needsReview,statement,alternatives,type,correct},i)=>({id,originalId,subject,exam,board,year,link,needsReview,statement,alternatives,type,correct,number:i+1})) : undefined,
    question:q ? {...q,correct: revealed?q.correct:null}:null,
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
function findRoom(code,res) {
  const r=rooms.get(code);
  if(!r) {err(res,404,'Sala não encontrada ou expirada.'); return null;}
  return r;
}
function requireHost(r,body,res) {
  if(body.hostToken!==r.hostToken) {err(res,403,'Somente o criador da sala pode fazer isso.');return false;}
  return true;
}
async function handleApi(req,res,url) {
  const segments=url.pathname.split('/').filter(Boolean);
  if(segments[1]==='room' && segments.length===2 && req.method==='POST') {
    const body=await parseJson(req);
    const code=makeCode(), hostToken=id();
    const room={code,hostToken,hostName:safeText(body.name,30)||'Você', guest:null, questions:[],index:0,votes:{},clients:new Set(),touched:Date.now()};
    rooms.set(code,room); send(res,201,{code,token:hostToken}); return;
  }
  if(segments[1]!=='room'||!segments[2]) {err(res,404,'Rota não encontrada');return;}
  const room=findRoom(segments[2].toUpperCase(),res); if(!room) return;
  const action=segments[3]||'';
  if(action==='events' && req.method==='GET') {
    const role=auth(room,url.searchParams.get('token'));
    if(!role) {err(res,401,'Token inválido');return;}
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('event: refresh\ndata: {}\n\n');room.clients.add(res);
    const heartbeat=setInterval(()=>{try{res.write(': heartbeat\n\n')}catch{}},20000);
    req.on('close',()=>{clearInterval(heartbeat);room.clients.delete(res)});return;
  }
  if(action==='state'&&req.method==='GET') {
    const role=auth(room,url.searchParams.get('token'));
    if(!role) {err(res,401,'Você precisa entrar na sala.');return;}
    send(res,200,sanitizedState(room,role));return;
  }
  if(action==='join'&&req.method==='POST') {
    const body=await parseJson(req);
    if(room.guest) {err(res,409,'Esta sala já tem dois participantes.');return;}
    const token=id(); room.guest={name:safeText(body.name,30)||'Amigo',token};
    send(res,200,{code:room.code,token});notify(room);return;
  }
  const body=await parseJson(req);
  const role=auth(room,body.token||body.hostToken);
  if(!role) {err(res,401,'Credencial inválida.');return;}
  if(action==='import'&&req.method==='POST') {
    if(!requireHost(room,body,res))return;
    if(!Array.isArray(body.questions)||body.questions.length===0||body.questions.length>MAX_QUESTIONS) {err(res,400,`Envie entre 1 e ${MAX_QUESTIONS} questões.`);return;}
    const cleaned=body.questions.map(normalizeQuestion);
    if(cleaned.some(x=>!x)) {err(res,400,'Há questão sem enunciado.');return;}
    room.questions=cleaned;room.index=0;room.votes={};notify(room);
    send(res,200,{imported:cleaned.length});return;
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
    notify(room);send(res,200,{ok:true});return;
  }
  if(!requireHost(room,body,res))return;
  if(action==='navigate'&&req.method==='POST') {
    const index=Number(body.index);
    if(!Number.isInteger(index)||index<0||index>=room.questions.length){err(res,400,'Questão não existe.');return;}
    room.index=index;notify(room);send(res,200,{index});return;
  }
  if(action==='reveal'&&req.method==='POST') {
    if(!room.questions.length){err(res,400,'Importe questões antes.');return;}
    const vote=room.votes[room.index] ||= {host:null,guest:null,revealed:false};
    vote.revealed=true;notify(room);send(res,200,{ok:true});return;
  }
  if(action==='key'&&req.method==='POST') {
    const q=room.questions[room.index];
    if(!q) {err(res,400,'Importe questões antes.');return;}
    if(body.correct!==null&&!q.alternatives.some(a=>a.letter===body.correct)){err(res,400,'Gabarito inválido.');return;}
    q.correct=body.correct;
    notify(room);send(res,200,{ok:true});return;
  }
  if(action==='edit'&&req.method==='POST') {
    const index=Number(body.index);
    if(!Number.isInteger(index)||index<0||index>=room.questions.length){err(res,400,'Questão inválida.');return;}
    const q=normalizeQuestion(body.question,index);
    if(!q){err(res,400,'Informe um enunciado válido.');return;}
    const old=room.questions[index];
    const validCorrect=q.alternatives.some(a=>a.letter===old.correct);
    room.questions[index]={...q,correct:q.correct||(validCorrect?old.correct:null)};
    room.votes[index]=undefined;notify(room);send(res,200,{ok:true});return;
  }
  err(res,404,'Ação não encontrada.');
}
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/health' && req.method==='GET')return send(res,200,{status:'ok'});
    if(url.pathname.startsWith('/api/')) return await handleApi(req,res,url);
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
  console.log(`Estudo em Dupla disponível em http://localhost:${PORT}`);
  console.log('Mantenha esta janela aberta enquanto estiver estudando.');
  if(process.argv.includes('--open')&&process.platform==='win32'){
    require('node:child_process').exec(`start "" "http://localhost:${PORT}"`,{shell:'cmd.exe'},(err)=>{
      if(err)console.log(`Abra manualmente: http://localhost:${PORT}`);
    });
  }
});

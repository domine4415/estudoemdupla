const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const net=require('node:net');
const path=require('node:path');
test('servidor entrega scripts com MIME JavaScript e não JSON de erro',async t=>{
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
 t.after(()=>child.kill());
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou a tempo.')),8000);child.stdout.setEncoding('utf8');child.stdout.on('data',data=>{if(data.includes('http://localhost:')){clearTimeout(timer);resolve();}});child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);reject(Error('Servidor encerrou: '+code));});});
 for(const file of ['math-support.js','searchable-select.js','page-motion.js','date-picker.js','room-screen.js']){const response=await fetch(`http://127.0.0.1:${port}/${file}`);assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),/application\/javascript/);assert.ok((await response.text()).length>100);}
});

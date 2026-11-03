'use strict';
// A chave permanente permanece no servidor. O navegador recebe credenciais temporárias.
module.exports=function createVoiceIce({env=process.env,fetchImpl=globalThis.fetch,now=Date.now}={}){
 const cache=new Map();
 return async function voiceIce(userId){
  const key=env.CLOUDFLARE_TURN_KEY_ID,token=env.CLOUDFLARE_TURN_API_TOKEN;
  if(key||token){
   if(!key||!token||!/^[-a-zA-Z0-9_]+$/.test(key))throw Error('Configure CLOUDFLARE_TURN_KEY_ID e CLOUDFLARE_TURN_API_TOKEN no Render.');
   const cached=cache.get(userId);if(cached&&cached.until>now())return cached.promise;
   for(const [id,value] of cache)if(value.until<=now())cache.delete(id);
   if(cache.size>=500)cache.delete(cache.keys().next().value);
   const entry={until:now()+60000,promise:null};
   entry.promise=(async()=>{
    let response;try{response=await fetchImpl('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(key)+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({ttl:86400}),signal:AbortSignal.timeout(12000)});}catch{throw Error('Não foi possível acessar o serviço TURN. Tente novamente.');}
    if(!response.ok)throw Error('A Cloudflare não autorizou a conexão TURN. Confira a chave e o token no Render.');
    const data=await response.json();
    if(!Array.isArray(data.iceServers))throw Error('O serviço TURN retornou uma configuração inválida.');
    const servers=data.iceServers.map(server=>({...server,urls:(Array.isArray(server.urls)?server.urls:[server.urls]).filter(url=>typeof url==='string'&&/^(stun|turn|turns):/.test(url)&&!/:53(?:\?|$)/.test(url))})).filter(server=>server.urls.length);
    if(!servers.some(server=>server.urls.some(url=>/^turns?:/.test(url))))throw Error('O serviço não retornou um servidor TURN válido.');
    return servers;
   })().catch(error=>{if(cache.get(userId)===entry)cache.delete(userId);throw error;});cache.set(userId,entry);return entry.promise;
  }
  if(env.VOICE_ICE_SERVERS){try{const servers=JSON.parse(env.VOICE_ICE_SERVERS);if(!Array.isArray(servers)||!servers.length)throw Error();return servers;}catch{throw Error('VOICE_ICE_SERVERS inválido.');}}
  return [{urls:'stun:stun.l.google.com:19302'}];
 };
};

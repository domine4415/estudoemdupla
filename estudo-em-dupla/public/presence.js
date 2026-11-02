 'use strict';
(()=>{
 let userId='',busy=false,events=null,audio=null,queued=false;const seenMemory=new Set();
 const selectors=['a[href="/comunidade"]','#tabFriends','#tabInvites'];
 function sound(){if(!audio||audio.state!=='running')return;const now=audio.currentTime;for(const [frequency,delay] of [[660,0],[880,.12]]){const tone=audio.createOscillator(),gain=audio.createGain();tone.type='sine';tone.frequency.value=frequency;gain.gain.setValueAtTime(0,now+delay);gain.gain.linearRampToValueAtTime(.07,now+delay+.015);gain.gain.exponentialRampToValueAtTime(.001,now+delay+.18);tone.connect(gain);gain.connect(audio.destination);tone.start(now+delay);tone.stop(now+delay+.2);}}
 function unlock(){try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio)audio=new Audio();}audio?.resume().catch(()=>{});}catch{}}
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 function badge(target,count){let element=target.querySelector('.notification-badge');if(!count){element?.remove();return;}if(!element){element=document.createElement('span');element.className='notification-badge';element.setAttribute('aria-hidden','true');target.append(element);}element.textContent=count>99?'99+':String(count);target.classList.add('has-notification-badge');}
 function decorate(data){for(const target of document.querySelectorAll(selectors.join(','))){const count=target.id==='tabFriends'?(data.friendRequests||[]).length:target.id==='tabInvites'?(data.invitations||[]).length:data.notifications;badge(target,count);if(target.tagName==='A')target.setAttribute('aria-label',count?'Comunidade: '+count+' notificações':'Comunidade');}}
 function toast(invites,requests){document.getElementById('communityToast')?.remove();const panel=document.createElement('aside');panel.id='communityToast';panel.className='community-notification-toast';panel.setAttribute('role','status');const link=document.createElement('a');link.href=invites?'/comunidade#convites':'/comunidade#amigos';link.textContent=invites?'Você recebeu '+invites+' novo(s) convite(s) para sala.':'Você recebeu '+requests+' nova(s) solicitação(ões) de amizade.';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar notificação');close.onclick=()=>panel.remove();panel.append(link,close);document.body.append(panel);setTimeout(()=>panel.remove(),10000);sound();}
 function received(data){decorate(data);const items=[...(data.invitations||[]),...(data.friendRequests||[])];let seen=[];try{seen=JSON.parse(localStorage.getItem('policial_notification_seen:'+userId)||'[]');if(!Array.isArray(seen))seen=[];}catch{}const freshInvites=(data.invitations||[]).filter(id=>!seen.includes(id)&&!seenMemory.has(id)),freshRequests=(data.friendRequests||[]).filter(id=>!seen.includes(id)&&!seenMemory.has(id));for(const id of items)seenMemory.add(id);if(freshInvites.length||freshRequests.length){toast(freshInvites.length,freshRequests.length);try{localStorage.setItem('policial_notification_seen:'+userId,JSON.stringify([...new Set([...seen,...items])].slice(-500)));}catch{}}window.dispatchEvent(new CustomEvent('community-notifications',{detail:data}));}
 function connect(){if(events||!window.EventSource)return;events=new EventSource('/api/community/events');events.addEventListener('notifications',()=>ping());}
 async function ping(){
  if(busy){queued=true;return;}if(document.visibilityState!=='visible')return;busy=true;
  try{
   if(!userId){const session=await (await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})).json();if(!session.authenticated)return;userId=session.user.id;}
   const response=await fetch('/api/community/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
   if(response.status===401){userId='';events?.close();events=null;return;}if(!response.ok)return;
   received(await response.json());connect();
  }catch{}finally{busy=false;if(queued){queued=false;setTimeout(ping,100);}}
 }
 window.addEventListener('community-notifications-refresh',ping);
 document.addEventListener('visibilitychange',ping);window.addEventListener('focus',ping);setInterval(ping,10000);ping();
})();

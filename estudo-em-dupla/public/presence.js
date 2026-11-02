'use strict';
(()=>{
 let authenticated=null,busy=false;
 async function ping(){
  if(busy||document.visibilityState!=='visible')return;busy=true;
  try{
   if(authenticated===null){const session=await (await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})).json();authenticated=!!session.authenticated;}
   if(!authenticated){authenticated=null;return;}
   const response=await fetch('/api/community/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
   if(response.status===401){authenticated=null;return;}if(!response.ok)return;
   const data=await response.json();let link=document.getElementById('communityNotifications');
   if(!link){const bar=document.querySelector('.page-navigation');if(bar){link=document.createElement('a');link.id='communityNotifications';link.className='btn btn-soft';link.href='/comunidade';link.style.marginLeft='auto';bar.append(link);}}
   if(link)link.textContent=data.notifications?'Comunidade ('+data.notifications+')':'Comunidade';
  }catch{}finally{busy=false;}
 }
 document.addEventListener('visibilitychange',ping);window.addEventListener('focus',ping);setInterval(ping,45000);ping();
})();

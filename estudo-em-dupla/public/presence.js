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
   const data=await response.json();
   document.getElementById('communityNotifications')?.remove();
   for(const link of document.querySelectorAll('a[href="/comunidade"]')){
    link.setAttribute('aria-label',data.notifications?'Comunidade: '+data.notifications+' notificações':'Comunidade');
   }
  }catch{}finally{busy=false;}
 }
 document.addEventListener('visibilitychange',ping);window.addEventListener('focus',ping);setInterval(ping,45000);ping();
})();

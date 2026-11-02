'use strict';
(()=>{
 // Em páginas abertas pela sala, os links continuam usando o mesmo hospedeiro.
 if(window.parent!==window){
  try{if(window.parent.roomBrowse){for(const event of ['pointerdown','keydown','touchstart'])document.addEventListener(event,()=>window.parent.roomBrowse.activity(),{passive:true});document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||link.target==='_blank'||link.hasAttribute('download'))return;const url=new URL(link.href);if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;if(url.pathname===location.pathname&&url.search===location.search&&url.hash)return;event.preventDefault();window.parent.roomBrowse.open(url.href);},true);}}
  catch{}return;
 }
 const workspace=document.getElementById('workspace');if(!workspace)return;
 let frame=null,overlay=null,bar=null,roomUrl='',open=false;
 const active=()=>!workspace.classList.contains('hidden');
 function close(updateHistory=true){window.dispatchEvent(new Event('room-return-to-room'));if(!open)return;open=false;overlay.remove();bar.remove();frame=null;overlay=null;bar=null;document.body.classList.remove('room-browsing');window.roomScreen?.setAway(false);if(updateHistory)history.pushState(null,'',roomUrl);window.dispatchEvent(new Event('room-browse-change'));}
 function browse(href,addHistory=true){const url=new URL(href,location.href);if(url.origin!==location.origin||!active())return false;
  const room=new URL(roomUrl||location.href);if(url.pathname==='/'&&url.searchParams.get('room')===room.searchParams.get('room')&&url.searchParams.has('room')){close(addHistory);return true;}
  if(!open){window.dispatchEvent(new Event('room-return-to-room'));roomUrl=location.href;overlay=document.createElement('div');overlay.className='room-browse-overlay';frame=document.createElement('iframe');frame.title='Páginas de estudo';frame.setAttribute('allow','fullscreen');overlay.append(frame);bar=document.createElement('div');bar.className='room-return-bar';const back=document.createElement('button');back.className='btn btn-primary';back.type='button';back.textContent='← Voltar à sala';back.onclick=()=>close();const mute=document.createElement('button');mute.type='button';mute.className='btn btn-soft';mute.textContent=document.getElementById('voiceMute').textContent;mute.disabled=document.getElementById('voiceMute').disabled;mute.onclick=()=>{document.getElementById('voiceMute').click();mute.textContent=document.getElementById('voiceMute').textContent;};const leave=document.createElement('button');leave.type='button';leave.className='btn btn-outline';leave.textContent='Sair da sala';leave.onclick=()=>document.getElementById('exitRoom').click();bar.append(back,mute,leave);document.body.append(overlay,bar);open=true;document.body.classList.add('room-browsing');window.roomScreen?.setAway(true);}
  frame.src=url.href;if(addHistory)history.pushState(null,'',url.pathname+url.search+url.hash);return true;
 }
 window.roomBrowse={open:browse,close,activity(){document.dispatchEvent(new Event('pointerdown'));}};
 document.addEventListener('click',event=>{if(!active()||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.button!==0)return;const link=event.target.closest('a[href]');if(!link||link.target==='_blank'||link.hasAttribute('download'))return;const url=new URL(link.href);if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;if(url.pathname===location.pathname&&url.search===location.search&&url.hash)return;if(browse(url.href))event.preventDefault();},true);
 window.addEventListener('popstate',()=>{if(!open)return;const original=new URL(roomUrl);if(location.pathname===original.pathname&&location.search===original.search)close(false);else browse(location.href,false);});
 new MutationObserver(()=>{if(!active())close(false);}).observe(workspace,{attributes:true,attributeFilter:['class']});
})();

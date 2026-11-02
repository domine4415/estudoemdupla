'use strict';
window.pageMotion=(()=>{
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animations=new WeakMap();
 function animate(target,frames,duration){
  if(!target||!target.animate||reduced())return Promise.resolve();
  animations.get(target)?.cancel();
  const effect=target.animate(frames,{duration,easing:'ease-out'});animations.set(target,effect);
  return effect.finished.catch(()=>{});
 }
 function enter(target){return animate(target,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],240);}
 function exit(target){return animate(target,[{opacity:1},{opacity:0}],140);}
 const observer=new MutationObserver(records=>{
  for(const record of records){const target=record.target;if(!target.classList.contains('hidden')&&!target.parentElement?.closest('.hidden')&&(record.oldValue||'').split(/\s+/).includes('hidden'))enter(target);}
 });
 for(const id of ['pageBody','statsPane','adminPane','library','reader','editor','publicProfile','profilePane','friendsPane','invitesPane','peoplePane']){const target=document.getElementById(id);if(target)observer.observe(target,{attributes:true,attributeFilter:['class'],attributeOldValue:true});}
 return {enter,exit};
})();

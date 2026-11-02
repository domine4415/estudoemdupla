'use strict';
(()=>{
  const body=document.body,existing=document.getElementById('sideNav');
  const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
  const bar=node('div','page-navigation');const back=node('button','btn btn-soft page-back','← Voltar');back.type='button';bar.append(back);body.prepend(bar);
  let nav,shade,menu;
  function close(){nav?.classList.remove('is-open');if(shade)shade.hidden=true;menu?.setAttribute('aria-expanded','false');}
  if(!existing){
    nav=node('nav','app-sidebar');nav.id='appSidebar';nav.setAttribute('aria-label','Navegação principal');
    const brand=node('a','app-sidebar-brand','ESTUDO POLICIAL');brand.href='/';nav.append(brand);
    const items=[['Comunidade','/comunidade','M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a6 6 0 0 1 12 0v3M17 5v6M14 8h6'],['Home','/','M3 11 12 3l9 8v10H3zM9 21v-8h6v8'],['Banco de questões','/banco','M4 4h16v16H4zM8 8h8M8 12h8'],['Teoria','/teoria','M3 4h6l3 3 3-3h6v15h-6l-3 2-3-2H3zM12 7v14'],['Estatísticas','/banco#estatisticas','M4 20V10m8 10V4m8 16v-7'],['Salas ao vivo','/?view=salas#salas-abertas','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a7 7 0 0 1 14 0v3M18 5a3 3 0 0 1 0 6M19 15l3 6']];
    for(const [label,href,path] of items){const link=node('a','app-sidebar-link');link.href=href;link.title=label;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('aria-hidden','true');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',path);svg.append(p);link.append(svg,node('span','',label));nav.append(link);}
    const create=node('a','app-sidebar-link hidden');create.href='/?action=criar';create.title='Criar sala';
    const plus=document.createElementNS('http://www.w3.org/2000/svg','svg');plus.setAttribute('viewBox','0 0 24 24');plus.setAttribute('fill','none');plus.setAttribute('stroke','currentColor');plus.setAttribute('stroke-width','1.8');plus.setAttribute('aria-hidden','true');const plusPath=document.createElementNS('http://www.w3.org/2000/svg','path');plusPath.setAttribute('d','M4 4h16v16H4zM12 8v8M8 12h8');plus.append(plusPath);create.append(plus,node('span','','Criar sala'));nav.append(create);
    fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(response=>response.json()).then(session=>create.classList.toggle('hidden',!session.authenticated)).catch(()=>{});
    menu=node('button','btn btn-soft app-menu','☰ Menu');menu.type='button';menu.setAttribute('aria-controls','appSidebar');menu.setAttribute('aria-expanded','false');bar.append(menu);
    shade=node('button','app-menu-shade');shade.type='button';shade.hidden=true;shade.setAttribute('aria-label','Fechar navegação');shade.onclick=close;body.append(shade,nav);
    menu.onclick=()=>{const open=nav.classList.toggle('is-open');shade.hidden=!open;menu.setAttribute('aria-expanded',String(open));};
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  }
  function update(){
    const params=new URLSearchParams(location.search),workspace=document.getElementById('workspace');
    const home=['/','/index.html'].includes(location.pathname)&&!params.has('room')&&!params.has('view')&&!params.has('action')&&(!workspace||workspace.classList.contains('hidden'));
    body.classList.toggle('is-home',home);
    bar.hidden=home;back.hidden=home;
    body.classList.toggle('is-room-directory',params.get('view')==='salas');
    body.classList.toggle('is-room-create',params.get('action')==='criar');
    body.classList.toggle('has-app-sidebar',!existing&&!home);if(nav){nav.hidden=home;menu.hidden=home;if(home)close();}
    for(const link of nav?.querySelectorAll('.app-sidebar-link')||[]){const url=new URL(link.href);const active=location.pathname===url.pathname&&(url.pathname!=='/'||url.search===location.search);link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  }
  const visible=id=>{const el=document.getElementById(id);return el&&!el.classList.contains('hidden');};
  back.onclick=()=>{
    close();
    if(visible('publicProfile')||visible('profilePane')||visible('friendsPane')||visible('invitesPane'))return document.getElementById('tabPeople').click();
    if(visible('editor'))return document.getElementById('cancelEdit').click();
    if(visible('reader'))return document.getElementById('back').click();
    if(visible('library')){const crumbs=document.getElementById('theoryBreadcrumbs')?.children;if(crumbs?.length>1)return crumbs[crumbs.length-2].click();location.href='/';return;}
    if(visible('statsPane'))return document.getElementById('statsBack').click();
    if(visible('adminPane'))return document.getElementById('backToStudy').click();
    if(visible('workspace'))return document.getElementById('exitRoom').click();
    if(location.pathname!=='/'||location.search){location.href='/';return;}
    if(history.length>1)history.back();
  };
  const workspace=document.getElementById('workspace');if(workspace)new MutationObserver(update).observe(workspace,{attributes:true,attributeFilter:['class']});
  window.addEventListener('popstate',update);window.addEventListener('hashchange',update);update();
})();

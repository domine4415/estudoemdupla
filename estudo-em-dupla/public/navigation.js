'use strict';
(()=>{
  const body=document.body,existing=document.getElementById('sideNav');
  const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
  const menuIcons={"brand":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round"},"shapes":[{"tag":"path","attrs":{"d":"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"}},{"tag":"path","attrs":{"d":"m8.5 12 2.3 2.3 4.7-4.8"}}]},"Home":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8"},"shapes":[{"tag":"path","attrs":{"d":"m3 11 9-8 9 8v9H3zM9 20v-7h6v7"}}]},"Banco de questões":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round"},"shapes":[{"tag":"path","attrs":{"d":"M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"}},{"tag":"path","attrs":{"d":"M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 11h6"}}]},"Teoria":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round"},"shapes":[{"tag":"path","attrs":{"d":"M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z"}},{"tag":"path","attrs":{"d":"M13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3M7 8h3M7 12h3M16 8h2M16 12h2"}}]},"Estatísticas":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round"},"shapes":[{"tag":"rect","attrs":{"x":"3","y":"3","width":"18","height":"18","rx":"3"}},{"tag":"path","attrs":{"d":"M7 17v-5m5 5V7m5 10v-7"}}]},"Salas ao vivo":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round"},"shapes":[{"tag":"circle","attrs":{"cx":"9","cy":"8","r":"3"}},{"tag":"path","attrs":{"d":"M3 19v-2a6 6 0 0 1 12 0v2H3zM17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"}}]},"Criar sala":{"attrs":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","stroke-width":"1.8","stroke-linecap":"round"},"shapes":[{"tag":"rect","attrs":{"x":"3","y":"3","width":"18","height":"18","rx":"4"}},{"tag":"path","attrs":{"d":"M12 7v10M7 12h10"}}]},"Comunidade e perfil":{"attrs":{"viewBox":"0 0 24 24","fill":"none"},"shapes":[{"tag":"text","attrs":{"x":"12","y":"19","text-anchor":"middle","font-size":"23","fill":"currentColor"},"text":"♧"}]}};
  function menuIcon(label){const data=menuIcons[label],ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');for(const [key,value] of Object.entries(data.attrs))svg.setAttribute(key,value);svg.setAttribute('aria-hidden','true');for(const shape of data.shapes){const element=document.createElementNS(ns,shape.tag);for(const [key,value] of Object.entries(shape.attrs))element.setAttribute(key,value);if(shape.text)element.textContent=shape.text;svg.append(element);}return svg;}
  const bar=node('div','page-navigation');const back=node('button','btn btn-soft page-back','← Voltar');back.type='button';bar.append(back);body.prepend(bar);
  let nav,shade,menu;
  if(existing){for(const link of existing.querySelectorAll('.side-link')){const label=link.querySelector('.side-label')?.textContent.trim();if(menuIcons[label])link.querySelector('.side-icon')?.replaceChildren(menuIcon(label));}}
  function close(){nav?.classList.remove('is-open');if(shade)shade.hidden=true;menu?.setAttribute('aria-expanded','false');}
  if(!existing){
    nav=node('nav','app-sidebar');nav.id='appSidebar';nav.setAttribute('aria-label','Navegação principal');
    const brand=node('a','app-sidebar-brand');brand.append(menuIcon('brand'),node('span','','ESTUDO POLICIAL'));brand.href='/';nav.append(brand);
    const items=[['Home','/'],['Banco de questões','/banco'],['Teoria','/teoria'],['Estatísticas','/banco#estatisticas'],['Salas ao vivo','/?view=salas#salas-abertas'],['Comunidade e perfil','/comunidade']];
    for(const [label,href] of items){const link=node('a','app-sidebar-link');link.href=href;link.title=label;link.append(menuIcon(label),node('span','',label));nav.append(link);}
    const create=node('a','app-sidebar-link hidden');create.href='/?action=criar';create.title='Criar sala';
    create.append(menuIcon('Criar sala'),node('span','','Criar sala'));nav.append(create);const communityLink=[...nav.querySelectorAll('.app-sidebar-link')].find(link=>new URL(link.href).pathname==='/comunidade');if(communityLink)nav.append(communityLink);
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
    body.classList.toggle('is-inside-room',!!workspace&&!workspace.classList.contains('hidden'));
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

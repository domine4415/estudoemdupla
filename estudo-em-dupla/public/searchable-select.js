'use strict';
(()=>{
 const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const controls=[];
 for(const select of document.querySelectorAll('select[data-searchable]')){
  const wrap=document.createElement('div');wrap.className='searchable-select';select.before(wrap);wrap.append(select);select.classList.add('searchable-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const input=document.createElement('input'),list=document.createElement('div');input.id=select.id+'Search';input.type='text';input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',select.id+'List');input.placeholder=select.dataset.searchable;list.id=select.id+'List';list.className='searchable-options';list.setAttribute('role','listbox');list.hidden=true;wrap.append(input,list);
  const label=document.querySelector('label[for="'+select.id+'"]');if(label)label.htmlFor=input.id;
  let active=-1,buttons=[],querying=false;
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function sync(){input.disabled=select.disabled;if(select.disabled){querying=false;close();}if(!querying||document.activeElement!==input){input.value=select.selectedOptions[0]?.textContent||'';querying=false;}}
  function choose(option){select.value=option.value;querying=false;sync();close();select.dispatchEvent(new Event('change',{bubbles:true}));input.focus();}
  function results(){if(select.disabled)return;list.replaceChildren();buttons=[];active=-1;const query=querying?fold(input.value.trim()):'';for(const option of select.options){if(query&&!fold(option.textContent).includes(query))continue;const button=document.createElement('div');button.id=list.id+'Option'+buttons.length;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===select.value));button.textContent=option.textContent;button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(option);buttons.push(button);list.append(button);}if(!buttons.length){const empty=document.createElement('p');empty.textContent='Nenhum resultado encontrado.';list.append(empty);}list.hidden=false;input.setAttribute('aria-expanded','true');}
  input.onfocus=()=>{querying=false;input.select();results();};input.onclick=()=>{if(list.hidden)results();};
  input.oninput=()=>{querying=true;if(select.value){select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));}results();};
  input.onkeydown=event=>{if(event.key==='Escape'){querying=false;sync();close();return;}if(event.key==='Tab'){close();return;}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(list.hidden)results();if(!buttons.length)return;active=(active+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.classList.toggle('active',i===active));input.setAttribute('aria-activedescendant',buttons[active].id);buttons[active].scrollIntoView({block:'nearest'});}if(event.key==='Enter'){event.preventDefault();if(buttons[active>=0?active:0])buttons[active>=0?active:0].click();}};
  input.onblur=()=>{querying=false;sync();close();};select.addEventListener('change',sync);
  new MutationObserver(()=>{sync();if(!list.hidden)results();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});controls.push(sync);sync();
 }
 document.addEventListener('click',()=>setTimeout(()=>controls.forEach(sync=>sync()),0));
})();

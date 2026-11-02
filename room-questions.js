'use strict';
const crypto=require('node:crypto');
function shuffle(items,random=max=>crypto.randomInt(max)){
 const result=[...items];for(let i=result.length-1;i>0;i--){const j=random(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;
}
function prepareQuestion(q,random){
 if(q.type==='true_false')return {...q,alternatives:shuffle(q.alternatives,random)};
 // Itens que dependem de outras letras ou da ordem das opções precisam mantê-la.
 if(/anteriores|acima|alternativas?\s+[A-H]\b|letras?\s+[A-H]\b/i.test([q.statement,...q.alternatives.map(a=>a.text)].join(' ')))return {...q};
 const reordered=shuffle(q.alternatives,random),mapping={};reordered.forEach((a,i)=>mapping[a.letter]='ABCDEFGH'[i]);
 const commentary=(q.commentary||'').replace(/((?:alternativa|letra)\s+)([A-H])\b|\b([A-H])(?=\s*[)])/gi,(all,prefix,letter,label)=>prefix?prefix+(mapping[letter.toUpperCase()]||letter):(mapping[label.toUpperCase()]||label));
 return {...q,alternatives:reordered.map(a=>({...a,letter:mapping[a.letter]})),correct:mapping[q.correct]||q.correct,commentary};
}
module.exports={shuffle,prepareQuestion};

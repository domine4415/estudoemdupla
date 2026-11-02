'use strict';

function normalizeTopic(value){
  const topic=typeof value==='string'?value.trim():'';
  return /^uso\s+do\s+h[ií]fen(?:\s*[-–—:]|$)/i.test(topic)?'Uso do Hífen':topic;
}

function topicFilter(value){
  return normalizeTopic(value)==='Uso do Hífen'?'imatch.^Uso[[:space:]]+do[[:space:]]+H[ií]fen([[:space:]]*[-–—:]|$)':'eq.'+value;
}

module.exports={normalizeTopic,topicFilter};

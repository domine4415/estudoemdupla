const test=require('node:test');
const assert=require('node:assert/strict');
const {shuffle,prepareQuestion}=require('../room-questions');
test('embaralha alternativas e mantém a resposta correta associada ao texto',()=>{
 const original={statement:'Pergunta',type:'multiple_choice',correct:'A',commentary:'Alternativa A correta; alternativa B incorreta.',alternatives:[{letter:'A',text:'Correta'},{letter:'B',text:'Incorreta'}]};
 const q=prepareQuestion(original,()=>0);assert.equal(q.alternatives[0].text,'Incorreta');assert.equal(q.correct,'B');assert.equal(q.alternatives.find(a=>a.letter===q.correct).text,'Correta');assert.equal(q.commentary,'Alternativa B correta; alternativa A incorreta.');assert.equal(original.correct,'A');
});
test('preserva semântica de certo/errado e alternativas dependentes da ordem',()=>{
 const base={statement:'Pergunta',correct:'C',type:'true_false',alternatives:[{letter:'C',text:'Certo'},{letter:'E',text:'Errado'}]};const result=prepareQuestion(base,()=>0);assert.equal(result.correct,'C');assert.equal(result.alternatives.find(a=>a.letter==='C').text,'Certo');
 const dependent={statement:'Pergunta',correct:'B',alternatives:[{letter:'A',text:'Uma opção'},{letter:'B',text:'Todas as anteriores'}]};assert.deepEqual(prepareQuestion(dependent,()=>0).alternatives,dependent.alternatives);
 assert.deepEqual(shuffle([1,2,3],()=>0),[2,3,1]);
});

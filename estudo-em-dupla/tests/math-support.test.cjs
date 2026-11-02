const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(value){
 const idle=[],assets=[],rendered=[];let mutation,scans=0;
 const formula={nodeType:1,isConnected:true,textContent:value,matches:()=>true,querySelectorAll:()=>[],closest(){return this;}};
 const body={nodeType:1,isConnected:true,matches:()=>false,querySelectorAll:()=>{scans++;return [formula];},closest:()=>null};
 const window={requestIdleCallback:fn=>idle.push(fn),renderMathInElement:(node,options)=>{rendered.push({text:node.textContent,options});node.textContent='Fórmula renderizada';}};
 const document={body,createElement:tag=>({tag}),head:{append:node=>{assets.push(node);if(node.tag==='script')node.onload();}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/math-support.js'),'utf8'),{window,document,MutationObserver:class{constructor(fn){mutation=fn;}observe(){}},console,setTimeout});
 function flush(){while(idle.length)idle.shift()({timeRemaining:()=>10});}
 return {assets,rendered,formula,flush,mutation:records=>mutation(records),scans:()=>scans};
}
test('texto sem fórmulas não baixa nem processa a biblioteca matemática',()=>{
 const state=setup('Uma questão de Língua Portuguesa.');state.flush();assert.equal(state.assets.length,0);assert.equal(state.rendered.length,0);
});
test('fórmulas usam processamento agendado e atualizações locais sem varrer a página novamente',()=>{
 const state=setup('Calcule \\(x+1\\).');assert.equal(state.rendered.length,0);state.flush();assert.equal(state.rendered.length,1);assert.equal(state.rendered[0].options.delimiters[2].left,'\\(');assert.equal(state.scans(),1);
 state.formula.textContent='Nova questão: \\(y+2\\).';state.mutation([{addedNodes:[],target:state.formula}]);state.flush();assert.equal(state.rendered.length,2);assert.equal(state.scans(),1);assert.equal(state.assets.length,3);
 state.mutation([{addedNodes:[],target:state.formula}]);state.flush();assert.equal(state.rendered.length,2);
});

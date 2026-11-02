const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=new Map();const element=id=>{if(!nodes.has(id)){const classes=new Set(id==='authLoading'?[]:['hidden']);nodes.set(id,{classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s)},addEventListener(){}});}return nodes.get(id);};
 let resolve,verifications=0;const response=new Promise(r=>resolve=r);
 const context=vm.createContext({$:element,signedIn:false,code:null,window:{pageMotion:{enter(){}}},authFetch:()=>response,showAuthMessage(){},onAuthSubmit(){},verifyLogin:async session=>{assert.equal(session.authenticated,true);verifications++;context.signedIn=true;element('authGate').classList.add('hidden');}});
 const full=fs.readFileSync(require.resolve('../public/app.js'),'utf8'),start=full.indexOf('async function boot(){'),end=full.indexOf('\nboot();',start);
 const promise=vm.runInContext(full.slice(start,end)+'\nboot()',context);
 return {element,promise,resolve,verifications:()=>verifications};
}
test('login permanece oculto enquanto confirma sessão existente',async()=>{
 const s=setup();assert.equal(s.element('authGate').classList.contains('hidden'),true);s.resolve({authenticated:true});await s.promise;assert.equal(s.element('authGate').classList.contains('hidden'),true);assert.equal(s.element('authLoading').classList.contains('hidden'),true);assert.equal(s.verifications(),1);
});
test('formulário aparece somente após confirmar que não há login',async()=>{
 const s=setup();assert.equal(s.element('authGate').classList.contains('hidden'),true);s.resolve({authenticated:false});await s.promise;assert.equal(s.element('authGate').classList.contains('hidden'),false);assert.equal(s.element('authLoading').classList.contains('hidden'),true);
});

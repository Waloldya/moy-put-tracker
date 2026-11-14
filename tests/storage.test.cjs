const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../tracker-core.js');
function app(raw=JSON.stringify({sessions:{}})){
 const storage=new Map([[C.WORKOUT_KEY,raw]]),bodyEvents={},windowEvents={},elements={};
 const document={body:{addEventListener:(n,f)=>(bodyEvents[n]??=[]).push(f)},addEventListener(){},getElementById:id=>elements[id]??={innerHTML:'',textContent:'',classList:{add(){},remove(){}}},querySelector:()=>null};
 const ctx={console,Intl,Date,JSON,Math,String,Number,Object,Array,RegExp,Error,FormData:class{constructor(form){this.v=form.fields}get(k){return this.v[k]}},document,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{},location:{protocol:'http:',hostname:'localhost'},setTimeout(){},clearTimeout(){},setInterval(){},TrackerCore:C,FoodProvider:require('../food-provider.js')};
 ctx.window=ctx;ctx.addEventListener=(n,f)=>(windowEvents[n]??=[]).push(f);ctx.scrollTo=()=>{};vm.createContext(ctx);
 for(const file of ['data.js','life-ui.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);
 return {storage,event:key=>(windowEvents.storage||[]).forEach(f=>f({key})),edit:()=>bodyEvents.input.forEach(f=>f({target:{matches:()=>true,dataset:{field:'bodyWeight'},value:'69'}})),submitWeight:()=>bodyEvents.submit.forEach(f=>f({target:{closest:()=>({dataset:{lifeForm:'weight'},fields:{weight:'69'}})},preventDefault(){}}))};
}
for(const notify of [true,false])test('stale workout tab cannot overwrite another tab import'+(notify?' after event':' before event delivery'),()=>{
 const a=app();const imported=JSON.stringify({sessions:{'pull__2026-11-02':{day:'pull',date:'2026-11-02',bodyWeight:'68',notes:'',rpe:'7',completedAt:null,exercises:{sumo:[{weight:'80',count:'8',done:true}]}}}});
 a.storage.set(C.WORKOUT_KEY,imported);if(notify)a.event(C.WORKOUT_KEY);a.edit();assert.equal(a.storage.get(C.WORKOUT_KEY),imported);
});
test('unreadable original workout storage is preserved when editing',()=>{const a=app('{broken');a.edit();assert.equal(a.storage.get(C.WORKOUT_KEY),'{broken');});
for(const notify of [true,false])test('stale nutrition tab preserves another tab diary'+(notify?' after event':' before event delivery'),()=>{
 const a=app(),incoming=C.newLife();incoming.days['2026-11-02']={breakfast:[{id:'test-food',name:'Test',grams:100,nutrients:{kcal:100}}]};const raw=JSON.stringify(incoming);
 a.storage.set(C.LIFE_KEY,raw);if(notify)a.event(C.LIFE_KEY);a.submitWeight();assert.equal(a.storage.get(C.LIFE_KEY),raw);
});

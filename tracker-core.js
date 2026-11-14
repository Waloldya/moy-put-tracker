(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrackerCore=api;})(globalThis,function(){
'use strict';
const WORKOUT_KEY='moyput_workouts_v1',LIFE_KEY='moyput_life_v2';
const MEALS=[['breakfast','Завтрак'],['lunch','Обед'],['snack','Перекус'],['dinner','Ужин']];
// Canonical display units. Personal targets are entered or imported locally.
const NUTRIENTS=[
 ['kcal','Калории','ккал',null,'macro'],['protein','Белки','г',null,'macro'],['fat','Жиры','г',null,'macro'],['carbs','Углеводы','г',null,'macro'],['fiber','Клетчатка','г',null,'other'],
 ['vitaminA','Витамин A (RAE)','мкг',null,'vitamin'],['vitaminC','Витамин C','мг',null,'vitamin'],['vitaminD','Витамин D','мкг',null,'vitamin'],['vitaminE','Витамин E','мг',null,'vitamin'],['vitaminK','Витамин K (K1)','мкг',null,'vitamin'],
 ['thiamin','B1 · тиамин','мг',null,'vitamin'],['riboflavin','B2 · рибофлавин','мг',null,'vitamin'],['niacin','B3 · ниацин','мг',null,'vitamin'],['choline','B4 · холин','мг',null,'vitamin'],['pantothenic','B5 · пантотеновая кислота','мг',null,'vitamin'],['vitaminB6','Витамин B6','мг',null,'vitamin'],['biotin','B7 · биотин','мкг',null,'vitamin'],['folate','B9 · фолат (DFE)','мкг',null,'vitamin'],['vitaminB12','Витамин B12','мкг',null,'vitamin'],['omega3','Омега-3','мг',null,'other'],
 ['calcium','Кальций','мг',null,'mineral'],['iron','Железо','мг',null,'mineral'],['magnesium','Магний','мг',null,'mineral'],['phosphorus','Фосфор','мг',null,'mineral'],['zinc','Цинк','мг',null,'mineral'],['iodine','Йод','мкг',null,'mineral'],['selenium','Селен','мкг',null,'mineral'],['copper','Медь','мг',null,'mineral'],['sodium','Натрий','мг',null,'mineral'],['manganese','Марганец','мг',null,'mineral'],['chromium','Хром','мкг',null,'mineral'],['molybdenum','Молибден','мкг',null,'mineral'],['fluoride','Фтор','мг',null,'mineral'],['potassium','Калий','мг',null,'mineral'],['chloride','Хлорид','мг',null,'mineral']
].map(([id,name,unit,target,group])=>({id,name,unit,target,group}));
const META=Object.fromEntries(NUTRIENTS.map(n=>[n.id,n]));
const DEFAULT_GOALS=Object.fromEntries(NUTRIENTS.map(n=>[n.id,n.target]));
const copy=v=>JSON.parse(JSON.stringify(v));
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function number(v){if(v===null||v===undefined||String(v).trim()==='')return null;const s=String(v).trim().replace(',','.');return /^[-+]?\d*(\.\d+)?$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;}
function positive(v,label='Значение',zero=false){const n=number(v);if(n===null||(zero?n<0:n<=0))throw Error(label+': укажи корректное '+(zero?'неотрицательное':'положительное')+' число');return n;}
function dateValid(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
function dates(start,end){if(!dateValid(start)||!dateValid(end)||start>end)throw Error('Проверь начало и конец периода');const out=[];const endMs=Date.parse(end+'T12:00:00Z');for(let ms=Date.parse(start+'T12:00:00Z');ms<=endMs;ms+=86400000){if(out.length>=36600)throw Error('Слишком длинный период');out.push(new Date(ms).toISOString().slice(0,10));}return out;}
function newLife(){return {version:2,days:{},weights:{},goals:{...DEFAULT_GOALS},goalHistory:[],goalNote:'',products:{}};}
function entriesForDay(day){return MEALS.flatMap(([m])=>day?.[m]||[]);}
function totals(entries){
 const out=Object.fromEntries(NUTRIENTS.map(n=>[n.id,{value:null,known:0,total:entries.length,complete:false,partial:false}]));
 for(const entry of entries){const factor=positive(entry.grams,'Граммы')/100;for(const n of NUTRIENTS){const v=entry.nutrients?.[n.id];if(v===undefined||v===null)continue;const amount=positive(v,n.name,true);const r=out[n.id];r.value=(r.value??0)+amount*factor;r.known++;if(entry.partial?.includes(n.id))r.partial=true;}}
 for(const r of Object.values(out))r.complete=entries.length>0&&r.known===entries.length&&!r.partial;
 return out;
}
function csvRows(text){
 const rows=[];let row=[],cell='',quoted=false,closed=false;const s=text.replace(/^\ufeff/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'){if(cell||closed)throw Error('Некорректные кавычки в CSV');quoted=true;}
 else if(c===';'){row.push(cell);cell='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}
 else{if(closed)throw Error('Некорректный CSV после кавычек');cell+=c;}}
 if(quoted)throw Error('Незакрытые кавычки в CSV');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
}
function parseWorkoutCSV(text,workouts){
 const rows=csvRows(text);const expected=['Дата','День','Упражнение','Подход','Вес кг','Повторы/секунды/попытки','Единица','Вес тела кг','Сложность','Заметки'];
 if(!rows.length||rows[0].length!==10||!expected.every((h,i)=>rows[0][i]===h))throw Error('Нужен CSV истории из приложения «Мой путь»');
 const sessions={};const occupied=new Set();
 rows.slice(1).forEach((r,idx)=>{if(r.length!==10)throw Error('Строка '+(idx+2)+': неверное число колонок');
 const [date,dayName,name,set,weight,count,unit,bodyWeight,rpe,notes]=r;
 if(!dateValid(date))throw Error('Строка '+(idx+2)+': неверная дата');
 const day=Object.keys(workouts).find(k=>workouts[k].title===dayName);const ex=workouts[day]?.exercises.find(e=>e.name===name);
 if(!ex)throw Error('Неизвестное упражнение: '+name);if(unit!==ex.unit)throw Error('Единица упражнения не совпадает: '+name);
 const setIndex=positive(set,'Номер подхода')-1;if(!Number.isInteger(setIndex)||setIndex>99)throw Error('Некорректный номер подхода');
 const n=positive(count,'Повторы/секунды');if(!Number.isInteger(n))throw Error('Количество должно быть целым');
 const w=weight===''?'':String(positive(weight,'Вес',true));const bw=bodyWeight===''?'':String(positive(bodyWeight,'Вес тела'));
 const rp=rpe===''?'':String(positive(rpe,'Сложность'));if(rp!==''&&Number(rp)>10)throw Error('Сложность должна быть от 1 до 10');
 const key=day+'__'+date,slot=key+'/'+ex.id+'/'+setIndex;if(occupied.has(slot))throw Error('Повтор подхода в CSV: '+name);occupied.add(slot);
 if(!sessions[key])sessions[key]={day,date,bodyWeight:bw,notes,rpe:rp,exercises:{},completedAt:null,importedFrom:'csv'};
 const s=sessions[key];if(s.bodyWeight!==bw||s.notes!==notes||s.rpe!==rp)throw Error('В CSV различаются данные одной тренировки: '+date);
 const sets=s.exercises[ex.id]??=[];while(sets.length<=setIndex)sets.push({weight:'',count:'',done:false});sets[setIndex]={weight:w,count:String(n),done:true};
 });
 if(rows.length===1)throw Error('CSV не содержит подходов');return {sessions,rows:rows.length-1};
}
function rejectKeys(v){if(!v||typeof v!=='object')return;for(const [k,val] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Недопустимый ключ в файле');rejectKeys(val);}}
function validateWorkouts(db,workouts){
 if(!object(db)||!object(db.sessions))throw Error('Некорректная история тренировок');const out={sessions:{}};
 for(const [key,s] of Object.entries(db.sessions)){
 if(!object(s)||!workouts[s.day]||!dateValid(s.date)||key!==s.day+'__'+s.date||!object(s.exercises))throw Error('Некорректная запись тренировки');
 const dst=copy(s);dst.bodyWeight=s.bodyWeight==null?'':String(s.bodyWeight);dst.rpe=s.rpe==null?'':String(s.rpe);dst.notes=typeof s.notes==='string'?s.notes:'';
 if(dst.bodyWeight!=='')positive(dst.bodyWeight,'Вес тела');if(dst.rpe!==''){const r=positive(dst.rpe,'Сложность');if(r>10)throw Error('Некорректная сложность');}
 if(s.completedAt!=null&&(typeof s.completedAt!=='string'||isNaN(Date.parse(s.completedAt))))throw Error('Некорректная дата завершения');
 dst.completedAt=s.completedAt||null;
 for(const [eid,sets] of Object.entries(s.exercises)){if(!workouts[s.day].exercises.some(e=>e.id===eid)||!Array.isArray(sets)||sets.length>100)throw Error('Неизвестное упражнение или подходы');
 for(const st of sets){if(!object(st)||typeof st.done!=='boolean')throw Error('Некорректный подход');if(st.weight!=null&&st.weight!=='')positive(st.weight,'Вес',true);if(st.count!=null&&st.count!=='')positive(st.count,'Количество',true);if(st.done)positive(st.count,'Выполненный подход');}}
 out.sessions[key]=dst;
 }return out;
}
function validateFood(food,entry=false){
 if(!object(food)||typeof food.id!=='string'||!food.id||food.id.length>160||typeof food.name!=='string'||!food.name.trim()||!object(food.nutrients))throw Error('Некорректный продукт');
 for(const [id,v] of Object.entries(food.nutrients)){if(!META[id])throw Error('Неизвестный нутриент');if(v!==null)positive(v,META[id].name,true);}
 if(food.partial!==undefined&&(!Array.isArray(food.partial)||!food.partial.every(k=>META[k])))throw Error('Некорректные неполные данные');
 if(entry)positive(food.grams,'Граммы');return copy(food);
}
function validateLife(life){
 if(!object(life)||life.version!==2||!object(life.days)||!object(life.weights)||!object(life.goals)||!object(life.products))throw Error('Некорректный дневник питания');
 const out=newLife();if(life.goalNote!==undefined){if(typeof life.goalNote!=='string'||life.goalNote.length>2000)throw Error('Некорректная заметка о целях');out.goalNote=life.goalNote;}
 for(const [k,v] of Object.entries(life.goals)){if(!META[k])throw Error('Неизвестная цель');out.goals[k]=v===null?null:positive(v,'Цель '+META[k].name);}
 for(const [date,w] of Object.entries(life.weights)){if(!dateValid(date))throw Error('Некорректная дата веса');out.weights[date]=positive(w,'Вес тела');}
 for(const [date,day] of Object.entries(life.days)){if(!dateValid(date)||!object(day))throw Error('Некорректный день питания');out.days[date]={};const ids=new Set();
 for(const [meal,entries] of Object.entries(day)){if(!MEALS.some(([m])=>m===meal)||!Array.isArray(entries))throw Error('Некорректный приём пищи');out.days[date][meal]=entries.map(e=>{const f=validateFood(e,true);if(ids.has(f.id))throw Error('Повтор записи еды');ids.add(f.id);return f;});}}
 for(const [id,f] of Object.entries(life.products)){const item=validateFood(f);if(id!==item.id)throw Error('Некорректный идентификатор продукта');out.products[id]=item;}
 if(life.goalHistory!==undefined){if(!Array.isArray(life.goalHistory))throw Error('Некорректная история целей');out.goalHistory=life.goalHistory.map(g=>{if(!object(g)||!dateValid(g.from)||!object(g.goals))throw Error('Некорректная история целей');const goals={...DEFAULT_GOALS};for(const [id,v] of Object.entries(g.goals)){if(!META[id])throw Error('Неизвестная цель');goals[id]=v===null?null:positive(v,'Цель');}return {from:g.from,goals};});}
 return out;
}
function parseBackup(text,workouts){
 let data;try{data=JSON.parse(text);}catch{throw Error('Не удалось прочитать JSON');}rejectKeys(data);
 if(data.app==='moy-put-workout'&&(data.version===undefined||data.version===1))return {workouts:validateWorkouts({sessions:data.sessions},workouts),life:null,format:'JSON v1'};
 if(data.app==='moy-put'&&data.version===2)return {workouts:validateWorkouts(data.workouts,workouts),life:validateLife(data.life),format:'JSON v2'};
 throw Error('Файл не является резервной копией «Моего пути»');
}
function mergeWorkouts(existing,incoming){
 const db=copy(existing),info={db,addedSessions:0,addedSets:0,conflicts:0};
 for(const [key,s] of Object.entries(incoming.sessions)){
 if(!db.sessions[key]){db.sessions[key]=copy(s);info.addedSessions++;info.addedSets+=Object.values(s.exercises).flat().filter(x=>x.done).length;continue;}
 const dst=db.sessions[key];dst.exercises??={};
 for(const f of ['bodyWeight','notes','rpe','completedAt','importedFrom'])if((dst[f]===undefined||dst[f]===null||dst[f]==='')&&s[f]!==undefined)dst[f]=copy(s[f]);
 for(const [eid,sets] of Object.entries(s.exercises)){dst.exercises[eid]??=[];sets.forEach((st,i)=>{const old=dst.exercises[eid][i];if(!old||(!old.done&&st.done)){while(dst.exercises[eid].length<=i)dst.exercises[eid].push({weight:'',count:'',done:false});dst.exercises[eid][i]=copy(st);if(st.done)info.addedSets++;}else if(old.done&&st.done&&(number(old.weight)!==number(st.weight)||number(old.count)!==number(st.count)))info.conflicts++;});}
 }return info;
}
function mergeLife(existing,incoming,useGoals=false){
 const out=copy(existing);if(!incoming)return out;
 for(const [date,day] of Object.entries(incoming.days)){out.days[date]??={};const ids=new Set(entriesForDay(out.days[date]).map(e=>e.id));for(const [meal,list] of Object.entries(day)){out.days[date][meal]??=[];for(const e of list)if(!ids.has(e.id)){out.days[date][meal].push(copy(e));ids.add(e.id);}}}
 for(const [date,w] of Object.entries(incoming.weights))if(out.weights[date]===undefined)out.weights[date]=w;
 for(const [id,food] of Object.entries(incoming.products))if(!out.products[id])out.products[id]=copy(food);
 if(useGoals){out.goals=copy(incoming.goals);out.goalHistory=copy(incoming.goalHistory||[]);out.goalNote=incoming.goalNote||'';}return out;
}
function persistImport(storage,workouts,life){
 const a=storage.getItem(WORKOUT_KEY),b=storage.getItem(LIFE_KEY);
 try{storage.setItem(WORKOUT_KEY,JSON.stringify(workouts));storage.setItem(LIFE_KEY,JSON.stringify(life));}
 catch(error){try{a===null?storage.removeItem(WORKOUT_KEY):storage.setItem(WORKOUT_KEY,a);b===null?storage.removeItem(LIFE_KEY):storage.setItem(LIFE_KEY,b);}catch{throw Error('Ошибка хранилища. Сохрани резервную копию перед перезагрузкой.');}throw error;}
}
function withChange(points){const valid=points.filter(p=>p.value!==null&&Number.isFinite(p.value));const first=valid[0],last=valid.at(-1);return {points,first:first?.value??null,last:last?.value??null,change:valid.length>1?last.value-first.value:null,percent:valid.length>1&&first.value>0?(last.value-first.value)/first.value*100:null};}
function workoutSeries(sessions,eid,start,end,load=true){
 dates(start,end);const points=Object.values(sessions).filter(s=>s.date>=start&&s.date<=end).sort((a,b)=>a.date.localeCompare(b.date)).flatMap(s=>{
 const sets=(s.exercises?.[eid]||[]).filter(v=>v.done&&number(v.count)>0&&number(load?v.weight:v.count)!==null&&number(load?v.weight:v.count)>=0);
 if(!sets.length)return [];const best=sets.reduce((a,b)=>number(load?b.weight:b.count)>number(load?a.weight:a.count)?b:a);
 return [{date:s.date,value:number(load?best.weight:best.count),count:number(best.count),sets:sets.length}];});return withChange(points);
}
function weightSeries(workouts,life,start,end){dates(start,end);const map={};for(const s of Object.values(workouts.sessions||{})){const n=number(s.bodyWeight);if(n>0&&dateValid(s.date))map[s.date]=n;}for(const [date,n] of Object.entries(life.weights||{}))if(number(n)>0)map[date]=number(n);return withChange(Object.keys(map).filter(d=>d>=start&&d<=end).sort().map(date=>({date,value:map[date]})));}
function goalsAt(life,date){const records=(life.goalHistory||[]).filter(g=>g.from<=date).sort((a,b)=>a.from.localeCompare(b.from));return records.at(-1)?.goals||life.goals||DEFAULT_GOALS;}
function dailySeries(life,nutrient,start,end){
 if(!META[nutrient])throw Error('Неизвестный показатель');const range=dates(start,end);let loggedDays=0,completeDays=0;
 const points=range.map(date=>{const es=entriesForDay(life.days[date]);if(es.length)loggedDays++;const total=totals(es)[nutrient];if(total.complete)completeDays++;return {date,...total,target:goalsAt(life,date)[nutrient]};});const known=points.filter(p=>p.value!==null),percentPoints=known.filter(p=>p.target>0);
 return {points,calendarDays:range.length,loggedDays,knownDays:known.length,completeDays,average:known.length?known.reduce((a,p)=>a+p.value,0)/known.length:null,percentDays:percentPoints.length,partialPercent:percentPoints.some(p=>!p.complete),averagePercent:percentPoints.length?percentPoints.reduce((a,p)=>a+p.value/p.target*100,0)/percentPoints.length:null};
}
return {WORKOUT_KEY,LIFE_KEY,MEALS,NUTRIENTS,META,DEFAULT_GOALS,number,positive,dateValid,dates,newLife,entriesForDay,totals,parseWorkoutCSV,parseBackup,validateWorkouts,validateLife,validateFood,mergeWorkouts,mergeLife,persistImport,workoutSeries,weightSeries,dailySeries,goalsAt,copy};
});

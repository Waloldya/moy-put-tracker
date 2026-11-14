'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=fs.existsSync(require('node:path').join(__dirname,'../tracker-core.js'))?require('../tracker-core.js'):{};
const workouts=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../data.js'),'utf8')+';workouts');
const header='Дата;День;Упражнение;Подход;Вес кг;Повторы/секунды/попытки;Единица;Вес тела кг;Сложность;Заметки';
const csv=header+'\r\n2026-11-02;ТЯНИ;Становая тяга сумо;1;80;8;раз;68,5;7;"Первая; строка\nи вторая ""строка"""\r\n2026-11-02;ТЯНИ;Становая тяга сумо;2;80;8;раз;68,5;7;"Первая; строка\nи вторая ""строка"""';
test('portion totals distinguish missing from real zero, retain precision and scale grams',()=>{
 const t=C.totals([{grams:150,nutrients:{kcal:100,protein:10,fat:0,fiber:4,vitaminC:20}},{grams:50,nutrients:{kcal:200,protein:5,fat:4}}]);
 assert.equal(t.kcal.value,250);assert.equal(t.protein.value,17.5);assert.equal(t.fat.value,2);
 assert.equal(t.fiber.value,6);assert.equal(t.fiber.known,1);assert.equal(t.fiber.complete,false);
 assert.equal(t.iodine.value,null);assert.equal(t.iodine.known,0);assert.equal(C.totals([]).kcal.value,null);
});
test('invalid portions cannot introduce NaN or negative consumption',()=>{
 for(const grams of [0,-1,Infinity,'abc'])assert.throws(()=>C.totals([{grams,nutrients:{kcal:100}}]));
});
test('legacy CSV preserves BOM, quoted semicolons, line breaks, decimal commas and original sets',()=>{
 const r=C.parseWorkoutCSV('\ufeff'+csv,workouts);assert.equal(r.rows,2);assert.equal(Object.keys(r.sessions).length,1);
 const s=r.sessions['pull__2026-11-02'];assert.equal(s.bodyWeight,'68.5');assert.equal(s.notes,'Первая; строка\nи вторая "строка"');
 assert.equal(s.exercises.sumo[0].weight,'80');assert.equal(s.exercises.sumo[1].count,'8');assert.equal(s.exercises.sumo[0].done,true);
 assert.equal(s.completedAt,null);assert.equal(s.importedFrom,'csv');
});
test('malformed CSV, unknown exercise, duplicate set and impossible dates fail before import',()=>{
 for(const bad of [csv.replace('2026-11-02','2026-02-30'),csv.replace('Становая тяга сумо','Unknown'),csv.replace(';80;8;',';-80;8;'),csv.replace(';2;80;',';1;80;'),csv+'\n"unclosed'])assert.throws(()=>C.parseWorkoutCSV(bad,workouts));
});
test('import merges missing sets without overwriting completed sets and is idempotent',()=>{
 const incoming=C.parseWorkoutCSV(csv,workouts).sessions;
 const old={sessions:{'pull__2026-11-02':{day:'pull',date:'2026-11-02',notes:'Existing',bodyWeight:'70',exercises:{sumo:[{weight:'85',count:'6',done:true} ]},completedAt:null}}};
 const r=C.mergeWorkouts(old,{sessions:incoming});
 assert.equal(r.db.sessions['pull__2026-11-02'].exercises.sumo[0].weight,'85');
 assert.equal(r.db.sessions['pull__2026-11-02'].exercises.sumo[1].weight,'80');
 assert.equal(r.db.sessions['pull__2026-11-02'].notes,'Existing');assert.equal(r.conflicts,1);
 const twice=C.mergeWorkouts(r.db,{sessions:incoming});assert.deepEqual(twice.db,r.db);assert.equal(twice.addedSets,0);
 assert.equal(old.sessions['pull__2026-11-02'].exercises.sumo.length,1);
});
test('JSON v1 valid schema is accepted; hostile keys and malformed records are rejected',()=>{
 const sessions=C.parseWorkoutCSV(csv,workouts).sessions;
 assert.equal(Object.keys(C.parseBackup(JSON.stringify({app:'moy-put-workout',version:1,sessions}),workouts).workouts.sessions).length,1);
 assert.throws(()=>C.parseBackup('{"app":"moy-put-workout","sessions":{"__proto__":{}}}',workouts));
 assert.throws(()=>C.parseBackup(JSON.stringify({app:'moy-put-workout',sessions:{x:{day:'pull',date:'2026-11-02',exercises:{sumo:[{weight:'bad',count:'8',done:true}]}}}}),workouts));
});
test('workout series filters dates and uses done sets; zero baseline never yields infinity',()=>{
 const sessions={a:{date:'2026-11-01',exercises:{sumo:[{weight:'80',count:'8',done:true},{weight:'100',count:'1',done:false}]}},b:{date:'2026-11-08',exercises:{sumo:[{weight:'90',count:'6',done:true}]}},c:{date:'2026-11-15',exercises:{sumo:[{weight:'95',count:'6',done:true}]}}};
 const r=C.workoutSeries(sessions,'sumo','2026-11-01','2026-11-08',true);assert.equal(r.points.length,2);assert.equal(r.change,10);assert.equal(r.percent,12.5);assert.equal(r.points[1].count,6);
 sessions.a.exercises.sumo[0].weight='0';assert.equal(C.workoutSeries(sessions,'sumo','2026-11-01','2026-11-08',true).percent,null);
});
test('daily averages ignore missing days and preserve missing nutrient information',()=>{
 const life={days:{'2026-11-01':{breakfast:[{grams:100,nutrients:{kcal:200,vitaminC:10}}]},'2026-11-03':{dinner:[{grams:100,nutrients:{kcal:400}}]}}};
 const r=C.dailySeries(life,'kcal','2026-11-01','2026-11-03');assert.equal(r.average,300);assert.equal(r.loggedDays,2);assert.equal(r.calendarDays,3);assert.equal(r.points[1].value,null);
 const micro=C.dailySeries(life,'vitaminC','2026-11-01','2026-11-03');assert.equal(micro.knownDays,1);assert.equal(micro.average,10);
});
test('body weight uses separate daily measurements over workout records without duplicating dates',()=>{
 const s={sessions:{a:{date:'2026-11-01',bodyWeight:'68.5'},b:{date:'2026-11-02',bodyWeight:'69'}}};
 const r=C.weightSeries(s,{weights:{'2026-11-01':69.2}},'2026-11-01','2026-11-02');assert.deepEqual(r.points.map(p=>p.value),[69.2,69]);
});
test('failed second-store write restores previous workout data',()=>{
 const values=new Map([[C.WORKOUT_KEY,'old'],[C.LIFE_KEY,'old-life']]);
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(k===C.LIFE_KEY&&v!=='old-life')throw Error('QuotaExceeded');values.set(k,v)},removeItem:k=>values.delete(k)};
 assert.throws(()=>C.persistImport(storage,{sessions:{}},C.newLife()));assert.equal(values.get(C.WORKOUT_KEY),'old');assert.equal(values.get(C.LIFE_KEY),'old-life');
});
test('new diaries have no personal goals; missing goals do not produce percentages',()=>{
 const life=C.newLife();assert.ok(Object.values(life.goals).every(v=>v===null));
 life.days['2026-11-01']={breakfast:[{id:'test',name:'Test',grams:100,nutrients:{kcal:200}}]};
 assert.equal(C.dailySeries(life,'kcal','2026-11-01','2026-11-01').averagePercent,null);
 assert.deepEqual(C.validateLife(life),life);
});
test('private goal import preserves optional notes and history; percent averages use only configured days',()=>{
 const incoming=C.newLife();incoming.goals.kcal=2100;incoming.goalNote='Check label units';
 const merged=C.mergeLife(C.newLife(),incoming,true);assert.equal(merged.goalNote,incoming.goalNote);
 merged.days['2026-11-01']={breakfast:[{id:'test',name:'Test',grams:100,nutrients:{kcal:210}}]};
 merged.days['2026-11-02']=merged.days['2026-11-01'];merged.goalHistory=[{from:'2026-11-01',goals:{...C.DEFAULT_GOALS}},{from:'2026-11-02',goals:merged.goals}];
 const result=C.dailySeries(merged,'kcal','2026-11-01','2026-11-02');assert.equal(result.averagePercent,10);assert.equal(result.percentDays,1);
 assert.equal(C.validateLife(merged).goalNote,incoming.goalNote);
});

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright'));
const csv='Дата;День;Упражнение;Подход;Вес кг;Повторы/секунды/попытки;Единица;Вес тела кг;Сложность;Заметки\r\n2026-11-02;ТЯНИ;Становая тяга сумо;1;80;8;раз;68.5;7;Test\r\n2026-11-09;ТЯНИ;Становая тяга сумо;1;90;6;раз;69;8;Test';
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=process.env.MOY_PUT_URL?null:http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});
 });
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.MOY_PUT_URL||'http://127.0.0.1:'+server.address().port;
 let browser;
 try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Питание',exact:true}).click({timeout:5000});
 await page.getByRole('heading',{name:'Питание',exact:true}).waitFor();
 for(const name of ['Завтрак','Обед','Перекус','Ужин'])assert.ok(await page.getByRole('heading',{name,exact:true}).isVisible());
 await page.locator('[data-life="add-food"][data-meal="breakfast"]').click();
 await page.getByLabel('Найти продукт').fill('гречка');await page.getByRole('button',{name:'Найти',exact:true}).click();
 await page.locator('[data-life="choose-food"][data-id="usda:170686"]').click();
 await page.getByLabel('Порция, г').fill('150');await page.getByRole('button',{name:'Добавить в приём пищи',exact:true}).click();
 assert.match(await page.locator('[data-meal-card="breakfast"]').innerText(),/150 г/);
 assert.equal(await page.locator('[data-total="kcal"]').getAttribute('data-value'),'138');
 await page.reload();await page.getByRole('button',{name:'Питание',exact:true}).click();assert.equal(await page.locator('[data-total="kcal"]').getAttribute('data-value'),'138');
 await page.locator('[data-life="edit-food"]').click();await page.getByLabel('Порция, г').fill('200');await page.getByRole('button',{name:'Сохранить порцию',exact:true}).click();assert.equal(await page.locator('[data-total="kcal"]').getAttribute('data-value'),'184');
 await page.getByRole('button',{name:'Цели',exact:true}).click();await page.getByLabel('Калории, ккал',{exact:true}).fill('2700');await page.getByRole('button',{name:'Сохранить цели',exact:true}).click();
 await page.getByLabel('Вес тела сегодня, кг').fill('69.3');await page.getByRole('button',{name:'Записать вес',exact:true}).click();
 await page.locator('#bottomnav').getByRole('button',{name:'Данные',exact:true}).click();
 await page.locator('#life-import').setInputFiles({name:'history.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await page.getByRole('heading',{name:'Импорт истории',exact:true}).waitFor();
 await page.getByRole('button',{name:'Объединить записи',exact:true}).click();
 let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_workouts_v1')));assert.equal(Object.values(stored.sessions).filter(s=>s.importedFrom==='csv').length,2);
 await page.locator('#life-import').setInputFiles({name:'history.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.getByRole('button',{name:'Объединить записи',exact:true}).click();
 stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_workouts_v1')));assert.equal(Object.values(stored.sessions).flatMap(s=>Object.values(s.exercises).flat()).filter(x=>x.done).length,2);
 await page.getByRole('button',{name:'Статистика',exact:true}).click();await page.getByLabel('Начало периода').fill('2026-11-01');await page.getByLabel('Конец периода').fill('2026-11-14');await page.getByRole('button',{name:'Применить период',exact:true}).click();
 await page.getByLabel('Упражнение').selectOption('sumo');assert.match(await page.locator('#workout-trend').innerText(),/12,5/);
 await page.locator('#bottomnav').getByRole('button',{name:'Данные',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать полную копию',exact:true}).click();const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(backup.version,2);assert.equal(backup.life.goals.kcal,2700);assert.equal(Object.values(backup.life.days).flatMap(d=>Object.values(d).flat()).length,1);
 // Importing an older copy into an existing diary preserves current goals by default.
 const older=structuredClone(backup);older.life.goals.kcal=2500;
 await page.locator('#life-import').setInputFiles({name:'older.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(older))});
 assert.equal(await page.locator('#import-goals').isChecked(),false);await page.getByRole('button',{name:'Объединить записи',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_life_v2')).goals.kcal),2700);
 await page.evaluate(()=>{localStorage.removeItem('moyput_life_v2');localStorage.removeItem('moyput_workouts_v1');});await page.reload();await page.locator('#bottomnav').getByRole('button',{name:'Данные',exact:true}).click();
 await page.locator('#life-import').setInputFiles({name:'full.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.getByRole('button',{name:'Объединить записи',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('moyput_life_v2')).goals.kcal),2700);
 await page.getByRole('button',{name:'Тренировки',exact:true}).click();await page.locator('[data-field="session-date"]').fill('2026-11-02');
 await page.locator('[data-action="worktab"][data-workout="pull"]').click();await page.locator('[data-field="session-date"]').fill('2026-11-02');await page.locator('[data-action="expand"][data-ex="sumo"]').click();assert.equal(await page.locator('[data-field="weight"][data-ex="sumo"]').first().inputValue(),'80');assert.equal(await page.locator('[data-field="weight"][data-ex="sumo"]').count(),3,'Imported sessions keep all planned set fields');
 // Wait for a complete cache install before testing offline navigation.
 await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Offline cache installation timed out')),30000))]);});await page.reload();await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Питание',exact:true}).click();
 assert.equal(await page.locator('[data-total="kcal"]').getAttribute('data-value'),'184');
 await page.locator('[data-life="add-food"][data-meal="lunch"]').click();await page.getByLabel('Найти продукт').fill('банан');await page.getByRole('button',{name:'Найти',exact:true}).click();await page.locator('[data-life="choose-food"][data-id="usda:173944"]').click();await page.getByLabel('Порция, г').fill('100');await page.getByRole('button',{name:'Добавить в приём пищи',exact:true}).click();
 assert.equal(await page.locator('[data-total="kcal"]').getAttribute('data-value'),'273');await context.setOffline(false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No mobile horizontal overflow');
 fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/nutrition-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Статистика',exact:true}).click();await page.screenshot({path:path.join(__dirname,'../test-results/statistics-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: mobile meals, grams, edit, goals, weight, CSV idempotence, workout trend, full backup roundtrip, old workout data, offline search and persistence.');
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

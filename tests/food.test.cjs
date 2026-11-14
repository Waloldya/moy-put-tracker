const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const P=fs.existsSync(path.join(__dirname,'../food-provider.js'))?require('../food-provider.js'):{};
test('Open Food Facts canonical grams convert to mg and mcg without using label display units twice',()=>{
 const f=P.fromOFF({code:'12345678',product_name:'Test',nutrition_data_per:'100g',product_quantity_unit:'g',nutriments:{'energy-kcal_100g':100,proteins_100g:8,fat_100g:0,carbohydrates_100g:15,'vitamin-c_100g':0.025,'vitamin-c_unit':'mg','vitamin-d_100g':0.000005,calcium_100g:0.12,sodium_100g:0.3}});
 assert.equal(f.nutrients.vitaminC,25);assert.equal(f.nutrients.vitaminD,5);assert.equal(f.nutrients.calcium,120);assert.equal(f.nutrients.sodium,300);assert.equal(f.nutrients.fat,0);assert.equal(f.nutrients.iodine,undefined);assert.equal(f.basis,'100g');
});
test('liquid per-100ml records require density before grams can be used',()=>{
 const f=P.fromOFF({code:'12345679',product_name:'Drink',product_quantity_unit:'ml',nutriments:{'energy-kcal_100g':40,proteins_100g:2}});assert.equal(f.basis,'100ml');
 assert.throws(()=>P.forGrams(f));assert.equal(P.forGrams(f,1.04).nutrients.kcal,40/1.04);
 const imported={basis:'100ml',nutrients:{kcal:40,vitaminC:null}};
 assert.equal(P.forGrams(imported,1.04).nutrients.vitaminC,null);
});
test('OFF derives kcal from kJ when absent, rejects missing name/nutrition and never invents folate DFE',()=>{
 const f=P.fromOFF({code:'12345670',product_name:'Test',nutriments:{energy_100g:418.4,folates_100g:0.0001}});assert.ok(Math.abs(f.nutrients.kcal-100)<1e-9);assert.equal(f.nutrients.folate,undefined);
 assert.equal(P.fromOFF({code:'123',product_name:'Empty',nutriments:{}}),null);
});
test('Russian search finds exact staple and keeps cooked and raw entries distinct',async()=>{
 await P.ensureCatalog();const results=P.searchLocal('гречка');assert.ok(results.some(f=>f.id==='usda:170685'));assert.ok(results.some(f=>f.id==='usda:170686'));
 const cooked=await P.getFood('usda:170686');assert.equal(cooked.nutrients.kcal,92);assert.equal(cooked.nutrients.protein,3.38);assert.equal(cooked.nutrients.iodine,undefined);
 assert.equal(P.searchLocal('куриная грудка')[0].id,'usda:171077');
});
test('Russian preparation words and butter phrases do not match cheese or unrelated oils',async()=>{
 await P.ensureCatalog();
 const raw=P.searchLocal('говядина сырая');assert.ok(raw.length);assert.ok(raw.slice(0,5).every(f=>/raw/i.test(f.original||f.name)));
 const butter=P.searchLocal('сливочное масло');assert.ok(butter.length);assert.match(butter[0].original||butter[0].name,/butter/i);
});

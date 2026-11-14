"""Build reproducible per-100g catalog from the official USDA SR Legacy CSV zip.
Usage: python scripts/build-food-catalog.py /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip
No personal user data is used by this script. Source and nutrient decisions: SOURCES.md.
"""
import csv, io, json, pathlib, sys, zipfile, hashlib
root=pathlib.Path(__file__).resolve().parents[1]
archive=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(archive)
prefix=next(n[:-len('food.csv')] for n in z.namelist() if n.endswith('/food.csv'))
def read(name):return csv.DictReader(io.TextIOWrapper(z.open(prefix+name),encoding='utf-8-sig'))
# Canonical units: kcal, grams for macros/fiber, mg or micrograms as documented.
mapping={1008:('kcal',1),1003:('protein',1),1004:('fat',1),1005:('carbs',1),1079:('fiber',1),1106:('vitaminA',1),1162:('vitaminC',1),1114:('vitaminD',1),1109:('vitaminE',1),1185:('vitaminK',1),1165:('thiamin',1),1166:('riboflavin',1),1167:('niacin',1),1180:('choline',1),1170:('pantothenic',1),1175:('vitaminB6',1),1176:('biotin',1),1190:('folate',1),1178:('vitaminB12',1),1087:('calcium',1),1089:('iron',1),1090:('magnesium',1),1091:('phosphorus',1),1095:('zinc',1),1100:('iodine',1),1103:('selenium',1),1098:('copper',1),1093:('sodium',1),1101:('manganese',1),1096:('chromium',1),1102:('molybdenum',1),1099:('fluoride',0.001),1092:('potassium',1),1088:('chloride',1)}
omega={1404,1272,1278,1280} # ALA + DHA + EPA + DPA; unspecified 18:3 is NOT assumed to be n-3.
foods={r['fdc_id']:{'id':'usda:'+r['fdc_id'],'name':r['description'],'nutrients':{}} for r in read('food.csv')}
components={}
for r in read('food_nutrient.csv'):
 f=foods.get(r['fdc_id']);nid=int(r['nutrient_id'])
 if f is None or not r['amount']:continue
 amount=float(r['amount'])
 if amount<0:continue
 if nid in mapping:
  key,factor=mapping[nid];f['nutrients'][key]=round(amount*factor,9)
 if nid in omega:components.setdefault(r['fdc_id'],{})[nid]=amount
names={
 '170685':'Гречка, крупа обжаренная, сухая','170686':'Гречка, варёная','170286':'Гречиха, зерно сухое','170687':'Гречневая мука',
 '171077':'Куриная грудка без кожи, сырая','171477':'Куриная грудка без кожи, запечённая','171478':'Куриная грудка без кожи, тушёная',
 '171287':'Яйцо куриное целое, сырое','173424':'Яйцо куриное, варёное вкрутую','172185':'Омлет','173423':'Яйцо жареное',
 '173944':'Банан, сырой','171688':'Яблоко с кожурой, сырое','171689':'Яблоко без кожуры, сырое',
 '169756':'Рис белый длиннозёрный, сухой, необогащённый','169757':'Рис белый длиннозёрный, варёный, без соли','169758':'Рис пропаренный, сухой','169759':'Рис пропаренный, варёный',
 '172684':'Хлеб ржаной','172685':'Хлеб ржаной, тост','172739':'Хлебцы ржаные',
 '171413':'Масло оливковое','169414':'Семена льна','170187':'Грецкий орех','172430':'Арахис сырой','173806':'Арахис, сухая обжарка, без соли','170158':'Миндаль, сухая обжарка, без соли',
 '170379':'Брокколи, сырая','170393':'Морковь, сырая','170457':'Помидор, сырой','168409':'Огурец с кожурой, сырой','168462':'Шпинат, сырой','170108':'Перец сладкий красный, сырой','169383':'Перец сладкий жёлтый, сырой',
 '170438':'Картофель, отваренный в кожуре, мякоть без соли','170440':'Картофель, варёный без кожуры и соли','170520':'Картофель, варёный без кожуры, с солью','168482':'Батат, сырой','168483':'Батат, запечённый без соли','168484':'Батат, варёный без кожуры',
 '172420':'Чечевица, сухая','172421':'Чечевица, варёная без соли','175254':'Чечевица, варёная с солью',
 '175167':'Лосось атлантический, выращенный, сырой','175138':'Горбуша, сырая','173689':'Кета, сырая',
 '174030':'Фарш говяжий, 10% жира, сырой','171794':'Фарш говяжий, 10% жира, жареный',
 '171284':'Йогурт натуральный из цельного молока','170886':'Йогурт натуральный, низкой жирности','170887':'Йогурт натуральный, обезжиренный',
 '172217':'Молоко цельное 3,25%, без обогащения','171265':'Молоко цельное 3,25%, с витамином D',
 '172182':'Зернёный творог (cottage cheese), 2% жира','172181':'Зернёный творог (cottage cheese), обезжиренный',
}
for fid,f in foods.items():
 if fid in names:f['original']=f['name'];f['name']=names[fid]
 if fid in components:
  f['nutrients']['omega3']=round(sum(components[fid].values())*1000,9)
  if len(components[fid])<4:f['partial']=['omega3']
out=root/'foods';out.mkdir(exist_ok=True)
ordered=sorted(foods.values(),key=lambda f:f['id']);index=[];chunks=[]
for i in range(0,len(ordered),400):
 name=f'catalog-{i//400:02d}.json';chunk=ordered[i:i+400];chunks.append(name)
 (out/name).write_text(json.dumps(chunk,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 for f in chunk:index.append({k:v for k,v in {**{k:f[k] for k in ('id','name','original') if k in f},'file':name}.items()})
(out/'index.json').write_text(json.dumps({'version':1,'count':len(ordered),'source':'USDA SR Legacy 2018','chunks':chunks,'foods':index},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({'foods':len(ordered),'chunks':len(chunks),'translated_names':len(names),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'bytes':sum(p.stat().st_size for p in out.glob('*.json'))},indent=2))

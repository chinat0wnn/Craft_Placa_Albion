import json

gamedata_path = 'site/gamedata.json'
with open(gamedata_path, 'r', encoding='utf-8') as f:
    gd = json.load(f)

meta_data = json.load(open('scratch/meta_foods.json', encoding='utf-8'))
meta_foods = meta_data['metaFoods']

food_families = [
    {'id': 'pie', 'name': '🥧 Tortas'},
    {'id': 'omelette', 'name': '🍳 Omeletes'},
    {'id': 'stew', 'name': '🍲 Guisados'},
    {'id': 'sandwich', 'name': '🥪 Sanduíches'},
    {'id': 'roast', 'name': '🍗 Assados'},
    {'id': 'salad', 'name': '🥗 Saladas'},
    {'id': 'soup', 'name': '🥣 Sopas'}
]

butchering = [
    {'animalId': 'T3_FARM_CHICKEN_GROWN', 'meatId': 'T3_MEAT', 'animalName': 'Galinha', 'meatName': 'Galinha Crua', 'yield': 18, 'tier': 3},
    {'animalId': 'T4_FARM_GOAT_GROWN', 'meatId': 'T4_MEAT', 'animalName': 'Cabra', 'meatName': 'Cabra Crua', 'yield': 18, 'tier': 4},
    {'animalId': 'T5_FARM_GOOSE_GROWN', 'meatId': 'T5_MEAT', 'animalName': 'Ganso', 'meatName': 'Ganso Cru', 'yield': 18, 'tier': 5},
    {'animalId': 'T6_FARM_SHEEP_GROWN', 'meatId': 'T6_MEAT', 'animalName': 'Ovelha', 'meatName': 'Carneiro Cru', 'yield': 18, 'tier': 6},
    {'animalId': 'T7_FARM_PIG_GROWN', 'meatId': 'T7_MEAT', 'animalName': 'Porco', 'meatName': 'Porco Cru', 'yield': 18, 'tier': 7},
    {'animalId': 'T8_FARM_COW_GROWN', 'meatId': 'T8_MEAT', 'animalName': 'Vaca', 'meatName': 'Carne Crua', 'yield': 18, 'tier': 8}
]

processing = [
    {'id': 'T3_FLOUR', 'fromId': 'T3_WHEAT', 'count': 1, 'name': 'Farinha', 'fromName': 'Feixe de Trigo', 'building': 'Moinho'},
    {'id': 'T4_BREAD', 'fromId': 'T3_FLOUR', 'count': 1, 'name': 'Pão', 'fromName': 'Farinha', 'building': 'Cozinha'},
    {'id': 'T4_BUTTER', 'fromId': 'T4_MILK', 'count': 1, 'name': 'Manteiga de Cabra', 'fromName': 'Leite de Cabra', 'building': 'Cozinha'},
    {'id': 'T6_BUTTER', 'fromId': 'T6_MILK', 'count': 1, 'name': 'Manteiga de Ovelha', 'fromName': 'Leite de Ovelha', 'building': 'Cozinha'},
    {'id': 'T8_BUTTER', 'fromId': 'T8_MILK', 'count': 1, 'name': 'Manteiga de Vaca', 'fromName': 'Leite de Vaca', 'building': 'Cozinha'}
]

extra_names = {
    'T1_CARROT': 'Cenoura',
    'T2_BEAN': 'Feijão',
    'T3_WHEAT': 'Feixe de Trigo',
    'T4_TURNIP': 'Nabo',
    'T5_CABBAGE': 'Repolho',
    'T6_POTATO': 'Batata',
    'T7_CORN': 'Fardo de Milho',
    'T8_PUMPKIN': 'Abóbora',
    'T3_EGG': 'Ovo de Galinha',
    'T5_EGG': 'Ovo de Ganso',
    'T4_MILK': 'Leite de Cabra',
    'T6_MILK': 'Leite de Ovelha',
    'T8_MILK': 'Leite de Vaca',
    'T3_MEAT': 'Galinha Crua',
    'T4_MEAT': 'Cabra Crua',
    'T5_MEAT': 'Ganso Cru',
    'T6_MEAT': 'Carneiro Cru',
    'T7_MEAT': 'Porco Cru',
    'T8_MEAT': 'Carne Crua',
    'T3_FARM_CHICKEN_GROWN': 'Galinha',
    'T4_FARM_GOAT_GROWN': 'Cabra',
    'T5_FARM_GOOSE_GROWN': 'Ganso',
    'T6_FARM_SHEEP_GROWN': 'Ovelha',
    'T7_FARM_PIG_GROWN': 'Porco',
    'T8_FARM_COW_GROWN': 'Vaca',
    'T3_FLOUR': 'Farinha',
    'T4_BREAD': 'Pão',
    'T4_BUTTER': 'Manteiga de Cabra',
    'T6_BUTTER': 'Manteiga de Ovelha',
    'T8_BUTTER': 'Manteiga de Vaca',
    'T1_FISHSAUCE_LEVEL1': 'Molho de Peixe Básico',
    'T1_FISHSAUCE_LEVEL2': 'Molho de Peixe Extravagante',
    'T1_FISHSAUCE_LEVEL3': 'Molho de Peixe Especial'
}

for f in meta_foods:
    extra_names[f['id']] = f['name']
    for e in f['enchantments']:
        extra_names[e['id']] = f"{f['name']} .{e['level']}"

gd['foods'] = meta_foods
gd['foodFamilies'] = food_families
gd['butchering'] = butchering
gd['foodProcessing'] = processing
if 'itemNames' not in gd:
    gd['itemNames'] = {}
for k, v in extra_names.items():
    gd['itemNames'][k] = v

with open(gamedata_path, 'w', encoding='utf-8') as f:
    json.dump(gd, f, indent=1, ensure_ascii=False)

print('Updated gamedata.json successfully! Total items in itemNames:', len(gd['itemNames']))

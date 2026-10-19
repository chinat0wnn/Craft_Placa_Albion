import urllib.request
import json

print("Fetching items.json...")
url = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.loads(r.read().decode('utf-8'))

print("Fetching formatted/items.json for localized names...")
url_names = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json'
req_names = urllib.request.Request(url_names, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req_names, timeout=60) as r:
    formatted = json.loads(r.read().decode('utf-8'))

names_map = {}
for it in formatted:
    un = it.get('UniqueName')
    loc = it.get('LocalizedNames') or {}
    pt = loc.get('PT-BR')
    en = loc.get('EN-US')
    names_map[un] = {'pt': pt or en or un, 'en': en or un}

items_root = data.get("items", {})

# Map item values for simple items and consumables
iv_map = {}
for cat, items in items_root.items():
    if not isinstance(items, list): items = [items]
    for it in items:
        if not isinstance(it, dict): continue
        un = it.get("@uniquename", "")
        iv = it.get("@itemvalue")
        if iv:
            try:
                iv_map[un] = round(float(iv))
            except Exception:
                pass

META_FOOD_IDS = [
    # Tortas (Pies)
    ("T3_MEAL_PIE", "pie", "Torta"),
    ("T5_MEAL_PIE", "pie", "Torta"),
    ("T7_MEAL_PIE", "pie", "Torta"),
    # Omeletes (Omelettes)
    ("T3_MEAL_OMELETTE", "omelette", "Omelete"),
    ("T5_MEAL_OMELETTE", "omelette", "Omelete"),
    ("T7_MEAL_OMELETTE", "omelette", "Omelete"),
    # Ensopados / Guisados (Stews)
    ("T4_MEAL_STEW", "stew", "Ensopado"),
    ("T6_MEAL_STEW", "stew", "Ensopado"),
    ("T8_MEAL_STEW", "stew", "Ensopado"),
    # Sanduíches (Sandwiches)
    ("T4_MEAL_SANDWICH", "sandwich", "Sanduíche"),
    ("T6_MEAL_SANDWICH", "sandwich", "Sanduíche"),
    ("T8_MEAL_SANDWICH", "sandwich", "Sanduíche"),
    # Assados (Roasts)
    ("T3_MEAL_ROAST", "roast", "Assado"),
    ("T5_MEAL_ROAST", "roast", "Assado"),
    ("T7_MEAL_ROAST", "roast", "Assado"),
    # Saladas (Salads)
    ("T2_MEAL_SALAD", "salad", "Salada"),
    ("T4_MEAL_SALAD", "salad", "Salada"),
    ("T6_MEAL_SALAD", "salad", "Salada"),
    # Sopas (Soups)
    ("T1_MEAL_SOUP", "soup", "Sopa"),
    ("T3_MEAL_SOUP", "soup", "Sopa"),
    ("T5_MEAL_SOUP", "soup", "Sopa"),
]

consumables = items_root.get("consumableitem", [])
if isinstance(consumables, dict): consumables = [consumables]
c_dict = {c.get("@uniquename"): c for c in consumables if isinstance(c, dict)}

meta_foods = []
all_needed_items = set()

for un, family, fam_label in META_FOOD_IDS:
    c = c_dict.get(un)
    if not c:
        print("Missing consumable item:", un)
        continue
    
    tier = int(c.get("@tier", 0) or un[1]) if un.startswith("T") else 1
    cr = c.get("craftingrequirements", {})
    amount_crafted = int(cr.get("@amountcrafted", 10))
    craft_focus = int(cr.get("@craftingfocus", 0))
    nutrition = int(c.get("@nutrition", 0))
    try:
        iv = round(float(c.get("@itemvalue", 0) or iv_map.get(un, 0) or 0))
    except Exception:
        iv = iv_map.get(un, 0)
    
    res = cr.get("craftresource", [])
    if isinstance(res, dict): res = [res]
    
    ingredients = []
    total_batch_iv = 0
    for r in res:
        r_id = r.get("@uniquename")
        r_count = int(r.get("@count", 0))
        r_name = names_map.get(r_id, {}).get('pt', r_id)
        r_iv = iv_map.get(r_id, 0)
        total_batch_iv += r_count * r_iv
        all_needed_items.add(r_id)
        ingredients.append({
            "id": r_id,
            "count": r_count,
            "name": r_name,
            "iv": r_iv
        })
    
    # If the food item itself has 0 iv in XML, station fee is based on ingredients sum / amount_crafted
    unit_iv = iv if iv > 0 else round(total_batch_iv / amount_crafted)
    
    enchantments = []
    # Check enchantments 1, 2, 3
    ench_list = c.get("enchantments", {}).get("enchantment", [])
    if isinstance(ench_list, dict): ench_list = [ench_list]
    for e in ench_list:
        lvl = int(e.get("@enchantmentlevel", 1))
        e_cr = e.get("craftingrequirements", {})
        e_res = e_cr.get("craftresource", [])
        if isinstance(e_res, dict): e_res = [e_res]
        sauce_res = [r for r in e_res if "FISHSAUCE" in r.get("@uniquename", "")]
        sauce_id = sauce_res[0].get("@uniquename") if sauce_res else f"T1_FISHSAUCE_LEVEL{lvl}"
        sauce_count = int(sauce_res[0].get("@count", 90)) if sauce_res else 90
        sauce_name = names_map.get(sauce_id, {}).get('pt', sauce_id)
        all_needed_items.add(sauce_id)
        all_needed_items.add(f"{un}@{lvl}")
        enchantments.append({
            "level": lvl,
            "id": f"{un}@{lvl}",
            "sauceId": sauce_id,
            "sauceCount": sauce_count,
            "saucePerItem": sauce_count / amount_crafted,
            "sauceName": sauce_name
        })
    
    all_needed_items.add(un)
    pt_name = names_map.get(un, {}).get('pt', un)
    en_name = names_map.get(un, {}).get('en', un)
    
    meta_foods.append({
        "id": un,
        "family": family,
        "familyLabel": fam_label,
        "tier": tier,
        "name": pt_name,
        "nameEn": en_name,
        "amountCrafted": amount_crafted,
        "craftFocus": craft_focus,
        "nutrition": nutrition,
        "iv": unit_iv,
        "batchIv": total_batch_iv,
        "ingredients": ingredients,
        "enchantments": enchantments
    })

print(f"Successfully processed {len(meta_foods)} meta foods!")
print(f"Total unique item IDs involved (foods, enchantments, ingredients): {len(all_needed_items)}")

# Let's save a clean json for inspection
with open('scratch/meta_foods.json', 'w', encoding='utf-8') as f:
    json.dump({
        "metaFoods": meta_foods,
        "allItems": sorted(list(all_needed_items))
    }, f, indent=2, ensure_ascii=False)
print("Saved to scratch/meta_foods.json")

import urllib.request
import json

url = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json'
print("Loading items.json...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.loads(r.read().decode('utf-8'))

# Load localized names
url_names = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json'
print("Loading formatted/items.json for names...")
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
consumables = items_root.get("consumableitem", [])
if isinstance(consumables, dict):
    consumables = [consumables]

meals = []
for c in consumables:
    un = c.get("@uniquename", "")
    if "MEAL" in un:
        tier = int(c.get("@tier", 0) or un[1]) if un.startswith("T") else 1
        cr = c.get("craftingrequirements")
        ench = c.get("enchantments", {}).get("enchantment", [])
        if isinstance(ench, dict):
            ench = [ench]
        
        # parse craft resources
        resources = []
        amount_crafted = 10
        craft_focus = 0
        if cr:
            amount_crafted = int(cr.get("@amountcrafted", 10))
            craft_focus = int(cr.get("@craftingfocus", 0))
            res = cr.get("craftresource", [])
            if isinstance(res, dict):
                res = [res]
            for r in res:
                r_id = r.get("@uniquename")
                r_count = int(r.get("@count", 0))
                r_name = names_map.get(r_id, {}).get('pt', r_id)
                resources.append({"id": r_id, "count": r_count, "name": r_name})
        
        # enchantments
        enchant_info = []
        for e in ench:
            lvl = int(e.get("@enchantmentlevel", 1))
            e_cr = e.get("craftingrequirements", {})
            e_res = e_cr.get("craftresource", [])
            if isinstance(e_res, dict):
                e_res = [e_res]
            # find sauce resource
            sauce_res = [r for r in e_res if "FISHSAUCE" in r.get("@uniquename", "")]
            sauce_id = sauce_res[0].get("@uniquename") if sauce_res else f"T1_FISHSAUCE_LEVEL{lvl}"
            sauce_count = int(sauce_res[0].get("@count", 90)) if sauce_res else 90
            sauce_name = names_map.get(sauce_id, {}).get('pt', sauce_id)
            enchant_info.append({
                "level": lvl,
                "sauce_id": sauce_id,
                "sauce_count": sauce_count,
                "sauce_per_item": sauce_count / amount_crafted,
                "sauce_name": sauce_name
            })
            
        pt_name = names_map.get(un, {}).get('pt', un)
        en_name = names_map.get(un, {}).get('en', un)
        
        meals.append({
            "id": un,
            "tier": tier,
            "name": pt_name,
            "name_en": en_name,
            "category": c.get("@craftingcategory", "cooked"),
            "subcategory": c.get("@shopsubcategory1", ""),
            "nutrition": int(c.get("@nutrition", 0)),
            "amount_crafted": amount_crafted,
            "craft_focus": craft_focus,
            "resources": resources,
            "enchantments": enchant_info
        })

print(f"Total parsed meals: {len(meals)}")
# Group by family (Soup, Salad, Pie, Sandwich, Stew, Omelette, Roast, Fish, Avalon)
families = {}
for m in meals:
    un = m['id']
    fam = 'other'
    if 'SOUP' in un: fam = 'soup'
    elif 'SALAD' in un: fam = 'salad'
    elif 'PIE' in un: fam = 'pie'
    elif 'SANDWICH' in un: fam = 'sandwich'
    elif 'STEW' in un: fam = 'stew'
    elif 'OMELETTE' in un: fam = 'omelette'
    elif 'ROAST' in un: fam = 'roast'
    elif 'FISH' in un: fam = 'fish'
    families.setdefault(fam, []).append(m)

for fam, list_m in families.items():
    print(f"\n--- FAMILY: {fam.upper()} ({len(list_m)} items) ---")
    for m in sorted(list_m, key=lambda x: (x['tier'], x['id'])):
        res_str = ", ".join([f"{r['count']}x {r['name']}" for r in m['resources']])
        print(f"T{m['tier']} {m['name']} ({m['id']}) [rende {m['amount_crafted']} un]: {res_str}")

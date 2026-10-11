"""Gera gamedata.json (receitas/artefatos oficiais) e um data.json inicial com precos da planilha antiga."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

VARIANTS = [
    ("SET1", "Soldado (Soldier)", False),
    ("SET2", "Cavaleiro (Knight)", False),
    ("SET3", "Guardião (Guardian)", False),
    ("UNDEAD", "Graveguard", True),
    ("HELL", "Demônio (Demon)", True),
    ("KEEPER", "Juiz (Judicator)", True),
    ("FEY", "Duskweaver", True),
    ("AVALON", "Valor", True),
]
PIECES = [("ARMOR", "Armadura", 16), ("HEAD", "Elmo", 8), ("SHOES", "Botas", 8)]
CITIES = ["Thetford", "Martlock", "Bridgewatch", "Lymhurst", "Fort Sterling"]

game = json.load(open(os.path.join(ROOT, "items.json"), encoding="utf-8"))["items"]
index = {}
def walk(o):
    if isinstance(o, dict):
        un = o.get("@uniquename")
        if un and ("craftingrequirements" in o or "@itemvalue" in o):
            index.setdefault(un, o)
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)
walk(game)

names = {}
for line in open(os.path.join(ROOT, "items.txt"), encoding="utf-8"):
    m = re.match(r"\s*\d+:\s+(\S+)\s+:\s+(.*)$", line.rstrip())
    if m:
        names[m.group(1)] = m.group(2).strip()

def first_recipe(un):
    cr = index[un]["craftingrequirements"]
    cr = cr[0] if isinstance(cr, list) else cr
    res = cr["craftresource"]
    res = res if isinstance(res, list) else [res]
    return [(r["@uniquename"], int(r["@count"])) for r in res]

artifacts, item_names = {}, {}
for code, disp, uses in VARIANTS:
    for slot, pname, nbars in PIECES:
        for t in range(4, 9):
            un = f"T{t}_{slot}_PLATE_{code}"
            rec = first_recipe(un)
            assert rec[0] == (f"T{t}_METALBAR", nbars), (un, rec)
            item_names[un] = names.get(un, un)
            if uses:
                art_id, cnt = rec[1]
                assert cnt == 1 and "ARTEFACT" in art_id
                artifacts[f"{code}_{slot}_{t}"] = {
                    "id": art_id,
                    "name": re.sub(r"^\w+'s ", "", names.get(art_id, art_id)),
                    "iv": int(index[art_id]["@itemvalue"]),
                }
            else:
                assert len(rec) == 1

gd = {
    "cities": CITIES,
    "saleLocs": CITIES + ["Caerleon", "Black Market"],
    "variants": [{"code": c, "name": n, "artifact": a} for c, n, a in VARIANTS],
    "pieces": [{"slot": s, "name": n, "bars": b} for s, n, b in PIECES],
    "artifacts": artifacts,
    "itemNames": item_names,
}
json.dump(gd, open(os.path.join(HERE, "gamedata.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("gamedata.json gerado:", len(artifacts), "artefatos")

# ---- data.json inicial (nao sobrescreve se ja existir) ----
data_path = os.path.join(HERE, "data.json")
if not os.path.exists(data_path):
    prices = {}
    def bar_id(t, e): return f"T{t}_METALBAR" + (f"_LEVEL{e}@{e}" if e else "")
    def ore_id(t, e): return f"T{t}_ORE" + (f"_LEVEL{e}@{e}" if e else "")
    try:
        import openpyxl
        ws = openpyxl.load_workbook(os.path.join(ROOT, "planilha de refino de material.xlsx"), data_only=True)["PesquisaRefino"]
        for r in range(3, 69):
            a = ws.cell(r, 1).value
            try:
                t, e = (int(x) for x in f"{float(a):.1f}".split("."))
            except (TypeError, ValueError):
                continue
            vals = {CITIES[j]: ws.cell(r, 2 + j).value for j in range(5)}
            vals = {k: v for k, v in vals.items() if isinstance(v, (int, float)) and v > 0}
            if vals:
                prices[(ore_id if r <= 34 else bar_id)(t, e)] = vals
        print("Precos importados da planilha original:", list(prices))
    except Exception as ex:
        print("Sem precos iniciais:", ex)
    state = {
        "config": {"taxBuy": 0.0, "taxSell": 0.065, "retRefine": 0.367, "retCraft": 0.248,
                   "feeRefine": 465, "feeCraft": 465, "server": "west"},
        "prices": prices, "dates": {}, "origins": {}, "plan": [],
    }
    json.dump(state, open(data_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("data.json inicial criado")

"""Servidor local do Albion Craft (somente biblioteca padrao do Python).

Uso:  python server.py   ->  http://127.0.0.1:8765
"""
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import gzip, json, os, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")
DATA = os.path.join(HERE, "data.json")
GAMEDATA = os.path.join(HERE, "gamedata.json")
PORT = 8765
API_HOSTS = {"west": "west", "east": "east", "europe": "europe"}
lock = threading.Lock()
api_cache = {}
API_CACHE_TTL = 300  # 5 minutos de cache em memoria para evitar requisicoes repetidas

def fetch_aodp_json(api_url, timeout=35):
    now = time.time()
    with lock:
        cached = api_cache.get(api_url)
        if cached and (now - cached[0]) < API_CACHE_TTL:
            return cached[1]
    req = urllib.request.Request(
        api_url,
        headers={
            "User-Agent": "AlbionCraftLocal/2.0",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or (raw[:2] == b"\x1f\x8b"):
            raw = gzip.decompress(raw)
        data = json.loads(raw.decode("utf-8"))
    with lock:
        if len(api_cache) > 500:
            api_cache.clear()
        api_cache[api_url] = (now, data)
    return data

LOCATIONS = {
    4: "Swamp Cross",
    7: "Thetford",
    301: "Thetford",
    1002: "Lymhurst",
    1301: "Lymhurst",
    2004: "Bridgewatch",
    2301: "Bridgewatch",
    3008: "Martlock",
    3301: "Martlock",
    4002: "Fort Sterling",
    4301: "Fort Sterling",
    3005: "Caerleon",
    3013: "Caerleon",
    3003: "Black Market",
    5003: "Brecilien"
}

def resolve_location(loc_raw):
    if not loc_raw:
        return None
    s = str(loc_raw).strip()
    if "Auction2" in s or "BlackMarket" in s or s == "3003":
        return "Black Market"
    digits = "".join(filter(str.isdigit, s))
    if digits:
        return LOCATIONS.get(int(digits))
    return None

live_status = {
    "connected": False,
    "last_heartbeat": None,
    "last_update": None,
    "last_city": None,
    "items_updated": 0,
    "total_received": 0
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=STATIC, **kw)

    def log_message(self, fmt, *args):  # silencioso, exceto erros
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/api/gamedata":
            with open(GAMEDATA, encoding="utf-8") as f:
                return self._json(json.load(f))
        if url.path == "/api/state":
            with lock, open(DATA, encoding="utf-8") as f:
                return self._json(json.load(f))
        if url.path == "/api/live_status":
            with lock:
                now = datetime.now()
                is_conn = False
                if live_status["last_heartbeat"]:
                    diff = (now - live_status["last_heartbeat"]).total_seconds()
                    is_conn = diff < 60
                res = dict(live_status)
                res["connected"] = is_conn
                res["last_heartbeat"] = live_status["last_heartbeat"].isoformat() if live_status["last_heartbeat"] else None
                res["last_update"] = live_status["last_update"].isoformat() if live_status["last_update"] else None
                return self._json(res)
        if url.path == "/api/prices":
            q = urllib.parse.parse_qs(url.query)
            host = API_HOSTS.get(q.get("server", ["west"])[0], "west")
            items = q.get("items", [""])[0]
            locs = q.get("locations", [""])[0]
            qualities = q.get("qualities", ["1,2,3,4,5"])[0]
            api = (f"https://{host}.albion-online-data.com/api/v2/stats/prices/"
                   f"{urllib.parse.quote(items, safe=',@_')}.json?locations={urllib.parse.quote(locs, safe=',')}&qualities={urllib.parse.quote(qualities, safe=',')}")
            try:
                return self._json(fetch_aodp_json(api, timeout=35))
            except urllib.error.HTTPError as e:
                retry = e.headers.get("Retry-After") if e.headers else None
                code = e.code if e.code in (414, 429, 502, 503, 504) else 502
                return self._json({"error": f"HTTP {e.code}: {e.reason}", "status": e.code,
                                   "retryAfter": retry, "retryable": True}, code)
            except Exception as e:
                return self._json({"error": str(e), "status": 503, "retryable": True}, 503)
        if url.path == "/api/history":
            q = urllib.parse.parse_qs(url.query)
            host = API_HOSTS.get(q.get("server", ["west"])[0], "west")
            items = q.get("items", [""])[0]
            locs = q.get("locations", [""])[0]
            qualities = q.get("qualities", ["1"])[0]
            api = (f"https://{host}.albion-online-data.com/api/v2/stats/history/"
                   f"{urllib.parse.quote(items, safe=',@_')}.json?locations={urllib.parse.quote(locs, safe=',')}&qualities={urllib.parse.quote(qualities, safe=',')}&time-scale=24")
            try:
                return self._json(fetch_aodp_json(api, timeout=40))
            except urllib.error.HTTPError as e:
                retry = e.headers.get("Retry-After") if e.headers else None
                code = e.code if e.code in (414, 429, 502, 503, 504) else 502
                return self._json({"error": f"HTTP {e.code}: {e.reason}", "status": e.code,
                                   "retryAfter": retry, "retryable": True}, code)
            except Exception as e:
                return self._json({"error": str(e), "status": 503, "retryable": True}, 503)
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/api/state":
            n = int(self.headers.get("Content-Length", 0))
            try:
                state = json.loads(self.rfile.read(n).decode("utf-8"))
            except ValueError:
                return self._json({"error": "JSON invalido"}, 400)
            with lock:
                tmp = DATA + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(state, f, ensure_ascii=False)
                os.replace(tmp, DATA)
            return self._json({"ok": True})

        if url.path.startswith("/api/ingest") or "/marketorders" in url.path:
            n = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(n).decode("utf-8"))
            except Exception as e:
                return self._json({"error": f"JSON invalido: {e}"}, 400)

            orders = payload.get("Orders", [])
            now_dt = datetime.now()
            now_iso = now_dt.isoformat()

            batch_offers = {}
            batch_requests = {}
            last_city = None

            for order in orders:
                city = resolve_location(order.get("LocationId"))
                if not city:
                    continue
                item_id = order.get("ItemTypeId")
                if not item_id:
                    continue
                price = (order.get("UnitPriceSilver") or 0) / 10000.0
                if price <= 0:
                    continue
                quality = int(order.get("QualityLevel", 1))
                amount = int(order.get("Amount", 1))
                auction_type = order.get("AuctionType", "")
                key = (item_id, city, quality)
                last_city = city
                if auction_type == "offer":
                    if key not in batch_offers or price < batch_offers[key]["price"]:
                        batch_offers[key] = {"price": price, "amount": amount}
                elif auction_type == "request":
                    if key not in batch_requests or price > batch_requests[key]["price"]:
                        batch_requests[key] = {"price": price, "amount": amount}

            updated_count = 0
            with lock:
                with open(DATA, encoding="utf-8") as f:
                    state = json.load(f)
                state.setdefault("prices", {})
                state.setdefault("dates", {})
                state.setdefault("amounts", {})
                state.setdefault("qualityPrices", {})
                state.setdefault("qualityAmounts", {})

                for (item_id, city, q), data_offer in batch_offers.items():
                    if city != "Black Market":
                        p = data_offer["price"]
                        amt = data_offer["amount"]
                        state["qualityPrices"].setdefault(item_id, {}).setdefault(str(q), {})[city] = p
                        state["qualityAmounts"].setdefault(item_id, {}).setdefault(str(q), {})[city] = amt
                        if q == 1 or city not in state["prices"].get(item_id, {}):
                            state["prices"].setdefault(item_id, {})[city] = p
                            state["amounts"].setdefault(item_id, {})[city] = amt
                            state["dates"].setdefault(item_id, {})[city] = now_iso
                        updated_count += 1

                for (item_id, city, q), data_req in batch_requests.items():
                    if city == "Black Market":
                        p = data_req["price"]
                        amt = data_req["amount"]
                        state["qualityPrices"].setdefault(item_id, {}).setdefault(str(q), {})[city] = p
                        state["qualityAmounts"].setdefault(item_id, {}).setdefault(str(q), {})[city] = amt
                        if q == 1 or city not in state["prices"].get(item_id, {}):
                            state["prices"].setdefault(item_id, {})[city] = p
                            state["amounts"].setdefault(item_id, {})[city] = amt
                            state["dates"].setdefault(item_id, {})[city] = now_iso
                        updated_count += 1

                if updated_count > 0:
                    tmp = DATA + ".tmp"
                    with open(tmp, "w", encoding="utf-8") as f:
                        json.dump(state, f, ensure_ascii=False)
                    os.replace(tmp, DATA)

                    live_status["last_update"] = now_dt
                    live_status["last_city"] = last_city
                    live_status["items_updated"] = updated_count
                    live_status["total_received"] += len(orders)

                live_status["connected"] = True
                live_status["last_heartbeat"] = now_dt

            return self._json({"ok": True, "updated": updated_count, "city": last_city})

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    if not os.path.exists(GAMEDATA) or not os.path.exists(DATA):
        import build_data  # noqa: F401  (gera os arquivos)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"Albion Craft rodando em {url}  (Ctrl+C para parar)")
    if os.environ.get("NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass

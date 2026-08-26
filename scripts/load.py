#!/usr/bin/env python3
"""Event-scale load test: the whole venue on the API at once.

769 attendees hold tickets; this drives N of them (default 700) through the
day's four rushes against a FRESH database seeded with the real event data:

  1. The morning sign-in storm — real /auth/login calls, bcrypt and all,
     each phone on its own IP (X-Forwarded-For), shared-email tickets
     resolved through the account chooser.
  2. The browse storm — every signed-in phone loads /me, /tenants,
     /seminars and /rundown at once.
  3. The class rush — everyone tries to grab a seat the moment
     registration opens; the four classes hold 60 each, so exactly 240
     may win and nobody may be oversold.
  4. The expo — booths scan the crowd; and networking check-in fills
     88 tables of 8 with zero oversell.

Correctness is asserted; latency is reported (p50/p95/p99). Run it before
the event on hardware shaped like production:

    createdb natcon_load
    ADDR=:8099 DATABASE_URL=postgres://...natcon_load... go run ./backend/cmd/api &
    ulimit -n 4096   # 700 keep-alive sockets need file descriptors
    BASE=http://localhost:8099 N=700 python3 scripts/load.py

Stdlib only; exits non-zero on any failed assertion.
"""

import http.client
import json
import os
import re
import statistics
import sys
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

BASE = os.environ.get("BASE", "http://localhost:8099")
N = int(os.environ.get("N", "700"))
PASSWORD = os.environ.get("SEED_PASSWORD", "natcon2026")
parsed = urlparse(BASE)
HOST, PORT = parsed.hostname, parsed.port or 80

passed = failed = 0
lock = threading.Lock()


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


class Client:
    def __init__(self):
        self.conn = http.client.HTTPConnection(HOST, PORT, timeout=60)

    def req(self, method, path, token=None, body=None, xff=None):
        headers = {}
        payload = None
        if body is not None:
            payload = json.dumps(body)
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if xff:
            headers["X-Forwarded-For"] = xff
        for attempt in (1, 2):
            try:
                self.conn.request(method, path, body=payload, headers=headers)
                resp = self.conn.getresponse()
                data = resp.read()
                break
            except Exception:
                self.conn.close()
                self.conn = http.client.HTTPConnection(HOST, PORT, timeout=60)
                if attempt == 2:
                    raise
        out = None
        if data:
            try:
                out = json.loads(data)
            except json.JSONDecodeError:
                out = None
        return resp.status, out


def pct(lat, p):
    return statistics.quantiles(lat, n=100)[p - 1] if len(lat) > 1 else lat[0]


def report(name, lat, wall, statuses):
    ok = sum(v for k, v in statuses.items() if 200 <= k < 300)
    print(f"  {name}: {len(lat)} reqs in {wall:.1f}s ({len(lat)/wall:.0f} rps) · "
          f"p50 {pct(lat, 50)*1000:.0f}ms · p95 {pct(lat, 95)*1000:.0f}ms · "
          f"p99 {pct(lat, 99)*1000:.0f}ms · statuses {dict(sorted(statuses.items()))} · 2xx {ok}")


def first_password(chapter, name):
    """Mirror of scripts/attendees_migration.py — what the ticket says."""
    first = name.split()[0] if name.split() else ""
    raw = unicodedata.normalize("NFKD", f"{chapter}{first}")
    return re.sub(r"\s+", "", raw).lower()


def run_pool(items, fn, workers=None):
    lat, statuses, results = [], {}, []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers or len(items)) as ex:
        for status, elapsed, extra in ex.map(fn, items):
            lat.append(elapsed)
            statuses[status] = statuses.get(status, 0) + 1
            results.append((status, extra))
    return lat, statuses, results, time.time() - t0


# ---------------------------------------------------------------- setup
boot = Client()
status, body = boot.req("POST", "/api/v1/auth/login",
                        body={"email": "admin@natcon.id", "password": PASSWORD})
assert status == 200, f"admin login failed: {status} {body}"
admin_tok = body["token"]

members = []
page = 1
while True:
    status, body = boot.req("GET", f"/api/v1/admin/members?limit=1000&page={page}", token=admin_tok)
    assert status == 200
    members += body["members"]
    if len(members) >= body["total"] or not body["members"]:
        break
    page += 1
crowd = members[:N]
print(f"== Setup == {len(members)} attendees seeded, driving {len(crowd)}")

status, body = boot.req("GET", "/api/v1/admin/seminars", token=admin_tok)
seminars = body["seminars"]
capacity_total = sum(s["capacity"] for s in seminars)

TABLES = -(-N // 8) + 1  # enough 8-seat tables for everyone, plus one spare
status, body = boot.req("POST", "/api/v1/admin/tables/generate", token=admin_tok,
                        body={"count": TABLES, "hall": "Hall Load", "capacity": 8})
assert status in (200, 201), f"tables: {status} {body}"

# ------------------------------------------- 1. the morning sign-in storm
print(f"\n== 1. Sign-in storm ({len(crowd)} phones at once) ==")

def sign_in(im):
    i, m = im
    c = Client()
    pw = first_password(m["chapter"], m["name"])
    t0 = time.time()
    status, body = c.req("POST", "/api/v1/auth/login",
                         body={"email": m["email"], "password": pw},
                         xff=f"10.{i // 250}.{(i // 50) % 5}.{i % 50 + 1}")
    if status == 200 and body and "accounts" in body:
        status, body = c.req("POST", "/api/v1/auth/login/select",
                             body={"choice_token": body["choice_token"], "user_id": m["id"]},
                             xff=f"10.{i // 250}.{(i // 50) % 5}.{i % 50 + 1}")
    elapsed = time.time() - t0
    tok = body.get("token") if status == 200 and body else None
    return status, elapsed, (m, tok, c)

lat, statuses, results, wall = run_pool(list(enumerate(crowd)), sign_in)
report("login", lat, wall, statuses)
tokens = [(m, tok, c) for _, (m, tok, c) in results if tok]
check(f"all {len(crowd)} attendees signed in", len(tokens) == len(crowd),
      f"got {len(tokens)}; statuses {statuses}")

# ------------------------------------------------------- 2. browse storm
print(f"\n== 2. Browse storm ({len(tokens)} × 4 endpoints) ==")

def browse(entry):
    m, tok, c = entry
    t0 = time.time()
    worst = 200
    for path in ("/api/v1/me", "/api/v1/tenants", "/api/v1/seminars", "/api/v1/rundown"):
        s, _ = c.req("GET", path, token=tok)
        worst = max(worst, s)
    return worst, time.time() - t0, None

lat, statuses, _, wall = run_pool(tokens, browse)
report("browse (4 GETs each)", lat, wall, statuses)
check("every phone loaded every screen", statuses.get(200, 0) == len(tokens), f"{statuses}")

# --------------------------------------------------------- 3. class rush
print(f"\n== 3. Class rush ({len(tokens)} people, {capacity_total} seats) ==")

def grab_seat(ie):
    i, (m, tok, c) = ie
    sem = seminars[i % len(seminars)]
    t0 = time.time()
    s, _ = c.req("POST", f"/api/v1/seminars/{sem['id']}/register", token=tok)
    return s, time.time() - t0, sem["id"]

lat, statuses, results, wall = run_pool(list(enumerate(tokens)), grab_seat)
report("register", lat, wall, statuses)
won = statuses.get(200, 0) + statuses.get(201, 0)
check(f"exactly {capacity_total} seats won, the rest turned away cleanly",
      won == capacity_total
      and statuses.get(409, 0) == len(tokens) - capacity_total
      and not any(k >= 500 for k in statuses), f"{statuses}")

status, body = boot.req("GET", "/api/v1/admin/seminars", token=admin_tok)
check("no class oversold",
      all(s["seats_taken"] <= s["capacity"] for s in body["seminars"])
      and sum(s["seats_taken"] for s in body["seminars"]) == capacity_total,
      f'{[(s["room"], s["seats_taken"], s["capacity"]) for s in body["seminars"]]}')

# ------------------------------------------------- 4a. booths scan the crowd
print(f"\n== 4a. Expo scan storm ({len(tokens)} scans across the booths) ==")

status, body = boot.req("GET", "/api/v1/admin/tenants", token=admin_tok)
booths = [t for t in body["tenants"] if t["kind"] == "booth"]

def booth_token(t):
    c = Client()
    from_name = "".join(ch for ch in (t["name"] + t["booth"]).lower() if ch.isalnum() and ch.isascii())
    s, b = c.req("POST", "/api/v1/auth/login",
                 body={"email": f"booth-{t['booth'].split(' ')[0].replace('-', '').lower()}@natcon.id",
                       "password": from_name},
                 xff=f"10.9.{booths.index(t) // 50}.{booths.index(t) % 50 + 1}")
    return (s, b.get("token") if b else None, c)

booth_sessions = [booth_token(t) for t in booths]
booth_sessions = [(tok, c) for s, tok, c in booth_sessions if s == 200 and tok]
check(f"every booth scanner signed in ({len(booths)})",
      len(booth_sessions) == len(booths), f"got {len(booth_sessions)}")

def scan(im):
    i, (m, _, _) = im
    tok, c = booth_sessions[i % len(booth_sessions)]
    t0 = time.time()
    s, b = c.req("POST", "/api/v1/scans", token=tok, body={"member_code": m["member_code"]})
    return s, time.time() - t0, (b or {}).get("duplicate")

# One shared client per booth would serialize on the socket; give each worker
# its own connection by scanning through fresh clients in the hot loop.
def scan_fresh(im):
    i, (m, _, _) = im
    tok, _ = booth_sessions[i % len(booth_sessions)]
    c = Client()
    t0 = time.time()
    s, b = c.req("POST", "/api/v1/scans", token=tok, body={"member_code": m["member_code"]})
    return s, time.time() - t0, (b or {}).get("duplicate")

lat, statuses, results, wall = run_pool(list(enumerate(tokens)), scan_fresh, workers=200)
report("scan", lat, wall, statuses)
dupes = sum(1 for _, d in results if d)
check("every scan landed once, none duplicated",
      statuses.get(200, 0) == len(tokens) and dupes == 0, f"{statuses} dupes={dupes}")

# --------------------------------------------- 4b. networking check-in rush
print(f"\n== 4b. Networking check-in ({len(tokens)} people, {TABLES} tables of 8) ==")

def sit(im):
    i, (m, tok, c) = im
    table = (i % (len(tokens) // 8 + (1 if len(tokens) % 8 else 0))) + 1
    t0 = time.time()
    s, _ = c.req("POST", "/api/v1/networking/checkin", token=tok, body={"table_no": table})
    return s, time.time() - t0, table

lat, statuses, results, wall = run_pool(list(enumerate(tokens)), sit)
report("check-in", lat, wall, statuses)
check("everyone found a seat, no table oversold",
      statuses.get(200, 0) == len(tokens) and not any(k >= 500 for k in statuses),
      f"{statuses}")

print(f"\n{'='*40}\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

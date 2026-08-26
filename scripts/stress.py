#!/usr/bin/env python3
"""Stress & concurrency-correctness test for the BNI Natcon 2026 API.

Run against a FRESH database (the script creates its own users/seminar):

    createdb natcon_stress
    ADDR=:8083 DATABASE_URL=postgres://natcon:natcon@localhost:5432/natcon_stress?sslmode=disable \
        go run ./backend/cmd/api &
    BASE=http://localhost:8083 python3 scripts/stress.py

Phases:
  A. Read-heavy load — N workers hammer mixed GET endpoints with keep-alive
     connections; reports RPS + latency p50/p95/p99 + status breakdown.
  B. Seminar seat contention — M members register a capacity-K seminar at
     the same instant; asserts EXACTLY K succeed and the DB never oversells.
  C. Networking table contention — M members check in to one 8-seat table
     concurrently; asserts exactly 8 seated.
  D. Scan burst — 100 concurrent scans of one member at one booth; asserts
     exactly one non-duplicate and the coupon count stays 1.

Login is rate-limited (10/IP/min), so worker tokens are minted locally with
the dev JWT secret — set JWT_SECRET to match the server if overridden.
Stdlib only; exits non-zero on any failed assertion.
"""

import base64
import hashlib
import hmac
import http.client
import json
import os
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

BASE = os.environ.get("BASE", "http://localhost:8083")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
PASSWORD = os.environ.get("SEED_PASSWORD", "natcon2026")

READ_WORKERS = int(os.environ.get("WORKERS", "40"))
READ_REQS_PER_WORKER = int(os.environ.get("REQS", "60"))
CONTENDERS = int(os.environ.get("CONTENDERS", "60"))
SEMINAR_CAPACITY = 10
# The hall's tables seat 8 — the number section C contends against.
TABLE_CAPACITY = 8

parsed = urlparse(BASE)
HOST, PORT = parsed.hostname, parsed.port or 80

passed = 0
failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


# ---------------------------------------------------------------- helpers

def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def mint_token(user_id, role):
    """HS256 JWT compatible with the backend issuer."""
    now = int(time.time())
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64url(json.dumps(
        {"role": role, "sub": str(user_id), "exp": now + 3600, "iat": now}
    ).encode())
    sig = b64url(hmac.new(JWT_SECRET.encode(), header + b"." + payload, hashlib.sha256).digest())
    return (header + b"." + payload + b"." + sig).decode()


class Client:
    """Thin keep-alive HTTP client (one per worker thread)."""

    def __init__(self):
        self.conn = http.client.HTTPConnection(HOST, PORT, timeout=30)

    def req(self, method, path, token=None, body=None):
        headers = {}
        payload = None
        if body is not None:
            payload = json.dumps(body)
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            self.conn.request(method, path, body=payload, headers=headers)
            resp = self.conn.getresponse()
            data = resp.read()
        except Exception:
            self.conn.close()
            self.conn = http.client.HTTPConnection(HOST, PORT, timeout=30)
            raise
        parsed_body = None
        if data:
            try:
                parsed_body = json.loads(data)
            except json.JSONDecodeError:
                pass
        return resp.status, parsed_body


def section(title):
    print(f"\n== {title} ==")


# ---------------------------------------------------------------- setup

section("Setup")
c = Client()

status, body = c.req("POST", "/api/v1/auth/login",
                     body={"email": "admin@natcon.id", "password": PASSWORD})
assert status == 200, f"admin login failed: {status} {body}"
admin_tok = body["token"]

# Booth A1 arrives with the Data Booth migration; the networking tables do
# not exist until someone makes them, so this suite makes its own.
status, body = c.req("POST", "/api/v1/admin/tables/generate", token=admin_tok,
                     body={"count": 12, "hall": "Hall B", "capacity": TABLE_CAPACITY})
assert status == 201, f"table fixture failed: {status} {body}"

status, body = c.req("POST", "/api/v1/auth/login",
                     body={"email": "booth-a1@natcon.id", "password": "sscxinternationala1"})
assert status == 200, "tenant login failed"
tenant_tok = body["token"]

# Bulk-create contenders in chunks (bcrypt hashing makes one huge batch
# outlast the 30 s request timeout), then resolve their ids via search.
rows = [{"name": f"Stress {i:04d}", "email": f"stress{i:04d}@natcon.id",
         "chapter": "Chapter Stress"} for i in range(CONTENDERS)]
created_total = 0
for start in range(0, CONTENDERS, 200):
    chunk = rows[start:start + 200]
    status, body = c.req("POST", "/api/v1/admin/members/bulk", token=admin_tok,
                         body={"members": chunk})
    assert status == 200, f"bulk create failed: {status} {body}"
    created_total += body["created"]
assert created_total == CONTENDERS, f"created {created_total}/{CONTENDERS}"

members = {}
for start in range(0, CONTENDERS, 1000):
    status, body = c.req(
        "GET", f"/api/v1/admin/members?q=Stress&limit=1000&page={start // 1000 + 1}",
        token=admin_tok)
    for m in body["members"]:
        members[m["email"]] = m
contenders = [members[f"stress{i:04d}@natcon.id"] for i in range(CONTENDERS)]
tokens = [mint_token(m["id"], "member") for m in contenders]

# One attendee stands in for "the person a whole queue of scanners hits at
# once" — any of the contenders will do.
scan_target_code = contenders[0]["member_code"]

status, body = c.req("POST", "/api/v1/admin/seminars", token=admin_tok,
                     body={"slot": 9, "room": "R. Stress", "title": "Uji Beban",
                           "speaker": "Bot", "capacity": SEMINAR_CAPACITY})
assert status == 201, f"create seminar failed: {body}"
stress_seminar_id = body["seminar"]["id"]

# Sanity: a minted token really authenticates.
status, _ = c.req("GET", "/api/v1/me", token=tokens[0])
check("minted JWT accepted by API", status == 200, f"got {status}")
print(f"  setup: {CONTENDERS} members, seminar cap {SEMINAR_CAPACITY}, "
      f"{READ_WORKERS} workers x {READ_REQS_PER_WORKER} reqs")

# ---------------------------------------------------------------- phase A

section("A. Read-heavy load")
READ_PATHS = [
    ("/healthz", None),
    ("/api/v1/me", "member"),
    ("/api/v1/tenants", "member"),
    ("/api/v1/seminars", "member"),
    ("/api/v1/networking", "member"),
    ("/api/v1/booth/stats", "tenant"),
    ("/api/v1/admin/overview", "admin"),
    ("/api/v1/admin/tenants", "admin"),
]

latencies = []
status_counts = {}
lock = threading.Lock()


def read_worker(wid):
    client = Client()
    my_lat, my_status = [], {}
    member_tok = tokens[wid % len(tokens)]
    for i in range(READ_REQS_PER_WORKER):
        path, kind = READ_PATHS[(wid + i) % len(READ_PATHS)]
        tok = {"member": member_tok, "tenant": tenant_tok, "admin": admin_tok, None: None}[kind]
        t0 = time.perf_counter()
        try:
            status, _ = client.req("GET", path, token=tok)
        except Exception:
            status = -1
        my_lat.append((time.perf_counter() - t0) * 1000)
        my_status[status] = my_status.get(status, 0) + 1
    with lock:
        latencies.extend(my_lat)
        for k, v in my_status.items():
            status_counts[k] = status_counts.get(k, 0) + v


t0 = time.perf_counter()
with ThreadPoolExecutor(max_workers=READ_WORKERS) as ex:
    list(ex.map(read_worker, range(READ_WORKERS)))
elapsed = time.perf_counter() - t0

total = len(latencies)
lat_sorted = sorted(latencies)
p = lambda q: lat_sorted[min(total - 1, int(total * q))]
print(f"  {total} requests in {elapsed:.2f}s  ->  {total/elapsed:,.0f} req/s")
print(f"  latency ms: p50={statistics.median(lat_sorted):.1f}  "
      f"p95={p(0.95):.1f}  p99={p(0.99):.1f}  max={lat_sorted[-1]:.1f}")
print(f"  status: {status_counts}")
check("all read requests returned 200", set(status_counts) == {200}, f"{status_counts}")
check("p99 under 500ms", p(0.99) < 500, f"p99={p(0.99):.1f}ms")

# ---------------------------------------------------------------- phase B

section(f"B. Seminar seat contention ({CONTENDERS} members, {SEMINAR_CAPACITY} seats)")
results = {}


def register_worker(idx):
    client = Client()
    status, _ = client.req("POST", f"/api/v1/seminars/{stress_seminar_id}/register",
                           token=tokens[idx])
    with lock:
        results[status] = results.get(status, 0) + 1


with ThreadPoolExecutor(max_workers=CONTENDERS) as ex:
    list(ex.map(register_worker, range(CONTENDERS)))

print(f"  results: {results}")
check(f"exactly {SEMINAR_CAPACITY} registrations succeed",
      results.get(201, 0) == SEMINAR_CAPACITY, f"{results}")
check("the rest rejected with 409",
      results.get(409, 0) == CONTENDERS - SEMINAR_CAPACITY, f"{results}")

status, body = c.req("GET", f"/api/v1/admin/seminars/{stress_seminar_id}", token=admin_tok)
check("DB never oversells (seats_taken == capacity)",
      body["seminar"]["seats_taken"] == SEMINAR_CAPACITY
      and len(body["attendees"]) == SEMINAR_CAPACITY,
      f"taken={body['seminar']['seats_taken']}")

# ---------------------------------------------------------------- phase C

section(f"C. Networking table contention ({CONTENDERS} members, {TABLE_CAPACITY} seats)")
results = {}


def checkin_worker(idx):
    client = Client()
    status, _ = client.req("POST", "/api/v1/networking/checkin",
                           token=tokens[idx], body={"table_no": 10})
    with lock:
        results[status] = results.get(status, 0) + 1


with ThreadPoolExecutor(max_workers=CONTENDERS) as ex:
    list(ex.map(checkin_worker, range(CONTENDERS)))

print(f"  results: {results}")
check("exactly 8 check-ins succeed", results.get(200, 0) == 8, f"{results}")
check("the rest rejected with 409 (meja penuh)",
      results.get(409, 0) == CONTENDERS - 8, f"{results}")

status, body = c.req("GET", "/api/v1/networking", token=tokens[0])
table10 = next(t for t in body["tables"] if t["table_no"] == 10)
check(f"table occupancy is exactly {TABLE_CAPACITY}", table10["occupied"] == TABLE_CAPACITY,
      f"occupied={table10['occupied']}")

# ---------------------------------------------------------------- phase D

# Two door crews scanning the same attendee at the same moment: exactly one
# goodiebag may leave the table.
section("D2. Goodiebag handover burst (50 concurrent scans, one attendee)")
status, body = c.req("POST", "/api/v1/admin/members", token=admin_tok,
                     body={"name": "Rebutan Goodiebag", "email": "rebutan@natcon.id",
                           "chapter": "Chapter Stress"})
assert status == 201, f"handover fixture failed: {status} {body}"
burst_code = body["user"]["member_code"]
handover_results = {}


def handover_worker(_):
    client = Client()
    status, _ = client.req("POST", "/api/v1/admin/redeem", token=admin_tok,
                           body={"member_code": burst_code, "item": "goodiebag"})
    with lock:
        handover_results[status] = handover_results.get(status, 0) + 1


with ThreadPoolExecutor(max_workers=25) as ex:
    list(ex.map(handover_worker, range(50)))

print(f"  results: {handover_results}")
check("exactly one goodiebag leaves the table",
      handover_results.get(200, 0) == 1, f"{handover_results}")
check("every other scan is told it is already collected",
      handover_results.get(409, 0) == 49, f"{handover_results}")

section("D. Scan burst (100 concurrent scans, one member, one booth)")
results = {}
non_dup = [0]


def scan_worker(_):
    client = Client()
    status, body = client.req("POST", "/api/v1/scans", token=tenant_tok,
                              body={"member_code": scan_target_code})
    with lock:
        results[status] = results.get(status, 0) + 1
        if status == 200 and body and body.get("duplicate") is False:
            non_dup[0] += 1


with ThreadPoolExecutor(max_workers=50) as ex:
    list(ex.map(scan_worker, range(100)))

print(f"  results: {results}, non-duplicate: {non_dup[0]}")
check("all 100 scans return 200", results.get(200, 0) == 100, f"{results}")
check("exactly one scan counted as new", non_dup[0] == 1, f"non_dup={non_dup[0]}")

status, body = c.req("GET", "/api/v1/scans", token=tenant_tok)  # noqa: unused sanity
status, body = c.req("GET", "/api/v1/booth/stats", token=tenant_tok)
check("booth total scans is exactly 1", body["total_scans"] == 1, f"{body}")

# ---------------------------------------------------------------- summary
print(f"\n{'='*40}\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

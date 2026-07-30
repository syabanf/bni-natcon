#!/usr/bin/env python3
"""End-to-end test suite for the BNI Natcon 2026 API.

Run against a FRESH database (seed data only), e.g.:

    createdb natcon_e2e
    ADDR=:8082 DATABASE_URL=postgres://natcon:natcon@localhost:5432/natcon_e2e?sslmode=disable \
        go run ./cmd/api &
    BASE=http://localhost:8082 python3 scripts/e2e.py

Exits non-zero when any check fails. Stdlib only — no dependencies.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://localhost:8082")
PASSWORD = os.environ.get("SEED_PASSWORD", "natcon2026")

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


def req(method, path, token=None, body=None, raw_body=None):
    """Returns (status, parsed-json-or-None, headers)."""
    url = BASE + path
    data = raw_body if raw_body is not None else (
        json.dumps(body).encode() if body is not None else None
    )
    r = urllib.request.Request(url, data=data, method=method)
    if body is not None or raw_body is not None:
        r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            payload = resp.read()
            parsed = json.loads(payload) if payload else None
            return resp.status, parsed, dict(resp.headers)
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            parsed = json.loads(payload) if payload else None
        except json.JSONDecodeError:
            parsed = None
        return e.code, parsed, dict(e.headers)
    except urllib.error.URLError:
        # The server may slam the connection shut mid-upload (e.g. the
        # oversized-body guard) — treat it as a connection-level reject.
        return 0, None, {}


def login(email, password=PASSWORD):
    status, body, _ = req("POST", "/api/v1/auth/login", body={"email": email, "password": password})
    return status, body


def section(title):
    print(f"\n== {title} ==")


# ---------------------------------------------------------------- health & auth
section("Health & auth")
status, body, headers = req("GET", "/healthz")
check("healthz 200", status == 200 and body["status"] == "ok")
check("security header nosniff", headers.get("X-Content-Type-Options") == "nosniff")
check("security header frame deny", headers.get("X-Frame-Options") == "DENY")

status, body = login("reddie@natcon.id", "salah-total")
check("wrong password -> 401", status == 401)

status, body = login("reddie@natcon.id")
check("member login 200", status == 200 and body["user"]["role"] == "member")
member_tok = body["token"]
member_code = body["user"]["member_code"]

status, body = login("sinta@natcon.id")
check("second member login 200", status == 200)
sinta_tok = body["token"]
sinta_id = body["user"]["id"]

status, body = login("booth-a03@natcon.id")
check("tenant login 200", status == 200 and body["user"]["role"] == "tenant")
tenant_tok = body["token"]

status, body = login("admin@natcon.id")
check("admin login 200", status == 200 and body["user"]["role"] == "admin")
admin_tok = body["token"]

# ---------------------------------------------------------------- role guards
section("Role guards")
status, _, _ = req("GET", "/api/v1/me")
check("no token -> 401", status == 401)
status, _, _ = req("GET", "/api/v1/me", token="bukan-token")
check("garbage token -> 401", status == 401)
status, _, _ = req("POST", "/api/v1/scans", token=member_tok, body={"member_code": member_code})
check("member cannot scan -> 403", status == 403)
status, _, _ = req("GET", "/api/v1/tenants", token=tenant_tok)
check("tenant cannot list tenants -> 403", status == 403)
status, _, _ = req("GET", "/api/v1/admin/overview", token=member_tok)
check("member cannot admin -> 403", status == 403)

# ---------------------------------------------------------------- member basics
section("Member basics")
status, body, _ = req("GET", "/api/v1/me", token=member_tok)
check("me: 14 tenants, 0 visited", status == 200
      and body["stats"]["tenants_total"] == 14 and body["stats"]["tenants_visited"] == 0)

status, body, _ = req("GET", "/api/v1/tenants", token=member_tok)
check("tenants list 14, none visited",
      status == 200 and len(body["tenants"]) == 14
      and not any(t["visited"] for t in body["tenants"]))
check("sponsors listed first with kind + description",
      body["tenants"][0]["kind"] == "sponsor" and body["tenants"][0]["description"] != ""
      and body["tenants"][-1]["kind"] == "booth")

# ---------------------------------------------------------------- scan flow
section("Booth scan (digital stamp)")
status, body, _ = req("POST", "/api/v1/scans", token=tenant_tok, body={"member_code": member_code})
check("first scan ok, coupon 1", status == 200 and body["duplicate"] is False and body["coupons"] == 1)
status, body, _ = req("POST", "/api/v1/scans", token=tenant_tok, body={"member_code": member_code})
check("re-scan duplicate, coupon still 1", status == 200 and body["duplicate"] is True and body["coupons"] == 1)
status, body, _ = req("POST", "/api/v1/scans", token=tenant_tok, body={"member_code": "+62811000201"})
check("scan by phone number resolves member (Sinta)",
      status == 200 and body["member_name"] == "Sinta Dewi" and body["duplicate"] is False)
sinta_member_id = body["member_id"]
status, _, _ = req("POST", "/api/v1/scans", token=tenant_tok, body={"member_code": "NATCON-2026-99999"})
check("unknown code -> 404", status == 404)
status, _, _ = req("POST", "/api/v1/scans", token=tenant_tok, body={})
check("missing member_code -> 400", status == 400)

status, body, _ = req("GET", "/api/v1/me", token=member_tok)
check("stats reflect 1 visit/coupon",
      body["stats"]["tenants_visited"] == 1 and body["stats"]["coupons"] == 1)

status, body, _ = req("GET", "/api/v1/booth/stats", token=tenant_tok)
check("booth stats total 2 (Reddie + Sinta)", status == 200 and body["total_scans"] == 2)
status, body, _ = req("GET", "/api/v1/booth/visitors?limit=5", token=tenant_tok)
check("booth visitors has newest member first", status == 200 and body["visitors"][0]["name"] == "Sinta Dewi")

status, _, _ = req("PUT", f"/api/v1/booth/visitors/{sinta_member_id}/note", token=tenant_tok,
                   body={"note": "interested in bulk order"})
check("set visitor note -> 200", status == 200)
status, body, _ = req("GET", f"/api/v1/booth/visitors/{sinta_member_id}", token=tenant_tok)
check("visitor detail carries note + phone", status == 200
      and body["visitor"]["note"] == "interested in bulk order"
      and body["visitor"]["phone"] == "+62811000201")
status, body, _ = req("GET", "/api/v1/booth/visitors?limit=5", token=tenant_tok)
check("visitor list shows the note",
      any(v.get("note") == "interested in bulk order" for v in body["visitors"]))
status, _, _ = req("PUT", "/api/v1/booth/visitors/999999/note", token=tenant_tok, body={"note": "x"})
check("note for non-visitor -> 404", status == 404)

# ---------------------------------------------------------------- seminars
section("Seminars (register / slot lock / cancel / switch)")
status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
check("2 seminars listed", status == 200 and len(body["seminars"]) == 2)
check("seminar carries description + attended flag",
      body["seminars"][0]["description"] != "" and body["seminars"][0]["attended"] is False)
sem1, sem2 = body["seminars"][0]["id"], body["seminars"][1]["id"]

status, _, _ = req("POST", f"/api/v1/seminars/{sem1}/register", token=member_tok)
check("register seminar 1 -> 201", status == 201)
status, _, _ = req("POST", f"/api/v1/seminars/{sem2}/register", token=member_tok)
check("same-slot second register -> 409", status == 409)
status, _, _ = req("DELETE", f"/api/v1/seminars/{sem1}/register", token=member_tok)
check("cancel -> 200", status == 200)
status, _, _ = req("DELETE", f"/api/v1/seminars/{sem1}/register", token=member_tok)
check("cancel again -> 404", status == 404)
status, _, _ = req("POST", f"/api/v1/seminars/{sem2}/register", token=member_tok)
check("switch to seminar 2 -> 201", status == 201)
status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
reg = {s["id"]: s["registered"] for s in body["seminars"]}
check("only seminar 2 registered", reg[sem1] is False and reg[sem2] is True)

# ---------------------------------------------------------------- networking
section("Speed networking")
status, body, _ = req("GET", "/api/v1/networking", token=member_tok)
check("not checked in, 12 tables", status == 200
      and body["checked_in"] is False and len(body["tables"]) == 12)

status, _, _ = req("POST", "/api/v1/networking/checkin", token=member_tok, body={"table_no": 12})
check("check-in table 12", status == 200)
status, _, _ = req("POST", "/api/v1/networking/checkin", token=sinta_tok, body={"table_no": 12})
check("second member joins table 12", status == 200)
status, _, _ = req("POST", "/api/v1/networking/checkin", token=member_tok, body={"table_no": 999})
check("unknown table -> 404", status == 404)

status, body, _ = req("GET", "/api/v1/networking", token=member_tok)
check("status shows table 12 with 2 mates", body["checked_in"] is True
      and body["table"]["table_no"] == 12 and len(body["mates"]) == 2)

status, _, _ = req("POST", "/api/v1/networking/contacts", token=member_tok, body={"member_id": sinta_id})
check("save contact", status == 200)
status, body, _ = req("POST", "/api/v1/networking/contacts/all", token=member_tok)
check("save-all idempotent (0 new)", status == 200 and body["saved"] == 0)

status, body, _ = req("GET", "/api/v1/networking/history", token=member_tok)
check("history: 1 table, 1 contact", status == 200
      and len(body["tables"]) == 1 and len(body["contacts"]) == 1
      and body["contacts"][0]["member_id"] == sinta_id)

status, body, _ = req("GET", "/api/v1/networking/tables/12", token=member_tok)
check("table detail: 2 occupants, contact flagged saved",
      status == 200 and len(body["members"]) == 2
      and any(m["saved"] for m in body["members"] if not m["is_me"]))
status, _, _ = req("GET", "/api/v1/networking/tables/99", token=member_tok)
check("table detail unknown -> 404", status == 404)

status, body, _ = req("GET", f"/api/v1/networking/contacts/{sinta_id}", token=member_tok)
check("contact detail shows current table 12",
      status == 200 and body["current_table_no"] == 12)
check("contact detail carries email + phone",
      body["email"] == "sinta@natcon.id" and body["phone"] == "+62811000201")

status, _, _ = req("PUT", f"/api/v1/networking/contacts/{sinta_id}/note", token=member_tok,
                   body={"note": "great referral fit"})
check("set contact note -> 200", status == 200)
status, body, _ = req("GET", f"/api/v1/networking/contacts/{sinta_id}", token=member_tok)
check("contact note persisted", body["note"] == "great referral fit")
status, _, _ = req("PUT", "/api/v1/networking/contacts/999/note", token=member_tok, body={"note": "x"})
check("note for unsaved contact -> 404", status == 404)
status, _, _ = req("GET", "/api/v1/networking/contacts/999", token=member_tok)
check("contact not owned -> 404", status == 404)

status, _, _ = req("POST", "/api/v1/networking/checkin", token=sinta_tok, body={"table_no": 3})
status, body, _ = req("GET", "/api/v1/networking", token=member_tok)
check("mate moved away, 1 left at table", len(body["mates"]) == 1)

# ---------------------------------------------------------------- admin CRUD
section("Admin: overview, CRUD, details, import, reports")
status, body, _ = req("GET", "/api/v1/admin/overview", token=admin_tok)
check("overview: 3 members, 14 tenants, 2 visits",
      status == 200 and body["total_members"] == 3
      and body["total_tenants"] == 14 and body["total_visits"] == 2)

status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                      body={"name": "E2E Budi", "email": "e2e-budi@natcon.id", "chapter": "Chapter E2E"})
check("create member 201 with code", status == 201 and body["user"]["member_code"].startswith("NATCON-2026-"))
new_member_id = body["user"]["id"]

status, _ = login("e2e-budi@natcon.id")
check("new member can log in", status == 200)

status, _, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                   body={"name": "Dup", "email": "e2e-budi@natcon.id"})
check("duplicate email -> 409", status == 409)
status, _, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                   body={"name": "Bad", "email": "bukan-email"})
check("invalid email -> 400 (hardening)", status == 400)

status, _, _ = req("PUT", f"/api/v1/admin/members/{new_member_id}", token=admin_tok,
                   body={"name": "E2E Budi Update", "email": "e2e-budi@natcon.id", "chapter": "X", "company": "Y"})
check("update member 200", status == 200)
status, body, _ = req("GET", f"/api/v1/admin/members/{new_member_id}", token=admin_tok)
check("member detail reflects update", status == 200 and body["user"]["name"] == "E2E Budi Update")

status, body, _ = req("POST", "/api/v1/admin/tenants", token=admin_tok,
                      body={"name": "E2E Booth", "category": "Uji", "booth": "Z-01"})
check("create tenant 201 (auto initials)", status == 201 and body["tenant"]["initials"] == "EB")
new_tenant_id = body["tenant"]["id"]
status, _ = login("booth-z01@natcon.id")
check("auto booth login works", status == 200)
status, body, _ = req("GET", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok)
check("tenant detail 200", status == 200 and body["tenant"]["owner_email"] == "booth-z01@natcon.id")

status, body, _ = req("POST", "/api/v1/admin/seminars", token=admin_tok,
                      body={"slot": 2, "room": "R. E2E", "title": "Uji E2E", "speaker": "Bot", "capacity": 5})
check("create seminar 201", status == 201)
new_sem_id = body["seminar"]["id"]
status, _, _ = req("POST", "/api/v1/admin/seminars", token=admin_tok,
                   body={"room": "X", "title": "Y", "capacity": 0})
check("capacity 0 -> 400", status == 400)
status, body, _ = req("GET", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok)
check("seminar detail 200", status == 200 and body["seminar"]["room"] == "R. E2E")

status, body, _ = req("POST", "/api/v1/admin/members/bulk", token=admin_tok,
                      body={"members": [
                          {"name": "Bulk Satu", "email": "bulk1@natcon.id"},
                          {"name": "Bulk Dup", "email": "e2e-budi@natcon.id"},
                      ]})
check("bulk import: 1 created 1 failed", status == 200 and body["created"] == 1 and body["failed"] == 1)

status, body, _ = req("GET", "/api/v1/admin/report/visits", token=admin_tok)
check("visits report has both scans", status == 200 and len(body["visits"]) == 2)
status, body, _ = req("GET", "/api/v1/admin/report/registrations", token=admin_tok)
check("registrations report has row", status == 200 and len(body["registrations"]) == 1)

# ---- attendance (check-in pintu) — Reddie saat ini terdaftar di seminar 2
status, body, _ = req("POST", f"/api/v1/admin/seminars/{sem2}/checkin", token=admin_tok,
                      body={"member_code": member_code})
check("door check-in recorded", status == 200 and body["duplicate"] is False
      and body["attended_count"] == 1)
status, body, _ = req("POST", f"/api/v1/admin/seminars/{sem2}/checkin", token=admin_tok,
                      body={"member_code": member_code})
check("repeat check-in flagged duplicate", status == 200 and body["duplicate"] is True)
status, _, _ = req("POST", f"/api/v1/admin/seminars/{sem1}/checkin", token=admin_tok,
                   body={"member_code": member_code})
check("check-in without registration -> 409", status == 409)
status, body, _ = req("GET", f"/api/v1/admin/seminars/{sem2}", token=admin_tok)
check("seminar detail shows attendance",
      body["seminar"]["attended_count"] == 1
      and body["attendees"][0]["checked_in"] is True)
status, body, _ = req("GET", "/api/v1/admin/report/registrations", token=admin_tok)
check("registration report carries attended flag",
      any(r.get("attended") for r in body["registrations"]))

# ---- pagination & search
status, body, _ = req("GET", "/api/v1/admin/members?limit=2&page=1", token=admin_tok)
check("members pagination: 2 rows, total tracked",
      status == 200 and len(body["members"]) == 2 and body["total"] >= 3)
status, body, _ = req("GET", "/api/v1/admin/members?q=reddie", token=admin_tok)
check("members search filters", status == 200 and body["total"] == 1
      and body["members"][0]["name"] == "Reddie Wijaya")

status, _, _ = req("DELETE", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok)
check("delete seminar 200", status == 200)
status, _, _ = req("DELETE", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok)
check("delete tenant 200", status == 200)
status, _ = login("booth-z01@natcon.id")
check("deleted booth login -> 401", status == 401)
status, _, _ = req("DELETE", f"/api/v1/admin/members/{new_member_id}", token=admin_tok)
check("delete member 200", status == 200)

# ---------------------------------------------------------------- hardening
section("Hardening & metrics")
with urllib.request.urlopen(BASE + "/metrics", timeout=10) as _r:
    metrics_status, metrics_text = _r.status, _r.read().decode()
check("prometheus /metrics exposed", metrics_status == 200)
check("request counter metric present", "natcon_http_requests_total" in metrics_text)
big = b'{"member_code": "' + b"A" * (3 * 1024 * 1024) + b'"}'
status, _, _ = req("POST", "/api/v1/scans", token=tenant_tok, raw_body=big)
check("3MB body rejected (400/413/conn-reset)", status in (400, 413, 0), f"got {status}")

statuses = []
for _ in range(12):
    s, _ = login("reddie@natcon.id", "brute-force")
    statuses.append(s)
check("login rate limit kicks in (429 seen)", 429 in statuses, f"got {statuses}")

# ---------------------------------------------------------------- summary
print(f"\n{'='*40}\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

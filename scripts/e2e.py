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

# What a freshly migrated + seeded database holds: the 31 real booths from
# migration 0014 plus the two BNI sponsors from the seeder.
SEEDED_BOOTHS = 31
SEEDED_SPONSORS = 2
SEEDED_TENANTS = SEEDED_BOOTHS + SEEDED_SPONSORS
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


def req(method, path, token=None, body=None, raw_body=None, xff=None):
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
    if xff:
        # Distinct client IP for the login rate limiter (RealIP middleware).
        r.add_header("X-Forwarded-For", xff)
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


def login(email, password=PASSWORD, xff=None):
    status, body, _ = req("POST", "/api/v1/auth/login",
                          body={"email": email, "password": password}, xff=xff)
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

status, body = login("booth-a1@natcon.id")
check("tenant login 200", status == 200 and body["user"]["role"] == "tenant")
tenant_tok = body["token"]

status, body = login("admin@natcon.id")
check("admin login 200", status == 200 and body["user"]["role"] == "admin")
admin_tok = body["token"]

# ------------------------------------------------- passwords (setup + recovery)
section("Password setup & recovery")
# An imported attendee still carries the generated password, so the app must
# push them to the "choose your own" screen.
status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                      body={"name": "Pass Test", "email": "passtest@natcon.id",
                            "chapter": "Chapter Sandi", "phone": "+628119876543"})
check("create an attendee -> 201", status == 201)
check("a fresh attendee must set a password",
      body["user"].get("must_set_password") is True)
pass_id = body["user"]["id"]

status, body = login("passtest@natcon.id", xff="10.9.9.1")
check("first sign-in works with the generated password", status == 200)
check("login says the password still has to be set",
      body["user"].get("must_set_password") is True)
pass_tok = body["token"]

status, _, _ = req("POST", "/api/v1/auth/password", token=pass_tok, body={"password": "short"})
check("a short password -> 400", status == 400)
status, _, _ = req("POST", "/api/v1/auth/password", token=pass_tok, body={"password": "chosenbythem"})
check("setting a password -> 200", status == 200)

status, body = login("passtest@natcon.id", "chosenbythem", xff="10.9.9.2")
check("the chosen password works", status == 200)
check("the flag is cleared once set", not body["user"].get("must_set_password"))
status, _ = login("passtest@natcon.id", xff="10.9.9.3")
check("the generated password stops working", status == 401)

# Recovery: chapter + the phone on the ticket, in any of its shapes.
status, body, _ = req("POST", "/api/v1/auth/forgot",
                      body={"chapter": "chaptersandi", "phone": "08119876543"})
check("forgot password resolves on chapter + phone",
      status == 200 and len(body["accounts"]) == 1
      and body["accounts"][0]["email"] == "passtest@natcon.id")
reset_token = body["accounts"][0]["reset_token"]
status, _, _ = req("POST", "/api/v1/auth/forgot",
                   body={"chapter": "Chapter Salah", "phone": "+628119876543"})
check("right phone, wrong chapter -> 401", status == 401)
status, _, _ = req("POST", "/api/v1/auth/forgot",
                   body={"chapter": "Chapter Sandi", "phone": "+628110000000"})
check("right chapter, unknown phone -> 401", status == 401)

status, _, _ = req("POST", "/api/v1/auth/reset",
                   body={"reset_token": "not-a-token", "password": "afterreset1"})
check("a bogus reset token -> 400", status == 400)
status, _, _ = req("POST", "/api/v1/auth/reset",
                   body={"reset_token": reset_token, "password": "afterreset1"})
check("reset with a valid token -> 200", status == 200)
status, body = login("passtest@natcon.id", "afterreset1", xff="10.9.9.4")
check("the reset password works", status == 200)
# A reset token must never open the API itself.
status, _, _ = req("GET", "/api/v1/me", token=reset_token)
check("a reset token is not a session token -> 401", status == 401)

status, _, _ = req("DELETE", f"/api/v1/admin/members/{pass_id}", token=admin_tok)
check("clean up the password test attendee", status == 200)

# ------------------------------------------- two tickets bought on one email
section("One email, two tickets")
status, body, _ = req("POST", "/api/v1/admin/members/bulk", token=admin_tok,
                      body={"members": [
                          {"name": "Kembar Satu", "email": "kembar@natcon.id",
                           "chapter": "Chapter Kembar", "phone": "+628117000001",
                           "ticket_number": "TKT-K1"},
                          {"name": "Kembar Dua", "email": "kembar@natcon.id",
                           "chapter": "Chapter Kembar", "phone": "+628117000001",
                           "ticket_number": "TKT-K2"},
                      ]})
check("both tickets on one email import as two attendees",
      status == 200 and body["created"] == 2 and body["failed"] == 0)

# Re-importing the same tickets updates them instead of making more.
status, body, _ = req("POST", "/api/v1/admin/members/bulk", token=admin_tok,
                      body={"members": [
                          {"name": "Kembar Satu Revisi", "email": "kembar@natcon.id",
                           "chapter": "Chapter Kembar", "phone": "+628117000001",
                           "ticket_number": "TKT-K1"},
                      ]})
check("re-importing a ticket updates it", status == 200 and body["updated"] == 1 and body["created"] == 0)

status, body, _ = req("GET", "/api/v1/admin/members?q=kembar@natcon.id", token=admin_tok)
check("the shared address holds exactly two attendees", status == 200 and body["total"] == 2)

# Imported accounts get the generated password: chapter + first name. Both
# tickets carry the same first name here, so one password opens both — which
# is exactly when the chooser has to appear.
status, body = login("kembar@natcon.id", "chapterkembarkembar", xff="10.9.9.5")
check("signing in on a shared address offers a choice",
      status == 200 and body.get("choose") is True and len(body["accounts"]) == 2
      and "token" not in body)
choice_token = body["choice_token"]
chosen = body["accounts"][1]
check("each pass carries its own member code and ticket",
      body["accounts"][0]["member_code"] != chosen["member_code"]
      and chosen["ticket_number"] in ("TKT-K1", "TKT-K2"))

status, body, _ = req("POST", "/api/v1/auth/login/select",
                      body={"choice_token": choice_token, "user_id": chosen["id"]})
check("picking a pass returns a session for it",
      status == 200 and body["token"] and body["user"]["member_code"] == chosen["member_code"])
status, _, _ = req("POST", "/api/v1/auth/login/select",
                   body={"choice_token": choice_token, "user_id": 999999})
check("a choice token cannot sign in an account it never listed -> 401", status == 401)
status, _, _ = req("POST", "/api/v1/auth/login/select",
                   body={"choice_token": "not-a-token", "user_id": chosen["id"]})
check("a bogus choice token -> 400", status == 400)

# Recovery on a shared chapter + phone offers both passes, each with its own token.
status, body, _ = req("POST", "/api/v1/auth/forgot",
                      body={"chapter": "Chapter Kembar", "phone": "08117000001"})
check("recovery offers both passes",
      status == 200 and len(body["accounts"]) == 2
      and body["accounts"][0]["reset_token"] != body["accounts"][1]["reset_token"])

status, body, _ = req("GET", "/api/v1/admin/members?q=kembar@natcon.id", token=admin_tok)
for acc in body["members"]:
    req("DELETE", f"/api/v1/admin/members/{acc['id']}", token=admin_tok)

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
check("me: 33 tenants, 0 visited", status == 200
      and body["stats"]["tenants_total"] == SEEDED_TENANTS and body["stats"]["tenants_visited"] == 0)

status, body, _ = req("GET", "/api/v1/tenants", token=member_tok)
check("tenants list 33, none visited",
      status == 200 and len(body["tenants"]) == SEEDED_TENANTS
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
section("Breakout classes (register / slot lock / cancel / switch)")
status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
check("4 breakout classes listed", status == 200 and len(body["seminars"]) == 4)
check("class carries description + attended flag",
      body["seminars"][0]["description"] != "" and body["seminars"][0]["attended"] is False)
# All four share slot 1, so picking one locks the rest — that single pick is
# what the goodiebag is claimed against.
check("all classes share one parallel slot",
      len({s["slot"] for s in body["seminars"]}) == 1)
check("classes carry speakers and at least one moderator",
      all(s["speaker"] for s in body["seminars"])
      and any(s.get("moderator") for s in body["seminars"]))
# Speakers are rows now, each with a photo the app serves from its own
# public/ folder — that is what the class card renders.
people = body["seminars"][0].get("speakers") or []
# The admin list has to round-trip everything the edit form shows, or saving
# a class would blank its description, cover and speakers.
status, adminlist, _ = req("GET", "/api/v1/admin/seminars", token=admin_tok)
check("admin class list round-trips description + speakers",
      status == 200
      and all(s["description"] for s in adminlist["seminars"])
      and any(s.get("speakers") for s in adminlist["seminars"]))

check("class carries speaker rows with photos",
      len(people) >= 2
      and all(p["name"] and p["photo_url"].startswith("/speakers/") for p in people)
      and any(p["role"] == "moderator" for p in people))
sem1, sem2 = body["seminars"][0]["id"], body["seminars"][1]["id"]
sem3, sem4 = body["seminars"][2]["id"], body["seminars"][3]["id"]

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
# Business classification + WhatsApp number are what people ask each other for
# across a table, so every mate row carries both.
sinta_mate = next(m for m in body["mates"] if not m["is_me"])
check("table mates carry classification + phone for the WhatsApp link",
      sinta_mate["classification"] == "Trade & Distribution"
      and sinta_mate["phone"] == "+62811000201")

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
check("contact detail carries classification",
      body["classification"] == "Trade & Distribution")

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
check("overview splits sponsors from booths",
      body["total_sponsors"] == SEEDED_SPONSORS and body["total_booths"] == SEEDED_BOOTHS
      and body["total_sponsors"] + body["total_booths"] == body["total_tenants"])
check("overview: 3 members, 33 tenants, 2 visits",
      status == 200 and body["total_members"] == 3
      and body["total_tenants"] == SEEDED_TENANTS and body["total_visits"] == 2)

status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                      body={"name": "E2E Budi", "email": "e2e-budi@natcon.id", "chapter": "Chapter E2E",
                            "phone": "+628999000111"})
check("create member 201 with code", status == 201 and body["user"]["member_code"].startswith("NATCON-2026-"))
check("created member stores phone", body["user"].get("phone") == "+628999000111")
new_member_id = body["user"]["id"]
status, body, _ = req("GET", "/api/v1/admin/members?q=%2B628999000111", token=admin_tok)
check("member searchable by phone", status == 200 and body["total"] == 1
      and body["members"][0]["phone"] == "+628999000111")

status, _ = login("e2e-budi@natcon.id")
check("new member can log in", status == 200)

# Two tickets on one address is now a supported shape, so a second attendee
# on the same email is allowed — a tenant's login is not.
status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                      body={"name": "Second Ticket", "email": "e2e-budi@natcon.id"})
check("a second attendee may share an email -> 201", status == 201)
status, _, _ = req("DELETE", f"/api/v1/admin/members/{body['user']['id']}", token=admin_tok)
check("clean up the shared-email attendee", status == 200)
status, _, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                   body={"name": "Staff Clash", "email": "booth-a1@natcon.id"})
check("a tenant's email is still taken -> 409", status == 409)
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

# ---- quota, set on its own from the admin class list
status, _, _ = req("PUT", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok,
                   body={"slot": 2, "room": "R. E2E", "title": "Uji E2E", "speaker": "Bot",
                         "capacity": 5, "description": "Kelas uji", "cover_url": "/covers/e2e.jpg",
                         "speakers": [{"name": "Bot Speaker", "role": "speaker"}]})
check("class carries description, cover and a speaker", status == 200)

status, body, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=admin_tok,
                      body={"quota": 40})
check("set quota -> 200 with seats left",
      status == 200 and body["seminar"]["capacity"] == 40
      and body["seminar"]["seats_taken"] == 0 and body["seminar"]["seats_left"] == 40)

# The narrow call exists so re-sizing a room cannot blank the class copy —
# the same bug that once wiped descriptions and covers on a plain edit.
status, body, _ = req("GET", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok)
check("setting the quota leaves description, cover and speakers alone",
      status == 200 and body["seminar"]["capacity"] == 40
      and body["seminar"]["description"] == "Kelas uji"
      and body["seminar"]["cover_url"] == "/covers/e2e.jpg"
      and len(body["seminar"].get("speakers") or []) == 1)

status, _, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=admin_tok,
                   body={"capacity": 12})
check("quota also accepts the API's own field name", status == 200)
status, _, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=admin_tok,
                   body={"quota": 0})
check("quota 0 -> 400", status == 400)
status, _, _ = req("PATCH", "/api/v1/admin/seminars/999999/quota", token=admin_tok,
                   body={"quota": 10})
check("quota on an unknown class -> 404", status == 404)
status, _, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=member_tok,
                   body={"quota": 10})
check("quota is admin-only", status == 403)

# Shrinking below the people already booked would strand them silently.
status, body, _ = req("POST", f"/api/v1/admin/seminars/{new_sem_id}/registrations",
                      token=admin_tok, body={"member": "sinta@natcon.id"})
check("register the first attendee into the quota class", status == 201)
code_a = body["member_code"]
status, body, _ = req("POST", f"/api/v1/admin/seminars/{new_sem_id}/registrations",
                      token=admin_tok, body={"member": "agus@natcon.id"})
check("register the second attendee into the quota class", status == 201)
code_b = body["member_code"]

status, body, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=admin_tok,
                      body={"quota": 1})
check("quota below the registered count -> 400 naming both numbers",
      status == 400 and "2 attendees already registered" in body.get("error", ""))
status, body, _ = req("GET", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok)
check("a refused quota change leaves the old quota in place",
      status == 200 and body["seminar"]["capacity"] == 12)
status, _, _ = req("PUT", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok,
                   body={"slot": 2, "room": "R. E2E", "title": "Uji E2E", "speaker": "Bot",
                         "capacity": 1})
check("the full edit form refuses the same shrink", status == 400)

status, body, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=admin_tok,
                      body={"quota": 2})
check("quota down to exactly what is booked is allowed — that just closes the room",
      status == 200 and body["seminar"]["seats_left"] == 0)
status, body, _ = req("POST", f"/api/v1/admin/seminars/{new_sem_id}/registrations",
                      token=admin_tok, body={"member": "reddie@natcon.id"})
check("a class at quota turns the next registration away",
      status == 409 and "fully booked" in body.get("error", ""))

# Put the class back the way the rest of the suite expects it.
for code in (code_a, code_b):
    status, _, _ = req("DELETE", f"/api/v1/admin/seminars/{new_sem_id}/registrations/{code}",
                       token=admin_tok)
    check(f"unregister quota-test attendee {code}", status == 200)
status, _, _ = req("PATCH", f"/api/v1/admin/seminars/{new_sem_id}/quota", token=admin_tok,
                   body={"quota": 5})
check("quota restored to 5 for the rest of the run", status == 200)

status, body, _ = req("POST", "/api/v1/admin/members/bulk", token=admin_tok,
                      body={"members": [
                          {"name": "Bulk Satu", "email": "bulk1@natcon.id",
                           "chapter": "Chapter Import", "phone": "+62810009001"},
                          {"name": "Budi Refreshed", "email": "e2e-budi@natcon.id",
                           "chapter": "Chapter Import", "phone": "+62810009002"},
                      ]})
check("bulk import upserts: 1 created, 1 updated, 0 failed",
      status == 200 and body["created"] == 1 and body["updated"] == 1 and body["failed"] == 0)

# Imported accounts: username = email, password = chapter+firstname slug.
status, _ = login("bulk1@natcon.id", "chapterimportbulk", xff="10.99.0.1")
check("imported member logs in with generated chapter+firstname password", status == 200)
status, _ = login("bulk1@natcon.id", PASSWORD, xff="10.99.0.1")
check("default password rejected for imported member", status == 401)
status, _ = login("e2e-budi@natcon.id", PASSWORD, xff="10.99.0.1")
check("updated member keeps original password", status == 200)
status, body, _ = req("GET", f"/api/v1/admin/members/{new_member_id}", token=admin_tok)
check("upsert refreshed existing member (name/chapter/phone; code kept)",
      body["user"]["name"] == "Budi Refreshed"
      and body["user"]["chapter"] == "Chapter Import"
      and body["user"]["phone"] == "+62810009002"
      and body["user"]["member_code"].startswith("NATCON-2026-"))

# ---- networking tables master data
status, body, _ = req("GET", "/api/v1/admin/tables", token=admin_tok)
seeded_tables = len(body["tables"])
# Reddie and Sinta are still checked in from the networking section, so the
# live occupancy has to show up here.
check("tables listed with capacity + live occupancy", status == 200 and seeded_tables == 12
      and all(t["capacity"] == 8 for t in body["tables"])
      and sum(t["occupied"] for t in body["tables"]) == 2
      and next(t for t in body["tables"] if t["table_no"] == 12)["occupied"] == 1)

status, body, _ = req("POST", "/api/v1/admin/tables/generate", token=admin_tok,
                      body={"count": 3, "hall": "Hall C", "capacity": 6})
check("generate 3 tables -> 201, numbering continues",
      status == 201 and body["created"] == 3
      and [t["table_no"] for t in body["tables"]] == [13, 14, 15]
      and body["tables"][0]["hall"] == "Hall C")
gen_table_id = body["tables"][0]["id"]

status, body, _ = req("GET", "/api/v1/networking", token=member_tok)
check("generated tables reach the attendee app", len(body["tables"]) == seeded_tables + 3)

status, _, _ = req("POST", "/api/v1/admin/tables/generate", token=admin_tok,
                   body={"count": 0, "hall": "X", "capacity": 8})
check("generate 0 tables -> 400", status == 400)

status, _, _ = req("PUT", f"/api/v1/admin/tables/{gen_table_id}", token=admin_tok,
                   body={"hall": "Hall D", "capacity": 10})
check("update table hall/capacity -> 200", status == 200)
status, body, _ = req("GET", "/api/v1/admin/tables", token=admin_tok)
t13 = next(t for t in body["tables"] if t["table_no"] == 13)
check("table update persisted", t13["hall"] == "Hall D" and t13["capacity"] == 10)

# Table 12 currently seats Reddie (checked in earlier), so it is protected.
busy_table = next(t for t in body["tables"] if t["occupied"] > 0)
status, _, _ = req("DELETE", f"/api/v1/admin/tables/{busy_table['id']}", token=admin_tok)
check("delete an occupied table -> 409", status == 409)
status, _, _ = req("PUT", f"/api/v1/admin/tables/{busy_table['id']}", token=admin_tok,
                   body={"hall": "Hall B", "capacity": 0})
check("shrink capacity below seated -> 400", status == 400)

status, _, _ = req("DELETE", f"/api/v1/admin/tables/{gen_table_id}", token=admin_tok)
check("delete an empty table -> 200", status == 200)
status, body, _ = req("GET", "/api/v1/admin/tables", token=admin_tok)
check("table list shrinks after delete", len(body["tables"]) == seeded_tables + 2)

# ---- tenant bulk import (create-or-update keyed by booth code)
status, body, _ = req("GET", "/api/v1/admin/overview", token=admin_tok)
sponsors_before, booths_before = body["total_sponsors"], body["total_booths"]

status, body, _ = req("POST", "/api/v1/admin/tenants/bulk", token=admin_tok,
                      body={"tenants": [
                          {"name": "Bulk Sponsor", "booth": "SP-99", "category": "Main Sponsor",
                           "kind": "sponsor", "description": "seeded by import"},
                          {"name": "E2E Booth Refreshed", "booth": "Z-01", "category": "Updated",
                           "kind": "booth"},
                      ]})
check("tenant import upserts: 1 created, 1 updated, 0 failed",
      status == 200 and body["created"] == 1 and body["updated"] == 1 and body["failed"] == 0)

status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
tenants_by_booth = {t["booth"]: t for t in body["tenants"]}
status, body, _ = req("GET", "/api/v1/admin/overview", token=admin_tok)
check("imported sponsor bumps the sponsor counter, not the booth one",
      body["total_sponsors"] == sponsors_before + 1 and body["total_booths"] == booths_before)
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
tenants_by_booth = {t["booth"]: t for t in body["tenants"]}
check("imported sponsor created with kind + auto initials",
      tenants_by_booth["SP-99"]["kind"] == "sponsor"
      and tenants_by_booth["SP-99"]["initials"] == "BS")
check("admin tenant list round-trips description, contact and chapter",
      all("description" in t and "contact_name" in t and "chapter" in t
          for t in tenants_by_booth.values()))
check("existing booth refreshed in place (single row, new details)",
      sum(1 for t in body["tenants"] if t["booth"] == "Z-01") == 1
      and tenants_by_booth["Z-01"]["name"] == "E2E Booth Refreshed"
      and tenants_by_booth["Z-01"]["category"] == "Updated")

# The official booth sheet carries the person manning the booth and their
# chapter alongside the company; both ride through the import onto the tenant.
# Booth A1 already exists from migration 0014, so re-importing the sheet the
# committee already has must refresh it rather than create a second booth.
status, body, _ = req("POST", "/api/v1/admin/tenants/bulk", token=admin_tok,
                      body={"tenants": [
                          {"name": "SSCX International", "booth": "A1",
                           "category": "Management Consultant",
                           "contact_name": "Nicolaas Andrew", "chapter": "Star"},
                      ]})
check("re-importing the seeded booth sheet updates, never duplicates",
      status == 200 and body["updated"] == 1 and body["created"] == 0)
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
sheet_booth = next(t for t in body["tenants"] if t["booth"] == "A1")
check("the booth carries its contact and chapter",
      sheet_booth["name"] == "SSCX International"
      and sheet_booth["contact_name"] == "Nicolaas Andrew"
      and sheet_booth["chapter"] == "Star")
status, body, _ = req("GET", "/api/v1/tenants", token=member_tok)
passport_booth = next(t for t in body["tenants"] if t["booth"] == "A1")
check("the attendee passport shows who is at the booth",
      passport_booth["contact_name"] == "Nicolaas Andrew" and passport_booth["chapter"] == "Star")

status, _ = login("booth-z01@natcon.id", xff="10.99.0.2")
check("refreshed booth keeps its scanner login", status == 200)
status, _ = login("booth-sp99@natcon.id", xff="10.99.0.3")
check("imported booth gets an auto scanner login", status == 200)

status, body, _ = req("POST", "/api/v1/admin/tenants/bulk", token=admin_tok,
                      body={"tenants": [{"name": "No Booth", "booth": ""}]})
check("tenant row without booth -> failed row", status == 200 and body["failed"] == 1)

# ---- cover image upload (stored locally, served at /uploads)
def multipart(field, filename, content_type, payload):
    boundary = "e2eboundary123"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; "
            f"filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n").encode() \
        + payload + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082")

upload_body, upload_ct = multipart("file", "cover.png", "image/png", PNG_1PX)
upload_req = urllib.request.Request(BASE + "/api/v1/admin/uploads", data=upload_body, method="POST")
upload_req.add_header("Content-Type", upload_ct)
upload_req.add_header("Authorization", f"Bearer {admin_tok}")
try:
    with urllib.request.urlopen(upload_req, timeout=15) as resp:
        up = json.loads(resp.read())
        upload_status = resp.status
except urllib.error.HTTPError as e:
    up, upload_status = json.loads(e.read() or b"{}"), e.code
check("cover upload stored locally -> 201 + /uploads url",
      upload_status == 201 and up.get("url", "").startswith("/uploads/"))

img_status = 0
try:
    with urllib.request.urlopen(BASE + up["url"], timeout=15) as resp:
        img_status = resp.status
        img_bytes = resp.read()
except urllib.error.HTTPError as e:
    img_status = e.code
    img_bytes = b""
check("uploaded image served back intact", img_status == 200 and img_bytes == PNG_1PX)

bad_body, bad_ct = multipart("file", "notes.txt", "text/plain", b"just text, not an image")
bad_req = urllib.request.Request(BASE + "/api/v1/admin/uploads", data=bad_body, method="POST")
bad_req.add_header("Content-Type", bad_ct)
bad_req.add_header("Authorization", f"Bearer {admin_tok}")
try:
    with urllib.request.urlopen(bad_req, timeout=15) as resp:
        bad_status = resp.status
except urllib.error.HTTPError as e:
    bad_status = e.code
check("non-image upload rejected -> 400", bad_status == 400)

status, _, _ = req("PUT", f"/api/v1/admin/seminars/{new_sem_id}", token=admin_tok,
                   body={"slot": 2, "room": "R. E2E", "title": "Uji E2E", "speaker": "Bot",
                         "capacity": 5, "cover_url": up["url"]})
check("seminar takes uploaded cover", status == 200)
status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
check("member sees uploaded cover on seminar",
      any(sm.get("cover_url") == up["url"] for sm in body["seminars"]))

# ---- chapters master data
status, body, _ = req("GET", "/api/v1/admin/chapters", token=admin_tok)
chapter_names = {c["name"]: c for c in body["chapters"]}
check("chapters registered from import + CRUD",
      status == 200 and "Chapter Import" in chapter_names
      and chapter_names["Chapter Import"]["members"] == 2)
imp_chapter_id = chapter_names["Chapter Import"]["id"]

status, _, _ = req("POST", "/api/v1/admin/chapters", token=admin_tok, body={"name": "Chapter Import"})
check("duplicate chapter name -> 409", status == 409)
status, _, _ = req("DELETE", f"/api/v1/admin/chapters/{imp_chapter_id}", token=admin_tok)
check("delete chapter in use -> 409", status == 409)
status, _, _ = req("PUT", f"/api/v1/admin/chapters/{imp_chapter_id}", token=admin_tok,
                   body={"name": "Chapter Imported"})
check("rename chapter 200", status == 200)
status, body, _ = req("GET", f"/api/v1/admin/members/{new_member_id}", token=admin_tok)
check("rename cascades to members", body["user"]["chapter"] == "Chapter Imported")

status, body, _ = req("POST", "/api/v1/admin/chapters", token=admin_tok, body={"name": "Chapter Kosong"})
check("create empty chapter 201", status == 201)
empty_id = body["chapter"]["id"]
status, _, _ = req("DELETE", f"/api/v1/admin/chapters/{empty_id}", token=admin_tok)
check("delete empty chapter 200", status == 200)

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

# ---- committee-side class registration + import
section("Class registration by the committee")
status, body, _ = req("POST", f"/api/v1/admin/seminars/{sem3}/registrations", token=admin_tok,
                      body={"member": "sinta@natcon.id"})
check("register an attendee by email -> 201",
      status == 201 and body["duplicate"] is False and body["member_name"] == "Sinta Dewi")
status, body, _ = req("POST", f"/api/v1/admin/seminars/{sem3}/registrations", token=admin_tok,
                      body={"member": "sinta@natcon.id"})
check("registering twice reports duplicate, not an error",
      status == 201 and body["duplicate"] is True)
status, _, _ = req("POST", f"/api/v1/admin/seminars/{sem4}/registrations", token=admin_tok,
                   body={"member": "sinta@natcon.id"})
check("second class in the same slot -> 409", status == 409)
status, _, _ = req("POST", f"/api/v1/admin/seminars/{sem3}/registrations", token=admin_tok,
                   body={"member": "nobody@example.com"})
check("unknown attendee -> 404", status == 404)

status, body, _ = req("POST", "/api/v1/admin/seminars/registrations/bulk", token=admin_tok,
                      body={"registrations": [
                          {"member": "agus@natcon.id", "room": "Breakout Room 3"},
                          {"member": "sinta@natcon.id", "room": "Breakout Room 3"},
                          {"member": "agus@natcon.id", "room": "No Such Room"},
                      ]})
check("bulk registration: 1 created, 1 already there, 1 unknown room",
      status == 200 and body["created"] == 1 and body["updated"] == 1 and body["failed"] == 1)

# Attendees can see who else is in the room — names and chapters only.
status, body, _ = req("GET", f"/api/v1/seminars/{sem3}/attendees", token=member_tok)
check("attendee sees who else is in the room",
      status == 200 and len(body["attendees"]) == 2
      and all(a["name"] and "phone" not in a and "email" not in a for a in body["attendees"]))
status, _, _ = req("GET", "/api/v1/seminars/999999/attendees", token=member_tok)
check("unknown class attendees -> 404", status == 404)

status, body, _ = req("GET", f"/api/v1/admin/seminars/{sem3}", token=admin_tok)
codes = [a["member_code"] for a in body["attendees"]]
check("class detail lists both registered attendees", len(codes) == 2)
status, _, _ = req("DELETE", f"/api/v1/admin/seminars/{sem3}/registrations/{codes[0]}", token=admin_tok)
check("unregister an attendee -> 200", status == 200)
status, body, _ = req("GET", f"/api/v1/admin/seminars/{sem3}", token=admin_tok)
check("class detail drops the removed attendee", len(body["attendees"]) == 1)
status, _, _ = req("DELETE", f"/api/v1/admin/seminars/{sem3}/registrations/{codes[0]}", token=admin_tok)
check("unregistering again -> 404", status == 404)

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

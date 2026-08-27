#!/usr/bin/env python3
"""End-to-end test suite for the BNI Natcon 2026 API.

A fresh database holds only the committee's admin login and the four breakout
classes, so this suite builds every attendee, booth and networking table it
needs before it starts — the same way the committee does on the day, through
the admin API.

Run against a FRESH database, e.g.:

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

# The exhibitor floor of the committee's booth sheet arrives with migration
# 0023 — booths and the four sponsors printed under its own "Sponsor" divider.
# A brand on two stands counts once: it is one exhibitor, not two.
# The extra sponsors, the attendees and the tables are this suite's fixtures.
SEEDED_BOOTHS = 32
SEEDED_SPONSORS = 4
FIXTURE_SPONSORS = 2
FIXTURE_TENANTS = SEEDED_BOOTHS + SEEDED_SPONSORS + FIXTURE_SPONSORS
FIXTURE_TABLES = 12
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

status, body = login("admin@natcon.id")
check("admin login 200", status == 200 and body["user"]["role"] == "admin")
admin_tok = body["token"]

# ------------------------------------------------------------------- fixtures
section("Fixtures (the ticketing export and the sheet's booths arrive seeded)")

# The attendees now arrive with a migration of their own, so a fresh database
# is not empty. Everything downstream counts from this baseline rather than
# from zero — the export changes whenever the committee re-exports it, and a
# suite that hardcoded 769 would fail on the next sheet instead of on a bug.
status, body, _ = req("GET", "/api/v1/admin/overview", token=admin_tok)
SEEDED_MEMBERS = body.get("total_members", 0)
check("a fresh database arrives with the ticketing export and the sheet's booths",
      status == 200 and SEEDED_MEMBERS > 0
      and body["total_booths"] == SEEDED_BOOTHS and body["total_sponsors"] == SEEDED_SPONSORS,
      f"got {body}")

status, body, _ = req("GET", "/api/v1/admin/chapters", token=admin_tok)
SEEDED_CHAPTERS = {c["name"] for c in body["chapters"]}
check("...and with the chapters those attendees carry",
      status == 200 and len(SEEDED_CHAPTERS) > 1, f"{len(SEEDED_CHAPTERS)} chapters")

status, body, _ = req("GET", "/api/v1/admin/seminars", token=admin_tok)
check("...but the four learning classes are already there, with their speakers",
      status == 200 and len(body["seminars"]) == 4
      and sum(len(s.get("speakers") or []) for s in body["seminars"]) == 9)

FIXTURE_MEMBERS = [
    {"name": "Reddie Wijaya", "email": "reddie@natcon.id", "chapter": "BNI Chapter Jakarta Elite",
     "company": "Witid Intelligence", "phone": "+62811000154", "classification": "IT & Software"},
    {"name": "Sinta Dewi", "email": "sinta@natcon.id", "chapter": "BNI Chapter Jakarta Elite",
     "company": "Sinta Florist", "phone": "+62811000201", "classification": "Trade & Distribution"},
    {"name": "Agus Santoso", "email": "agus@natcon.id", "chapter": "BNI Chapter Bandung Raya",
     "company": "Santoso Baja", "phone": "+62811000322", "classification": "Manufacturing"},
]
created = {}
for m in FIXTURE_MEMBERS:
    status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok, body=m)
    if status != 201:
        print(f"  FAIL could not create fixture attendee {m['email']}: {status} {body}")
        sys.exit(1)
    created[m["email"]] = body["user"]
check("three attendees created through the admin API", len(created) == 3)

status, body, _ = req("POST", "/api/v1/admin/tenants/bulk", token=admin_tok,
                      body={"tenants": [
                          {"name": "BNI Xpora", "booth": "SP-01", "category": "Main Sponsor",
                           "kind": "sponsor",
                           "description": "BNI's one-stop export hub for members going global."},
                          {"name": "Wondr by BNI", "booth": "SP-02", "category": "Digital Sponsor",
                           "kind": "sponsor",
                           "description": "Payments, savings goals and lifestyle deals in one app."},
                      ]})
check("two sponsors imported alongside the seeded booths",
      status == 200 and body["created"] == FIXTURE_SPONSORS)

# Booth A1 comes from the sheet, not from this suite — it must already be
# there, and its scanner login must work.
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
by_booth = {t["booth"]: t for t in body["tenants"]}
a1 = by_booth.get("A1")
check("booth A1 arrived from the booth sheet",
      a1 is not None and a1["name"] == "SSCX International"
      and a1["category"] == "Management Consultant", f"got {a1}")
# One exhibitor on two floor positions is still one exhibitor: one card in
# the passport, one stamp, one login. The label names both stands so the
# printed sign and the floor plan agree.
check("a double-width stand is one booth labelled with both numbers",
      by_booth.get("A47 & A48", {}).get("name") == "Alpha leaders"
      and "A47" not in by_booth and "A48" not in by_booth,
      f'got {sorted(b for b in by_booth if b.startswith("A4"))}')
# The logo pack carries the committee's newer floor plan: GrasiaCare gave up
# its second stand and everyone from Paper.id on moved down a slot.
check("the floor plan follows the committee's latest numbering",
      by_booth.get("A18", {}).get("name") == "GrasiaCare"
      and by_booth.get("A20", {}).get("name") == "Paper.id"
      and by_booth.get("A22", {}).get("name") == "inHARMONY Preventive Clinic"
      and by_booth.get("A27", {}).get("name") == "ICUBE (Invoice ke PT)",
      f'got {[(c, by_booth.get(c, {}).get("name")) for c in ("A18", "A20", "A22", "A27")]}')
# One crew, one login — checked through the detail page rather than by
# signing in, so this does not eat into the login rate limit the hardening
# section measures at the end.
merged_id = by_booth["A47 & A48"]["id"]
status, detail, _ = req("GET", f"/api/v1/admin/tenants/{merged_id}", token=admin_tok)
check("...and it has one scanner login, on the first stand's code",
      status == 200 and detail["tenant"]["owner_email"] == "booth-a47@natcon.id",
      f'{detail.get("tenant", {}).get("owner_email")}')
# The committee's logo pack numbers its booths differently from the sheet, so
# the logos are matched on company name and pinned by booth code here.
logos = {t["booth"]: t.get("logo_url", "") for t in body["tenants"] if t.get("logo_url")}
check("every exhibitor who sent a logo carries it",
      len(logos) == 34 and logos.get("A20") == "/logos/paper-id.png"
      and logos.get("C1") == "/logos/royal-medicalink-pharmalab.png",
      f"{len(logos)} {sorted(logos.items())[:3]}")
check("the double stand carries one logo, on one card",
      logos.get("A47 & A48") == "/logos/alpha-leaders.png", f'{logos.get("A47 & A48")}')
# SP-01 and SP-02 are this suite's own sponsors, not the committee's.
check("the two who sent nothing keep their initials",
      {t["booth"] for t in body["tenants"] if not t.get("logo_url")}
      - {"SP-01", "SP-02"} == {"B1", "B3"},
      f'{[t["booth"] for t in body["tenants"] if not t.get("logo_url")]}')
check("a booth still carries initials for the lists that have no room for a logo",
      by_booth["A1"]["initials"] == "SI", f'{by_booth["A1"]}')

check("the sheet's own Sponsor divider decided who is a sponsor",
      by_booth.get("B1", {}).get("kind") == "sponsor"
      and by_booth.get("C1", {}).get("kind") == "sponsor"
      and by_booth.get("A1", {}).get("kind") == "booth",
      f'got {[(c, by_booth.get(c, {}).get("kind")) for c in ("B1", "C1", "A1")]}')

# The migration fills an EMPTY logo only: a restart must never undo what the
# committee uploaded through the admin panel.
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
a1 = next(t for t in body["tenants"] if t["booth"] == "A1")
status, _, _ = req("PUT", f"/api/v1/admin/tenants/{a1['id']}", token=admin_tok,
                   body={"name": a1["name"], "category": a1["category"], "booth": "A1",
                         "kind": "booth", "description": a1.get("description", ""),
                         "logo_url": "/uploads/committee-choice.png"})
check("a committee upload replaces the shipped logo", status == 200, f"{status}")
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
a1 = next(t for t in body["tenants"] if t["booth"] == "A1")
check("...and it is what the passport shows",
      a1["logo_url"] == "/uploads/committee-choice.png", f'{a1["logo_url"]}')
status, _, _ = req("PUT", f"/api/v1/admin/tenants/{a1['id']}", token=admin_tok,
                   body={"name": a1["name"], "category": a1["category"], "booth": "A1",
                         "kind": "booth", "description": a1.get("description", ""), "logo_url": ""})
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
a1 = next(t for t in body["tenants"] if t["booth"] == "A1")
# A save that leaves the initials out must not empty the passport tile.
check("a save without initials keeps them", a1["initials"] == "SI", f'{a1["initials"]!r}')

status, body, _ = req("POST", "/api/v1/admin/tables/generate", token=admin_tok,
                      body={"count": FIXTURE_TABLES, "hall": "Hall B", "capacity": 8})
check(f"{FIXTURE_TABLES} networking tables generated",
      status == 201 and body["created"] == FIXTURE_TABLES)

status, body, _ = req("GET", "/api/v1/admin/chapters", token=admin_tok)
# Nothing pre-loads the chapter list: it is exactly the set of chapters the
# attendees themselves carry — the seeded ones plus whatever this suite just
# created. A booth's chapter is contact detail, not membership, so it does
# not join the list.
now_chapters = {c["name"] for c in body["chapters"]}
check("chapters register themselves from the attendees, nothing pre-loaded",
      status == 200
      and now_chapters == SEEDED_CHAPTERS | {m["chapter"] for m in FIXTURE_MEMBERS},
      f"unexpected: {sorted(now_chapters - SEEDED_CHAPTERS - {m['chapter'] for m in FIXTURE_MEMBERS})}")

# The second committee login mirrors admin, so the desk crew never has to
# borrow the main admin password.
status, body = login("panitia@natcon.id", xff="10.77.0.8")
check("panitia signs in with admin rights", status == 200 and body["user"]["role"] == "admin")
status, _, _ = req("GET", "/api/v1/admin/overview", token=body["token"])
check("...and the admin pages open for it", status == 200)

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

# Booth first passwords are derived — company name + booth code, lowercase,
# letters and digits only — so no two stands share one.
def booth_password(name, booth):
    return "".join(c for c in (name + booth).lower() if c.isalnum() and c.isascii())

status, body = login("booth-a1@natcon.id", booth_password("SSCX International", "A1"))
check("tenant login 200 on its derived password", status == 200 and body["user"]["role"] == "tenant")
tenant_tok = body["token"]
check("a booth's first login demands a password of its own",
      body["user"]["must_set_password"] is True, f'{body["user"]}')

# ------------------------------------------------ booth first-login password
section("Booth crews replace the handed-out password")

# Its three sign-ins ride a different source IP, or they would eat the
# per-IP login budget the hardening section measures at the end.
# A phone keyboard capitalises the first letter the moment somebody taps
# "show password". While a booth is still on the password we generated —
# always all-lowercase — that stray capital must not lock the crew out.
status, body = login("BOOTH-A2@natcon.id",
                     booth_password("PT. ORIENTAL LOGISTICS INDONESIA", "A2").capitalize(),
                     xff="10.77.0.7")
check("a capitalised email and first password still sign the booth in",
      status == 200 and body["user"]["role"] == "tenant", f"{status}")

a2_first = booth_password("PT. ORIENTAL LOGISTICS INDONESIA", "A2")
status, body = login("booth-a2@natcon.id", a2_first, xff="10.77.0.9")
a2_tok = body["token"]
check("the derived password opens the door once",
      status == 200 and body["user"]["must_set_password"] is True)
status, _, _ = req("POST", "/api/v1/auth/password", token=a2_tok,
                   body={"password": "rahasia-booth-a2"})
check("the crew sets their own -> 200", status == 200)
status, _ = login("booth-a2@natcon.id", a2_first, xff="10.77.0.9")
check("the first password no longer works there", status == 401)
status, body = login("booth-a2@natcon.id", "rahasia-booth-a2", xff="10.77.0.9")
# must_set_password is omitempty: gone from the JSON once it is false.
check("their own password works, and the demand is gone",
      status == 200 and not body["user"].get("must_set_password"), f'{body.get("user")}')
# Once the crew picks their own password, case is matched exactly again.
status, _ = login("booth-a2@natcon.id", "Rahasia-booth-a2", xff="10.77.0.9")
check("a self-chosen password is case-sensitive", status == 401)

# Put it back the way the rest of the suite expects it.
req("POST", "/api/v1/auth/password", token=body["token"], body={"password": a2_first})

# ------------------------------------------------------- duplicate attendees
section("Attendees who share a name, email and phone")

twins = [{"name": "Kembar Sama", "email": "kembar-sama@natcon.id", "chapter": "Chapter Kembar",
          "phone": "+628110005555", "ticket_number": f"TWIN-{i}"} for i in range(3)]
status, body, _ = req("POST", "/api/v1/admin/members/bulk", token=admin_tok, body={"members": twins})
check("three tickets on one name, email and phone import as three people",
      status == 200 and body["created"] == 3, f"{status} {body}")

status, body, _ = req("GET", "/api/v1/admin/members?q=kembar-sama@natcon.id&limit=50", token=admin_tok)
rows = body["members"]
check("each carries its position in the group",
      sorted(r["twin_index"] for r in rows) == [1, 2, 3]
      and all(r["twin_count"] == 3 for r in rows), f"{[(r['twin_index'], r['twin_count']) for r in rows]}")
check("the numbering is stable, not random",
      [r["twin_index"] for r in sorted(rows, key=lambda r: r["id"])] == [1, 2, 3])

status, body, _ = req("GET", "/api/v1/admin/members?q=reddie@natcon.id", token=admin_tok)
check("someone with no twin is marked as alone",
      body["members"][0]["twin_count"] == 1 and body["members"][0]["twin_index"] == 1)

for r in rows:
    req("DELETE", f"/api/v1/admin/members/{r['id']}", token=admin_tok)

# ------------------------------------------------- pin & goodiebag handover
section("Door desk — pin and goodiebag handed over by scan")

status, body, _ = req("GET", "/api/v1/admin/redeem/counts", token=admin_tok)
check("nothing handed over yet",
      status == 200 and body["pins"] == 0 and body["goodiebags"] == 0)

for item in ("goodiebag", "pin"):
    status, body, _ = req("POST", "/api/v1/admin/redeem", token=admin_tok,
                          body={"member_code": member_code, "item": item})
    check(f"{item}: first scan hands it over",
          status == 200 and body["member_code"] == member_code, f"{status} {body}")
    first_time = body["redeemed_at"]

    status, body, _ = req("POST", "/api/v1/admin/redeem", token=admin_tok,
                          body={"member_code": member_code, "item": item})
    # The refusal has to name the person and the time, or the crew cannot
    # tell a queue-jumper from their own double tap.
    check(f"{item}: second scan refused with who and when",
          status == 409 and body["already"] is True
          and body["name"] and body["redeemed_at"] == first_time, f"{status} {body}")

status, body, _ = req("GET", "/api/v1/admin/redeem/counts", token=admin_tok)
check("the desk counts what went out", body["pins"] == 1 and body["goodiebags"] == 1)

# The desk scans a QR, but a phone that will not read gets typed in.
status, body, _ = req("POST", "/api/v1/admin/redeem", token=admin_tok,
                      body={"member_code": "sinta@natcon.id", "item": "goodiebag"})
check("an email works at the desk too", status == 200)
status, body, _ = req("POST", "/api/v1/admin/redeem", token=admin_tok,
                      body={"member_code": "+62811000322", "item": "pin"})
check("a phone number works too", status == 200)

for label, payload, want in [
    ("unknown code", {"member_code": "NATCON-2026-99999", "item": "pin"}, 404),
    ("unknown item", {"member_code": member_code, "item": "t-shirt"}, 400),
    ("empty code", {"member_code": "   ", "item": "pin"}, 400),
]:
    status, _, _ = req("POST", "/api/v1/admin/redeem", token=admin_tok, body=payload)
    check(f"rejected: {label} -> {want}", status == want)

status, _, _ = req("POST", "/api/v1/admin/redeem", token=member_tok,
                   body={"member_code": member_code, "item": "pin"})
check("an attendee cannot hand themselves a pin", status == 403)

# ---------------------------------------------------------------- rundown
section("Rundown — the day in one-hour blocks")

D, TZ = "2026-09-03", "+07:00"
status, body, _ = req("GET", "/api/v1/admin/rundown", token=admin_tok)
draft = body["rundown"]
check("a fresh database opens on a draft day, not an empty page",
      status == 200 and len(draft) == 10
      and draft[0]["kind"] == "registration"
      and draft[0]["starts_at"] == f"{D}T07:00:00{TZ}"
      and [b for b in draft if b["starts_at"].startswith(D)][-1]["kind"] == "doorprize",
      f"{status} {[b.get('title') for b in draft]}")
# Two learning blocks, or "two classes that do not clash" can never happen.
check("the draft leaves room for two learning classes",
      sum(1 for b in draft if b["kind"] == "learning") == 2)
check("...and every block sits on the hour grid",
      all(b["starts_at"][14:19] == "00:00" and b["ends_at"][14:19] == "00:00" for b in draft))

# 66 tickets are for the morning after, not the conference day. A schedule
# that could only hold one date had nowhere to put them.
breakfast = [b for b in draft if b["starts_at"].startswith("2026-09-04")]
check("the Gold Club breakfast sits on its own day",
      len(breakfast) == 1 and breakfast[0]["starts_at"] == f"2026-09-04T08:00:00{TZ}"
      and breakfast[0]["ends_at"] == f"2026-09-04T11:00:00{TZ}", f"{breakfast}")
check("...and says who it is for, because the agenda is one list for everybody",
      "Gold Club" in breakfast[0]["title"] and "Gold Club" in breakfast[0]["place"])
check("the draft runs in the order the days do",
      [b["starts_at"] for b in draft] == sorted(b["starts_at"] for b in draft))

# The rest of this section builds its own day from scratch, the way a
# committee that has thrown the draft away would.
for b in draft:
    req("DELETE", f"/api/v1/admin/rundown/{b['id']}", token=admin_tok)
status, body, _ = req("GET", "/api/v1/admin/rundown", token=admin_tok)
check("the committee can clear the draft away", body["rundown"] == [])

status, body, _ = req("POST", "/api/v1/admin/rundown", token=admin_tok,
                      body={"starts_at": f"{D}T09:00:00{TZ}", "ends_at": f"{D}T10:00:00{TZ}",
                            "title": "Opening Ceremony", "place": "Grand Ballroom",
                            "kind": "plenary"})
check("create a block -> 201", status == 201 and body["block"]["title"] == "Opening Ceremony")
block_id = body["block"]["id"]

status, body, _ = req("POST", "/api/v1/admin/rundown", token=admin_tok,
                      body={"starts_at": f"{D}T13:00:00{TZ}", "title": "Learning Class",
                            "kind": "learning"})
check("a block with no end runs one hour",
      status == 201 and body["block"]["ends_at"] == f"{D}T14:00:00{TZ}",
      f'got {body["block"]["ends_at"]}')
check("...and the time comes back in Jakarta hours, whatever zone the server runs in",
      body["block"]["starts_at"] == f"{D}T13:00:00{TZ}", body["block"]["starts_at"])
learning_id = body["block"]["id"]

# The grid is the point of the MoM decision: half-hours would not line up
# with the printed programme.
for label, payload in [
    ("half past the hour", {"starts_at": f"{D}T13:30:00{TZ}", "title": "Off-grid"}),
    ("90 minutes long", {"starts_at": f"{D}T13:00:00{TZ}", "ends_at": f"{D}T14:30:00{TZ}",
                         "title": "Off-grid"}),
    ("ends before it starts", {"starts_at": f"{D}T14:00:00{TZ}", "ends_at": f"{D}T13:00:00{TZ}",
                               "title": "Backwards"}),
    ("unknown kind", {"starts_at": f"{D}T14:00:00{TZ}", "title": "X", "kind": "lunch"}),
    ("no title", {"starts_at": f"{D}T14:00:00{TZ}", "title": "   "}),
]:
    status, _, _ = req("POST", "/api/v1/admin/rundown", token=admin_tok, body=payload)
    check(f"rejected: {label} -> 400", status == 400)

status, body, _ = req("POST", "/api/v1/admin/rundown", token=admin_tok,
                      body={"starts_at": "2026-09-04T08:00:00+07:00",
                            "ends_at": "2026-09-04T11:00:00+07:00",
                            "title": "Gold Club Breakfast", "kind": "break"})
check("a block on the day after -> 201", status == 201, f"{status} {body}")
second_day_id = body["block"]["id"]
status, body, _ = req("GET", "/api/v1/rundown", token=member_tok)
check("the second day comes back last, not first",
      status == 200 and len(body["rundown"]) == 3
      and body["rundown"][-1]["starts_at"] == "2026-09-04T08:00:00+07:00",
      f'{[b["starts_at"] for b in body["rundown"]]}')
req("DELETE", f"/api/v1/admin/rundown/{second_day_id}", token=admin_tok)

status, body, _ = req("GET", "/api/v1/rundown", token=member_tok)
check("attendees read the same schedule", status == 200 and len(body["rundown"]) == 2)
check("...in the order the day runs",
      [b["title"] for b in body["rundown"]] == ["Opening Ceremony", "Learning Class"])

status, body, _ = req("GET", "/api/v1/rundown", token=tenant_tok)
check("booth crews can read it too", status == 200 and len(body["rundown"]) == 2)

status, _, _ = req("PUT", f"/api/v1/admin/rundown/{block_id}", token=admin_tok,
                   body={"starts_at": f"{D}T08:00:00{TZ}", "ends_at": f"{D}T09:00:00{TZ}",
                         "title": "Opening Ceremony (moved)", "kind": "plenary"})
status, body, _ = req("GET", "/api/v1/rundown", token=member_tok)
check("a moved block moves for everyone",
      body["rundown"][0]["title"] == "Opening Ceremony (moved)"
      and body["rundown"][0]["starts_at"] == f"{D}T08:00:00{TZ}",
      body["rundown"][0]["starts_at"])

status, _, _ = req("DELETE", f"/api/v1/admin/rundown/{learning_id}", token=admin_tok)
status, body, _ = req("GET", "/api/v1/rundown", token=member_tok)
check("delete removes the block", len(body["rundown"]) == 1)
status, _, _ = req("DELETE", f"/api/v1/admin/rundown/{learning_id}", token=admin_tok)
check("deleting it twice -> 404", status == 404)
status, _, _ = req("DELETE", f"/api/v1/admin/rundown/{block_id}", token=admin_tok)

status, _, _ = req("GET", "/api/v1/admin/rundown", token=member_tok)
check("an attendee cannot edit the schedule", status == 403)

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
check("me: every exhibitor listed, none visited", status == 200
      and body["stats"]["tenants_total"] == FIXTURE_TENANTS and body["stats"]["tenants_visited"] == 0)

status, body, _ = req("GET", "/api/v1/tenants", token=member_tok)
check("tenants list complete, none visited",
      status == 200 and len(body["tenants"]) == FIXTURE_TENANTS
      and not any(t["visited"] for t in body["tenants"]))
# WIT.id is placed first, ahead of the sponsors, at the committee's request.
check("the passport opens with WIT.id",
      body["tenants"][0]["name"] == "WIT.id", f'{body["tenants"][0]["name"]}')

kinds = [t["kind"] for t in body["tenants"][1:]]
xpora = next((t for t in body["tenants"] if t["name"] == "BNI Xpora"), None)
check("every sponsor is listed before the rest of the booths, descriptions intact",
      kinds.count("sponsor") == SEEDED_SPONSORS + FIXTURE_SPONSORS
      and kinds[:kinds.count("sponsor")] == ["sponsor"] * kinds.count("sponsor")
      and xpora is not None and xpora["description"] != "",
      f"{kinds[:8]}")

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

# That note rides into the committee's leads report — the per-tenant handout
# is built from these rows, and each sheet only ever shows its own notes.
status, body, _ = req("GET", "/api/v1/admin/report/visits", token=admin_tok)
check("the leads report carries the booth's note, and never a phone number",
      status == 200
      and any(v["note"] == "interested in bulk order" and v["booth"] == "A1" for v in body["visits"])
      and all("phone" not in v for v in body["visits"]), f'{body["visits"][:2]}')
status, _, _ = req("PUT", "/api/v1/booth/visitors/999999/note", token=tenant_tok, body={"note": "x"})
check("note for non-visitor -> 404", status == 404)

# ------------------------------------------------- the QR carries the ticket
section("The pass QR carries the ticket number")

# The ticketing team's number is what is printed on the physical ticket and
# what the attendee app puts in the QR, so every scanner in the building has
# to resolve it — booth, class door, goodiebag and pin desk alike. The member
# code still works: it is printed under the QR, and an attendee the committee
# typed in by hand has no ticket at all.
status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                      body={"name": "Tiket Sah", "email": "tiket-sah@natcon.id",
                            "chapter": "Chapter Tiket", "phone": "+628110009090",
                            "ticket_number": "E2E-TICKET-0001"})
ticket_member = body["user"]
check("an imported attendee keeps their ticket number",
      status == 201 and ticket_member["ticket_number"] == "E2E-TICKET-0001", f"{status} {body}")

status, body, _ = req("POST", "/api/v1/scans", token=tenant_tok,
                      body={"member_code": "E2E-TICKET-0001"})
check("a booth scans the ticket number and gets the attendee",
      status == 200 and body["member_name"] == "Tiket Sah" and body["duplicate"] is False,
      f"{status} {body}")
status, body, _ = req("POST", "/api/v1/scans", token=tenant_tok,
                      body={"member_code": ticket_member["member_code"]})
check("the member code under the QR reaches the same person",
      status == 200 and body["duplicate"] is True, f"{status} {body}")

status, body, _ = req("POST", "/api/v1/admin/redeem", token=admin_tok,
                      body={"member_code": "E2E-TICKET-0001", "item": "goodiebag"})
check("the goodiebag desk takes the ticket number",
      status == 200 and body["name"] == "Tiket Sah", f"{status} {body}")

status, body, _ = req("GET", "/api/v1/admin/seminars", token=admin_tok)
first_class = body["seminars"][0]["id"]
status, body, _ = req("POST", f"/api/v1/admin/seminars/{first_class}/registrations", token=admin_tok,
                      body={"member": "E2E-TICKET-0001"})
check("the committee can register by ticket number", status == 201, f"{status} {body}")
status, body, _ = req("POST", f"/api/v1/admin/seminars/{first_class}/checkin", token=admin_tok,
                      body={"member_code": "E2E-TICKET-0001"})
check("the class door records attendance from the ticket number",
      status == 200 and body["member_name"] == "Tiket Sah"
      and body["duplicate"] is False, f"{status} {body}")

status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok,
                      body={"name": "Tiket Kembar", "email": "tiket-kembar@natcon.id",
                            "chapter": "Chapter Tiket", "ticket_number": "E2E-TICKET-0001"})
check("a second attendee on the same ticket number is refused",
      status == 409 and "ticket" in body.get("error", "").lower(), f"{status} {body}")

status, _, _ = req("POST", "/api/v1/scans", token=tenant_tok,
                   body={"member_code": "E2E-NOSUCHTICKET"})
check("a ticket number nobody holds -> 404", status == 404)

# Put the floor back the way the rest of the suite expects it: the visit, the
# registration and the attendance go with the attendee.
req("DELETE", f"/api/v1/admin/members/{ticket_member['id']}", token=admin_tok)

# ---------------------------------------------------------------- seminars
section("Breakout classes (register / slot lock / cancel / switch)")
status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
check("4 learning classes listed", status == 200 and len(body["seminars"]) == 4)
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
      body["total_sponsors"] == FIXTURE_SPONSORS + SEEDED_SPONSORS
      and body["total_booths"] == SEEDED_BOOTHS
      and body["total_sponsors"] + body["total_booths"] == body["total_tenants"])
check("overview: the suite's 3 attendees on top of the export, every exhibitor, 2 visits",
      status == 200 and body["total_members"] == SEEDED_MEMBERS + 3
      and body["total_tenants"] == FIXTURE_TENANTS and body["total_visits"] == 2,
      f'{body["total_members"]} vs {SEEDED_MEMBERS} + 3')

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
status, _ = login("booth-z01@natcon.id", booth_password("E2E Booth", "Z-01"))
check("auto booth login works on its derived password", status == 200)
status, body, _ = req("GET", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok)
check("tenant detail 200", status == 200 and body["tenant"]["owner_email"] == "booth-z01@natcon.id")

# A booth shows its own logo on the passport; the initials are the fallback,
# so the field has to survive an edit like every other one.
status, _, _ = req("PUT", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok,
                   body={"name": "E2E Booth", "category": "Uji", "booth": "Z-01",
                         "logo_url": "/uploads/e2e-logo.png"})
status, body, _ = req("GET", "/api/v1/admin/tenants", token=admin_tok)
z01 = next(t for t in body["tenants"] if t["booth"] == "Z-01")
check("a booth logo round-trips through the admin list", z01["logo_url"] == "/uploads/e2e-logo.png",
      f'got {z01.get("logo_url")!r}')

status, body, _ = req("GET", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok)
check("...and through the detail page", body["tenant"]["logo_url"] == "/uploads/e2e-logo.png")

status, body, _ = req("GET", "/api/v1/tenants", token=member_tok)
passport = next(t for t in body["tenants"] if t["booth"] == "Z-01")
check("...and reaches the attendee passport", passport["logo_url"] == "/uploads/e2e-logo.png")
check("booths without a logo still send their initials",
      all(t["initials"] for t in body["tenants"] if not t["logo_url"]))

# Saving the form again without touching the logo must not wipe it — the
# same trap that once blanked class descriptions.
status, _, _ = req("PUT", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok,
                   body={"name": "E2E Booth", "category": "Uji", "booth": "Z-01",
                         "logo_url": "/uploads/e2e-logo.png", "description": "with a description"})
status, body, _ = req("GET", f"/api/v1/admin/tenants/{new_tenant_id}", token=admin_tok)
check("editing another field keeps the logo",
      body["tenant"]["logo_url"] == "/uploads/e2e-logo.png"
      and body["tenant"]["description"] == "with a description")

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

# ---- table names and the committee's view of the seating (MoM 19 Aug 2026)
first_table = body["tables"][0]
status, _, _ = req("PUT", f"/api/v1/admin/tables/{first_table['id']}", token=admin_tok,
                   body={"name": "Startup Corner", "hall": first_table["hall"],
                         "capacity": first_table["capacity"]})
check("a table can be named", status == 200)

status, body, _ = req("GET", "/api/v1/admin/tables", token=admin_tok)
named = next(t for t in body["tables"] if t["id"] == first_table["id"])
check("the name comes back on the table", named["name"] == "Startup Corner")
check("tables nobody named stay empty-named, not null",
      all(isinstance(t["name"], str) for t in body["tables"]))

status, body, _ = req("GET", "/api/v1/networking", token=member_tok)
listed = next(t for t in body["tables"] if t["table_no"] == named["table_no"])
check("attendees see the name too", listed["name"] == "Startup Corner")

# The seating only exists in the attendees' phones otherwise.
status, body, _ = req("GET", "/api/v1/admin/tables/seats", token=admin_tok)
check("the committee can see who is seated where", status == 200)
before = [s for s in body["seats"] if s["table_no"] == named["table_no"]]
check("...and that table is empty until somebody sits at it", before == [], f"{before}")

status, _, _ = req("POST", "/api/v1/networking/checkin", token=member_tok,
                   body={"table_no": named["table_no"]})
status, body, _ = req("GET", "/api/v1/admin/tables/seats", token=admin_tok)
mine = [s for s in body["seats"] if s["table_no"] == named["table_no"]]
check("a fresh check-in shows up in the committee's view", len(mine) == 1, f"{body['seats']}")
check("...with the table's name, the seat, and who they are",
      mine[0]["table_name"] == "Startup Corner" and mine[0]["seat_no"] >= 1
      and mine[0]["member_code"] and mine[0]["chapter"], f"{mine[0]}")

status, _, _ = req("GET", "/api/v1/admin/tables/seats", token=member_tok)
check("an attendee cannot read the whole room's seating", status == 403)

# ---- banner and poster are two pictures, not one cropped twice
status, body, _ = req("GET", "/api/v1/admin/seminars", token=admin_tok)
first = body["seminars"][0]
payload = {k: first[k] for k in
           ("slot", "room", "title", "speaker", "moderator", "capacity", "description")}
payload["cover_url"] = "/uploads/banner.jpg"
payload["poster_url"] = "/uploads/poster.jpg"
payload["speakers"] = first.get("speakers") or []
status, _, _ = req("PUT", f"/api/v1/admin/seminars/{first['id']}", token=admin_tok, body=payload)
check("a class takes both a banner and a poster", status == 200)

status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
shown = next(s for s in body["seminars"] if s["id"] == first["id"])
check("the attendee app gets both, not one",
      shown["cover_url"] == "/uploads/banner.jpg" and shown["poster_url"] == "/uploads/poster.jpg",
      f"{shown.get('cover_url')} / {shown.get('poster_url')}")

# Saving the class again without mentioning the poster must not wipe it.
payload["poster_url"] = "/uploads/poster.jpg"
payload["description"] = "edited"
status, _, _ = req("PUT", f"/api/v1/admin/seminars/{first['id']}", token=admin_tok, body=payload)
status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
shown = next(s for s in body["seminars"] if s["id"] == first["id"])
check("editing the class keeps both pictures",
      shown["cover_url"] == "/uploads/banner.jpg" and shown["poster_url"] == "/uploads/poster.jpg")

# ---- two learning classes, never at the same hour (MoM 19 Aug 2026)
section("Learning classes: two each, no clashes")

D2, TZ2 = "2026-09-03", "+07:00"
blocks = {}
for label, start in (("early", "13:00"), ("late", "15:00")):
    status, body, _ = req("POST", "/api/v1/admin/rundown", token=admin_tok,
                          body={"starts_at": f"{D2}T{start}:00{TZ2}", "kind": "learning",
                                "title": f"Learning Class ({label})"})
    blocks[label] = body["block"]["id"]

status, body, _ = req("GET", "/api/v1/admin/seminars", token=admin_tok)
classes = body["seminars"][:4]
check("the event has classes to place", len(classes) == 4)


def place(sem, block_id):
    payload = {k: sem[k] for k in
               ("slot", "room", "title", "speaker", "moderator", "capacity", "description",
                "cover_url")}
    payload["rundown_id"] = block_id
    payload["speakers"] = sem.get("speakers") or []
    return req("PUT", f"/api/v1/admin/seminars/{sem['id']}", token=admin_tok, body=payload)


for sem, block in zip(classes, ("early", "early", "late", "late")):
    place(sem, blocks[block])

status, body, _ = req("GET", "/api/v1/seminars", token=member_tok)
placed = {s["room"]: s for s in body["seminars"]}
check("a class carries the hour of its block",
      placed[classes[0]["room"]]["starts_at"].startswith(f"{D2}T13:00:00"))
check("...and the attendee app can show it", "ends_at" in placed[classes[0]["room"]])

# This attendee already holds a class from the fixtures section; start clean.
for sem in classes:
    req("DELETE", f"/api/v1/seminars/{sem['id']}/register", token=member_tok)

status, _, _ = req("POST", f"/api/v1/seminars/{classes[0]['id']}/register", token=member_tok)
check("first class accepted", status == 201)

status, body, _ = req("POST", f"/api/v1/seminars/{classes[1]['id']}/register", token=member_tok)
check("a second class at the same hour is refused",
      status == 409 and "same time" in body["error"], f"{status} {body}")

status, _, _ = req("POST", f"/api/v1/seminars/{classes[2]['id']}/register", token=member_tok)
check("a class at a different hour is accepted", status == 201)

status, body, _ = req("POST", f"/api/v1/seminars/{classes[3]['id']}/register", token=member_tok)
check("a third class is refused whatever the hour",
      status == 409 and "limit" in body["error"], f"{status} {body}")

status, _, _ = req("DELETE", f"/api/v1/seminars/{classes[2]['id']}/register", token=member_tok)
status, _, _ = req("POST", f"/api/v1/seminars/{classes[3]['id']}/register", token=member_tok)
check("cancelling one frees the place", status == 201)

# Leave this attendee where the rest of the suite expects to find them:
# registered for seminar 2, which the door check-in section scans them into.
for sem in classes:
    req("DELETE", f"/api/v1/seminars/{sem['id']}/register", token=member_tok)
status, _, _ = req("POST", f"/api/v1/seminars/{sem2}/register", token=member_tok)
check("the attendee is back on their original class", status == 201)

# ---- the door crew's own account (MoM 19 Aug 2026)
section("Door accounts do one job")

status, body = login("door@natcon.id")
check("a fresh database has a door account", status == 200 and body["user"]["role"] == "door")
door_tok = body["token"]

# What the door crew is for.
status, _, _ = req("GET", "/api/v1/admin/seminars", token=door_tok)
check("the door crew can list the classes", status == 200)
status, body, _ = req("GET", "/api/v1/admin/redeem/counts", token=door_tok)
check("...and see what has been handed over", status == 200 and "goodiebags" in body)
status, body, _ = req("POST", "/api/v1/admin/redeem", token=door_tok,
                      body={"member_code": "agus@natcon.id", "item": "goodiebag"})
check("...and hand over a goodiebag", status == 200, f"{status} {body}")

# Everything else is the committee's, which is the reason this account exists.
for label, method, path in [
    ("the attendee list", "GET", "/api/v1/admin/members"),
    ("booth master data", "GET", "/api/v1/admin/tenants"),
    ("the draws", "GET", "/api/v1/admin/draws"),
    ("drawing a winner", "POST", "/api/v1/admin/draws/lucky/pick"),
    ("the rundown editor", "POST", "/api/v1/admin/rundown"),
    ("the dashboard", "GET", "/api/v1/admin/overview"),
    ("who is seated", "GET", "/api/v1/admin/tables/seats"),
]:
    status, _, _ = req(method, path, token=door_tok, body={} if method == "POST" else None)
    check(f"a door account cannot reach {label}", status == 403, f"got {status}")

status, _, _ = req("GET", "/api/v1/admin/seminars", token=member_tok)
check("an attendee still cannot list the classes as staff", status == 403)

# ---- the two draws (MoM 19 Aug 2026)
section("Lucky Draw and Doorprize")

status, body, _ = req("GET", "/api/v1/admin/draws", token=admin_tok)
check("there are two draws, not one",
      status == 200 and {d["key"] for d in body["draws"]} == {"lucky", "doorprize"})
check("both start with no condition and no winners",
      all(d["min_booth_visits"] == 0 and d["winner_count"] == 0 for d in body["draws"]))

status, body, _ = req("GET", "/api/v1/admin/draws/lucky", token=admin_tok)
everyone = len(body["eligible"])
check("with no condition, every attendee is in the draw", everyone >= 3, f"{everyone}")

# member_tok's attendee has scans from the booth section; the others do not.
status, _, _ = req("PUT", "/api/v1/admin/draws/lucky/minimum", token=admin_tok,
                   body={"min_booth_visits": 1})
status, body, _ = req("GET", "/api/v1/admin/draws/lucky", token=admin_tok)
check("a minimum of one booth thins the pool",
      0 < len(body["eligible"]) < everyone, f'{len(body["eligible"])} of {everyone}')
check("...and everyone left has actually visited one",
      all(e["visits"] >= 1 for e in body["eligible"]))

status, _, _ = req("PUT", "/api/v1/admin/draws/lucky/minimum", token=admin_tok,
                   body={"min_booth_visits": 999})
status, body, _ = req("GET", "/api/v1/admin/draws/lucky", token=admin_tok)
check("an impossible minimum empties it", body["eligible"] == [])
status, body, _ = req("POST", "/api/v1/admin/draws/lucky/pick", token=admin_tok)
check("drawing from an empty pool says so", status == 409 and "nobody left" in body["error"])

status, _, _ = req("PUT", "/api/v1/admin/draws/lucky/minimum", token=admin_tok,
                   body={"min_booth_visits": 0})
status, body, _ = req("POST", "/api/v1/admin/draws/lucky/pick", token=admin_tok)
check("a winner is drawn and recorded", status == 201 and body["winner"]["position"] == 1)
first_winner = body["winner"]["member_id"]

# The whole point of recording it server-side: a reload cannot lose this.
status, body, _ = req("GET", "/api/v1/admin/draws/lucky", token=admin_tok)
check("the winner survives a page reload",
      [w["member_id"] for w in body["winners"]] == [first_winner])
check("...and leaves the pool", all(e["member_id"] != first_winner for e in body["eligible"]))

status, body, _ = req("GET", "/api/v1/admin/draws/doorprize", token=admin_tok)
check("winning the lucky draw takes you out of the doorprize too",
      all(e["member_id"] != first_winner for e in body["eligible"]))
check("but the doorprize has its own, empty, winners list", body["winners"] == [])

status, body, _ = req("POST", "/api/v1/admin/draws/doorprize/pick", token=admin_tok)
check("the doorprize draws its own winner", status == 201)
check("...who is not the lucky draw's", body["winner"]["member_id"] != first_winner)

status, body, _ = req("GET", "/api/v1/admin/draws", token=admin_tok)
counts = {d["key"]: d["winner_count"] for d in body["draws"]}
check("each draw counts its own winners", counts == {"lucky": 1, "doorprize": 1}, f"{counts}")

status, _, _ = req("PUT", "/api/v1/admin/draws/lucky/minimum", token=admin_tok,
                   body={"min_booth_visits": -1})
check("a negative minimum is refused", status == 400)
status, _, _ = req("POST", "/api/v1/admin/draws/grand/pick", token=admin_tok)
check("a draw that does not exist is refused", status == 400)
status, _, _ = req("POST", "/api/v1/admin/draws/lucky/pick", token=member_tok)
check("an attendee cannot draw their own name", status == 403)

status, _, _ = req("DELETE", "/api/v1/admin/draws/lucky/winners", token=admin_tok)
status, body, _ = req("GET", "/api/v1/admin/draws/lucky", token=admin_tok)
check("winners can be cleared for a rehearsal", body["winners"] == [])
status, _, _ = req("DELETE", "/api/v1/admin/draws/doorprize/winners", token=admin_tok)

# ---- the networking round (MoM 19 Aug 2026)
status, body, _ = req("GET", "/api/v1/networking/session", token=member_tok)
check("before anyone starts a round, nothing is running",
      status == 200 and body["running"] is False and "server_now" in body)

status, body, _ = req("POST", "/api/v1/admin/networking/session/start", token=admin_tok,
                      body={"minutes": 15})
check("the committee starts a round", status == 201 and body["running"] is True and body["round"] >= 1)
round_ends = body["ends_at"]

status, body, _ = req("GET", "/api/v1/networking/session", token=member_tok)
check("every attendee reads the same end time", body["ends_at"] == round_ends)
check("...and the same round number", body["round"] >= 1 and body["running"] is True)

# Reading it again is what a refresh does. The old browser timer restarted
# here; the end time must not move.
status, body2, _ = req("GET", "/api/v1/networking/session", token=member_tok)
check("a refresh does not restart the round", body2["ends_at"] == round_ends)

status, body, _ = req("GET", "/api/v1/networking/session", token=tenant_tok)
check("booth crews can see the round too", status == 200 and body["ends_at"] == round_ends)

status, body, _ = req("POST", "/api/v1/admin/networking/session/start", token=admin_tok,
                      body={"minutes": 10})
check("starting the next round replaces the old one, never runs two",
      status == 201 and body["round"] >= 2 and body["ends_at"] != round_ends)
second_round = body["round"]

status, body, _ = req("GET", "/api/v1/networking/session", token=member_tok)
check("attendees follow to the new round", body["round"] == second_round)

status, body, _ = req("POST", "/api/v1/admin/networking/session/stop", token=admin_tok)
check("stopping ends it for everyone", status == 200 and body["running"] is False)
status, body, _ = req("GET", "/api/v1/networking/session", token=member_tok)
check("...and the attendee sees a stopped clock", body["running"] is False)

status, _, _ = req("POST", "/api/v1/admin/networking/session/stop", token=admin_tok)
check("stopping when nothing runs is not an error", status == 200)

status, _, _ = req("POST", "/api/v1/admin/networking/session/start", token=admin_tok,
                   body={"minutes": 999})
check("a three-hour-plus round is refused as a typo", status == 400)

status, _, _ = req("POST", "/api/v1/admin/networking/session/start", token=member_tok,
                   body={"minutes": 15})
check("an attendee cannot start the round", status == 403)

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
# Booth A1 already exists from migration 0023, so re-importing the sheet the
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

# A refresh keeps the login AND the password it was created with — derived
# from the ORIGINAL name, because the crew's briefing sheet was printed then.
status, _ = login("booth-z01@natcon.id", booth_password("E2E Booth", "Z-01"), xff="10.99.0.2")
check("refreshed booth keeps its scanner login and original password", status == 200)
status, _ = login("booth-sp99@natcon.id", booth_password("Bulk Sponsor", "SP-99"), xff="10.99.0.3")
check("imported booth gets an auto scanner login on its derived password", status == 200)

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

def upload_raw(filename, content_type, payload):
    """Returns (status, error message) for a multipart upload."""
    body, ct = multipart("file", filename, content_type, payload)
    r = urllib.request.Request(BASE + "/api/v1/admin/uploads", data=body, method="POST")
    r.add_header("Content-Type", ct)
    r.add_header("Authorization", f"Bearer {admin_tok}")
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, ""
    except urllib.error.HTTPError as e:
        try:
            return e.code, (json.loads(e.read()) or {}).get("error", "")
        except json.JSONDecodeError:
            return e.code, ""


# 415, not 400: the request was fine, the file simply is not an image the
# browser can show — and the message has to say what to do about it.
bad_status, bad_msg = upload_raw("notes.txt", "text/plain", b"just text, not an image")
check("non-image upload rejected -> 415", bad_status == 415, f"got {bad_status}")
check("...and the message says what is accepted", "JPG, PNG, WEBP or GIF" in bad_msg, bad_msg)

# The photo a committee member is most likely to pick first.
heic_status, heic_msg = upload_raw("photo.heic", "image/heic",
                                   b"\x00\x00\x00\x18ftypheic" + b"\x00" * 256)
check("an iPhone HEIC photo is named as such, not 'invalid'",
      heic_status == 415 and "HEIC" in heic_msg, f"{heic_status} {heic_msg}")

big_status, big_msg = upload_raw("huge.jpg", "image/jpeg",
                                 b"\xff\xd8\xff\xe0" + b"\x00" * (6 << 20))
check("an oversized image -> 413 with the limit spelled out",
      big_status == 413 and "5 MB" in big_msg, f"{big_status} {big_msg}")

# An import past the body cap used to be reported as "the list is empty",
# which sends the committee looking at the wrong end of the problem.
fat_rows = [{"name": f"Row {i}", "email": f"fat{i}@natcon.id", "chapter": "Fat",
             "company": "X" * 3000} for i in range(900)]
status, body, _ = req("POST", "/api/v1/admin/members/bulk", token=admin_tok,
                      body={"members": fat_rows})
check("an import past the body cap -> 413, not a confusing 400",
      status == 413 and "smaller batches" in (body or {}).get("error", ""),
      f"{status} {body}")

status, body, _ = req("POST", "/api/v1/admin/members", token=admin_tok, raw_body=b"")
check("an empty body says it arrived empty",
      status == 400 and "empty" in (body or {}).get("error", ""), f"{status} {body}")

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
                          {"member": "agus@natcon.id", "room": "Learning Class 3"},
                          {"member": "sinta@natcon.id", "room": "Learning Class 3"},
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

# The desk searches the person, not the class: the attendee's own detail page
# carries each registration's seminar id, so a cancel can start from there.
status, body, _ = req("GET", "/api/v1/admin/members?q=sinta@natcon.id", token=admin_tok)
sid = body["members"][0]["id"]
status, body, _ = req("GET", f"/api/v1/admin/members/{sid}", token=admin_tok)
check("the attendee detail names the class a cancel would hit",
      status == 200 and any(r.get("seminar_id") == sem3 for r in body["registrations"]),
      f'{body.get("registrations")}')
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

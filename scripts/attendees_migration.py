#!/usr/bin/env python3
"""Turn the ticketing export into the attendee seed migration.

    pip install openpyxl bcrypt
    python3 scripts/attendees_migration.py "~/Downloads/Data Peserta ... .xlsx"

Writes backend/internal/repository/postgres/migrations/0028_attendees.sql.

WHY THIS FILE IS NOT COMMITTED
------------------------------
The output carries 769 people's names, emails, phone numbers, companies and
chapters. This repository is public, and git history is forever — so the
generated .sql is gitignored on purpose. Generate it where you deploy from,
or apply it straight to the database:

    psql "$DATABASE_URL" -f backend/internal/repository/postgres/migrations/0028_attendees.sql

If the committee makes the repository private, drop the gitignore line and the
file rides along with every deploy like the booth migration does.

WHAT IT WRITES
--------------
· every chapter the sheet mentions, so the master list matches the sheet;
· one member per TICKET — the ticket number is the identity, and it is what
  the attendee's QR carries. A buyer holding several tickets becomes several
  attendees, which is the point: they are several people.
· the password each attendee is told on their ticket — chapter + first name,
  lowercase, no spaces — hashed here rather than at startup, because 769
  bcrypt hashes would add a minute to every boot. must_set_password stays
  true, so the app still makes them choose their own on first sign-in.

Re-running is safe: a ticket already in the database is left alone, keeping
its password, its booth stamps and its class registrations.
"""

import argparse
import pathlib
import re
import sys
import unicodedata

import bcrypt
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "backend/internal/repository/postgres/migrations/0028_attendees.sql"

COLUMNS = {
    "ticket": "Ticket Number",
    "session": "Sesi Berlaku (WIB)",
    "first": "First Name",
    "last": "Last Name",
    "email": "Email",
    "phone": "Phone",
    "company": "Company Name",
    "chapter": "Bni Chapter",
    "classification": "Business Classification",
}


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def normalize_phone(raw: str) -> str:
    """Mirror of normalizePhone in admin/src/excel.js — the sheet writes
    numbers as text with Excel's leading apostrophe."""
    p = re.sub(r"[\s.\-()]", "", raw.strip().lstrip("'"))
    if not p:
        return ""
    if p.startswith("+"):
        return "+" + re.sub(r"\D", "", p[1:])
    p = re.sub(r"\D", "", p)
    if p.startswith("0"):
        return "+62" + p[1:]
    if p.startswith("62"):
        return "+" + p
    return p


def first_password(chapter: str, name: str) -> str:
    """chapter + first name, lowercase, no spaces — what the ticket says."""
    first = name.split()[0] if name.split() else ""
    raw = f"{chapter}{first}"
    raw = unicodedata.normalize("NFKD", raw)
    return re.sub(r"\s+", "", raw).lower()


def read_rows(path: pathlib.Path, skip_day_two: bool):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip() if h else "" for h in rows[0]]
    ix = {}
    for key, column in COLUMNS.items():
        if column not in header:
            sys.exit(f"column {column!r} missing — got {header}")
        ix[key] = header.index(column)

    out, seen = [], set()
    for r in rows[1:]:
        def cell(key):
            v = r[ix[key]]
            return str(v).strip() if v is not None else ""

        ticket, email = cell("ticket"), cell("email").lower()
        if not ticket or not email:
            continue
        if skip_day_two and not cell("session").startswith("03"):
            continue
        if ticket in seen:
            continue
        seen.add(ticket)
        name = " ".join(x for x in (cell("first"), cell("last")) if x)
        chapter = cell("chapter")
        out.append({
            "ticket": ticket,
            "name": name,
            "email": email,
            "phone": normalize_phone(cell("phone")),
            "company": cell("company"),
            "chapter": chapter,
            "classification": cell("classification"),
            "password": first_password(chapter, name),
        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("sheet")
    ap.add_argument("--skip-day-two", action="store_true",
                    help="leave out the 4 September tickets (Gold Club Breakfast); "
                         "every one of them belongs to somebody who already holds a "
                         "3 September ticket, so seeding both gives that person two accounts")
    ap.add_argument("--cost", type=int, default=10, help="bcrypt cost (default 10, same as the API)")
    args = ap.parse_args()

    people = read_rows(pathlib.Path(args.sheet).expanduser(), args.skip_day_two)
    if not people:
        sys.exit("no attendee rows found")

    print(f"hashing {len(people)} passwords at cost {args.cost} — this takes a minute…")
    for i, p in enumerate(people, 1):
        p["hash"] = bcrypt.hashpw(p["password"].encode(), bcrypt.gensalt(args.cost)).decode()
        if i % 100 == 0:
            print(f"  {i}/{len(people)}")

    chapters = sorted({p["chapter"] for p in people if p["chapter"]})
    chapter_values = ",\n".join(f"    ({q(c)})" for c in chapters)
    people_values = ",\n".join(
        "    (" + ", ".join(q(p[k]) for k in
        ("ticket", "name", "email", "phone", "company", "chapter", "classification", "hash")) + ")"
        for p in people)

    sql = f"""-- The {len(people)} attendees of the ticketing export.
-- GENERATED by scripts/attendees_migration.py — edit the sheet, not this file.
--
-- One member per TICKET: the ticket number is the identity, and it is what
-- the attendee's QR carries. A buyer holding several tickets becomes several
-- attendees, because they are several people.
--
-- Passwords are the ones printed on the ticket — chapter + first name,
-- lowercase without spaces — hashed here rather than at boot, because {len(people)}
-- bcrypt hashes would add a minute to every start. must_set_password stays
-- true, so the app still makes each attendee choose their own on first
-- sign-in.
--
-- Idempotent: a ticket already in the database is left exactly as it is,
-- keeping its password, its booth stamps and its class registrations.

INSERT INTO chapters (name)
SELECT v.name FROM (VALUES
{chapter_values}
) AS v (name)
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (name, email, password_hash, role, member_code, chapter, company,
                   phone, classification, must_set_password, ticket_number)
SELECT v.name, v.email, v.hash, 'member',
       'NATCON-2026-' || lpad(nextval('member_code_seq')::text, 5, '0'),
       v.chapter, v.company, v.phone, v.classification, true, v.ticket
FROM (VALUES
{people_values}
) AS v (ticket, name, email, phone, company, chapter, classification, hash)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.ticket_number = v.ticket);
"""
    OUT.write_text(sql, encoding="utf-8")
    size = OUT.stat().st_size // 1024
    print(f"{OUT.relative_to(ROOT)} — {len(people)} attendees, {len(chapters)} chapters, {size} KB")
    print("NOTE: gitignored on purpose — this file carries personal data and the repo is public.")


if __name__ == "__main__":
    main()

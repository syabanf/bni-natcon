#!/usr/bin/env python3
"""Turn the ticketing export into the attendee seed migration.

    pip install openpyxl bcrypt
    python3 scripts/attendees_migration.py "~/Downloads/Data Peserta & Booth ... .xlsx"

Writes backend/internal/repository/postgres/migrations/0034_attendees.sql.

WHAT IT WRITES
--------------
· every chapter the sheet mentions, so the master list matches the sheet;
· one member per TICKET — the ticket number is the identity, and it is what
  the attendee's QR carries. A buyer holding several tickets becomes several
  attendees, which is the point: a booth owner buying four crew passes is
  four people through the door, and the sheet never collected the crew's
  names;
· the password each attendee is told on their ticket — chapter + first name,
  lowercase, no spaces — hashed here rather than at startup, because a
  thousand bcrypt hashes would add a minute to every boot. must_set_password
  stays true, so the app still makes them choose their own on first sign-in.

THE COMPANY COLUMN
------------------
The committee's newer export dropped Company Name and put Business
Classification and Industry in its place. A company already known for a
ticket is carried across from scripts/attendee-companies.json rather than
thrown away; someone registering for the first time simply has no company on
file, and the field stays empty. Nothing is guessed — a classification is not
an employer, and inventing one would put a wrong name on a booth's lead sheet.

Re-running is safe: a ticket already in the database is left exactly as it is,
keeping its password, its booth stamps and its class registrations. A ticket
that has LEFT the sheet is deleted, but only when that attendee has no scans,
no class seat and no check-in against their name — a database in use is never
quietly emptied.
"""

import argparse
import json
import pathlib
import re
import sys
import unicodedata

import bcrypt
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "backend/internal/repository/postgres/migrations/0034_attendees.sql"
COMPANIES = ROOT / "scripts/attendee-companies.json"

COLUMNS = {
    "ticket": "Ticket Number",
    "first": "First Name",
    "last": "Last Name",
    "email": "Email",
    "phone": "Phone",
    "chapter": "Bni Chapter",
    "classification": "Business Classification",
}


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def name_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name or "").lower())


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
    raw = unicodedata.normalize("NFKD", f"{chapter}{first}")
    return re.sub(r"\s+", "", raw).lower()


def read_rows(path: pathlib.Path, sheet_name: str):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip() if h else "" for h in rows[0]]
    ix = {}
    for key, column in COLUMNS.items():
        if column not in header:
            sys.exit(f"column {column!r} missing from sheet {ws.title!r} — got {header}")
        ix[key] = header.index(column)

    known = json.loads(COMPANIES.read_text(encoding="utf-8")) if COMPANIES.exists() else {}
    by_ticket, by_name = known.get("by_ticket", {}), known.get("by_name", {})

    out, seen, carried = [], set(), [0, 0]
    for r in rows[1:]:
        def cell(key):
            v = r[ix[key]]
            return str(v).strip() if v is not None else ""

        ticket, email = cell("ticket"), cell("email").lower()
        if not ticket or not email or ticket in seen:
            continue
        seen.add(ticket)
        name = " ".join(x for x in (cell("first"), cell("last")) if x)
        chapter = cell("chapter")
        company = by_ticket.get(ticket, "")
        if company:
            carried[0] += 1
        else:
            company = by_name.get(name_key(name), "")
            if company:
                carried[1] += 1
        out.append({
            "ticket": ticket,
            "name": name,
            "email": email,
            "phone": normalize_phone(cell("phone")),
            "company": company,
            "chapter": chapter,
            "classification": cell("classification"),
            "password": first_password(chapter, name),
        })
    return out, carried


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("sheet")
    ap.add_argument("--sheet-name", default="Data Peserta",
                    help="worksheet holding the attendee list (default: Data Peserta)")
    ap.add_argument("--cost", type=int, default=10, help="bcrypt cost (default 10, same as the API)")
    args = ap.parse_args()

    people, carried = read_rows(pathlib.Path(args.sheet).expanduser(), args.sheet_name)
    if not people:
        sys.exit("no attendee rows found")

    print(f"hashing {len(people)} passwords at cost {args.cost} — this takes a minute…")
    for i, p in enumerate(people, 1):
        p["hash"] = bcrypt.hashpw(p["password"].encode(), bcrypt.gensalt(args.cost)).decode()
        if i % 200 == 0:
            print(f"  {i}/{len(people)}")

    chapters = sorted({p["chapter"] for p in people if p["chapter"]})
    chapter_values = ",\n".join(f"    ({q(c)})" for c in chapters)
    people_values = ",\n".join(
        "    (" + ", ".join(q(p[k]) for k in
        ("ticket", "name", "email", "phone", "company", "chapter", "classification", "hash")) + ")"
        for p in people)
    ticket_values = ",\n".join(f"    ({q(p['ticket'])})" for p in people)
    no_company = sum(1 for p in people if not p["company"])

    sql = f"""-- The {len(people)} attendees of the ticketing export.
-- GENERATED by scripts/attendees_migration.py — edit the sheet, not this file.
--
-- This replaces the earlier attendee migration, which was built from an
-- export that listed the 4 September Gold Club tickets as separate rows. Every
-- one of those belonged to somebody who already held a 3 September ticket, so
-- seeding both gave that person two accounts; the newer export carries the
-- Gold Club as a ticket TYPE instead, one row per person per ticket.
--
-- One member per TICKET: the ticket number is the identity, and it is what
-- the attendee's QR carries. A buyer holding several tickets becomes several
-- attendees, because a booth owner buying four crew passes is four people
-- through the door and the sheet never collected the crew's names.
--
-- Passwords are the ones printed on the ticket — chapter + first name,
-- lowercase without spaces — hashed here rather than at boot, because {len(people)}
-- bcrypt hashes would add a minute to every start. must_set_password stays
-- true, so the app still makes each attendee choose their own on first
-- sign-in.
--
-- {len(people) - no_company} of these carry a company, brought across by ticket number from the
-- export that had a Company Name column; the newer one dropped it. The
-- remaining {no_company} have none on file. Business Classification is not an
-- employer, so nothing is guessed here.

INSERT INTO chapters (name)
SELECT v.name FROM (VALUES
{chapter_values}
) AS v (name)
ON CONFLICT (name) DO NOTHING;

-- Idempotent: a ticket already in the database is left exactly as it is,
-- keeping its password, its booth stamps and its class registrations.
INSERT INTO users (name, email, password_hash, role, member_code, chapter, company,
                   phone, classification, must_set_password, ticket_number)
SELECT v.name, v.email, v.hash, 'member',
       'NATCON-2026-' || lpad(nextval('member_code_seq')::text, 5, '0'),
       v.chapter, v.company, v.phone, v.classification, true, v.ticket
FROM (VALUES
{people_values}
) AS v (ticket, name, email, phone, company, chapter, classification, hash)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.ticket_number = v.ticket);

-- A ticket that has left the sheet goes with it — that is how the duplicate
-- Gold Club accounts are cleared. Only when the attendee has nothing against
-- their name: one scan, one class seat or one check-in and the row stays, so
-- a database in use is never quietly emptied. Every table that references a
-- member cascades on delete, which is exactly why each is checked here.
DELETE FROM users u
WHERE u.role = 'member'
  AND u.ticket_number <> ''
  AND NOT EXISTS (
      SELECT 1 FROM (VALUES
{ticket_values}
      ) AS v (ticket) WHERE v.ticket = u.ticket_number)
  AND NOT EXISTS (SELECT 1 FROM visits x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM seminar_registrations x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM seminar_attendance x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM networking_checkins x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM draw_winners x WHERE x.member_id = u.id);
"""
    OUT.write_text(sql, encoding="utf-8")
    size = OUT.stat().st_size // 1024
    print(f"{OUT.relative_to(ROOT)} — {len(people)} attendees, {len(chapters)} chapters, {size} KB")
    print(f"  company: {carried[0]} carried by ticket, {carried[1]} by name, {no_company} left empty")


if __name__ == "__main__":
    main()

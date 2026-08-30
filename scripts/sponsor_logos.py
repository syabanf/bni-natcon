#!/usr/bin/env python3
"""Turn the committee's sponsor packs into the files the apps ship.

    pip install pillow
    python3 scripts/sponsor_logos.py \
        "~/Downloads/1 Diamond Sponsorship" \
        "~/Downloads/2 Platinum Sponsorship" \
        "~/Downloads/3 Supported by"

Folders are read in the order given, and that order IS the tier: the first
folder is Diamond, the second Platinum, the third the supporters. The tier
decides where a sponsor sits on the wall, so it is worth being explicit —
pass --tier to override the name taken from the folder.

Writes frontend/public/sponsors/<company-slug>.png, mirrors them to the admin
app, and prints the VALUES block for the migration.

The image work — trimming to the mark's own edges, one shared canvas, a dark
plate under a logo that is white on transparent — is booth_logos.py's, reused
rather than reimplemented. A sponsor logo lands on the same white surfaces a
booth logo does.

SPONSORS ARE NOT EXHIBITORS. Most of these have no stand and no scanner: they
are a credits wall, not part of the passport. Two of them (Parahita, Royal
Medicalink) also hold a booth, and appear in both places — which is what
sponsoring and exhibiting at the same event looks like.
"""

import argparse
import pathlib
import re
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from booth_logos import process, slug  # noqa: E402  (same folder, shared image work)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend/public/sponsors"
MIRROR = ROOT / "admin/public/sponsors"

# Folder name -> the tier stored in the database. Anything else falls back to
# the supporter tier, which is the one with no badge on it.
TIERS = [("diamond", "Diamond"), ("platinum", "Platinum"), ("supported", "Supported by")]


def tier_of(folder: str) -> tuple:
    low = folder.lower()
    for key, label in TIERS:
        if key in low:
            return key, label
    return "supported", "Supported by"


def company_of(path: pathlib.Path) -> str:
    """'Diamond Sponsor 1 - ZOHO.png' -> 'ZOHO'; '6. cocomodo.png' -> 'cocomodo'.

    The packs number their files and sometimes name the member who sent the
    artwork; neither belongs in a company name on a sponsor wall.
    """
    name = path.stem
    # Underscores become spaces FIRST: an underscore is a word character, so
    # "LOGO_GLO_4_transp" hides every word from a \b pattern until it is split.
    name = re.sub(r"[_]+", " ", name)
    name = re.sub(r"^\d+[.\-]?\s*", "", name)                      # "6. "
    name = re.sub(r"^(Diamond|Platinum)\s+Sponsor\s*\d*\s*-\s*", "", name, flags=re.I)
    name = re.sub(r"\s*[-–]\s*Logo\s+(Pak|Bu|Ibu|Mas|Mbak)\b.*$", "", name, flags=re.I)
    name = re.sub(r"\s*\((?:\d+|bu [^)]*|pak [^)]*)\)\s*", " ", name, flags=re.I)
    name = re.sub(r"\b(logo|transp|colour|color|black)\b", " ", name, flags=re.I)
    # A trailing number is the pack's own versioning ("ACTION COACH 2",
    # "Jclass 1"), never part of a company name.
    name = re.sub(r"\s+\d+\s*$", "", name)
    name = re.sub(r"\s{2,}", " ", name).strip(" -–_")
    return name or path.stem


def q(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("folders", nargs="+")
    ap.add_argument("--tier", action="append", default=[],
                    help="override the tier for the folder at this position")
    args = ap.parse_args()

    for d in (OUT, MIRROR):
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.png"):
            old.unlink()

    rows, seen = [], {}
    for i, folder in enumerate(args.folders):
        src = pathlib.Path(folder).expanduser()
        if not src.is_dir():
            sys.exit(f"not a folder: {src}")
        key, label = tier_of(args.tier[i] if i < len(args.tier) else src.name)
        files = sorted(f for f in src.rglob("*")
                       if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf"}
                       and not f.name.startswith("."))
        print(f"\n{label} — {len(files)} files from {src.name}")
        for f in files:
            company = company_of(f)
            s = slug(company)
            if s in seen:
                # The packs ship two takes of one logo (ACTION COACH 1 and 2).
                # The first is kept; a second file is not a second sponsor.
                print(f"  skip  {f.name}  (already have {seen[s]})")
                continue
            seen[s] = company
            dest = OUT / f"{s}.png"
            note = process(f, dest)
            shutil.copy2(dest, MIRROR / dest.name)
            rows.append((key, company, f"/sponsors/{s}.png"))
            print(f"  {company[:38]:<38} {note}")

    print(f"\n-- {len(rows)} sponsors\n")
    for i, (tier, company, url) in enumerate(rows):
        print(f"    ({q(tier)}, {q(company)}, {q(url)}, {i}),")


if __name__ == "__main__":
    main()

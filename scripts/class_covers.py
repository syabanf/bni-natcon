#!/usr/bin/env python3
"""Prepare the learning-class banners the committee's designer sends.

    pip install pillow
    python3 scripts/class_covers.py "~/Downloads/<the banner folder>"

Writes frontend/public/covers/<class>.jpg and copies them to
admin/public/covers/. The mapping is by SPEAKER: the files are named after
who is on them ("Ben Wirawan & Selina Nicole.png"), and each class is the one
those people are speaking at.

They arrive as 2000px PNGs of about 4.5 MB each — 18 MB for four pictures
that are shown 800px wide on a phone. A photograph on a red gradient is a
JPEG; at quality 82 the set lands near 600 KB with nothing visible lost.
"""

import pathlib
import shutil
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend/public/covers"
MIRROR = ROOT / "admin/public/covers"
MAX_WIDTH = 1400
QUALITY = 82

# Who speaks where, from the Term of Reference documents. The file names carry
# the speakers, not the class, so this is the join.
BY_SPEAKER = {
    "flavia": "learning-class-1.jpg",   # Navigating the Mid-Market HR Squeeze
    "viktor": "learning-class-2.jpg",   # Work-Life Balance & AI
    "irfan": "learning-class-2.jpg",
    "ben": "learning-class-3.jpg",      # How to Win in Retail
    "selina": "learning-class-3.jpg",
    "suntoro": "learning-class-4.jpg",  # Your Face Tells a Story
}


def target_for(name: str) -> str | None:
    low = name.lower()
    for speaker, dest in BY_SPEAKER.items():
        if speaker in low:
            return dest
    return None


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src_dir = pathlib.Path(sys.argv[1]).expanduser()
    files = sorted(p for p in src_dir.rglob("*")
                   if p.suffix.lower() in {".png", ".jpg", ".jpeg"} and not p.name.startswith("."))
    if not files:
        sys.exit(f"no images under {src_dir}")

    OUT.mkdir(parents=True, exist_ok=True)
    seen = {}
    for f in files:
        dest_name = target_for(f.name)
        if not dest_name:
            print(f"  ? {f.name} — no speaker in the name matches a class, skipped")
            continue
        if dest_name in seen:
            print(f"  ? {f.name} — {dest_name} already came from {seen[dest_name]}, skipped")
            continue
        seen[dest_name] = f.name

        im = Image.open(f).convert("RGB")
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
        dest = OUT / dest_name
        im.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        print(f"  {f.name[:40]:42} -> {dest_name:22} {im.size[0]}x{im.size[1]} "
              f"{f.stat().st_size // 1024}KB -> {dest.stat().st_size // 1024}KB")

    MIRROR.mkdir(parents=True, exist_ok=True)
    for p in OUT.glob("*.jpg"):
        shutil.copy(p, MIRROR / p.name)
    print(f"\n{len(seen)} covers in {OUT.relative_to(ROOT)} (mirrored to {MIRROR.relative_to(ROOT)})")


if __name__ == "__main__":
    main()

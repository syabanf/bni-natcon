#!/usr/bin/env python3
"""Turn the committee's booth-logo pack into the files the apps ship.

    pip install pillow
    python3 scripts/booth_logos.py "~/Downloads/Transp Booth Logo" \
        "~/Downloads/.../Platinum Sponsor 2 - PARAHITA.pdf" ...

Takes folders or single files; a PDF is rasterised through Quick Look.

Writes frontend/public/logos/<company-slug>.png and copies them to
admin/public/logos/, then prints the SQL mapping for the migration.

Named after the COMPANY, not the booth: the floor plan has been renumbered
once already, and a logo file that has to be renamed every time a stand moves
is a file that will one day point at the wrong company.

Each logo is trimmed to its own edges — the pack ships them centred on a
1080px square, which inside a 38px passport tile would leave the mark tiny —
and capped at 400px. A logo that is white on transparent gets a dark plate,
because every surface it lands on in these apps is white.
"""

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend/public/logos"
MIRROR = ROOT / "admin/public/logos"
# The passport tile is 38px tall and the admin list 36px, so 320 is already
# four times the pixels a retina phone can show. Every kilobyte here is
# downloaded by 769 people on a venue WiFi.
MAX_EDGE = 320
PLATE = (17, 19, 23, 255)


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).lower()
    s = re.sub(r"\b(pt|cv|tbk|pte|ltd|sdn|bhd)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return "-".join(s.split("-")[:3])


def parse(path: pathlib.Path):
    """'A20 - Paper.id.png' -> ('A20', 'Paper.id')."""
    stem = path.stem
    if " - " not in stem:
        return None, stem
    booth, company = stem.split(" - ", 1)
    return booth.strip(), company.strip()


# Under this much of the mark showing against white, the logo is invisible on
# the tile. Measured, not guessed: in the committee's pack the lowest is
# Paper.id at 23% — a blue ring around a white disc, which reads fine.
VISIBLE_ON_WHITE = 0.10


def needs_plate(im: Image.Image) -> bool:
    """True when the mark would all but vanish on a white tile.

    Only for a file with real transparency: a logo exported flat on white has
    a white BACKGROUND, not a white mark, and putting that on black would
    frame it in a box.
    """
    if im.getchannel("A").getextrema()[0] == 255:
        return False
    px = [(r, g, b) for r, g, b, a in im.convert("RGBA").getdata() if a > 40]
    if not px:
        return False
    visible = sum(1 for r, g, b in px if 0.2126 * r + 0.7152 * g + 0.0722 * b <= 200)
    return visible / len(px) < VISIBLE_ON_WHITE


def load(src: pathlib.Path) -> Image.Image:
    if src.suffix.lower() == ".pdf":
        # sips renders a PDF at 72dpi; Quick Look renders it at whatever size
        # you ask for.
        d = pathlib.Path(tempfile.mkdtemp())
        subprocess.run(["qlmanage", "-t", "-s", "1600", "-o", str(d), str(src)],
                       check=True, capture_output=True)
        return Image.open(next(d.glob("*.png")))
    return Image.open(src)


def smallest(im: Image.Image, dest: pathlib.Path) -> None:
    """Write whichever encoding is smaller — a flat logo usually survives 256
    colours untouched, and often at a third of the bytes."""
    im.save(dest, "PNG", optimize=True)
    plain = dest.stat().st_size
    try:
        quantized = im.quantize(colors=256, method=Image.FASTOCTREE)
    except ValueError:
        return
    tmp = dest.with_suffix(".q.png")
    quantized.save(tmp, "PNG", optimize=True)
    if tmp.stat().st_size < plain:
        tmp.replace(dest)
    else:
        tmp.unlink()


def process(src: pathlib.Path, dest: pathlib.Path) -> str:
    im = load(src).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box is None:
        # An opaque file (a JPEG, or a PDF page): trim the flat border it was
        # exported on instead, or the mark ends up a speck in a white field.
        from PIL import ImageChops
        flat = Image.new("RGB", im.size, im.convert("RGB").getpixel((0, 0)))
        box = ImageChops.difference(im.convert("RGB"), flat).getbbox()
    if box:
        im = im.crop(box)
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    if needs_plate(im):
        pad = max(12, im.size[1] // 6)
        plate = Image.new("RGBA", (im.size[0] + pad * 2, im.size[1] + pad * 2), PLATE)
        plate.alpha_composite(im, (pad, pad))
        im = plate
        note = " (dark plate — the mark is white)"
    else:
        note = ""
    smallest(im, dest)
    return f"{im.size[0]}x{im.size[1]} {dest.stat().st_size // 1024}KB{note}"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    files = []
    for arg in sys.argv[1:]:
        p = pathlib.Path(arg).expanduser()
        if p.is_dir():
            files += sorted(f for f in p.rglob("*")
                            if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf"}
                            and not f.name.startswith("."))
        elif p.exists():
            files.append(p)
        else:
            sys.exit(f"not found: {p}")
    if not files:
        sys.exit("no images found")

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()

    rows = []
    for f in files:
        booth, company = parse(f)
        dest = OUT / f"{slug(company)}.png"
        how = process(f, dest)
        rows.append((booth, company, dest.name))
        print(f"{booth or '?':8} {company[:38]:40} -> {dest.name:28} {how}")

    if MIRROR.exists():
        shutil.rmtree(MIRROR)
    shutil.copytree(OUT, MIRROR)

    print(f"\n{len(rows)} logos in {OUT.relative_to(ROOT)} (mirrored to {MIRROR.relative_to(ROOT)})\n")
    print("-- booth number from the pack, company name as the key:")
    width = max(len(c) for _, c, _ in rows) + 2
    for booth, company, fn in rows:
        name = ("'" + company.replace("'", "''") + "',").ljust(width + 2)
        print(f"    ({name} '/logos/{fn}'),  -- {booth}")


if __name__ == "__main__":
    main()

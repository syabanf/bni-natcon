#!/usr/bin/env python3
"""Build the landscape breakout-room covers from the speaker photos.

The card draws the cover as a 2:1 strip, so a portrait photo dropped in
as-is sits letterboxed between two flat bars. Every cover here fills the
frame instead, in one of two ways:

  fill  — scale to the banner's width and take a band across the face. Best
          when the source is roomy enough that the head survives the crop;
          it makes the face large on a 116px-tall strip.
  inset — the whole portrait at full height over a blurred, darkened copy of
          itself. For a tight headshot, where any 2:1 crop would slice the
          top of the head off.

    pip install pillow
    python3 scripts/make_covers.py path/to/unzipped-TOR-folders

Writes assets/covers/ and copies into each app's public/covers/.
"""

import pathlib
import shutil
import sys

from PIL import Image, ImageEnhance, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "covers"
PUBLIC = [ROOT / "frontend/public/covers", ROOT / "admin/public/covers"]

W, H = 1200, 600

# room: (photo, treatment, focus)
#   focus is where the band sits, 0 = top of the photo, 1 = bottom.
ROOMS = {
    1: ("Navigating the Mid-Market HR Squeeze/Flavia Norpina Sungkit-Speaker/IMG_4944.JPG.jpeg",
        "fill", 0.38),
    2: ("Work life balance with AI/Irfan Arsandi-Speaker/DSC09877.jpg", "fill", 0.38),
    3: ("How to Win a Retail/Ben Wirawan-Speaker/WhatsApp Image 2026-08-06 at 2.44.03 PM.jpeg",
        "inset", 0.0),
    4: ("Suntoro Suciatmaja-Speaker/Suntoro Suciatmaja.png", "inset", 0.0),
}


def fill(im: Image.Image, focus: float) -> Image.Image:
    scale = W / im.width
    im = im.resize((W, max(H, round(im.height * scale))), Image.LANCZOS)
    top = max(0, min(round(im.height * focus - H / 2), im.height - H))
    return im.crop((0, top, W, top + H))


def inset(im: Image.Image) -> Image.Image:
    scale = max(W / im.width, H / im.height)
    big = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x, y = (big.width - W) // 2, (big.height - H) // 2
    back = big.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(28))
    back = ImageEnhance.Brightness(back).enhance(0.62)
    back = ImageEnhance.Color(back).enhance(0.7)
    front = im.copy()
    front.thumbnail((W, H), Image.LANCZOS)
    back.paste(front, ((W - front.width) // 2, (H - front.height) // 2))
    return back


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src_root = pathlib.Path(sys.argv[1]).expanduser()
    OUT.mkdir(parents=True, exist_ok=True)

    for room, (rel, how, focus) in ROOMS.items():
        src = src_root / rel
        if not src.exists():
            sys.exit(f"missing source photo: {src}")
        im = Image.open(src).convert("RGB")
        out = fill(im, focus) if how == "fill" else inset(im)
        target = OUT / f"breakout-room-{room}.jpg"
        out.save(target, quality=88, optimize=True)
        for pub in PUBLIC:
            pub.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, pub / target.name)
        print(f"room {room}: {how:5} {W}x{H}  ←  {src.name}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate the web logo variants, PWA icons and favicons from the source
artwork in assets/brand/.

The delivered logos are 4500x4500 PNGs that are mostly transparent padding,
so every output is trimmed to its real content bounds first. Run after
replacing the source files:

    python3 -m venv /tmp/pilenv && /tmp/pilenv/bin/pip install Pillow
    /tmp/pilenv/bin/python scripts/brand_assets.py
"""

import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover - guidance only
    sys.exit("Pillow is required: python3 -m venv /tmp/pilenv && "
             "/tmp/pilenv/bin/pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand")
BRAND_DIRS = [
    os.path.join(ROOT, "frontend", "public", "brand"),
    os.path.join(ROOT, "admin", "public", "brand"),
]
FAVICON_DIRS = [
    os.path.join(ROOT, "frontend", "public"),
    os.path.join(ROOT, "admin", "public"),
]
ICON_DIR = os.path.join(ROOT, "frontend", "public")

# The stacked lockup stacks: BNI mark / wordmark / divider / ACCELERATE.
# The app icon uses just the BNI mark — the first band of content.
MARK_BAND = (391, 1424)


def trimmed(name):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    return im.crop(im.getbbox())


def fit(im, *, width=None, height=None):
    w, h = im.size
    if width:
        height = round(h * width / w)
    else:
        width = round(w * height / h)
    return im.resize((width, height), Image.LANCZOS)


def main():
    for d in BRAND_DIRS:
        os.makedirs(d, exist_ok=True)

    variants = {
        "logo-horizontal.png": fit(trimmed("natcon2026-logo-horizontal-color.png"), width=900),
        "logo-horizontal-white.png": fit(trimmed("natcon2026-logo-horizontal-white.png"), width=900),
        "logo-stacked.png": fit(trimmed("natcon2026-logo-stacked-color.png"), height=720),
        "logo-stacked-white.png": fit(trimmed("natcon2026-logo-stacked-white.png"), height=720),
    }
    for fname, img in variants.items():
        for d in BRAND_DIRS:
            img.save(os.path.join(d, fname), optimize=True)
        print(f"{fname}: {img.size}")

    stacked = Image.open(os.path.join(SRC, "natcon2026-logo-stacked-color.png")).convert("RGBA")
    mark = stacked.crop((0, MARK_BAND[0], stacked.width, MARK_BAND[1]))
    mark = mark.crop(mark.getbbox())

    def icon(size, pad=0.16):
        canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        inner = round(size * (1 - 2 * pad))
        m = fit(mark, width=inner)
        if m.height > inner:
            m = fit(mark, height=inner)
        canvas.paste(m, ((size - m.width) // 2, (size - m.height) // 2), m)
        return canvas

    for size in (192, 512):
        icon(size).save(os.path.join(ICON_DIR, f"icon-{size}.png"), optimize=True)
        print(f"icon-{size}.png")

    fav = icon(64, pad=0.08)
    for d in FAVICON_DIRS:
        fav.save(os.path.join(d, "favicon.png"), optimize=True)
    print("favicon.png (frontend + admin)")


if __name__ == "__main__":
    main()

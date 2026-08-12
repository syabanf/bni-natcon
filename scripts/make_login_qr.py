#!/usr/bin/env python3
"""Generate the sign-in QR codes people scan to reach the app.

Two doors, two codes: attendees at /login, booth and sponsor crews at
/tenant/login. Writes SVG (for print/vector work), PNG (for slides and
chat), and one self-contained HTML sheet with both cards ready to print.

    pip install segno
    python3 scripts/make_login_qr.py                       # bninatcon.com
    python3 scripts/make_login_qr.py https://staging.example.com

Everything lands in assets/qr/. Re-run it whenever the domain changes —
a QR pointing at the wrong host is a stack of useless paper.
"""

import base64
import pathlib
import sys

import segno

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "qr"
LOGO = ROOT / "frontend" / "public" / "brand" / "logo-stacked.png"

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://bninatcon.com").rstrip("/")

DOORS = [
    {
        "slug": "attendee-login",
        "path": "/login",
        "eyebrow": "Peserta · Attendee",
        "title": "Scan untuk masuk",
        # Only members are flagged must_set_password, so only this card
        # promises the setup step.
        "note": ("Login pakai email di tiket. Password pertama = chapter + nama depan "
                 "(huruf kecil, tanpa spasi) — begitu masuk pertama kali kamu langsung "
                 "diminta membuat password sendiri."),
    },
    {
        "slug": "booth-login",
        "path": "/tenant/login",
        "eyebrow": "Booth &amp; Sponsor",
        "title": "Scan untuk booth scanner",
        "note": ("Login booth-&lt;kode booth&gt;@natcon.id dengan password dari panitia. "
                 "Akun booth tidak perlu bikin password baru."),
    },
]


def qr_svg_inline(url: str) -> str:
    """QR as a bare <svg> element, ready to drop into the page."""
    import io

    buf = io.BytesIO()
    # Error correction H survives a scuffed print and an off-angle phone.
    # The 4-module border is the spec's quiet zone; carrying it inside the
    # SVG means no page layout can accidentally crop it away.
    segno.make(url, error="h").save(
        buf, kind="svg", scale=10, border=4, dark="#111111", svgclass=None, lineclass=None,
        xmldecl=False, svgns=True, omitsize=True,
    )
    return buf.getvalue().decode("utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    logo_uri = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()

    cards = []
    for door in DOORS:
        url = BASE + door["path"]
        qr = segno.make(url, error="h")
        stem = OUT / f"natcon2026-qr-{door['slug']}"
        qr.save(f"{stem}.svg", scale=10, border=4, dark="#111111")
        qr.save(f"{stem}.png", scale=24, border=4, dark="#111111", light="#FFFFFF")
        print(f"{stem.name}  ←  {url}")

        cards.append(f"""
    <section class="card">
      <img class="brand" src="{logo_uri}" alt="BNI Natcon 2026 — Accelerate" />
      <p class="eyebrow">{door['eyebrow']}</p>
      <h2>{door['title']}</h2>
      <div class="qr">{qr_svg_inline(url)}</div>
      <p class="url">{url.replace('https://', '')}</p>
      <p class="note">{door['note']}</p>
    </section>""")

    sheet = f"""<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>BNI Natcon 2026 — QR login</title>
<style>
  @page {{ size: A4; margin: 12mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 18px;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #111; background: #f4f4f5;
    display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; align-items: flex-start;
  }}
  .card {{
    background: #fff; border-radius: 22px; padding: 28px 26px 24px;
    width: 92mm; text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,.08);
    border-top: 6px solid #CF2030;
    page-break-inside: avoid;
  }}
  .brand {{ height: 74px; object-fit: contain; margin-bottom: 14px; }}
  .eyebrow {{
    margin: 0; font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
    color: #CF2030; font-weight: 700;
  }}
  h2 {{ margin: 4px 0 14px; font-size: 19px; font-weight: 800; }}
  .qr {{ margin: 0 auto; width: 58mm; }}
  .qr svg {{ width: 100%; height: auto; display: block; }}
  .url {{
    margin: 14px 0 6px; font-size: 13px; font-weight: 700; letter-spacing: .01em;
    word-break: break-all;
  }}
  .note {{ margin: 0; font-size: 11px; line-height: 1.5; color: #52525b; }}
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .card {{ box-shadow: none; border: 1px solid #e4e4e7; }}
  }}
</style>
</head>
<body>{''.join(cards)}
</body>
</html>
"""
    sheet_path = OUT / "natcon2026-qr-login-sheet.html"
    sheet_path.write_text(sheet, encoding="utf-8")
    print(f"{sheet_path.name}  ←  print sheet, A4, both cards")


if __name__ == "__main__":
    main()

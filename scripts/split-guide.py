#!/usr/bin/env python3
"""Split the combined guide into the attendee edition and the crew edition.

    python3 scripts/split-guide.py docs/panduan/panduan-natcon.html docs/panduan/

The combined guide stays the master — edit that, run this, then render. The
split is by audience: attendees get their three pages plus the day flow; the
committee edition keeps the booth and door sections too, because the
committee is who hands those crews their pages.
"""
import pathlib, re, sys

src = pathlib.Path(sys.argv[1]).read_text()
outdir = pathlib.Path(sys.argv[2])

head_end = src.find("<body>") + len("<body>")
prolog = src[:head_end]                     # doctype + <style>
sections = re.findall(r"<section class=\"(?:cover|page)\">.*?</section>", src, re.S)
epilog = "\n</body></html>"
# order: cover, toc, flow, A1, A2, A3, B1, B2, C, D1, D2, D3, FAQ
cover, toc, flow, a1, a2, a3, b1, b2, c, d1, d2, d3, faq = sections

def retitle(cover_html, title, lead, keep_apps):
    out = re.sub(r"<h1>.*?</h1>", f"<h1>{title}</h1>", cover_html, flags=re.S)
    out = re.sub(r'<p class="lead">.*?</p>', f'<p class="lead">{lead}</p>', out, flags=re.S)
    if not keep_apps:
        out = re.sub(r'<div class="apps">.*?</div>\n', "", out, flags=re.S)
    return out

# Attendee edition: cover + flow + A + FAQ. Short enough to need no TOC.
peserta = prolog + retitle(
    cover,
    "Panduan Peserta",
    "Pass digital, stempel booth, learning class, dan speed networking — semuanya dari satu QR di HP Anda.",
    False,
) + flow + a1 + a2 + a3 + faq + epilog
# the last section keeps its page-break class; harmless.
(outdir / "panduan-peserta.html").write_text(peserta)

# Crew edition: cover + flow + B + C + D + FAQ.
panitia = prolog + retitle(
    cover,
    "Panduan Panitia &amp; Kru",
    "Booth, pintu kelas, dan panel admin — dari persiapan sampai laporan penutup. Bagian booth dan pintu siap dicetak lepas untuk masing-masing kru.",
    True,
) + flow + b1 + b2 + c + d1 + d2 + d3 + faq + epilog
(outdir / "panduan-panitia.html").write_text(panitia)
print(f"peserta: {len(peserta)//1024} KB · panitia: {len(panitia)//1024} KB · sections: {len(sections)}")

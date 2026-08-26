#!/usr/bin/env python3
"""Split a combined guide into the attendee edition and the crew edition.

    python3 scripts/split-guide.py <master.html> <outdir> [id|en]

The combined guide stays the master — edit that, run this, then render. The
split is by audience: attendees get their three pages plus the day flow; the
crew edition keeps booth, door and committee, because the committee is who
hands those crews their pages.
"""
import pathlib, re, sys

TEXTS = {
    "id": {
        "attendee_file": "panduan-peserta",
        "crew_file": "panduan-panitia",
        "attendee_title": "Panduan Peserta",
        "attendee_lead": "Pass digital, stempel booth, learning class, dan speed networking — semuanya dari satu QR di HP Anda.",
        "crew_title": "Panduan Panitia &amp; Kru",
        "crew_lead": "Booth, pintu kelas, dan panel admin — dari persiapan sampai laporan penutup. Bagian booth dan pintu siap dicetak lepas untuk masing-masing kru.",
    },
    "en": {
        "attendee_file": "guide-attendee-en",
        "crew_file": "guide-crew-en",
        "attendee_title": "Attendee Guide",
        "attendee_lead": "Your digital pass, booth stamps, learning classes and speed networking — all from one QR on your phone.",
        "crew_title": "Crew &amp; Committee Guide",
        "crew_lead": "Booths, class doors and the admin panel — from setup to the closing reports. The booth and door pages are made to print loose for their crews.",
    },
}

src = pathlib.Path(sys.argv[1]).read_text()
outdir = pathlib.Path(sys.argv[2])
t = TEXTS[sys.argv[3] if len(sys.argv) > 3 else "id"]

head_end = src.find("<body>") + len("<body>")
prolog = src[:head_end]
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

attendee = (prolog + retitle(cover, t["attendee_title"], t["attendee_lead"], False)
            + flow + a1 + a2 + a3 + faq + epilog)
(outdir / f"{t['attendee_file']}.html").write_text(attendee)

crew = (prolog + retitle(cover, t["crew_title"], t["crew_lead"], True)
        + flow + b1 + b2 + c + d1 + d2 + d3 + faq + epilog)
(outdir / f"{t['crew_file']}.html").write_text(crew)
print(f"{t['attendee_file']}: {len(attendee)//1024} KB · {t['crew_file']}: {len(crew)//1024} KB")

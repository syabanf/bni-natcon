#!/usr/bin/env python3
"""Generate a PDF performance-test report from k6 summary.json."""
import json
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, HRFlowable)

def fmt_ms(v):
    if v is None:
        return '-'
    return f"{v:.0f} ms"

def fmt_pct(v):
    if v is None:
        return '-'
    return f"{v*100:.2f}%"

def main(summary_path, pdf_path):
    with open(summary_path) as f:
        s = json.load(f)

    # styles
    title_style = ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#CF2030'))
    sub_style = ParagraphStyle('sub', fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#444444'))
    h2_style = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor('#1a1a1a'), spaceBefore=10, spaceAfter=6)
    cell_style = ParagraphStyle('cell', fontName='Helvetica', fontSize=9, leading=12)
    cell_bold = ParagraphStyle('cellb', fontName='Helvetica-Bold', fontSize=9, leading=12)
    small_style = ParagraphStyle('small', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#666666'))

    doc = SimpleDocTemplate(pdf_path, pagesize=landscape(A4),
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm,
                            title="Performance Test Report — BNI Natcon 2026",
                            author="Primmie (OpenClaw)")

    story = []
    story.append(Paragraph("Performance Test Report", title_style))
    story.append(Paragraph("BNI Natcon 2026 — Digital Stamp App", sub_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Target: <b>{s.get('base_url','-')}</b> &nbsp;|&nbsp; Generated: {s.get('generated_at','-')} (WIB+7)", small_style))
    story.append(HRFlowable(width='100%', thickness=1.2, color=colors.HexColor('#CF2030'), spaceAfter=8))

    # ---- test info ----
    total = s.get('total_requests', 0)
    ag = s.get('aggregates', {})
    duration_s = 105  # profile: 15+15+60+15
    rps = total / duration_s if duration_s else 0

    story.append(Paragraph("Ringkasan Test", h2_style))
    info = Table([
        [Paragraph('<b>Profil beban</b>', cell_bold), Paragraph('Ramping VUs: 0 → 10 → 30 → 30 → 0 selama 105 detik (15s ramp-up, 15s naik, 60s steady, 15s ramp-down)', cell_style)],
        [Paragraph('<b>Total request</b>', cell_bold), Paragraph(f'{total:,} ({rps:,.1f} req/s rata-rata)', cell_style)],
        [Paragraph('<b>Tipe test</b>', cell_bold), Paragraph('Read-heavy: landing page + 6 endpoint API (member/tenant). Login hanya 2x di setup (menghormati rate-limit 10/menit/IP). Tidak ada operasi tulis.', cell_style)],
    ], colWidths=[38*mm, 200*mm])
    info.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#f6f6f6')]),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cccccc')),
        ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(info)
    story.append(Spacer(1, 6))

    # ---- aggregate KPIs ----
    story.append(Paragraph("Latensi Agregat (semua request)", h2_style))
    kpi = Table([[Paragraph('<b>Avg</b>', cell_bold), Paragraph('<b>Min</b>', cell_bold), Paragraph('<b>Median</b>', cell_bold),
                  Paragraph('<b>p90</b>', cell_bold), Paragraph('<b>p95</b>', cell_bold), Paragraph('<b>p99</b>', cell_bold),
                  Paragraph('<b>Max</b>', cell_bold), Paragraph('<b>Error rate</b>', cell_bold)],
                 [fmt_ms(ag.get('avg_ms')), fmt_ms(ag.get('min_ms')), fmt_ms(ag.get('med_ms')),
                  fmt_ms(ag.get('p90_ms')), fmt_ms(ag.get('p95_ms')), fmt_ms(ag.get('p99_ms')),
                  fmt_ms(ag.get('max_ms')), fmt_pct(ag.get('failed_rate'))]],
                colWidths=[29.75*mm]*8)
    kpi.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#fdecea')),
        ('TEXTCOLOR', (0,1), (-1,1), colors.HexColor('#CF2030')),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cccccc')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(kpi)
    story.append(Spacer(1, 6))

    # ---- thresholds ----
    story.append(Paragraph("Hasil Threshold", h2_style))
    thr_rows = [[Paragraph('<b>Metric</b>', cell_bold), Paragraph('<b>Kondisi</b>', cell_bold), Paragraph('<b>Status</b>', cell_bold)]]
    for name, lst in s.get('thresholds', {}).items():
        for t in lst:
            status = '✅ LULUS' if t.get('ok') else '❌ GAGAL'
            color = colors.HexColor('#1a7f37') if t.get('ok') else colors.HexColor('#CF2030')
            thr_rows.append([Paragraph(name, cell_style), Paragraph(t.get('source','-'), cell_style),
                             Paragraph(f'<font color="{color.hexval()}"><b>{status}</b></font>', cell_style)])
    if len(thr_rows) > 1:
        thr = Table(thr_rows, colWidths=[50*mm, 110*mm, 78*mm])
        thr.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a1a1a')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f6f6f6')]),
            ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(thr)
    else:
        story.append(Paragraph('Tidak ada threshold.', cell_style))
    story.append(Spacer(1, 6))

    # ---- per-endpoint table ----
    story.append(Paragraph("Rincian per Endpoint", h2_style))
    head = [Paragraph('<b>Endpoint</b>', cell_bold), Paragraph('<b>Method</b>', cell_bold),
            Paragraph('<b>Requests</b>', cell_bold), Paragraph('<b>Avg</b>', cell_bold),
            Paragraph('<b>Median</b>', cell_bold), Paragraph('<b>p90</b>', cell_bold),
            Paragraph('<b>p95</b>', cell_bold), Paragraph('<b>p99</b>', cell_bold),
            Paragraph('<b>Max</b>', cell_bold), Paragraph('<b>Error</b>', cell_bold)]
    rows = [head]
    for name, ep in s.get('endpoints', {}).items():
        rows.append([
            Paragraph(f"{ep.get('path','-')} <font size=7 color='#888888'>({name})</font>", cell_style),
            Paragraph(ep.get('method','-'), cell_style),
            Paragraph(f"{ep.get('count',0):,}", cell_style),
            Paragraph(fmt_ms(ep.get('avg_ms')), cell_style),
            Paragraph(fmt_ms(ep.get('med_ms')), cell_style),
            Paragraph(fmt_ms(ep.get('p90_ms')), cell_style),
            Paragraph(fmt_ms(ep.get('p95_ms')), cell_style),
            Paragraph(fmt_ms(ep.get('p99_ms')), cell_style),
            Paragraph(fmt_ms(ep.get('max_ms')), cell_style),
            Paragraph(f"{fmt_pct(ep.get('fail_rate'))} ({ep.get('fails',0)})", cell_style),
        ])
    ep_table = Table(rows, colWidths=[92*mm, 20*mm, 22*mm, 20*mm, 20*mm, 20*mm, 20*mm, 20*mm, 20*mm, 24*mm], repeatRows=1)
    ep_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f6f6f6')]),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(ep_table)
    story.append(Spacer(1, 8))

    story.append(HRFlowable(width='100%', thickness=0.8, color=colors.HexColor('#cccccc'), spaceAfter=4))
    story.append(Paragraph("Metodologi: k6 v2.1.0, skenario ramping-vus, test dilakukan melalui jalur publik (Cloudflare tunnel). "
                           "Setiap iterasi VU memuat landing page + 6 panggilan API ber-token. Nilai latensi dalam milidetik (ms). "
                           "Test bersifat read-only untuk menjaga integritas data demo.", small_style))

    doc.build(story)
    print(f"PDF tersimpan: {pdf_path}")

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

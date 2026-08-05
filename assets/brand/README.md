# Brand assets — BNI Natcon 2026 “Accelerate”

Source artwork as delivered (4500 × 4500 PNG, transparent background):

| File | Use |
|---|---|
| `natcon2026-logo-stacked-color.png` | Stacked lockup, full colour — light backgrounds |
| `natcon2026-logo-stacked-white.png` | Stacked lockup, all white — dark/red backgrounds |
| `natcon2026-logo-horizontal-color.png` | Horizontal lockup, full colour |
| `natcon2026-logo-horizontal-white.png` | Horizontal lockup, all white |

The apps do **not** load these directly: they are large and mostly
transparent padding. Web variants (trimmed + resized) live in
`frontend/public/brand/` and `admin/public/brand/`, and the PWA icons
(`frontend/public/icon-192.png`, `icon-512.png`) plus both favicons are
cut from the “BNI” mark at the top of the stacked lockup.

## Regenerating the web variants

After replacing the source files, re-run (needs Python + Pillow):

```bash
python3 -m venv /tmp/pilenv && /tmp/pilenv/bin/pip install Pillow
/tmp/pilenv/bin/python scripts/brand_assets.py
```

The script trims transparent margins, resizes (900 px wide horizontal,
720 px tall stacked), writes both apps' `public/brand/`, and regenerates
the icons and favicons.

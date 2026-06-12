#!/usr/bin/env python3
"""Contrast sweep over variant 5 (autocontrast + S-curve x2).
Rows = tiles, columns = contrast levels A-D. Output: contrast-sweep.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

TILES_DIR = Path(__file__).resolve().parents[0] / ".." / "app" / "public" / "tiles"
OUT = Path(__file__).resolve().parent / "contrast-sweep.png"

DARK = "#4a6fa5"
LIGHT = "#e8dcc8"
TILE_PX, N, CELL = 200, 3, 380
LABEL_H = 40


def s_curve(x):
    return 2 * x * x if x < 0.5 else 1 - 2 * (1 - x) * (1 - x)


def curve_lut(times, blend_extra=0.0):
    """times full S-curve passes; blend_extra in [0,1] mixes toward one more pass."""
    lut = []
    for v in range(256):
        x = v / 255
        for _ in range(times):
            x = s_curve(x)
        if blend_extra:
            x = x * (1 - blend_extra) + s_curve(x) * blend_extra
        lut.append(round(x * 255))
    return lut


LEVELS = [
    ("A - base (la 5 del sheet)", 1, 2, 0.0),
    ("B - un pelin mas", 2, 2, 0.5),
    ("C - mas", 2, 3, 0.0),
    ("D - mucho mas", 3, 3, 0.5),
]


def mosaic_of(name):
    tile = Image.open(TILES_DIR / name).convert("RGB").resize((TILE_PX, TILE_PX), Image.LANCZOS)
    m = Image.new("RGB", (TILE_PX * N, TILE_PX * N))
    for r in range(N):
        for c in range(N):
            m.paste(tile, (c * TILE_PX, r * TILE_PX))
    return m


def render(mosaic, cutoff, times, extra):
    gray = ImageOps.autocontrast(mosaic.convert("L"), cutoff=cutoff)
    return ImageOps.colorize(gray.point(curve_lut(times, extra)), black=DARK, white=LIGHT)


tiles = ["star-blue-gold.png", "terrazzo-star.png"]
pad = 14
w = len(LEVELS) * CELL + (len(LEVELS) + 1) * pad
h = len(tiles) * (CELL + LABEL_H) + (len(tiles) + 1) * pad
sheet = Image.new("RGB", (w, h), "#111111")
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 21)
except OSError:
    font = ImageFont.load_default()

for row, name in enumerate(tiles):
    m = mosaic_of(name)
    for col, (label, cutoff, times, extra) in enumerate(LEVELS):
        x = pad + col * (CELL + pad)
        y = pad + row * (CELL + LABEL_H + pad)
        sheet.paste(render(m, cutoff, times, extra).resize((CELL, CELL), Image.LANCZOS), (x, y))
        draw.text((x + 2, y + CELL + 8), label, fill="#ffffff", font=font)

sheet.save(OUT)
print(OUT)

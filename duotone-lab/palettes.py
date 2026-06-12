#!/usr/bin/env python3
"""Palette candidates for the duotone presets, rendered with the shipped
algorithm (variant B: autocontrast 2% + S-curve x2.5). Rows alternate the two
reference tiles; one column per palette. Output: palettes.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

TILES_DIR = Path(__file__).resolve().parents[0] / ".." / "app" / "public" / "tiles"
OUT = Path(__file__).resolve().parent / "palettes.png"

TILE_PX, N, CELL = 200, 3, 300
LABEL_H = 56
COLS = 5

# Final six: deep saturated dark + light warm whites (lightened per Kike).
PALETTES = [
    ("Lisboa (default)", "#4a6fa5", "#f1ead9"),
    ("Delft", "#2b3a67", "#f7f3e9"),
    ("Porto", "#1e6b73", "#f9f1e3"),
    ("Sevilla", "#9c4a2f", "#f8efdf"),
    ("Talavera", "#3f5277", "#f9e7c4"),
    ("Nápoles", "#7d5a24", "#f7f0de"),
]


def s_curve(x):
    return 2 * x * x if x < 0.5 else 1 - 2 * (1 - x) * (1 - x)


def lut_b():
    lut = []
    for v in range(256):
        x = v / 255
        x = s_curve(s_curve(x))
        x = x * 0.5 + s_curve(x) * 0.5
        lut.append(round(x * 255))
    return lut


LUT = lut_b()


def mosaic_of(name):
    tile = Image.open(TILES_DIR / name).convert("RGB").resize((TILE_PX, TILE_PX), Image.LANCZOS)
    m = Image.new("RGB", (TILE_PX * N, TILE_PX * N))
    for r in range(N):
        for c in range(N):
            m.paste(tile, (c * TILE_PX, r * TILE_PX))
    return m


def render(mosaic, dark, light):
    gray = ImageOps.autocontrast(mosaic.convert("L"), cutoff=2)
    return ImageOps.colorize(gray.point(LUT), black=dark, white=light)


tiles = [mosaic_of("star-blue-gold.png"), mosaic_of("terrazzo-star.png")]
rows_of_palettes = (len(PALETTES) + COLS - 1) // COLS
pad = 14
w = COLS * CELL + (COLS + 1) * pad
h = rows_of_palettes * len(tiles) * CELL + rows_of_palettes * (LABEL_H + pad) + pad
sheet = Image.new("RGB", (w, h), "#111111")
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
    small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
except OSError:
    font = small = ImageFont.load_default()

for i, (name, dark, light) in enumerate(PALETTES):
    prow, col = divmod(i, COLS)
    x = pad + col * (CELL + pad)
    y = pad + prow * (len(tiles) * CELL + LABEL_H + pad)
    for t, m in enumerate(tiles):
        sheet.paste(render(m, dark, light).resize((CELL, CELL), Image.LANCZOS), (x, y + t * CELL))
    ly = y + len(tiles) * CELL + 6
    draw.rectangle([x + 2, ly + 4, x + 22, ly + 24], fill=dark)
    draw.rectangle([x + 26, ly + 4, x + 46, ly + 24], fill=light)
    draw.text((x + 56, ly), f"{i}. {name}", fill="#ffffff", font=font)
    draw.text((x + 56, ly + 26), f"{dark} / {light}", fill="#999999", font=small)

sheet.save(OUT)
print(OUT)

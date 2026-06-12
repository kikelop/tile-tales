#!/usr/bin/env python3
"""Duotone lab — render one tile mosaic through every duotone variant on a single
labeled contact sheet, so Kike can pick the one that matches the web look without
rebuilding the iOS app.

Usage: python3 duotone_lab.py [tile-name.png ...]
Outputs: contact-sheet-<tile>.png next to this script.
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

TILES_DIR = Path(__file__).resolve().parents[0] / ".." / "app" / "public" / "tiles"
OUT_DIR = Path(__file__).resolve().parent

# Classic preset = web default
DARK = "#4a6fa5"
LIGHT = "#e8dcc8"

TILE_PX = 200          # tile size inside the mosaic
MOSAIC_N = 3           # 3x3 mosaic
CELL_PX = 360          # mosaic downscaled to this for the sheet
LABEL_H = 34
COLS = 4


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def s_curve(x):
    return 2 * x * x if x < 0.5 else 1 - 2 * (1 - x) * (1 - x)


def lut_curve(times):
    lut = []
    for v in range(256):
        x = v / 255
        for _ in range(times):
            x = s_curve(x)
        lut.append(round(x * 255))
    return lut


def gradient_map(gray, dark=DARK, light=LIGHT):
    return ImageOps.colorize(gray, black=dark, white=light)


def flat(color, size):
    return Image.new("RGB", size, hex_rgb(color))


def srgb_to_linear(v):
    x = v / 255
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4


def linear_to_srgb(x):
    v = x * 12.92 if x <= 0.0031308 else 1.055 * (x ** (1 / 2.4)) - 0.055
    return max(0, min(255, round(v * 255)))


def variants(mosaic):
    """Yield (label, image) pairs. mosaic is RGB."""
    gray601 = mosaic.convert("L")  # PIL "L" = Rec.601 weights, same as web
    size = mosaic.size

    yield "ORIGINAL (sin duotono)", mosaic

    # 1. Web exact: S-curve x2 then gradient map
    yield "WEB EXACT - S-curve x2", gradient_map(gray601.point(lut_curve(2)))

    # 2-4. Curve strength sweep
    yield "S-curve x1 (mas suave)", gradient_map(gray601.point(lut_curve(1)))
    yield "Lineal (sin curva)", gradient_map(gray601)
    yield "S-curve x3 (mas duro)", gradient_map(gray601.point(lut_curve(3)))

    # 5. Normalize luminance first (fixes washed-out light tiles), then web curve
    yield "Autocontraste + S-curve x2", gradient_map(
        ImageOps.autocontrast(gray601, cutoff=1).point(lut_curve(2)))

    # 6. Equalize histogram then gradient map
    yield "Ecualizado + lineal", gradient_map(ImageOps.equalize(gray601))

    # 7. Gamma darker mids
    gamma = gray601.point([round(255 * ((v / 255) ** 1.6)) for v in range(256)])
    yield "Gamma 1.6 (medios oscuros)", gradient_map(gamma)

    # 8. Gradient map interpolated in linear light
    dark_lin = [srgb_to_linear(c) for c in hex_rgb(DARK)]
    light_lin = [srgb_to_linear(c) for c in hex_rgb(LIGHT)]
    luts = []
    for ch in range(3):
        luts.append([
            linear_to_srgb(dark_lin[ch] + (light_lin[ch] - dark_lin[ch]) * (lut_curve(2)[v] / 255))
            for v in range(256)
        ])
    g = gray601
    lin_img = Image.merge("RGB", [g.point(luts[0]), g.point(luts[1]), g.point(luts[2])])
    yield "S-curve x2 en luz lineal", lin_img

    # 9. Multiply + screen blend chain
    gray_rgb = gray601.convert("RGB")
    mult = ImageChops.multiply(gray_rgb, flat(LIGHT, size))
    yield "Multiply light + screen dark", ImageChops.screen(mult, flat(DARK, size))

    # 10. Soft light tint over curved gray
    curved_rgb = gray601.point(lut_curve(1)).convert("RGB")
    mid = tuple((d + l) // 2 for d, l in zip(hex_rgb(DARK), hex_rgb(LIGHT)))
    yield "Soft light tinte medio", ImageChops.soft_light(curved_rgb, Image.new("RGB", size, mid))

    # 11. Tritone: dark -> mid -> light
    yield "Tritono (con tono medio)", ImageOps.colorize(
        gray601.point(lut_curve(1)), black=DARK, white=LIGHT,
        mid="#9aa8b8", midpoint=127)

    # 12. Hard 2-color threshold
    yield "Umbral duro 2 colores", gradient_map(gray601.point(lambda v: 0 if v < 128 else 255))

    # 13. Posterize 4 levels
    yield "Posterizado 4 niveles", gradient_map(
        ImageOps.posterize(gray601.point(lut_curve(1)), 2))

    # 14. Ordered Bayer 4x4 dither, 2 colors
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    w, h = size
    px = list(gray601.point(lut_curve(1)).getdata())
    dk, lt = hex_rgb(DARK), hex_rgb(LIGHT)
    out = [dk if px[y * w + x] / 255 <= (bayer[y % 4][x % 4] + 0.5) / 16 else lt
           for y in range(h) for x in range(w)]
    dith = Image.new("RGB", size)
    dith.putdata(out)
    yield "Bayer dither 2 colores", dith

    # 15. Rec.709 luminance weights + web curve
    r, g_, b = mosaic.split()
    lum709 = Image.merge("RGB", (r, g_, b)).convert("L")  # placeholder, real 709 below
    lum709 = Image.eval(Image.blend(Image.blend(r, g_, 0.78), b, 0.07), lambda v: v)
    yield "Luminancia Rec.709 + S x2", gradient_map(lum709.point(lut_curve(2)))

    # 16. Keep-luminance colorize (saturation from colors, detail intact)
    soft = ImageChops.overlay(gray_rgb, ImageOps.colorize(gray601, black=DARK, white=LIGHT))
    yield "Overlay gradient map", soft


def build_sheet(tile_path):
    tile = Image.open(tile_path).convert("RGB").resize((TILE_PX, TILE_PX), Image.LANCZOS)
    msize = TILE_PX * MOSAIC_N
    mosaic = Image.new("RGB", (msize, msize))
    for r in range(MOSAIC_N):
        for c in range(MOSAIC_N):
            mosaic.paste(tile, (c * TILE_PX, r * TILE_PX))

    cells = list(variants(mosaic))
    rows = (len(cells) + COLS - 1) // COLS
    pad = 14
    sheet_w = COLS * CELL_PX + (COLS + 1) * pad
    sheet_h = rows * (CELL_PX + LABEL_H) + (rows + 1) * pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), "#111111")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 19)
        font_b = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 19, index=1)
    except OSError:
        font = font_b = ImageFont.load_default()

    for i, (label, img) in enumerate(cells):
        r, c = divmod(i, COLS)
        x = pad + c * (CELL_PX + pad)
        y = pad + r * (CELL_PX + LABEL_H + pad)
        sheet.paste(img.resize((CELL_PX, CELL_PX), Image.LANCZOS), (x, y))
        draw.text((x + 2, y + CELL_PX + 7), f"{i}. {label}",
                  fill="#ffffff", font=font_b if "WEB" in label else font)

    out = OUT_DIR / f"contact-sheet-{Path(tile_path).stem}.png"
    sheet.save(out)
    print(out)


if __name__ == "__main__":
    names = sys.argv[1:] or ["star-blue-gold.png", "terrazzo-star.png"]
    for n in names:
        build_sheet(TILES_DIR / n)

#!/usr/bin/env python3
"""Turn a tile image into a seamless Lisboa-duotone background (book-match tiling).

Usage:
  python3 make_bg.py <tile.png> [out.png] [--frac 0.72] [--gold] [--grid]

  --gold   re-inject yellow #EFAD4A on the gold/orange pixels (e.g. star-blue-gold
           diamonds), which the duotone would otherwise wash out to cream.
  --grid   plain grid tiling instead of mirrored book-match (use for full-bleed,
           4-fold-symmetric tiles whose edges already meet).
"""
import sys
from PIL import Image, ImageOps
import numpy as np

DARK = (74, 111, 165)    # Lisboa #4a6fa5
LIGHT = (241, 234, 217)  # Lisboa #f1ead9
YELLOW = (239, 173, 74)  # #EFAD4A


def duotone(img, contrast=1.22, gold_to=None):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gold = (r > 140) & (g > 80) & (b < 140) & (r > b + 35) & (g > b + 10) if gold_to else None
    lum = np.clip(((0.299 * r + 0.587 * g + 0.114 * b) / 255.0 - 0.5) * contrast + 0.5, 0, 1)
    out = np.empty_like(a)
    for i in range(3):
        out[..., i] = DARK[i] + (LIGHT[i] - DARK[i]) * lum
    if gold_to is not None:
        for i in range(3):
            out[..., i][gold] = gold_to[i]
    return Image.fromarray(np.clip(out, 0, 255).astype("uint8"))


def square_crop(img, frac=1.0, dy=0):
    w, h = img.size
    s = int(min(w, h) * frac)
    cx, cy = w // 2, h // 2 + dy
    return img.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2))


def bookmatch(tile, size):
    t = tile.resize((size, size))
    tH, tV = ImageOps.mirror(t), ImageOps.flip(t)
    tHV = ImageOps.flip(tH)
    bl = Image.new("RGB", (size * 2, size * 2))
    bl.paste(t, (0, 0)); bl.paste(tH, (size, 0))
    bl.paste(tV, (0, size)); bl.paste(tHV, (size, size))
    return bl


def background(block, W=1080, H=2256):
    bw, bh = block.size
    c = Image.new("RGB", (W, H))
    for y in range(0, H, bh):
        for x in range(0, W, bw):
            c.paste(block, (x, y))
    return c


if __name__ == "__main__":
    args = sys.argv[1:]
    src = args[0]
    out = next((a for a in args[1:] if not a.startswith("--")), "bg.png")
    frac = float(args[args.index("--frac") + 1]) if "--frac" in args else 0.72
    gold = "--gold" in args
    grid = "--grid" in args
    tile = square_crop(Image.open(src), frac=frac, dy=0)
    d = duotone(tile, gold_to=YELLOW if gold else None)
    block = d.resize((300, 300)) if grid else bookmatch(d, 260)
    background(block).save(out)
    print("wrote", out)

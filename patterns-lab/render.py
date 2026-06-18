from PIL import Image, ImageDraw, ImageFont
TILES = "app/public/tiles"
def load(name, s): return Image.open(f"{TILES}/{name}.png").convert("RGBA").resize((s, s), Image.LANCZOS)

ts, cols, rows = 70, 6, 6
CS = ts * cols
PATTERNS = ["grid", "mirror", "brick", "diamond", "pinwheel"]

def render(pattern, tiles):
    n = len(tiles)
    img = Image.new("RGBA", (CS, CS), (236, 232, 225, 255))
    for row in range(rows):
        for col in range(cols):
            if pattern == "grid":
                t = tiles[(row+col) % n]; img.paste(t, (col*ts, row*ts), t)
            elif pattern == "mirror":
                t = tiles[(row+col) % n]
                if col % 2: t = t.transpose(Image.FLIP_LEFT_RIGHT)
                if row % 2: t = t.transpose(Image.FLIP_TOP_BOTTOM)
                img.paste(t, (col*ts, row*ts), t)
            elif pattern == "brick":
                off = ts//2 if row % 2 else 0
                t = tiles[(row+col) % n]; img.paste(t, (col*ts-off, row*ts), t)
            elif pattern == "diamond":
                t = tiles[(row+col) % n].rotate(45, expand=True, resample=Image.BICUBIC)
                cx, cy = col*ts+ts//2, row*ts+ts//2
                img.paste(t, (cx-t.width//2, cy-t.height//2), t)
            elif pattern == "pinwheel":
                t = tiles[((row//2)+(col//2)) % n]
                quad = (row % 2)*2 + (col % 2)
                t = t.rotate(-quad*90, resample=Image.BICUBIC)
                img.paste(t, (col*ts, row*ts), t)
    return img.convert("RGB")

one = [load("star-compass", ts)]
two = [load("star-compass", ts), load("blue-floral-delft", ts)]
pad, labelh = 16, 28
W = 2*CS + 3*pad
H = len(PATTERNS)*(CS+labelh) + pad
sheet = Image.new("RGB", (W, H), "#f5f2ed")
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
except: font = ImageFont.load_default()
for i, p in enumerate(PATTERNS):
    y = pad + i*(CS+labelh)
    sheet.paste(render(p, one), (pad, y))
    sheet.paste(render(p, two), (2*pad+CS, y))
    d.text((pad, y+CS+4), f"{p} — 1 tile", fill="#1a1a1a", font=font)
    d.text((2*pad+CS, y+CS+4), f"{p} — 2 tiles", fill="#1a1a1a", font=font)
sheet.save("/tmp/patterns.png"); print("/tmp/patterns.png")

from PIL import Image, ImageDraw, ImageFont
TILES = "app/public/tiles"
ts, cols, rows = 110, 4, 4
CS = ts*cols
def load(n,s): return Image.open(f"{TILES}/{n}.png").convert("RGBA").resize((s,s), Image.LANCZOS)
tile = load("blue-floral-delft", ts)

def render(mode):
    img = Image.new("RGBA",(CS,CS),(236,232,225,255))
    for r in range(rows+1):
        for c in range(cols+1):
            t = tile
            offy = 0
            if mode == "current":          # book-match H+V (lo actual)
                if c%2: t = t.transpose(Image.FLIP_LEFT_RIGHT)
                if r%2: t = t.transpose(Image.FLIP_TOP_BOTTOM)
            elif mode == "horizontal":     # espejo solo horizontal
                if c%2: t = t.transpose(Image.FLIP_LEFT_RIGHT)
            elif mode == "halfdrop":       # columnas desfasadas 1/2 vertical (sin espejo)
                offy = ts//2 if c%2 else 0
            img.paste(t,(c*ts, r*ts - offy), t)
    return img.convert("RGB")

modes = [("current","Mirror ACTUAL (H+V)"),("horizontal","Solo horizontal"),("halfdrop","Half-drop (sin espejo)")]
pad=16; W=3*CS+4*pad; H=CS+28+pad
sheet=Image.new("RGB",(W,H),"#f5f2ed"); d=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc",15)
except: font=ImageFont.load_default()
for i,(m,lab) in enumerate(modes):
    x=pad+i*(CS+pad); sheet.paste(render(m),(x,pad)); d.text((x,pad+CS+4),lab,fill="#1a1a1a",font=font)
sheet.save("/tmp/mirror.png"); print("/tmp/mirror.png")

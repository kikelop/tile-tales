from PIL import Image, ImageDraw, ImageFont
import math
TILES = "app/public/tiles"
ts, cols = 70, 6
CS = ts*cols
def load(name, s): return Image.open(f"{TILES}/{name}.png").convert("RGBA").resize((s, s), Image.LANCZOS)

def diamond_diag(tiles):
    # rotate the WHOLE grid 45°: tiles stay whole, laid on a diagonal lattice
    n = len(tiles)
    big = int(CS*1.7)
    g = Image.new("RGBA", (big, big), (236, 232, 225, 255))
    nc = big//ts + 2
    for r in range(nc):
        for c in range(nc):
            t = tiles[(r+c) % n]; g.paste(t, (c*ts, r*ts), t)
    g = g.rotate(45, resample=Image.BICUBIC, expand=False)
    cx, cy = g.width//2, g.height//2
    return g.crop((cx-CS//2, cy-CS//2, cx-CS//2+CS, cy-CS//2+CS)).convert("RGB")

one=[load("star-compass",ts)]; two=[load("star-compass",ts),load("blue-floral-delft",ts)]
ter=[load("terrazzo-star",ts)]
pad=16; cells=[("star 1 tile",diamond_diag(one)),("delft+star 2",diamond_diag(two)),("terrazzo 1",diamond_diag(ter))]
W=3*CS+4*pad; H=CS+28+pad
sheet=Image.new("RGB",(W,H),"#f5f2ed"); d=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc",15)
except: font=ImageFont.load_default()
for i,(lab,im) in enumerate(cells):
    x=pad+i*(CS+pad); sheet.paste(im,(x,pad)); d.text((x,pad+CS+4),lab,fill="#1a1a1a",font=font)
sheet.save("/tmp/diamond2.png"); print("/tmp/diamond2.png")

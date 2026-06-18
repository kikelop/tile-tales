from PIL import Image, ImageDraw, ImageFont
import math
TILES = "app/public/tiles"
ts, cols, rows = 80, 5, 5
CS = ts*cols
def load(name, s): return Image.open(f"{TILES}/{name}.png").convert("RGBA").resize((s, s), Image.LANCZOS)

def diamond_old(tiles):
    n=len(tiles); img=Image.new("RGBA",(CS,CS),(236,232,225,255))
    for r in range(rows):
        for c in range(cols):
            t=tiles[(r+c)%n].rotate(45,expand=True,resample=Image.BICUBIC)
            cx,cy=c*ts+ts//2,r*ts+ts//2
            img.paste(t,(cx-t.width//2,cy-t.height//2),t)
    return img.convert("RGB")

def diamond_new(tiles):
    # scale tile so the 45°-rotated copy fills the cell, then crop to the cell (no gaps)
    n=len(tiles); img=Image.new("RGBA",(CS,CS),(236,232,225,255))
    big=int(ts*math.sqrt(2))+2
    bigs=[t.resize((big,big),Image.LANCZOS) for t in tiles]
    for r in range(rows):
        for c in range(cols):
            t=bigs[(r+c)%n].rotate(45,expand=True,resample=Image.BICUBIC)
            cx,cy=t.width//2,t.height//2
            t=t.crop((cx-ts//2,cy-ts//2,cx-ts//2+ts,cy-ts//2+ts))
            img.paste(t,(c*ts,r*ts),t)
    return img.convert("RGB")

one=[load("star-compass",ts)]; two=[load("star-compass",ts),load("blue-floral-delft",ts)]
pad=16
W=2*CS+3*pad; H=2*(CS+24)+pad
sheet=Image.new("RGB",(W,H),"#f5f2ed"); d=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc",15)
except: font=ImageFont.load_default()
sheet.paste(diamond_old(one),(pad,pad)); d.text((pad,pad+CS+4),"OLD diamond 1 tile (huecos)",fill="#1a1a1a",font=font)
sheet.paste(diamond_old(two),(2*pad+CS,pad)); d.text((2*pad+CS,pad+CS+4),"OLD 2 tiles",fill="#1a1a1a",font=font)
sheet.paste(diamond_new(one),(pad,pad+CS+24)); d.text((pad,pad+2*CS+28),"NEW rombo lleno 1 tile",fill="#1a1a1a",font=font)
sheet.paste(diamond_new(two),(2*pad+CS,pad+CS+24)); d.text((2*pad+CS,pad+2*CS+28),"NEW 2 tiles",fill="#1a1a1a",font=font)
sheet.save("/tmp/diamond.png"); print("/tmp/diamond.png")

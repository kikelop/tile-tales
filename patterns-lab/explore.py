from PIL import Image, ImageDraw, ImageFont
TILES = "app/public/tiles"
ts, cols, rows = 48, 6, 6
CS = ts*cols
def load(n): return Image.open(f"{TILES}/{n}.png").convert("RGBA").resize((ts,ts), Image.LANCZOS)
A=load("blue-floral-delft"); B=load("star-blue-gold"); C=load("yellow-zellige")
def rot(t,d): return t.rotate(-d, resample=Image.BICUBIC)
def fh(t): return t.transpose(Image.FLIP_LEFT_RIGHT)
def fv(t): return t.transpose(Image.FLIP_TOP_BOTTOM)

def canvas(): return Image.new("RGBA",(CS,CS),(236,232,225,255))

def quarter(_):  # 1 tile: each cell rotated 90°·((row+col)%4)
    img=canvas()
    for r in range(rows+1):
        for c in range(cols+1):
            img.paste(rot(A,90*((r+c)%4)),(c*ts,r*ts),rot(A,90*((r+c)%4)))
    return img
def halfdrop(_):  # 1 tile: columns dropped half a tile
    img=canvas()
    for r in range(rows+1):
        for c in range(cols+1):
            off=ts//2 if c%2 else 0
            img.paste(A,(c*ts,r*ts-off),A)
    return img
def brick(_):  # 1 tile: rows offset half
    img=canvas()
    for r in range(rows+1):
        for c in range(cols+1):
            off=ts//2 if r%2 else 0
            img.paste(A,(c*ts-off,r*ts),A)
    return img
def mirrorH(_):
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            t=fh(A) if c%2 else A; img.paste(t,(c*ts,r*ts),t)
    return img
def spin(_):  # 1 tile: 2x2 windmill (each quadrant +90)
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            q=(r%2)*2+(c%2); img.paste(rot(A,90*q),(c*ts,r*ts),rot(A,90*q))
    return img
def checker(ts2):  # 2 tiles straight checkerboard
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            t=ts2[(r+c)%2]; img.paste(t,(c*ts,r*ts),t)
    return img
def stripesH(ts3):  # rows by tile
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            t=ts3[r%len(ts3)]; img.paste(t,(c*ts,r*ts),t)
    return img
def stripesV(ts3):  # columns by tile
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            t=ts3[c%len(ts3)]; img.paste(t,(c*ts,r*ts),t)
    return img
def block(ts4):  # 2x2 block of distinct tiles repeated
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            idx=(r%2)*2+(c%2); t=ts4[idx%len(ts4)]; img.paste(t,(c*ts,r*ts),t)
    return img
def frame(ts2):  # field tile + accent every 3rd in a centered ring
    img=canvas()
    for r in range(rows):
        for c in range(cols):
            accent = (r%3==1 and c%3==1)
            t=ts2[1] if accent else ts2[0]; img.paste(t,(c*ts,r*ts),t)
    return img

items=[
 ("1. Quarter-turn (1)",quarter(None)),
 ("2. Half-drop (1)",halfdrop(None)),
 ("3. Brick (1)",brick(None)),
 ("4. Mirror-H (1)",mirrorH(None)),
 ("5. Windmill (1)",spin(None)),
 ("6. Checkerboard (2)",checker([A,C])),
 ("7. Rows (3)",stripesH([A,B,C])),
 ("8. Columns (3)",stripesV([A,B,C])),
 ("9. Block 2x2 (3)",block([A,B,C,A])),
 ("10. Field+accent (2)",frame([C,A])),
]
pad=14; perrow=5; nrow=2
W=perrow*CS+(perrow+1)*pad; H=nrow*(CS+26)+pad
sheet=Image.new("RGB",(W,H),"#f5f2ed"); d=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc",14)
except: font=ImageFont.load_default()
for i,(lab,im) in enumerate(items):
    rr,cc=divmod(i,perrow); x=pad+cc*(CS+pad); y=pad+rr*(CS+26)
    sheet.paste(im,(x,y)); d.text((x,y+CS+4),lab,fill="#1a1a1a",font=font)
sheet.save("/tmp/explore.png"); print("/tmp/explore.png")

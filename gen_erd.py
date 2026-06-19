"""fridge.ai ERD v0.6 이미지 생성"""
from PIL import Image, ImageDraw, ImageFont
import math, os

# ── 색상 ────────────────────────────────────────────────────────
BG         = "#eaf1ea"
HDR_BG     = "#1e5c38"
HDR_FG     = "#ffffff"
ROW_BG     = "#ffffff"
ROW_ALT    = "#f5faf5"
ROW_FG     = "#1a2a1a"
BORDER     = "#b8d8be"
PK_BG      = "#2e7d32"; PK_FG  = "#ffffff"
FK_BG      = "#e65100"; FK_FG  = "#ffffff"
FKN_BG     = "#ffd180"; FKN_FG = "#7a4500"
NEW_BG     = "#d0edda"; NEW_FG = "#1b5e20"
ARROW      = "#2d6a4f"
ARROW_DASH = "#b08060"
LEGEND_BG  = "#ffffff"

# ── 폰트 ────────────────────────────────────────────────────────
FP  = r"C:\Windows\Fonts\malgun.ttf"
FPB = r"C:\Windows\Fonts\malgunbd.ttf"
if not os.path.exists(FP):
    FP  = r"C:\Windows\Fonts\arial.ttf"
    FPB = r"C:\Windows\Fonts\arialbd.ttf"

def fnt(sz, bold=False):
    try:    return ImageFont.truetype(FPB if bold else FP, sz)
    except: return ImageFont.load_default()

F_HDR   = fnt(13, bold=True)
F_FIELD = fnt(11)
F_FIELDB= fnt(11, bold=True)
F_BADGE = fnt(9,  bold=True)
F_SMALL = fnt(10)
F_TITLE = fnt(15, bold=True)
F_VER   = fnt(9)

# ── 테이블 스키마 (field, badge, is_new) ────────────────────────
TABLES = {
    "users": [
        ("id","PK",False),("email",None,False),("password_hash",None,False),
        ("created_at",None,False),("updated_at",None,False),
    ],
    "user_inventory": [
        ("id","PK",False),("user_id","FK",False),("ingredient_id","FK",False),
        ("quantity",None,False),("unit",None,False),("expires_at",None,False),
        ("status",None,False),("created_at",None,False),("updated_at",None,False),
    ],
    "consumption_logs": [
        ("id","PK",False),("user_id","FK",False),("inventory_id","FK",False),
        ("ingredient_id","FK",False),("recipe_id","FK?",False),
        ("type",None,False),("quantity_used",None,False),("unit",None,False),
        ("weight_g",None,False),("logged_at",None,False),
    ],
    "recipes": [
        ("id","PK",False),("name",None,False),("category",None,False),
        ("emoji",None,False),("source_url",None,False),("created_at",None,False),
    ],
    "ingredient_requests": [
        ("id","PK",False),("name",None,False),("requested_by","FK?",False),
        ("status",None,False),("requested_at",None,False),("reviewed_at",None,False),
    ],
    "categories": [
        ("id","PK",False),("name",None,False),("icon",None,False),
        ("sort_order",None,False),("created_at",None,False),
    ],
    "ingredients": [
        ("id","PK",False),("name",None,False),("category_id","FK",False),
        ("default_unit",None,False),("weight_per_unit_g",None,False),
        ("carbon_per_100g",None,False),
        ("shelf_days",None,False),
        ("expiry_ext_days",None,False),
        ("created_at",None,False),
    ],
    "recipe_ingredients": [
        ("id","PK",False),("recipe_id","FK",False),("ingredient_id","FK",False),
        ("is_required",None,False),("sort_order",None,False),
    ],
}

TW = 255; RH = 25; HH = 36; PAD = 5

POSITIONS = {
    "users":               (25,  45),
    "user_inventory":      (320, 45),
    "consumption_logs":    (620, 45),
    "recipes":             (970, 45),
    "ingredient_requests": (25,  355),
    "categories":          (320, 355),
    "ingredients":         (620, 355),
    "recipe_ingredients":  (970, 355),
}

IMG_W = 1265
IMG_H = 730

def th(name): return HH + len(TABLES[name]) * RH + 2

def fy(name, fi):
    _, oy = POSITIONS[name]
    return oy + HH + fi * RH + RH // 2

def badge(draw, x, y, text, bg, fg):
    bw = 28; bh = 15
    draw.rounded_rectangle([x, y, x+bw, y+bh], radius=3, fill=bg)
    draw.text((x+bw//2, y+bh//2), text, font=F_BADGE, fill=fg, anchor="mm")

def draw_table(draw, name, ox, oy):
    fields = TABLES[name]
    h = th(name)
    draw.rounded_rectangle([ox+3,oy+3,ox+TW+3,oy+h+3], radius=7, fill="#c0d4c0")
    draw.rounded_rectangle([ox,oy,ox+TW,oy+HH+8], radius=7, fill=HDR_BG)
    draw.rectangle([ox,oy+HH-4,ox+TW,oy+HH+8], fill=HDR_BG)
    draw.text((ox+TW//2, oy+HH//2+2), name, font=F_HDR, fill=HDR_FG, anchor="mm")
    draw.rectangle([ox,oy+HH,ox+TW,oy+h], fill=ROW_BG, outline=BORDER)
    for i,(fname,bdg,is_new) in enumerate(fields):
        ry = oy + HH + i * RH
        draw.rectangle([ox+1,ry,ox+TW-1,ry+RH-1], fill=(NEW_BG if is_new else (ROW_ALT if i%2 else ROW_BG)))
        draw.line([ox+1,ry+RH-1,ox+TW-1,ry+RH-1], fill=BORDER)
        if bdg:
            bc = PK_BG if bdg=="PK" else (FKN_BG if bdg=="FK?" else FK_BG)
            fc = PK_FG if bdg=="PK" else (FKN_FG if bdg=="FK?" else FK_FG)
            badge(draw, ox+PAD, ry+5, bdg, bc, fc)
            tx = ox+PAD+32
        else:
            tx = ox+PAD+6
        draw.text((tx, ry+RH//2), fname,
                  font=(F_FIELDB if is_new else F_FIELD),
                  fill=(NEW_FG if is_new else ROW_FG), anchor="lm")
    draw.rounded_rectangle([ox,oy,ox+TW,oy+h], radius=7, outline=BORDER, width=1)

def curved_arrow(draw, sx, sy, ex, ey, dashed=False, color=ARROW):
    mx = (sx+ex)//2
    segs = [(sx,sy),(mx,sy),(mx,ey),(ex,ey)]
    for i in range(len(segs)-1):
        x1,y1=segs[i]; x2,y2=segs[i+1]
        if not dashed:
            draw.line([(x1,y1),(x2,y2)], fill=color, width=2)
        else:
            d=math.hypot(x2-x1,y2-y1)
            if d==0: continue
            s,g=7,4; n=int(d/(s+g))
            for j in range(n+1):
                t1=min((j*(s+g))/d,1); t2=min((j*(s+g)+s)/d,1)
                draw.line([(x1+(x2-x1)*t1,y1+(y2-y1)*t1),(x1+(x2-x1)*t2,y1+(y2-y1)*t2)], fill=color, width=2)
    lx,ly=segs[-2]; ex2,ey2=segs[-1]
    ang=math.atan2(ey2-ly,ex2-lx); aw=8
    draw.polygon([(ex2,ey2),(ex2-aw*math.cos(ang-0.4),ey2-aw*math.sin(ang-0.4)),
                             (ex2-aw*math.cos(ang+0.4),ey2-aw*math.sin(ang+0.4))], fill=color)

def draw_legend(draw, x, y):
    items = [
        (PK_BG,PK_FG,"PK","기본 키 (Primary Key)"),
        (FK_BG,FK_FG,"FK","외래 키 (Foreign Key)"),
        (FKN_BG,FKN_FG,"FK?","NULL 허용 외래 키"),
    ]
    draw.rounded_rectangle([x-8,y-8,x+218,y+len(items)*22+6], radius=6, fill=LEGEND_BG, outline=BORDER)
    for i,(bg,fg,bdg,label) in enumerate(items):
        iy=y+i*22
        draw.rounded_rectangle([x,iy,x+28,iy+15], radius=3, fill=bg)
        draw.text((x+14,iy+7), bdg, font=F_BADGE, fill=fg, anchor="mm")
        draw.text((x+34,iy+7), label, font=F_SMALL, fill=ROW_FG, anchor="lm")

# ── 관계선 (from_table, from_fi, to_table, to_fi, dashed) ───────
RELS = [
    ("users",0,"user_inventory",1,False),
    ("ingredients",0,"user_inventory",2,False),
    ("user_inventory",0,"consumption_logs",2,False),
    ("users",0,"consumption_logs",1,False),
    ("ingredients",0,"consumption_logs",3,False),
    ("recipes",0,"consumption_logs",4,True),
    ("recipes",0,"recipe_ingredients",1,False),
    ("ingredients",0,"recipe_ingredients",2,False),
    ("categories",0,"ingredients",2,False),
    ("users",0,"ingredient_requests",2,True),
]

img  = Image.new("RGB",(IMG_W,IMG_H),BG)
draw = ImageDraw.Draw(img)

draw.text((IMG_W//2,12),"fridge.ai — ERD",font=F_TITLE,fill=HDR_BG,anchor="mt")

for ft,fi,tt,ti,dashed in RELS:
    fox,foy=POSITIONS[ft]; tox,toy=POSITIONS[tt]
    sy=fy(ft,fi); ey=fy(tt,ti)
    sx=fox+TW if tox>=fox else fox
    ex=tox+TW if fox>tox  else tox
    curved_arrow(draw,sx,sy,ex,ey,dashed=dashed,color=ARROW_DASH if dashed else ARROW)

for name,(ox,oy) in POSITIONS.items():
    draw_table(draw,name,ox,oy)

draw_legend(draw, IMG_W-238, IMG_H-108)
draw.text((8,IMG_H-14),"fridge.ai ERD  ·  2026-06-19",font=F_VER,fill="#7aaa7a")

out = r"C:\Users\tnals\fridge.ai\erd.jpg"
img.save(out,"JPEG",quality=95)
print(f"저장 완료: {out}")

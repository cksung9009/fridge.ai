"""fridge.ai ERD v0.3 JPG generator"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mp
import os

FIG_W, FIG_H = 20.0, 9.5
DPI = 120
TBL_W = 3.6
H_HDR = 0.54
H_ROW = 0.30

BG   = '#F4FAF6'
HDR  = '#1A6640'
HDR_T= '#FFFFFF'
PK_B = '#D4EDDA'
FK_B = '#FFF3CD'
RW_B = '#FFFFFF'
AT_B = '#F2FBF5'
BDR  = '#2C9A56'
PK_T = '#145A2E'
FK_T = '#7D5A00'
TXT  = '#2C3E50'
AW   = '#3D8B5F'

plt.rcParams['font.family'] = 'Malgun Gothic'

TABLES = {
    'users': ('users', [
        ('id','PK'),('email',None),('password_hash',None),
        ('created_at',None),('updated_at',None)]),
    'user_inventory': ('user_inventory', [
        ('id','PK'),('user_id','FK'),('ingredient_id','FK'),
        ('quantity',None),('unit',None),('expires_at',None),
        ('status',None),('created_at',None),('updated_at',None)]),
    'consumption_logs': ('consumption_logs', [
        ('id','PK'),('user_id','FK'),('inventory_id','FK'),
        ('ingredient_id','FK'),('recipe_id','FK?'),('type',None),
        ('quantity_used',None),('unit',None),('weight_g',None),('logged_at',None)]),
    'recipes': ('recipes', [
        ('id','PK'),('name',None),('category',None),
        ('emoji',None),('source_url',None),('created_at',None)]),
    'ingredient_requests': ('ingredient_requests', [
        ('id','PK'),('name',None),('requested_by','FK?'),
        ('status',None),('requested_at',None),('reviewed_at',None)]),
    'categories': ('categories', [
        ('id','PK'),('name',None),('icon',None),
        ('sort_order',None),('created_at',None)]),
    'ingredients': ('ingredients', [
        ('id','PK'),('name',None),('category_id','FK'),
        ('default_unit',None),('weight_per_unit_g',None),
        ('carbon_per_100g',None),('created_at',None)]),
    'recipe_ingredients': ('recipe_ingredients', [
        ('id','PK'),('recipe_id','FK'),('ingredient_id','FK'),
        ('is_required',None),('sort_order',None)]),
}

# grid layout: (col, row)  row 0=top
LAYOUT = {
    'users':               (0, 0),
    'user_inventory':      (1, 0),
    'consumption_logs':    (2, 0),
    'recipes':             (3, 0),
    'ingredient_requests': (0, 1),
    'categories':          (1, 1),
    'ingredients':         (2, 1),
    'recipe_ingredients':  (3, 1),
}

COL_XS = [0.4 + c * (TBL_W + 1.6) for c in range(4)]

def th(k):
    return H_HDR + len(TABLES[k][1]) * H_ROW

R0_YTOP = FIG_H - 0.5
R1_YTOP = R0_YTOP - max(th(k) for k, (c, r) in LAYOUT.items() if r == 0) - 0.60

def xl(k): return COL_XS[LAYOUT[k][0]]
def yt(k): return R0_YTOP if LAYOUT[k][1] == 0 else R1_YTOP

fig, ax = plt.subplots(figsize=(FIG_W, FIG_H), dpi=DPI)
ax.set_xlim(0, FIG_W)
ax.set_ylim(0, FIG_H)
ax.axis('off')
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

C = {}  # connectors

def draw_table(k):
    title, cols = TABLES[k]
    xL = xl(k); yT = yt(k)
    xR = xL + TBL_W; xC = xL + TBL_W / 2
    h = th(k); yB = yT - h

    # drop shadow
    ax.add_patch(mp.FancyBboxPatch((xL+0.08, yB-0.08), TBL_W, h,
        boxstyle='round,pad=0.02', fc='#00000014', ec='none', zorder=1))
    # body
    ax.add_patch(mp.FancyBboxPatch((xL, yB), TBL_W, h,
        boxstyle='round,pad=0.02', fc=RW_B, ec=BDR, lw=1.5, zorder=2))
    # header bg
    ax.add_patch(mp.Rectangle((xL, yT-H_HDR), TBL_W, H_HDR, fc=HDR, ec='none', zorder=3))
    fs = 8.0 if len(title) > 15 else 9.0
    ax.text(xC, yT - H_HDR/2, title, ha='center', va='center',
            fontsize=fs, fontweight='bold', color=HDR_T, zorder=4)

    for i, (col, attr) in enumerate(cols):
        ry = yT - H_HDR - i * H_ROW
        rc = ry - H_ROW / 2
        if attr == 'PK':
            bg, tc, badge_c = PK_B, PK_T, BDR
        elif attr in ('FK', 'FK?'):
            bg, tc, badge_c = FK_B, FK_T, '#B8860B'
        else:
            bg, tc, badge_c = (AT_B if i % 2 else RW_B), TXT, ''

        ax.add_patch(mp.Rectangle((xL, ry-H_ROW), TBL_W, H_ROW, fc=bg, ec='none', zorder=3))
        ax.plot([xL, xR], [ry, ry], color='#D0E8D6', lw=0.5, zorder=4)

        if attr:
            bx, bw, bh = xL+0.10, 0.43, H_ROW * 0.64
            ax.add_patch(mp.Rectangle((bx, rc-bh/2), bw, bh,
                fc=PK_B if attr=='PK' else '#FEF0C7',
                ec=badge_c, lw=0.8, zorder=5))
            ax.text(bx+bw/2, rc, attr, ha='center', va='center',
                    fontsize=5.8, fontweight='bold', color=badge_c, zorder=6)
            ax.text(xL+0.62, rc, col, va='center', fontsize=7.0,
                    color=tc, family='monospace', zorder=5)
        else:
            ax.text(xL+0.20, rc, col, va='center', fontsize=7.0,
                    color=tc, family='monospace', zorder=5)

    ax.plot([xL, xR], [yT-H_HDR, yT-H_HDR], color='#156631', lw=0.9, zorder=4)
    ax.add_patch(mp.FancyBboxPatch((xL, yB), TBL_W, h,
        boxstyle='round,pad=0.02', fc='none', ec=BDR, lw=1.5, zorder=7))

    C[k] = dict(L=(xL,(yT+yB)/2), R=(xR,(yT+yB)/2),
                T=(xC,yT), B=(xC,yB),
                xL=xL, xR=xR, yT=yT, yB=yB, xC=xC)

for k in TABLES:
    draw_table(k)

def arr(p1, p2, rad=0.0, lbl='', dashed=False, color=AW, ox=0.0, oy=0.12):
    x1,y1 = p1; x2,y2 = p2
    ls = (0,(5,3)) if dashed else 'solid'
    ax.annotate('', xy=(x2,y2), xytext=(x1,y1),
        arrowprops=dict(arrowstyle='-|>', color=color, lw=1.2, linestyle=ls,
                        mutation_scale=11,
                        connectionstyle=f'arc3,rad={rad}'), zorder=6)
    if lbl:
        mx = (x1+x2)/2 + ox
        my = (y1+y2)/2 + oy
        ax.text(mx, my, lbl, ha='center', va='bottom', fontsize=5.8,
                color=color, style='italic',
                bbox=dict(fc=BG, ec='none', pad=0.6, alpha=0.88), zorder=8)

# ─── ARROWS ───────────────────────────────────────────────────────────────
# same row horizontal
arr(C['users']['R'],         C['user_inventory']['L'],      lbl='user_id')
arr(C['user_inventory']['R'],C['consumption_logs']['L'],    lbl='inventory_id')
arr(C['categories']['R'],    C['ingredients']['L'],         lbl='category_id')
arr(C['ingredients']['R'],   C['recipe_ingredients']['L'],  lbl='ingredient_id')

# users → consumption_logs (skip user_inventory, curved above)
arr(C['users']['R'], C['consumption_logs']['L'], rad=0.32, lbl='user_id',
    color='#4F7B63', oy=0.18)

# users → ingredient_requests (vertical down same col)
arr(C['users']['B'], C['ingredient_requests']['T'], lbl='requested_by?',
    color='#7DAA8A', ox=0.35, oy=0.05)

# recipes → recipe_ingredients (vertical down same col)
arr(C['recipes']['B'], C['recipe_ingredients']['T'], lbl='recipe_id', ox=0.30)

# recipes → consumption_logs (horizontal left, dashed = optional FK)
arr(C['recipes']['L'], C['consumption_logs']['R'],
    rad=-0.22, lbl='recipe_id?', dashed=True, color='#A08040', oy=0.14)

# ingredients → user_inventory (cross: col2-row1 → col1-row0, up+left)
p1 = (C['ingredients']['xL'] + 0.4, C['ingredients']['yT'])
p2 = (C['user_inventory']['xC'] - 0.2, C['user_inventory']['yB'])
arr(p1, p2, rad=-0.30, lbl='ingredient_id', color='#4F7B63', ox=-0.5, oy=0.08)

# ingredients → consumption_logs (same col, cross-row, straight up)
p1 = (C['ingredients']['xC'] + 0.25, C['ingredients']['yT'])
p2 = (C['consumption_logs']['xC'] + 0.25, C['consumption_logs']['yB'])
arr(p1, p2, rad=0.0, lbl='ingredient_id', color='#4F7B63', ox=0.45, oy=0.06)

# ─── TITLE ────────────────────────────────────────────────────────────────
TBL_BOTTOM = R1_YTOP - max(th(k) for k, (c, r) in LAYOUT.items() if r == 1) - 0.35

# ─── LEGEND ───────────────────────────────────────────────────────────────
lx, ly = FIG_W - 3.4, TBL_BOTTOM - 0.10
for tag, bg, ec, tc, desc in [
    ('PK',  PK_B, BDR,      PK_T, '기본 키 (Primary Key)'),
    ('FK',  FK_B, '#B8860B', FK_T, '외래 키 (Foreign Key)'),
    ('FK?', FK_B, '#B8860B', FK_T, 'NULL 허용 외래 키'),
]:
    ax.add_patch(mp.Rectangle((lx, ly), 0.46, 0.26, fc=bg, ec=ec, lw=0.9, zorder=8))
    ax.text(lx+0.23, ly+0.13, tag, ha='center', va='center',
            fontsize=5.8, fontweight='bold', color=ec, zorder=9)
    ax.text(lx+0.60, ly+0.13, desc, va='center', fontsize=7.5, color=TXT, zorder=9)
    ly -= 0.36

# ─── SAVE ─────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(__file__), 'erd.jpg')
fig.savefig(out, format='jpeg', dpi=DPI, bbox_inches='tight',
            facecolor=BG, pil_kwargs={'quality': 95})
plt.close()
print(f'saved: {out}')

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.font_manager as fm
from matplotlib.patches import FancyArrowPatch

# 맑은 고딕 (Windows 기본 한글 폰트) 등록
_font_path = r"C:\Windows\Fonts\malgun.ttf"
fm.fontManager.addfont(_font_path)
plt.rcParams["font.family"] = fm.FontProperties(fname=_font_path).get_name()
plt.rcParams["axes.unicode_minus"] = False

# ── 테이블 정의 ───────────────────────────────────────────────
TABLES = {
    "categories": {
        "columns": [
            ("id",         "INT",          "PK"),
            ("name",       "VARCHAR(50)",  ""),
            ("icon",       "VARCHAR(10)",  ""),
            ("sort_order", "INT",          ""),
            ("created_at", "TIMESTAMP",    ""),
        ],
        "color": "#4A90D9",
    },
    "ingredients": {
        "columns": [
            ("id",                "INT",           "PK"),
            ("name",              "VARCHAR(100)",  "UNIQUE"),
            ("category_id",       "INT",           "FK"),
            ("default_unit",      "VARCHAR(20)",   ""),
            ("weight_per_unit_g", "DECIMAL(8,2)",  ""),
            ("carbon_per_100g",   "DECIMAL(8,4)",  ""),
            ("created_at",        "TIMESTAMP",     ""),
        ],
        "color": "#4A90D9",
    },
    "users": {
        "columns": [
            ("id",            "INT",          "PK"),
            ("email",         "VARCHAR(255)", "UNIQUE"),
            ("password_hash", "VARCHAR(255)", ""),
            ("created_at",    "TIMESTAMP",    ""),
            ("updated_at",    "TIMESTAMP",    ""),
        ],
        "color": "#27AE60",
    },
    "user_inventory": {
        "columns": [
            ("id",            "INT",           "PK"),
            ("user_id",       "INT",           "FK"),
            ("ingredient_id", "INT",           "FK"),
            ("quantity",      "DECIMAL(8,2)",  ""),
            ("unit",          "VARCHAR(20)",   ""),
            ("expires_at",    "DATE",          ""),
            ("status",        "ENUM",          ""),
            ("created_at",    "TIMESTAMP",     ""),
            ("updated_at",    "TIMESTAMP",     ""),
        ],
        "color": "#E67E22",
    },
    "consumption_logs": {
        "columns": [
            ("id",               "INT",          "PK"),
            ("user_id",          "INT",          "FK"),
            ("inventory_id",     "INT",          "FK"),
            ("ingredient_id",    "INT",          "FK"),
            ("type",             "ENUM",         ""),
            ("quantity_used",    "DECIMAL(8,2)", ""),
            ("unit",             "VARCHAR(20)",  ""),
            ("weight_g",         "DECIMAL(10,2)",""),
            ("youtube_video_id", "VARCHAR(20)",  "NULL"),
            ("logged_at",        "TIMESTAMP",    ""),
        ],
        "color": "#8E44AD",
    },
}

# ── 테이블 위치 (x, y) ────────────────────────────────────────
POSITIONS = {
    "categories":       (0.5,  9.2),
    "ingredients":      (4.5,  9.2),
    "users":            (0.5,  4.2),
    "user_inventory":   (4.5,  4.2),
    "consumption_logs": (9.0,  4.2),
}

# ── 관계선 (from_table, to_table, label) ──────────────────────
RELATIONS = [
    ("categories",    "ingredients",     "1 : N"),
    ("users",         "user_inventory",  "1 : N"),
    ("ingredients",   "user_inventory",  "1 : N"),
    ("users",         "consumption_logs","1 : N"),
    ("user_inventory","consumption_logs","1 : N"),
    ("ingredients",   "consumption_logs","1 : N"),
]

ROW_H   = 0.38
HEAD_H  = 0.52
PAD     = 0.18
COL_W   = 3.6

def table_height(name):
    return HEAD_H + len(TABLES[name]["columns"]) * ROW_H + PAD

def draw_table(ax, name, x, y):
    info = TABLES[name]
    cols = info["columns"]
    color = info["color"]
    h = table_height(name)

    # 외곽선
    rect = mpatches.FancyBboxPatch(
        (x, y - h), COL_W, h,
        boxstyle="round,pad=0.05",
        linewidth=1.5, edgecolor="#2C3E50",
        facecolor="white", zorder=2
    )
    ax.add_patch(rect)

    # 헤더
    header = mpatches.FancyBboxPatch(
        (x, y - HEAD_H), COL_W, HEAD_H,
        boxstyle="round,pad=0.05",
        linewidth=0, edgecolor=color,
        facecolor=color, zorder=3
    )
    ax.add_patch(header)
    ax.text(x + COL_W / 2, y - HEAD_H / 2, name,
            ha="center", va="center", fontsize=9.5,
            fontweight="bold", color="white", zorder=4)

    # 컬럼 행
    for i, (col, dtype, tag) in enumerate(cols):
        cy = y - HEAD_H - (i + 0.5) * ROW_H

        # 짝수 행 배경
        if i % 2 == 0:
            bg = mpatches.Rectangle(
                (x + 0.03, cy - ROW_H / 2), COL_W - 0.06, ROW_H,
                facecolor="#F4F6F9", zorder=2
            )
            ax.add_patch(bg)

        # PK / FK 태그
        if tag == "PK":
            ax.text(x + 0.18, cy, "PK", ha="center", va="center",
                    fontsize=6, fontweight="bold", color="white",
                    bbox=dict(boxstyle="round,pad=0.15", fc="#E74C3C", ec="none"),
                    zorder=5)
            col_x = x + 0.38
        elif tag == "FK":
            ax.text(x + 0.18, cy, "FK", ha="center", va="center",
                    fontsize=6, fontweight="bold", color="white",
                    bbox=dict(boxstyle="round,pad=0.15", fc="#E67E22", ec="none"),
                    zorder=5)
            col_x = x + 0.38
        else:
            col_x = x + 0.20

        # 컬럼명
        ax.text(col_x, cy, col, ha="left", va="center",
                fontsize=7.5, color="#2C3E50", zorder=5)

        # 타입
        tag_text = f"  [{tag}]" if tag in ("UNIQUE", "NULL") else ""
        ax.text(x + COL_W - 0.12, cy, dtype + tag_text,
                ha="right", va="center", fontsize=6.5,
                color="#7F8C8D", zorder=5)

        # 구분선
        if i < len(cols) - 1:
            ax.plot([x + 0.05, x + COL_W - 0.05],
                    [cy - ROW_H / 2, cy - ROW_H / 2],
                    color="#DDE1E7", linewidth=0.4, zorder=3)

    return x + COL_W / 2, y - h / 2   # 중심점 반환

def table_center(name):
    x, y = POSITIONS[name]
    h = table_height(name)
    return x + COL_W / 2, y - h / 2

def table_bbox(name):
    x, y = POSITIONS[name]
    h = table_height(name)
    return x, y - h, x + COL_W, y   # left, bottom, right, top

# ── 캔버스 ────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(17, 13))
ax.set_xlim(-0.3, 13.5)
ax.set_ylim(-1.0, 12)
ax.axis("off")
ax.set_facecolor("#F0F3F7")
fig.patch.set_facecolor("#F0F3F7")

# 배경 격자 느낌
for gx in [i * 0.5 for i in range(28)]:
    ax.axvline(gx, color="#E8ECF0", linewidth=0.3, zorder=0)
for gy in [i * 0.5 for i in range(25)]:
    ax.axhline(gy, color="#E8ECF0", linewidth=0.3, zorder=0)

# 관계선 먼저 (테이블 아래에)
for src, dst, label in RELATIONS:
    sx, sy = table_center(src)
    dx, dy = table_center(dst)
    sl, sb, sr, st = table_bbox(src)
    dl, db, dr, dt = table_bbox(dst)

    # 테이블 경계에서 출발/도착점 계산
    if sr < dl:   # src 오른쪽 → dst 왼쪽
        p1, p2 = (sr, sy), (dl, dy)
    elif sl > dr: # src 왼쪽 ← dst 오른쪽
        p1, p2 = (sl, sy), (dr, dy)
    elif st < db: # src 위 → dst 아래
        p1, p2 = (sx, st), (dx, db)
    else:         # src 아래 → dst 위
        p1, p2 = (sx, sb), (dx, dt)

    ax.annotate("",
        xy=p2, xytext=p1,
        arrowprops=dict(
            arrowstyle="-|>",
            color="#95A5A6",
            lw=1.2,
            connectionstyle="arc3,rad=0.05"
        ),
        zorder=1
    )
    mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
    ax.text(mx, my + 0.12, label, ha="center", va="bottom",
            fontsize=6.5, color="#7F8C8D",
            bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.8))

# 테이블 그리기
for name, (x, y) in POSITIONS.items():
    draw_table(ax, name, x, y)

# 타이틀
ax.text(6.6, 11.6, "fridge.ai — ERD",
        ha="center", va="center", fontsize=16,
        fontweight="bold", color="#2C3E50")
ax.text(6.6, 11.2, "v0.2  |  2026-06-14  |  MySQL",
        ha="center", va="center", fontsize=9, color="#7F8C8D")

# 범례
legend_items = [
    mpatches.Patch(color="#4A90D9", label="마스터 테이블"),
    mpatches.Patch(color="#27AE60", label="사용자"),
    mpatches.Patch(color="#E67E22", label="재고"),
    mpatches.Patch(color="#8E44AD", label="이력"),
]
ax.legend(handles=legend_items, loc="lower right",
          fontsize=8, framealpha=0.9, edgecolor="#BDC3C7")

plt.tight_layout(pad=0.5)
plt.savefig("erd.jpg", dpi=180, bbox_inches="tight",
            facecolor=fig.get_facecolor())
print("erd.jpg 생성 완료")

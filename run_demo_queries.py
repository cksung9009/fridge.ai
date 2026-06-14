"""fridge.ai 데모 쿼리 실행 → query_results.md 생성 (SQLite 사용)"""
import sqlite3, textwrap, datetime

TODAY = "2026-06-14"

# ── DB 초기화 ──────────────────────────────────────────────────
conn = sqlite3.connect(":memory:")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.executescript("""
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, category_id INTEGER NOT NULL,
    default_unit TEXT NOT NULL,
    weight_per_unit_g REAL NOT NULL, carbon_per_100g REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL, unit TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE consumption_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, inventory_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    type TEXT NOT NULL, quantity_used REAL NOT NULL, unit TEXT NOT NULL,
    weight_g REAL NOT NULL, youtube_video_id TEXT,
    logged_at TEXT DEFAULT CURRENT_TIMESTAMP
);
""")

# ── 시드 데이터 ────────────────────────────────────────────────
cur.executemany("INSERT INTO categories(name,icon,sort_order) VALUES(?,?,?)", [
    ('채소','🥦',1),('육류','🥩',2),('유제품','🥛',3),
    ('두부/콩','🫘',4),('조미료','🧂',5),('기타','🛒',6),
])
cur.executemany(
    "INSERT INTO ingredients(name,category_id,default_unit,weight_per_unit_g,carbon_per_100g) VALUES(?,?,?,?,?)", [
    ('감자',1,'개',150,0.0460),('양파',1,'개',200,0.0500),
    ('대파',1,'개',100,0.0300),('당근',1,'개',120,0.0420),
    ('시금치',1,'봉',200,0.0350),('돼지고기',2,'팩',500,0.7100),
    ('닭가슴살',2,'팩',400,0.6900),('달걀',3,'개',60,0.1800),
    ('우유',3,'팩',900,0.0900),('두부',4,'모',300,0.0700),
    ('간장',5,'병',1000,0.0200),('참기름',5,'병',500,0.0300),
])
cur.execute("INSERT INTO users(email,password_hash) VALUES(?,?)",
            ('guest@fridge.ai','$2b$10$demohash'))
cur.executemany(
    "INSERT INTO user_inventory(user_id,ingredient_id,quantity,unit,expires_at,status) VALUES(?,?,?,?,?,?)", [
    (1,1,3,'개','2026-06-15','active'),
    (1,2,1,'개','2026-06-16','active'),
    (1,8,6,'개','2026-06-17','active'),
    (1,10,1,'모','2026-06-19','active'),
    (1,6,1,'팩','2026-06-20','active'),
    (1,9,1,'팩','2026-06-22','active'),
    (1,3,2,'개','2026-06-28','active'),
    (1,11,1,'병','2026-12-31','active'),
])
cur.executemany(
    "INSERT INTO consumption_logs(user_id,inventory_id,ingredient_id,type,quantity_used,unit,weight_g,youtube_video_id,logged_at) VALUES(?,?,?,?,?,?,?,?,?)", [
    (1,1,1,'cooked',2,'개',300,'dQw4w9WgXcQ','2026-06-10 19:30:00'),
    (1,2,2,'cooked',1,'개',200,'dQw4w9WgXcQ','2026-06-10 19:30:00'),
    (1,3,8,'cooked',2,'개',120,None,'2026-06-11 12:00:00'),
    (1,6,9,'cooked',1,'팩',900,None,'2026-06-12 08:00:00'),
    (1,4,10,'wasted',1,'모',300,None,'2026-06-09 10:00:00'),
    (1,5,6,'wasted',1,'팩',500,None,'2026-06-08 18:00:00'),
])
conn.commit()

# ── 마크다운 테이블 생성 헬퍼 ──────────────────────────────────
def md_table(rows, headers):
    col_w = [len(h) for h in headers]
    str_rows = []
    for row in rows:
        sr = [str(v) if v is not None else "NULL" for v in row]
        str_rows.append(sr)
        for i, v in enumerate(sr):
            col_w[i] = max(col_w[i], len(v))
    sep = "| " + " | ".join("-" * w for w in col_w) + " |"
    head = "| " + " | ".join(h.ljust(col_w[i]) for i, h in enumerate(headers)) + " |"
    lines = [head, sep]
    for sr in str_rows:
        lines.append("| " + " | ".join(v.ljust(col_w[i]) for i, v in enumerate(sr)) + " |")
    return "\n".join(lines)

# ── 쿼리 실행 ─────────────────────────────────────────────────
sections = []

# Q1. 재고 대시보드
cur.execute(f"""
SELECT i.name AS 재료명, c.name AS 카테고리,
       ui.quantity AS 수량, ui.unit AS 단위, ui.expires_at AS 유통기한,
       CAST(julianday(ui.expires_at) - julianday('{TODAY}') AS INTEGER) AS D_day,
       CASE
           WHEN julianday(ui.expires_at) - julianday('{TODAY}') < 0 THEN '만료'
           WHEN julianday(ui.expires_at) - julianday('{TODAY}') <= 2 THEN '⚠️ 위험'
           WHEN julianday(ui.expires_at) - julianday('{TODAY}') <= 5 THEN '🔶 임박'
           ELSE '✅ 여유'
       END AS 상태
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
JOIN categories  c ON i.category_id = c.id
WHERE ui.user_id = 1 AND ui.status = 'active'
ORDER BY ui.expires_at ASC
""")
rows = cur.fetchall()
headers = list(rows[0].keys())
sections.append(("Q1. 재고 대시보드 (D-day 정렬)", md_table([list(r) for r in rows], headers)))

# Q2. YouTube 추천 쿼리
cur.execute(f"""
SELECT GROUP_CONCAT(i.name, ' ') AS youtube_search_query
FROM (
    SELECT ui.ingredient_id, ui.expires_at
    FROM user_inventory ui
    WHERE ui.user_id = 1 AND ui.status = 'active'
    ORDER BY ui.expires_at ASC LIMIT 3
) ui
JOIN ingredients i ON ui.ingredient_id = i.id
""")
rows = cur.fetchall()
sections.append(("Q2. YouTube 추천 검색 쿼리 (임박 재료 TOP 3)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q3. 월간 환경 리포트
cur.execute("""
SELECT
    ROUND(SUM(cl.weight_g), 2)                              AS 총_절감량_g,
    ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 4)   AS 탄소절감_kg,
    COUNT(*)                                                 AS 조리_완료_횟수
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = 1 AND cl.type = 'cooked'
  AND cl.logged_at >= '2026-06-01'
""")
rows = cur.fetchall()
sections.append(("Q3. 월간 환경 리포트 (2026-06)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q4. 월간 폐기 분석
cur.execute("""
SELECT COUNT(*) AS 폐기_횟수,
       SUM(cl.weight_g) AS 폐기량_g,
       ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 4) AS 폐기_탄소_kg
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = 1 AND cl.type = 'wasted'
  AND cl.logged_at >= '2026-06-01'
""")
rows = cur.fetchall()
sections.append(("Q4. 월간 폐기 분석 (2026-06)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q5. 자동완성 검색
cur.execute("""
SELECT i.id, i.name AS 재료명, c.name AS 카테고리, i.default_unit AS 기본단위
FROM ingredients i
JOIN categories c ON i.category_id = c.id
WHERE i.name LIKE '%감%'
LIMIT 10
""")
rows = cur.fetchall()
sections.append(("Q5. 재료 자동완성 검색 (키워드: '감')", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q6. 카테고리별 재료 목록
cur.execute("""
SELECT i.id, i.name AS 재료명, i.default_unit AS 단위,
       i.weight_per_unit_g AS 기본무게_g, i.carbon_per_100g AS 탄소_kg
FROM ingredients i
WHERE i.category_id = 1
ORDER BY i.name
""")
rows = cur.fetchall()
sections.append(("Q6. 카테고리별 재료 목록 (채소)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# ── query_results.md 작성 ─────────────────────────────────────
with open("query_results.md", "w", encoding="utf-8") as f:
    f.write("# fridge.ai — 데모 쿼리 실행 결과\n\n")
    f.write(f"- **기준일:** {TODAY}\n")
    f.write(f"- **데모 사용자:** guest@fridge.ai (user_id = 1)\n")
    f.write(f"- **생성일:** {datetime.date.today()}\n\n---\n\n")
    for title, table in sections:
        f.write(f"## {title}\n\n")
        f.write(table + "\n\n---\n\n")

print("query_results.md 생성 완료")
conn.close()

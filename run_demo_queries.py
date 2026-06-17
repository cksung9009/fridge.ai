"""fridge.ai 데모 쿼리 실행 → query_results.md 생성 (SQLite 사용)"""
import sqlite3, datetime

TODAY = datetime.date.today().isoformat()

conn = sqlite3.connect(":memory:")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.executescript("""
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0
);
CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, category_id INTEGER NOT NULL,
    default_unit TEXT NOT NULL,
    weight_per_unit_g REAL NOT NULL, carbon_per_100g REAL NOT NULL
);
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL
);
CREATE TABLE user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL, unit TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, category TEXT NOT NULL, emoji TEXT
);
CREATE TABLE recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL, ingredient_id INTEGER NOT NULL,
    is_required INTEGER NOT NULL DEFAULT 1, sort_order INTEGER DEFAULT 0
);
CREATE TABLE consumption_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, inventory_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL, recipe_id INTEGER,
    type TEXT NOT NULL, quantity_used REAL NOT NULL, unit TEXT NOT NULL,
    weight_g REAL NOT NULL, logged_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ingredient_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, requested_by INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', requested_at TEXT DEFAULT CURRENT_TIMESTAMP
);
""")

# ── 카테고리 ──────────────────────────────────────────────────────
cur.executemany("INSERT INTO categories(name,icon,sort_order) VALUES(?,?,?)", [
    ('채소','🥦',1),('육류','🥩',2),('해산물','🐟',3),
    ('달걀/유제품','🥚',4),('두부/콩류','🫘',5),('버섯류','🍄',6),
    ('곡류/면류','🌾',7),('과일','🍎',8),('조미료/양념','🧂',9),('기타','🛒',10),
])

# ── 재료 마스터 ───────────────────────────────────────────────────
cur.executemany(
    "INSERT INTO ingredients(name,category_id,default_unit,weight_per_unit_g,carbon_per_100g) VALUES(?,?,?,?,?)", [
    ('감자',1,'개',150,0.046),('양파',1,'개',200,0.05),
    ('대파',1,'대',100,0.03),('당근',1,'개',120,0.042),
    ('시금치',1,'단',200,0.035),('상추',1,'봉',100,0.025),
    ('콩나물',1,'봉',200,0.022),('애호박',1,'개',250,0.028),
    ('돼지고기(삼겹살)',2,'팩',500,0.71),('닭가슴살',2,'팩',400,0.69),
    ('소고기(불고기용)',2,'팩',400,2.1),
    ('고등어',3,'마리',400,0.43),('새우',3,'팩',200,0.68),('오징어',3,'마리',300,0.52),
    ('달걀',4,'개',60,0.18),('우유',4,'팩',900,0.09),
    ('두부',5,'모',300,0.07),('순두부',5,'팩',300,0.07),
    ('표고버섯',6,'팩',150,0.041),('팽이버섯',6,'봉',150,0.038),
    ('쌀',7,'봉',1000,0.16),('라면',7,'개',120,0.38),
    ('바나나',8,'개',120,0.048),('딸기',8,'팩',300,0.037),
    ('간장',9,'병',1000,0.02),('된장',9,'통',500,0.025),
    ('고추장',9,'통',500,0.027),('참기름',9,'병',500,0.03),
    ('다진마늘(튜브)',9,'개',100,0.036),
])

cur.execute("INSERT INTO users(email,password_hash) VALUES(?,?)",
            ('guest@fridge.ai','$2b$10$demohash'))

# ── 재고 (CURDATE 기준 상대 오프셋) ──────────────────────────────
def exp(n):
    d = datetime.date.today() + datetime.timedelta(days=n)
    return d.isoformat()

cur.executemany(
    "INSERT INTO user_inventory(user_id,ingredient_id,quantity,unit,expires_at,status) VALUES(?,?,?,?,?,?)", [
    (1,15,10,'개',exp(0),'active'),   # 달걀      D-0
    (1,17, 1,'모',exp(1),'active'),   # 두부      D-1
    (1, 3, 1,'대',exp(1),'active'),   # 대파      D-1
    (1,13, 1,'팩',exp(1),'active'),   # 새우      D-1
    (1,12, 2,'마리',exp(2),'active'), # 고등어    D-2
    (1, 5, 1,'단',exp(2),'active'),   # 시금치    D-2
    (1, 6, 1,'봉',exp(2),'active'),   # 상추      D-2
    (1,14, 1,'마리',exp(2),'active'), # 오징어    D-2
    (1,11, 1,'팩',exp(2),'active'),   # 소고기    D-2
    (1,10, 1,'팩',exp(3),'active'),   # 닭가슴살  D-3
    (1, 9, 1,'팩',exp(3),'active'),   # 돼지고기  D-3
    (1,23, 3,'개',exp(3),'active'),   # 바나나    D-3
    (1,18, 1,'팩',exp(3),'active'),   # 순두부    D-3
    (1,19, 1,'팩',exp(3),'active'),   # 표고버섯  D-3
    (1,20, 1,'봉',exp(3),'active'),   # 팽이버섯  D-3
    (1, 2, 2,'개',exp(6),'active'),   # 양파      D-6
    (1, 1, 3,'개',exp(8),'active'),   # 감자      D-8
    (1,16, 1,'팩',exp(4),'active'),   # 우유      D-4
    (1,25, 1,'병',exp(199),'active'), # 간장
    (1,26, 1,'통',exp(199),'active'), # 된장
    (1,27, 1,'통',exp(199),'active'), # 고추장
    (1,28, 1,'병',exp(199),'active'), # 참기름
    (1,29, 1,'개',exp(199),'active'), # 다진마늘
])

# ── 레시피 마스터 ──────────────────────────────────────────────────
cur.executemany("INSERT INTO recipes(name,category,emoji) VALUES(?,?,?)", [
    ('된장찌개','국/찌개','🍲'),('제육볶음','볶음','🥓'),('달걀볶음밥','밥/면','🍳'),
    ('시금치나물','무침','🥬'),('두부조림','조림','⬜'),('소고기볶음','볶음','🥩'),
    ('해물파전','전/부침','🦑'),('고등어구이','구이','🐟'),('오징어볶음','볶음','🦑'),
    ('닭볶음탕','조림','🍗'),
])

# ── 레시피↔재료 매핑 (is_required 1=주재료, 0=조미료) ────────────
cur.executemany("INSERT INTO recipe_ingredients(recipe_id,ingredient_id,is_required,sort_order) VALUES(?,?,?,?)", [
    (1,17,1,1),(1,8,1,2),(1,3,1,3),(1,1,1,4),(1,26,0,5),(1,29,0,6),  # 된장찌개
    (2,9,1,1),(2,2,1,2),(2,3,1,3),(2,27,0,4),(2,25,0,5),               # 제육볶음
    (3,15,1,1),(3,21,1,2),(3,4,1,3),(3,3,1,4),(3,25,0,5),(3,28,0,6),  # 달걀볶음밥
    (4,5,1,1),(4,29,0,2),(4,28,0,3),                                    # 시금치나물
    (5,17,1,1),(5,3,1,2),(5,25,0,3),(5,27,0,4),(5,28,0,5),            # 두부조림
    (6,11,1,1),(6,2,1,2),(6,19,1,3),(6,3,0,4),(6,25,0,5),(6,28,0,6), # 소고기볶음
    (7,13,1,1),(7,14,1,2),(7,3,1,3),(7,15,1,4),(7,25,0,5),            # 해물파전
    (8,12,1,1),                                                          # 고등어구이
    (9,14,1,1),(9,2,1,2),(9,27,0,3),                                   # 오징어볶음
    (10,10,1,1),(10,1,1,2),(10,4,1,3),(10,3,1,4),(10,25,0,5),(10,27,0,6), # 닭볶음탕
])

# ── 소진 기록 (지난 3주) ──────────────────────────────────────────
def past(n): return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()
cur.executemany(
    "INSERT INTO consumption_logs(user_id,inventory_id,ingredient_id,recipe_id,type,quantity_used,unit,weight_g,logged_at) VALUES(?,?,?,?,?,?,?,?,?)", [
    (1, 1,15,3,'cooked',2,'개',120,past(21)+' 19:00:00'),
    (1, 2,17,1,'cooked',1,'모',300,past(20)+' 12:00:00'),
    (1, 3, 3,1,'cooked',1,'대',100,past(20)+' 12:00:00'),
    (1, 4, 5,4,'cooked',1,'단',200,past(19)+' 18:30:00'),
    (1, 5, 9,2,'cooked',1,'팩',500,past(18)+' 19:00:00'),
    (1, 6, 2,2,'cooked',1,'개',200,past(18)+' 19:00:00'),
    (1, 7,10,None,'cooked',1,'팩',400,past(17)+' 12:00:00'),
    (1, 8, 7,None,'cooked',1,'봉',200,past(16)+' 08:00:00'),
    (1, 9,15,3,'cooked',2,'개',120,past(15)+' 09:00:00'),
    (1,10,17,5,'cooked',1,'모',300,past(14)+' 19:00:00'),
    (1,11,11,6,'cooked',1,'팩',400,past(13)+' 19:00:00'),
    (1,12, 3,1,'cooked',1,'대',100,past(12)+' 12:00:00'),
    (1,13,16,None,'cooked',1,'팩',900,past(11)+' 08:00:00'),
    (1,14,19,6,'cooked',1,'팩',150,past(10)+' 19:00:00'),
    (1,15, 9,2,'cooked',1,'팩',500,past(9)+' 19:00:00'),
    (1,16,12,8,'cooked',1,'마리',400,past(8)+' 18:00:00'),
    (1,17,15,None,'wasted',3,'개',180,past(7)+' 10:00:00'),
    (1,18, 5,None,'wasted',1,'단',200,past(6)+' 10:00:00'),
    (1,19,10,None,'cooked',1,'팩',400,past(5)+' 12:00:00'),
    (1,20, 3,1,'cooked',1,'대',100,past(4)+' 19:00:00'),
    (1,21,17,1,'cooked',1,'모',300,past(4)+' 19:00:00'),
])
conn.commit()

# ── 마크다운 테이블 헬퍼 ──────────────────────────────────────────
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

sections = []

# Q1. 재고 대시보드
cur.execute(f"""
SELECT i.name AS 재료명, c.name AS 카테고리,
       ui.quantity AS 수량, ui.unit AS 단위, ui.expires_at AS 유통기한,
       CAST(julianday(ui.expires_at) - julianday('{TODAY}') AS INTEGER) AS D_day,
       CASE
           WHEN julianday(ui.expires_at) - julianday('{TODAY}') < 0  THEN '만료'
           WHEN julianday(ui.expires_at) - julianday('{TODAY}') <= 2 THEN '임박'
           WHEN julianday(ui.expires_at) - julianday('{TODAY}') <= 5 THEN '주의'
           ELSE '여유'
       END AS 상태
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
JOIN categories  c ON i.category_id = c.id
WHERE ui.user_id = 1 AND ui.status = 'active'
ORDER BY ui.expires_at ASC
""")
rows = cur.fetchall()
sections.append(("Q1. 재고 대시보드 (D-day 정렬)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q2. 레시피 추천 — 임박 재료 기반 스코어링
# 공식: 35×urgentRatio + 15×completeness + 40×absBonus + 10×seaRatio
cur.execute(f"""
WITH owned AS (
  SELECT i.name,
         CAST(julianday(ui.expires_at) - julianday('{TODAY}') AS INTEGER) AS days_left
  FROM user_inventory ui
  JOIN ingredients i ON ui.ingredient_id = i.id
  WHERE ui.user_id = 1 AND ui.status = 'active'
),
scored AS (
  SELECT r.id, r.name, r.emoji,
    COUNT(CASE WHEN ri.is_required=1 THEN 1 END)                              AS main_total,
    COUNT(CASE WHEN ri.is_required=1 AND o.name IS NOT NULL THEN 1 END)       AS main_matched,
    COUNT(CASE WHEN ri.is_required=1 AND o.name IS NOT NULL AND o.days_left<=2 THEN 1 END) AS urgent_matched,
    COUNT(CASE WHEN ri.is_required=1 AND o.name IS NOT NULL AND o.days_left BETWEEN 3 AND 5 THEN 1 END) AS warn_matched,
    COUNT(CASE WHEN ri.is_required=1 AND o.name IS NULL THEN 1 END)           AS main_missing,
    COUNT(CASE WHEN ri.is_required=0 THEN 1 END)                              AS sea_total,
    COUNT(CASE WHEN ri.is_required=0 AND o.name IS NOT NULL THEN 1 END)       AS sea_matched
  FROM recipes r
  JOIN recipe_ingredients ri ON r.id = ri.recipe_id
  LEFT JOIN ingredients i2 ON i2.id = ri.ingredient_id
  LEFT JOIN owned o ON o.name = i2.name
  GROUP BY r.id, r.name, r.emoji
)
SELECT name AS 레시피, emoji AS 이모지, main_matched AS 주재료매칭,
       urgent_matched AS 임박재료수, warn_matched AS 주의재료수,
       ROUND(
         35.0 * urgent_matched / MAX(main_matched, 1)
       + 15.0 * main_matched   / MAX(main_total,   1)
       + 40.0 * MIN(urgent_matched + warn_matched, 5) / 5.0
       + 10.0 * sea_matched    / MAX(sea_total,    1)
       , 2) AS 점수
FROM scored
WHERE main_matched > 0
  AND (urgent_matched + warn_matched) > 0
  AND main_missing <= main_total * 0.4
ORDER BY 점수 DESC
LIMIT 8
""")
rows = cur.fetchall()
sections.append(("Q2. 레시피 추천 (임박 재료 스코어링 — 35/15/40/10 가중치)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q3. 월간 환경 리포트
month_start = datetime.date.today().replace(day=1).isoformat()
cur.execute(f"""
SELECT
    COUNT(*)                                                       AS 조리완료횟수,
    ROUND(SUM(cl.weight_g), 0)                                    AS 총절감량_g,
    FLOOR(SUM(cl.weight_g) / 500)                                 AS 절약봉투수,
    ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 3)         AS 탄소절감_kg,
    ROUND(SUM(cl.weight_g) * 0.002, 0)                           AS 절약물_L,
    COUNT(*) * 2500                                               AS 절약식비_원
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id=1 AND cl.type='cooked' AND cl.logged_at >= '{month_start}'
""")
rows = cur.fetchall()
sections.append(("Q3. 월간 환경 리포트", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q4. 월간 폐기 분석
cur.execute(f"""
SELECT COUNT(*) AS 폐기횟수,
       ROUND(SUM(cl.weight_g), 0) AS 폐기량_g,
       ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 3) AS 폐기탄소_kg
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id=1 AND cl.type='wasted' AND cl.logged_at >= '{month_start}'
""")
rows = cur.fetchall()
sections.append(("Q4. 월간 폐기 분석", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q5. 재료 자동완성 검색
cur.execute("""
SELECT i.id, i.name AS 재료명, c.name AS 카테고리, i.default_unit AS 기본단위
FROM ingredients i JOIN categories c ON i.category_id=c.id
WHERE i.name LIKE '%감%' LIMIT 10
""")
rows = cur.fetchall()
sections.append(("Q5. 재료 자동완성 검색 (키워드: '감')", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q6. 카테고리별 재료 목록 (채소)
cur.execute("""
SELECT i.id, i.name AS 재료명, i.default_unit AS 단위,
       i.weight_per_unit_g AS 기본무게_g, i.carbon_per_100g AS 탄소_kgCO2
FROM ingredients i WHERE i.category_id=1 ORDER BY i.name
""")
rows = cur.fetchall()
sections.append(("Q6. 카테고리별 재료 목록 (채소)", md_table([list(r) for r in rows], list(rows[0].keys()))))

# Q7. 레시피별 소진 빈도
cur.execute("""
SELECT r.name AS 레시피, COUNT(*) AS 참고횟수
FROM consumption_logs cl
JOIN recipes r ON cl.recipe_id=r.id
WHERE cl.user_id=1 AND cl.type='cooked'
GROUP BY r.id, r.name ORDER BY 참고횟수 DESC
""")
rows = cur.fetchall()
sections.append(("Q7. 레시피별 소진 빈도", md_table([list(r) for r in rows], list(rows[0].keys()))))

# ── query_results.md 작성 ─────────────────────────────────────────
with open("query_results.md", "w", encoding="utf-8") as f:
    f.write("# fridge.ai — 데모 쿼리 실행 결과\n\n")
    f.write(f"- **기준일:** {TODAY}\n")
    f.write(f"- **ERD 버전:** v0.5\n")
    f.write(f"- **스코어링 공식:** 35×urgentRatio + 15×completeness + 40×absBonus + 10×seaRatio\n")
    f.write(f"- **데모 사용자:** guest@fridge.ai (user_id = 1)\n")
    f.write(f"- **생성일:** {datetime.date.today()}\n\n---\n\n")
    for title, table in sections:
        f.write(f"## {title}\n\n")
        f.write(table + "\n\n---\n\n")

print("query_results.md 생성 완료")
conn.close()

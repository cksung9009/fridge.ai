# fridge.ai — ERD & Query Definition

- **문서 버전:** 0.4
- **작성일:** 2026-06-16
- **상태:** 기획 확정 (demo.sql v0.3 동기화 — 스코어 공식 app.js 일치, COOKRCP01 연동 기재)

---

## ERD (Entity-Relationship Diagram)

```
┌─────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│    users    │        │   user_inventory      │        │   ingredients    │
│─────────────│        │──────────────────────│        │──────────────────│
│ id (PK)     │──┐     │ id (PK)              │───────▶│ id (PK)          │
│ email       │  │     │ user_id (FK)         │        │ name             │
│ password_   │  └────▶│ ingredient_id (FK)   │        │ category_id (FK) │
│   hash      │        │ quantity             │        │ default_unit     │
│ created_at  │        │ unit                 │        │ weight_per_unit_g│
│ updated_at  │        │ expires_at           │        │ carbon_per_100g  │
└─────────────┘        │ status               │        │ created_at       │
       │               │ created_at           │        └──────────────────┘
       │               │ updated_at           │                 │
       │               └──────────────────────┘                 │
       │                        │                        ┌──────────────┐
       │               ┌──────────────────────┐          │  categories  │
       │               │  consumption_logs    │          │──────────────│
       └──────────────▶│ id (PK)              │          │ id (PK)      │
                       │ user_id (FK)         │          │ name         │
                       │ inventory_id (FK)    │          │ icon         │
                       │ ingredient_id (FK)   │          │ sort_order   │
                       │ recipe_id (FK) NULL  │──┐       │ created_at   │
                       │ type (cooked/wasted) │  │       └──────────────┘
                       │ quantity_used        │  │
                       │ unit                 │  │       ┌──────────────────┐
                       │ weight_g             │  │       │     recipes      │
                       │ logged_at            │  └──────▶│──────────────────│
                       └──────────────────────┘          │ id (PK)          │
                                                         │ name             │
                                                         │ category         │
                                                         │ emoji            │
                                                         │ source_url NULL  │
                                                         │ created_at       │
                                                         └──────────────────┘
                                                                  │
                                                   ┌──────────────────────────┐
                                                   │    recipe_ingredients    │
                                                   │──────────────────────────│
                                                   │ id (PK)                  │
                                                   │ recipe_id (FK)      ─────┘
                                                   │ ingredient_id (FK)  ────▶ ingredients
                                                   │ is_required (BOOL)       │
                                                   │ sort_order               │
                                                   └──────────────────────────┘

                          ┌───────────────────────────┐
                          │   ingredient_requests     │  ← F10
                          │───────────────────────────│
                          │ id (PK)                   │
                          │ name                      │
                          │ requested_by (FK) NULL ───┼──▶ users
                          │ status (pending/…)        │
                          │ requested_at              │
                          │ reviewed_at NULL          │
                          └───────────────────────────┘
```

---

## 테이블 정의

### `categories`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(50) UNIQUE | 채소, 육류, 해산물, 달걀/유제품, 두부/콩류, 버섯류, 곡류/면류, 과일, 조미료/양념, 기타 |
| icon | VARCHAR(10) | 이모지 |
| sort_order | INT | 탭 노출 순서 |
| created_at | TIMESTAMP DEFAULT NOW() | |

### `ingredients` (재료 마스터 — 약 131종)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(100) UNIQUE | 감자, 달걀 등 |
| category_id | INT FK → categories | |
| default_unit | VARCHAR(20) | 개, g, mL, 팩, 봉 등 |
| weight_per_unit_g | DECIMAL(8,2) | 1단위 기본 무게 (감자 1개=150g) |
| carbon_per_100g | DECIMAL(8,4) | 탄소 발자국 (kg CO₂eq / 100g) |
| created_at | TIMESTAMP DEFAULT NOW() | |

### `users`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP | |

### `user_inventory` (냉장고 재고)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| user_id | INT FK → users | MVP: 단일 사용자(id=1) 고정 |
| ingredient_id | INT FK → ingredients | |
| quantity | DECIMAL(8,2) | 수량 |
| unit | VARCHAR(20) | 개, g, mL 등 |
| expires_at | DATE | 유통기한 (D-day 계산 기준) |
| status | ENUM('active','used','wasted') DEFAULT 'active' | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP | |

### `recipes` (요리/메뉴 마스터 — 약 45종, Phase 1 이후 확장)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(100) UNIQUE | 된장찌개, 제육볶음 등 |
| category | VARCHAR(50) | 국/찌개, 볶음, 전/부침, 구이, 조림, 밥/면, 무침, 기타 |
| emoji | VARCHAR(10) | 이모지 |
| source_url | VARCHAR(500) NULL | YouTube/블로그 링크 캐싱용 (Phase 2 정밀 카드 도입 시 사용) |
| created_at | TIMESTAMP DEFAULT NOW() | |

### `recipe_ingredients` (요리↔재료 매핑)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| recipe_id | INT FK → recipes | |
| ingredient_id | INT FK → ingredients | |
| is_required | BOOLEAN DEFAULT TRUE | FALSE=선택 재료 |
| sort_order | INT DEFAULT 0 | 레시피 내 재료 순서 |

> 복합 유니크: `UNIQUE (recipe_id, ingredient_id)`

### `consumption_logs` (소진 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| user_id | INT FK → users | |
| inventory_id | INT FK → user_inventory | |
| ingredient_id | INT FK → ingredients | 리포트 집계용 비정규화 |
| recipe_id | INT FK → recipes NULL | 참고한 레시피 (없으면 NULL) |
| type | ENUM('cooked','wasted') | |
| quantity_used | DECIMAL(8,2) | |
| unit | VARCHAR(20) | |
| weight_g | DECIMAL(10,2) | quantity × weight_per_unit_g |
| logged_at | TIMESTAMP DEFAULT NOW() | |

### `ingredient_requests` (F10 — 신규 재료 요청 큐)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(100) | 사용자가 요청한 재료명 |
| requested_by | INT FK → users NULL | 비로그인 요청 허용 시 NULL |
| status | ENUM('pending','approved','rejected') DEFAULT 'pending' | |
| requested_at | TIMESTAMP DEFAULT NOW() | |
| reviewed_at | TIMESTAMP NULL | 관리자 검토 시각 |

---

## 인덱스

```sql
-- 재고 대시보드 핵심 쿼리 (D-day 정렬)
CREATE INDEX idx_inventory_user_status_expires
  ON user_inventory (user_id, status, expires_at);

-- 환경 리포트 집계
CREATE INDEX idx_logs_user_type_date
  ON consumption_logs (user_id, type, logged_at);

-- 레시피 매핑 조회
CREATE INDEX idx_recipe_ingredients_ingredient
  ON recipe_ingredients (ingredient_id);

-- 요청 큐 관리자 조회
CREATE INDEX idx_requests_status
  ON ingredient_requests (status, requested_at);
```

---

## 핵심 쿼리

### 재고 대시보드 (D-day 정렬)
```sql
SELECT ui.id, i.name, i.carbon_per_100g, i.weight_per_unit_g,
       c.name AS category_name,
       ui.quantity, ui.unit, ui.expires_at,
       DATEDIFF(ui.expires_at, CURDATE()) AS days_left
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
JOIN categories  c ON i.category_id   = c.id
WHERE ui.user_id = :userId
  AND ui.status  = 'active'
ORDER BY ui.expires_at ASC;
```

### 레시피 추천 — 임박 재료 기반 스코어링
> 공식: **40×urgentRatio + 35×completeness + 15×absBonus + 10×seaRatio**  
> 필터: ① 임박/주의 주재료 ≥ 1개, ② 부족 주재료 ≤ 40%

```sql
WITH owned AS (
  SELECT i.name, DATEDIFF(ui.expires_at, CURDATE()) AS days_left
  FROM user_inventory ui
  JOIN ingredients i ON ui.ingredient_id = i.id
  WHERE ui.user_id = :userId AND ui.status = 'active'
),
scored AS (
  SELECT r.id, r.name, r.emoji,
         -- 주재료 (is_required = TRUE)
         COUNT(CASE WHEN ri.is_required = TRUE THEN 1 END)                        AS main_total,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NOT NULL THEN 1 END) AS main_matched,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NOT NULL
                         AND o.days_left <= 2 THEN 1 END)                         AS urgent_matched,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NOT NULL
                         AND o.days_left BETWEEN 3 AND 5 THEN 1 END)              AS warn_matched,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NULL THEN 1 END)     AS main_missing,
         -- 조미료 (is_required = FALSE)
         COUNT(CASE WHEN ri.is_required = FALSE THEN 1 END)                       AS sea_total,
         COUNT(CASE WHEN ri.is_required = FALSE AND o.name IS NOT NULL THEN 1 END) AS sea_matched
  FROM recipes r
  JOIN recipe_ingredients ri ON r.id = ri.recipe_id
  LEFT JOIN owned o ON o.name = (
    SELECT i2.name FROM ingredients i2 WHERE i2.id = ri.ingredient_id LIMIT 1
  )
  GROUP BY r.id, r.name, r.emoji
)
SELECT id, name, emoji,
       ROUND(
         35 * urgent_matched / NULLIF(main_matched, 0)               -- urgentRatio
       + 15 * main_matched   / NULLIF(main_total,   0)               -- completeness
       + 40 * LEAST(urgent_matched + warn_matched, 5) / 5            -- absBonus (임박·주의 재료 절대 개수, 다재료 우대)
       + 10 * sea_matched    / NULLIF(sea_total,    0)                -- seaRatio
       , 2) AS score
FROM scored
WHERE main_matched > 0
  AND (urgent_matched + warn_matched) > 0     -- 임박/주의 주재료 최소 1개 (필터 ①)
  AND main_missing <= main_total * 0.4        -- 부족 재료 40% 이하 (필터 ②)
ORDER BY score DESC
LIMIT 12;
```

### 월간 환경 리포트
```sql
SELECT
  SUM(cl.weight_g)                            AS total_saved_g,
  SUM(cl.weight_g * i.carbon_per_100g / 100)  AS carbon_saved_kg,
  COUNT(*)                                     AS cooked_count
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = :userId
  AND cl.type    = 'cooked'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');
```

### 폐기 분석
```sql
SELECT COUNT(*) AS wasted_count,
       SUM(weight_g) AS wasted_g,
       SUM(weight_g * i.carbon_per_100g / 100) AS wasted_carbon_kg
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = :userId
  AND cl.type    = 'wasted'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');
```

### 재료 자동완성 검색
```sql
SELECT i.id, i.name, i.default_unit, c.name AS category_name, c.icon
FROM ingredients i
JOIN categories c ON i.category_id = c.id
WHERE i.name LIKE CONCAT('%', :keyword, '%')
ORDER BY i.name
LIMIT 10;
```

### F10 — 신규 재료 요청 접수
```sql
INSERT INTO ingredient_requests (name, requested_by, status, requested_at)
VALUES (:name, :userId, 'pending', NOW())
ON DUPLICATE KEY UPDATE requested_at = NOW();
-- 관리자 승인 후 ingredients 테이블에 수동 INSERT
```

---

## 설계 결정 사항 (Decision Log)

| 항목 | 결정 | 이유 |
|------|------|------|
| 재료명 관리 | 마스터 테이블 (약 131종) | 자동완성·카테고리 탭·스코어링 기반 |
| 카테고리 관리 | 별도 테이블 (10종) | 코드 배포 없이 DB에서 수정 가능 |
| 수량 저장 | quantity + unit 분리 | 차감 계산 및 집계 가능 |
| 소진 기록 | 단일 테이블 (type 구분) | 리포트 쿼리 단순화 |
| 탄소 데이터 | 재료 마스터 컬럼 | 1:1 대응, 조인 불필요, 농진청 + 문헌 확보 |
| 무게 환산 | 마스터 기본값 사용 | 사용자 입력 부담 제거 |
| 레시피 DB | COOKRCP01 API (1,146건) + 내부 recipe_ingredients 매핑 병행 | 식품안전나라 공공 API로 풍부한 레시피 확보, DB는 스코어링 정밀 제어용 |
| 레시피 소싱 | YouTube/Naver 블로그 검색 URL 동적 생성 (MVP) → YouTube Data API (Phase 2) | API 쿼터 의존 없이 MVP 시작, Phase 2에서 정밀 카드 |
| 스코어 공식 | 35×urgentRatio + 15×completeness + 40×absBonus + 10×seaRatio | urgentRatio: 임박 재료 활용도, completeness: 전체 매칭률, absBonus: 임박·주의 재료 절대 개수(5개 상한) — 다재료 요리 우대, seaRatio: 조미료 구비율 |
| recipe_id in logs | NULL 허용 FK | 레시피 참고 없이 직접 조리한 경우 포함 |
| F10 요청 큐 | ingredient_requests 테이블 | 관리자 검토 후 마스터 반영 워크플로우 |
| user_id MVP 처리 | 단일 사용자(id=1) 고정 | 데모/제출 쿼리 명확성, 멀티유저는 Phase 3 |
| purchased_at | 컬럼 제거 | MVP 불필요, D-day는 expires_at만으로 계산 |
| youtube_video_id | recipe_id (FK)로 교체 | 요리/메뉴 DB 도입으로 레시피 참조 구조화 |
| is_required | recipe_ingredients 컬럼 | 필수/선택 재료 구분으로 스코어링 정밀도 향상 |
| 인덱스 | 4개 | 핵심 쿼리 full scan 방지 |

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1 | 2026-06-14 | 최초 작성 |
| 0.2 | 2026-06-14 | MVP 리뷰 반영 — purchased_at 제거, 인덱스 추가 |
| 0.3 | 2026-06-16 | MANIFESTO v0.3 반영 — recipes·recipe_ingredients·ingredient_requests 추가, consumption_logs.youtube_video_id → recipe_id 교체, 레시피 스코어링 쿼리 추가 |
| 0.4 | 2026-06-16 | demo.sql v0.3 동기화 — 카테고리 10종·재료 40종·레시피 10종 시드 추가, 스코어 공식 app.js 완전 일치(urgentRatio/completeness/absBonus/seaRatio), COOKRCP01 연동 결정 기재, Q2 YouTube검색→레시피추천 교체, Q8 레시피 참고 빈도 쿼리 추가 |
| 0.5 | 2026-06-17 | 스코어링 공식 개정 — absBonus 기준을 전체 매칭 수에서 임박·주의 재료 절대 개수로 변경, 가중치 재조정(35/15/40/10), 재고 날짜 CURDATE() 상대값으로 전환 |

---

*이 문서는 fridge.ai ERD의 기준점이며, 스키마 변경 시 함께 갱신한다.*

-- ============================================================
-- fridge.ai — Demo SQL (MySQL)
-- 목적: ERD 검증 및 핵심 쿼리 데모
-- ERD 버전: v0.3 (recipes·recipe_ingredients·ingredient_requests 추가)
-- ============================================================

DROP DATABASE IF EXISTS fridge_ai;
CREATE DATABASE fridge_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fridge_ai;

-- ============================================================
-- 1. 테이블 생성
-- ============================================================

CREATE TABLE categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL UNIQUE,
    icon       VARCHAR(10),
    sort_order INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ingredients (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    name               VARCHAR(100) NOT NULL UNIQUE,
    category_id        INT          NOT NULL,
    default_unit       VARCHAR(20)  NOT NULL,
    weight_per_unit_g  DECIMAL(8,2) NOT NULL COMMENT '1단위 기본 무게(g)',
    carbon_per_100g    DECIMAL(8,4) NOT NULL COMMENT '탄소 발자국(kg CO₂eq/100g)',
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_inventory (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    ingredient_id INT          NOT NULL,
    quantity      DECIMAL(8,2) NOT NULL,
    unit          VARCHAR(20)  NOT NULL,
    expires_at    DATE         NOT NULL,
    status        ENUM('active','used','wasted') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE recipes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    category   VARCHAR(50)  NOT NULL COMMENT '국/찌개,볶음,전/부침,구이,조림,밥/면,무침,기타',
    emoji      VARCHAR(10),
    source_url VARCHAR(500) NULL COMMENT 'Phase 2: YouTube/블로그 캐싱용',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recipe_ingredients (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id     INT     NOT NULL,
    ingredient_id INT     NOT NULL,
    is_required   BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'FALSE=조미료/선택재료',
    sort_order    INT     NOT NULL DEFAULT 0,
    UNIQUE KEY uq_recipe_ingredient (recipe_id, ingredient_id),
    FOREIGN KEY (recipe_id)     REFERENCES recipes(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE consumption_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT           NOT NULL,
    inventory_id  INT           NOT NULL,
    ingredient_id INT           NOT NULL COMMENT '리포트 집계용 비정규화',
    recipe_id     INT           NULL     COMMENT '참고한 레시피, 직접 조리 시 NULL',
    type          ENUM('cooked','wasted') NOT NULL,
    quantity_used DECIMAL(8,2)  NOT NULL,
    unit          VARCHAR(20)   NOT NULL,
    weight_g      DECIMAL(10,2) NOT NULL COMMENT 'quantity_used × weight_per_unit_g',
    logged_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(id),
    FOREIGN KEY (inventory_id)  REFERENCES user_inventory(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
    FOREIGN KEY (recipe_id)     REFERENCES recipes(id)
);

CREATE TABLE ingredient_requests (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    requested_by INT          NULL COMMENT '비로그인 허용 시 NULL',
    status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at  TIMESTAMP    NULL,
    FOREIGN KEY (requested_by) REFERENCES users(id)
);

-- ============================================================
-- 2. 인덱스
-- ============================================================

CREATE INDEX idx_inventory_user_status_expires
  ON user_inventory (user_id, status, expires_at);

CREATE INDEX idx_logs_user_type_date
  ON consumption_logs (user_id, type, logged_at);

CREATE INDEX idx_recipe_ingredients_ingredient
  ON recipe_ingredients (ingredient_id);

CREATE INDEX idx_requests_status
  ON ingredient_requests (status, requested_at);

-- ============================================================
-- 3. 시드 데이터
-- ============================================================

-- 카테고리 (data.js CATS 기준 10종)
INSERT INTO categories (name, icon, sort_order) VALUES
('채소',       '🥦', 1),
('육류',       '🥩', 2),
('해산물',     '🐟', 3),
('달걀/유제품','🥚', 4),
('두부/콩류',  '🫘', 5),
('버섯류',     '🍄', 6),
('곡류/면류',  '🌾', 7),
('과일',       '🍎', 8),
('조미료/양념','🧂', 9),
('기타',       '🛒', 10);

-- 재료 마스터 (주요 131종 중 데모용 40종)
INSERT INTO ingredients (name, category_id, default_unit, weight_per_unit_g, carbon_per_100g) VALUES
-- 채소 (cat 1)
('감자',       1, '개',  150.00, 0.0460),
('고구마',     1, '개',  200.00, 0.0430),
('양파',       1, '개',  200.00, 0.0500),
('대파',       1, '대',  100.00, 0.0300),
('마늘',       1, '통',   50.00, 0.0360),
('당근',       1, '개',  120.00, 0.0420),
('무',         1, '개',  800.00, 0.0380),
('배추',       1, '통', 2000.00, 0.0310),
('시금치',     1, '단',  200.00, 0.0350),
('애호박',     1, '개',  250.00, 0.0280),
('상추',       1, '봉',  100.00, 0.0250),
('콩나물',     1, '봉',  200.00, 0.0220),
-- 육류 (cat 2)
('돼지고기(삼겹살)',   2, '팩', 500.00, 0.7100),
('돼지고기(불고기용)', 2, '팩', 400.00, 0.7100),
('닭가슴살',           2, '팩', 400.00, 0.6900),
('닭볶음탕용',         2, '팩', 500.00, 0.6900),
('소고기(불고기용)',   2, '팩', 400.00, 2.1000),
-- 해산물 (cat 3)
('고등어',   3, '마리', 400.00, 0.4300),
('갈치',     3, '마리', 350.00, 0.4100),
('새우',     3, '팩',   200.00, 0.6800),
('오징어',   3, '마리', 300.00, 0.5200),
('바지락',   3, '봉',   200.00, 0.3900),
-- 달걀/유제품 (cat 4)
('달걀',   4, '개',  60.00, 0.1800),
('우유',   4, '팩', 900.00, 0.0900),
('버터',   4, '팩', 200.00, 0.3200),
-- 두부/콩류 (cat 5)
('두부',   5, '모', 300.00, 0.0700),
('순두부', 5, '팩', 300.00, 0.0700),
-- 버섯류 (cat 6)
('표고버섯',   6, '팩', 150.00, 0.0410),
('팽이버섯',   6, '봉', 150.00, 0.0380),
-- 곡류/면류 (cat 7)
('쌀', 7, '봉', 1000.00, 0.1600),
('라면', 7, '개', 120.00, 0.3800),
-- 과일 (cat 8)
('사과',  8, '개', 250.00, 0.0430),
('바나나',8, '개', 120.00, 0.0480),
('딸기',  8, '팩', 300.00, 0.0370),
-- 조미료/양념 (cat 9)
('간장',       9, '병', 1000.00, 0.0200),
('된장',       9, '통',  500.00, 0.0250),
('고추장',     9, '통',  500.00, 0.0270),
('참기름',     9, '병',  500.00, 0.0300),
('고춧가루',   9, '봉',  100.00, 0.0310),
('다진마늘(튜브)', 9, '개', 100.00, 0.0360),
-- 기타 (cat 10)
('멸치', 10, '봉', 100.00, 0.3100);

-- 데모 사용자 (guest 계정 — MVP에서 user_id=1 고정)
INSERT INTO users (email, password_hash) VALUES
('guest@fridge.ai', '$2b$10$demohashdemohashdemohashdemohashdemohashdemohashdemo');

-- 냉장고 재고 (기준일: 2026-06-16)
INSERT INTO user_inventory (user_id, ingredient_id, quantity, unit, expires_at, status) VALUES
(1, 23, 6,  '개', '2026-06-16', 'active'),  -- 달걀      D-day ⚠️
(1, 26, 1,  '모', '2026-06-17', 'active'),  -- 두부      D-1
(1,  4, 1,  '대', '2026-06-17', 'active'),  -- 대파      D-1
(1, 20, 1,  '팩', '2026-06-17', 'active'),  -- 새우      D-1
(1, 18, 1,  '마리','2026-06-18','active'),  -- 고등어    D-2
(1,  9, 1,  '단', '2026-06-18', 'active'),  -- 시금치    D-2
(1, 11, 1,  '봉', '2026-06-18', 'active'),  -- 상추      D-2
(1, 21, 1,  '마리','2026-06-18','active'),  -- 오징어    D-2
(1, 22, 1,  '봉', '2026-06-18', 'active'),  -- 바지락    D-2
(1, 17, 1,  '팩', '2026-06-18', 'active'),  -- 소고기    D-2
(1, 15, 1,  '팩', '2026-06-19', 'active'),  -- 닭가슴살  D-3
(1, 13, 1,  '팩', '2026-06-19', 'active'),  -- 돼지고기  D-3
(1, 33, 3,  '개', '2026-06-19', 'active'),  -- 바나나    D-3
(1, 27, 1,  '팩', '2026-06-19', 'active'),  -- 순두부    D-3
(1, 28, 1,  '팩', '2026-06-19', 'active'),  -- 표고버섯  D-3
(1, 29, 1,  '봉', '2026-06-19', 'active'),  -- 팽이버섯  D-3
(1,  3, 2,  '개', '2026-06-22', 'active'),  -- 양파      D-6
(1,  1, 3,  '개', '2026-06-24', 'active'),  -- 감자      D-8
(1, 34, 1,  '팩', '2026-06-25', 'active'),  -- 딸기      D-9
(1, 24, 1,  '팩', '2026-06-30', 'active'),  -- 우유      D-14
(1, 35, 1,  '병', '2026-12-31', 'active'),  -- 간장      D-199
(1, 36, 1,  '통', '2026-12-31', 'active'),  -- 된장      D-199
(1, 37, 1,  '통', '2026-12-31', 'active'),  -- 고추장    D-199
(1, 38, 1,  '병', '2026-12-31', 'active'),  -- 참기름    D-199
(1, 40, 1,  '개', '2026-12-31', 'active');  -- 다진마늘  D-199

-- 레시피 마스터
INSERT INTO recipes (name, category, emoji) VALUES
('된장찌개',   '국/찌개', '🍲'),
('제육볶음',   '볶음',    '🥓'),
('달걀볶음밥', '밥/면',   '🍳'),
('시금치나물', '무침',    '🥬'),
('갈치조림',   '조림',    '🐟'),
('닭볶음탕',   '조림',    '🍗'),
('콩나물국',   '국/찌개', '🍜'),
('두부조림',   '조림',    '⬜'),
('소고기볶음', '볶음',    '🥩'),
('해물파전',   '전/부침', '🦑');

-- 레시피↔재료 매핑 (is_required TRUE=주재료, FALSE=조미료/선택)
-- 된장찌개 (id=1)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(1, 26, TRUE,  1),  -- 두부
(1, 10, TRUE,  2),  -- 애호박
(1,  4, TRUE,  3),  -- 대파
(1,  1, TRUE,  4),  -- 감자
(1, 36, FALSE, 5),  -- 된장 (조미료)
(1, 40, FALSE, 6);  -- 다진마늘 (조미료)

-- 제육볶음 (id=2)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(2, 13, TRUE,  1),  -- 돼지고기(삼겹살)
(2,  3, TRUE,  2),  -- 양파
(2,  4, TRUE,  3),  -- 대파
(2, 37, FALSE, 4),  -- 고추장 (조미료)
(2, 35, FALSE, 5),  -- 간장 (조미료)
(2, 39, FALSE, 6);  -- 고춧가루 (조미료)

-- 달걀볶음밥 (id=3)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(3, 23, TRUE,  1),  -- 달걀
(3, 30, TRUE,  2),  -- 쌀
(3,  6, TRUE,  3),  -- 당근
(3,  4, TRUE,  4),  -- 대파
(3, 35, FALSE, 5),  -- 간장 (조미료)
(3, 38, FALSE, 6);  -- 참기름 (조미료)

-- 시금치나물 (id=4)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(4,  9, TRUE,  1),  -- 시금치
(4,  5, TRUE,  2),  -- 마늘
(4, 35, FALSE, 3),  -- 간장 (조미료)
(4, 38, FALSE, 4);  -- 참기름 (조미료)

-- 갈치조림 (id=5)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(5, 19, TRUE,  1),  -- 갈치
(5,  7, TRUE,  2),  -- 무
(5,  4, TRUE,  3),  -- 대파
(5, 35, FALSE, 4),  -- 간장 (조미료)
(5, 37, FALSE, 5),  -- 고추장 (조미료)
(5, 39, FALSE, 6);  -- 고춧가루 (조미료)

-- 닭볶음탕 (id=6)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(6, 16, TRUE,  1),  -- 닭볶음탕용
(6,  1, TRUE,  2),  -- 감자
(6,  6, TRUE,  3),  -- 당근
(6,  4, TRUE,  4),  -- 대파
(6, 35, FALSE, 5),  -- 간장 (조미료)
(6, 37, FALSE, 6);  -- 고추장 (조미료)

-- 콩나물국 (id=7)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(7, 12, TRUE,  1),  -- 콩나물
(7,  4, TRUE,  2),  -- 대파
(7, 35, FALSE, 3),  -- 간장 (조미료)
(7, 40, FALSE, 4);  -- 다진마늘 (조미료)

-- 두부조림 (id=8)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(8, 26, TRUE,  1),  -- 두부
(8,  4, TRUE,  2),  -- 대파
(8, 35, FALSE, 3),  -- 간장 (조미료)
(8, 37, FALSE, 4),  -- 고추장 (조미료)
(8, 38, FALSE, 5);  -- 참기름 (조미료)

-- 소고기볶음 (id=9)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(9, 17, TRUE,  1),  -- 소고기(불고기용)
(9,  3, TRUE,  2),  -- 양파
(9, 28, TRUE,  3),  -- 표고버섯
(9,  4, FALSE, 4),  -- 대파
(9, 35, FALSE, 5),  -- 간장 (조미료)
(9, 38, FALSE, 6);  -- 참기름 (조미료)

-- 해물파전 (id=10)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, is_required, sort_order) VALUES
(10, 20, TRUE,  1),  -- 새우
(10, 21, TRUE,  2),  -- 오징어
(10,  4, TRUE,  3),  -- 대파
(10, 23, TRUE,  4),  -- 달걀
(10, 35, FALSE, 5);  -- 간장 (조미료)

-- 소진 기록 (데모 — 지난 3주)
INSERT INTO consumption_logs
    (user_id, inventory_id, ingredient_id, recipe_id, type, quantity_used, unit, weight_g, logged_at)
VALUES
(1,  1, 23, 3,    'cooked', 2, '개', 120.00, '2026-05-26 19:00:00'),  -- 달걀 → 달걀볶음밥
(1,  2, 26, 1,    'cooked', 1, '모', 300.00, '2026-05-27 12:00:00'),  -- 두부 → 된장찌개
(1,  3,  4, 1,    'cooked', 1, '대', 100.00, '2026-05-27 12:00:00'),  -- 대파 → 된장찌개
(1,  4,  9, 4,    'cooked', 1, '단', 200.00, '2026-05-28 18:30:00'),  -- 시금치 → 시금치나물
(1,  5, 13, 2,    'cooked', 1, '팩', 500.00, '2026-05-29 19:00:00'),  -- 돼지고기 → 제육볶음
(1,  6,  3, 2,    'cooked', 1, '개', 200.00, '2026-05-29 19:00:00'),  -- 양파 → 제육볶음
(1,  7, 15, NULL, 'cooked', 1, '팩', 400.00, '2026-05-30 12:00:00'),  -- 닭가슴살 직접 조리
(1,  8, 12, 7,    'cooked', 1, '봉', 200.00, '2026-05-31 08:00:00'),  -- 콩나물 → 콩나물국
(1,  9, 23, 3,    'cooked', 2, '개', 120.00, '2026-06-01 09:00:00'),  -- 달걀 → 달걀볶음밥
(1, 10, 26, 8,    'cooked', 1, '모', 300.00, '2026-06-02 19:00:00'),  -- 두부 → 두부조림
(1, 11, 17, 9,    'cooked', 1, '팩', 400.00, '2026-06-03 19:00:00'),  -- 소고기 → 소고기볶음
(1, 12,  4, 7,    'cooked', 1, '대', 100.00, '2026-06-04 12:00:00'),  -- 대파 → 콩나물국
(1, 13, 24, NULL, 'cooked', 1, '팩', 900.00, '2026-06-05 08:00:00'),  -- 우유 직접 소비
(1, 14, 28, 9,    'cooked', 1, '팩', 150.00, '2026-06-06 19:00:00'),  -- 표고버섯 → 소고기볶음
(1, 15, 13, 2,    'cooked', 1, '팩', 500.00, '2026-06-07 19:00:00'),  -- 돼지고기 → 제육볶음
(1, 16, 18, 5,    'cooked', 1, '마리',400.00,'2026-06-08 18:00:00'),  -- 고등어 → 갈치조림
(1, 17, 23, NULL, 'wasted', 3, '개', 180.00, '2026-06-09 10:00:00'),  -- 달걀 폐기
(1, 18,  9, NULL, 'wasted', 1, '단', 200.00, '2026-06-10 10:00:00'),  -- 시금치 폐기
(1, 19, 15, NULL, 'cooked', 1, '팩', 400.00, '2026-06-11 12:00:00'),  -- 닭가슴살 직접 조리
(1, 20,  4, 1,    'cooked', 1, '대', 100.00, '2026-06-12 19:00:00'),  -- 대파 → 된장찌개
(1, 21, 26, 1,    'cooked', 1, '모', 300.00, '2026-06-12 19:00:00');  -- 두부 → 된장찌개

-- 신규 재료 요청 예시
INSERT INTO ingredient_requests (name, requested_by, status) VALUES
('파인애플', 1, 'pending'),
('두릅',     1, 'pending');

-- ============================================================
-- 4. 핵심 데모 쿼리
-- ============================================================

-- -------------------------------------------------------
-- Q1. 재고 대시보드 (D-day 오름차순)
-- -------------------------------------------------------
SELECT
    ui.id,
    i.name                                        AS 재료명,
    c.name                                        AS 카테고리,
    ui.quantity,
    ui.unit,
    ui.expires_at                                 AS 유통기한,
    DATEDIFF(ui.expires_at, CURDATE())            AS D_day,
    CASE
        WHEN DATEDIFF(ui.expires_at, CURDATE()) < 0 THEN '만료'
        WHEN DATEDIFF(ui.expires_at, CURDATE()) <= 2 THEN '임박'
        WHEN DATEDIFF(ui.expires_at, CURDATE()) <= 5 THEN '주의'
        ELSE '여유'
    END                                           AS 상태
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
JOIN categories  c ON i.category_id    = c.id
WHERE ui.user_id = 1 AND ui.status = 'active'
ORDER BY ui.expires_at ASC;

-- -------------------------------------------------------
-- Q2. 레시피 추천 — 임박 재료 기반 스코어링
--     공식: 40×urgentRatio + 35×completeness + 15×absBonus + 10×seaRatio
-- -------------------------------------------------------
WITH owned AS (
  SELECT i.name,
         DATEDIFF(ui.expires_at, CURDATE()) AS days_left
  FROM user_inventory ui
  JOIN ingredients i ON ui.ingredient_id = i.id
  WHERE ui.user_id = 1 AND ui.status = 'active'
),
scored AS (
  SELECT r.id, r.name, r.emoji,
         -- 주재료(is_required=TRUE)
         COUNT(CASE WHEN ri.is_required = TRUE                                THEN 1 END) AS main_total,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NOT NULL         THEN 1 END) AS main_matched,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NOT NULL
                         AND o.days_left <= 2                                 THEN 1 END) AS urgent_matched,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NOT NULL
                         AND o.days_left BETWEEN 3 AND 5                      THEN 1 END) AS warn_matched,
         COUNT(CASE WHEN ri.is_required = TRUE AND o.name IS NULL             THEN 1 END) AS main_missing,
         -- 조미료(is_required=FALSE)
         COUNT(CASE WHEN ri.is_required = FALSE                               THEN 1 END) AS sea_total,
         COUNT(CASE WHEN ri.is_required = FALSE AND o.name IS NOT NULL        THEN 1 END) AS sea_matched
  FROM recipes r
  JOIN recipe_ingredients ri ON r.id = ri.recipe_id
  LEFT JOIN owned o ON o.name = (
    SELECT i2.name FROM ingredients i2 WHERE i2.id = ri.ingredient_id LIMIT 1
  )
  GROUP BY r.id, r.name, r.emoji
)
SELECT id, name, emoji,
       main_matched,
       main_missing,
       ROUND(
         40 * urgent_matched / NULLIF(main_matched, 0)  -- urgentRatio
       + 35 * main_matched   / NULLIF(main_total,   0)  -- completeness
       + 15 * LEAST(main_matched, 8) / 8                -- absBonus (최대 8개)
       + 10 * sea_matched    / NULLIF(sea_total,    0)   -- seaRatio
       , 2) AS score
FROM scored
WHERE main_matched > 0
  AND (urgent_matched + warn_matched) > 0          -- 임박/주의 재료 최소 1개
  AND main_missing <= main_total * 0.4             -- 부족 재료 40% 이하
ORDER BY score DESC
LIMIT 12;

-- -------------------------------------------------------
-- Q3. 월간 환경 리포트
-- -------------------------------------------------------
SELECT
    COUNT(*)                                               AS 조리_완료_횟수,
    SUM(cl.weight_g)                                       AS 총_절감량_g,
    FLOOR(SUM(cl.weight_g) / 500)                          AS 절약_봉투수,
    ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 3)  AS 탄소절감_kg,
    ROUND(SUM(cl.weight_g) * 0.002, 0)                    AS 절약_물_L,
    COUNT(*) * 2500                                        AS 절약_식비_원
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = 1
  AND cl.type     = 'cooked'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');

-- -------------------------------------------------------
-- Q4. 월간 폐기 분석
-- -------------------------------------------------------
SELECT
    COUNT(*)                                               AS 폐기_횟수,
    SUM(cl.weight_g)                                       AS 폐기량_g,
    ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 3)  AS 폐기_탄소_kg
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = 1
  AND cl.type    = 'wasted'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');

-- -------------------------------------------------------
-- Q5. 재료 자동완성 검색
-- -------------------------------------------------------
SELECT
    i.id,
    i.name,
    c.name         AS 카테고리,
    c.icon         AS 아이콘,
    i.default_unit AS 기본단위
FROM ingredients i
JOIN categories c ON i.category_id = c.id
WHERE i.name LIKE '%감%'
ORDER BY i.name
LIMIT 10;

-- -------------------------------------------------------
-- Q6. 카테고리별 재료 목록
-- -------------------------------------------------------
SELECT
    i.id,
    i.name,
    i.default_unit,
    i.weight_per_unit_g
FROM ingredients i
WHERE i.category_id = 1  -- 채소
ORDER BY i.name;

-- -------------------------------------------------------
-- Q7. 신규 재료 요청 접수 (F10)
-- -------------------------------------------------------
INSERT INTO ingredient_requests (name, requested_by, status, requested_at)
VALUES ('참나물', 1, 'pending', NOW())
ON DUPLICATE KEY UPDATE requested_at = NOW();
-- 관리자 승인 후 ingredients 테이블에 수동 INSERT

-- -------------------------------------------------------
-- Q8. 레시피별 소진 빈도 (자주 참고한 레시피)
-- -------------------------------------------------------
SELECT r.name AS 레시피, COUNT(*) AS 참고_횟수
FROM consumption_logs cl
JOIN recipes r ON cl.recipe_id = r.id
WHERE cl.user_id = 1 AND cl.type = 'cooked'
GROUP BY r.id, r.name
ORDER BY 참고_횟수 DESC;

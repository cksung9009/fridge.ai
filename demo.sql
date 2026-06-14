-- ============================================================
-- fridge.ai — Demo SQL (MySQL)
-- 목적: ERD 검증 및 핵심 쿼리 데모
-- ERD 버전: v0.2 (purchased_at 제거, 인덱스 추가)
-- ============================================================

DROP DATABASE IF EXISTS fridge_ai;
CREATE DATABASE fridge_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fridge_ai;

-- ============================================================
-- 1. 테이블 생성
-- ============================================================

CREATE TABLE categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL,
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
    carbon_per_100g    DECIMAL(8,4) NOT NULL COMMENT '탄소 발자국(kg CO₂)',
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
    user_id       INT          NOT NULL,             -- MVP: guest=1 고정
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

CREATE TABLE consumption_logs (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT          NOT NULL,
    inventory_id   INT          NOT NULL,
    ingredient_id  INT          NOT NULL,
    type           ENUM('cooked','wasted') NOT NULL,
    quantity_used  DECIMAL(8,2) NOT NULL,
    unit           VARCHAR(20)  NOT NULL,
    weight_g       DECIMAL(10,2) NOT NULL COMMENT 'quantity_used × weight_per_unit_g',
    youtube_video_id VARCHAR(20) NULL,
    logged_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(id),
    FOREIGN KEY (inventory_id)  REFERENCES user_inventory(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- ============================================================
-- 2. 인덱스
-- ============================================================

CREATE INDEX idx_inventory_user_status_expires
  ON user_inventory (user_id, status, expires_at);

CREATE INDEX idx_logs_user_type_date
  ON consumption_logs (user_id, type, logged_at);

-- ============================================================
-- 3. 시드 데이터
-- ============================================================

-- 카테고리
INSERT INTO categories (name, icon, sort_order) VALUES
('채소',   '🥦', 1),
('육류',   '🥩', 2),
('유제품', '🥛', 3),
('두부/콩','🫘', 4),
('조미료', '🧂', 5),
('기타',   '🛒', 6);

-- 재료 마스터 (name, category_id, default_unit, weight_per_unit_g, carbon_per_100g)
INSERT INTO ingredients (name, category_id, default_unit, weight_per_unit_g, carbon_per_100g) VALUES
('감자',       1, '개',  150.00, 0.0460),
('양파',       1, '개',  200.00, 0.0500),
('대파',       1, '개',  100.00, 0.0300),
('당근',       1, '개',  120.00, 0.0420),
('시금치',     1, '봉',  200.00, 0.0350),
('돼지고기',   2, '팩',  500.00, 0.7100),
('닭가슴살',   2, '팩',  400.00, 0.6900),
('달걀',       3, '개',   60.00, 0.1800),
('우유',       3, '팩',  900.00, 0.0900),
('두부',       4, '모',  300.00, 0.0700),
('간장',       5, '병', 1000.00, 0.0200),
('참기름',     5, '병',  500.00, 0.0300);

-- 데모 사용자 (guest 계정 — MVP에서 user_id=1 고정)
INSERT INTO users (email, password_hash) VALUES
('guest@fridge.ai', '$2b$10$demohashdemohashdemohashdemohashdemohashdemohashdemo');

-- 냉장고 재고 (기준일: 2026-06-14 기준 D-day 설정)
INSERT INTO user_inventory (user_id, ingredient_id, quantity, unit, expires_at, status) VALUES
(1, 1,  3, '개', '2026-06-15', 'active'),  -- 감자      D-1 ⚠️
(1, 2,  1, '개', '2026-06-16', 'active'),  -- 양파      D-2
(1, 8,  6, '개', '2026-06-17', 'active'),  -- 달걀      D-3
(1, 10, 1, '모', '2026-06-19', 'active'),  -- 두부      D-5
(1, 6,  1, '팩', '2026-06-20', 'active'),  -- 돼지고기  D-6
(1, 9,  1, '팩', '2026-06-22', 'active'),  -- 우유      D-8
(1, 3,  2, '개', '2026-06-28', 'active'),  -- 대파      D-14
(1, 11, 1, '병', '2026-12-31', 'active');  -- 간장      D-200

-- 소진 기록 (지난 30일 데모 데이터)
-- 조리 완료 기록
INSERT INTO consumption_logs
    (user_id, inventory_id, ingredient_id, type, quantity_used, unit, weight_g, youtube_video_id, logged_at)
VALUES
(1, 1, 1,  'cooked', 2, '개', 300.00, 'dQw4w9WgXcQ', '2026-06-10 19:30:00'),  -- 감자 2개 조리
(1, 2, 2,  'cooked', 1, '개', 200.00, 'dQw4w9WgXcQ', '2026-06-10 19:30:00'),  -- 양파 1개 조리
(1, 3, 8,  'cooked', 2, '개', 120.00, NULL,           '2026-06-11 12:00:00'),  -- 달걀 2개 조리
(1, 6, 9,  'cooked', 1, '팩', 900.00, NULL,           '2026-06-12 08:00:00'),  -- 우유 1팩 조리
-- 폐기 기록
(1, 4, 10, 'wasted', 1, '모', 300.00, NULL,           '2026-06-09 10:00:00'),  -- 두부 1모 폐기
(1, 5, 6,  'wasted', 1, '팩', 500.00, NULL,           '2026-06-08 18:00:00');  -- 돼지고기 1팩 폐기

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
        WHEN DATEDIFF(ui.expires_at, CURDATE()) <= 2 THEN '위험'
        WHEN DATEDIFF(ui.expires_at, CURDATE()) <= 5 THEN '임박'
        ELSE '여유'
    END                                           AS 상태
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
JOIN categories  c ON i.category_id    = c.id
WHERE ui.user_id = 1 AND ui.status = 'active'
ORDER BY ui.expires_at ASC;

-- -------------------------------------------------------
-- Q2. YouTube 추천 쿼리 생성 (임박 재료 TOP 3)
-- -------------------------------------------------------
SELECT GROUP_CONCAT(i.name ORDER BY ui.expires_at ASC SEPARATOR ' ') AS youtube_search_query
FROM (
    SELECT ui.ingredient_id, ui.expires_at
    FROM user_inventory ui
    WHERE ui.user_id = 1 AND ui.status = 'active'
    ORDER BY ui.expires_at ASC
    LIMIT 3
) ui
JOIN ingredients i ON ui.ingredient_id = i.id;

-- -------------------------------------------------------
-- Q3. 월간 환경 리포트
-- -------------------------------------------------------
SELECT
    SUM(cl.weight_g)                                    AS 총_절감량_g,
    ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 4) AS 탄소절감_kg,
    COUNT(*)                                            AS 조리_완료_횟수
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = 1
  AND cl.type = 'cooked'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');

-- -------------------------------------------------------
-- Q4. 월간 폐기 분석
-- -------------------------------------------------------
SELECT
    COUNT(*)         AS 폐기_횟수,
    SUM(cl.weight_g) AS 폐기량_g,
    ROUND(SUM(cl.weight_g * i.carbon_per_100g / 100), 4) AS 폐기_탄소_kg
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = 1
  AND cl.type = 'wasted'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');

-- -------------------------------------------------------
-- Q5. 재료 자동완성 검색
-- -------------------------------------------------------
SELECT
    i.id,
    i.name,
    c.name         AS 카테고리,
    i.default_unit AS 기본단위
FROM ingredients i
JOIN categories c ON i.category_id = c.id
WHERE i.name LIKE '%감%'
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

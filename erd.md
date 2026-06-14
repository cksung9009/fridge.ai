# fridge.ai — ERD & Query Definition

- **문서 버전:** 0.2
- **작성일:** 2026-06-14
- **상태:** 기획 확정 (MVP 리뷰 반영)

---

## ERD (Entity-Relationship Diagram)

```
┌─────────────┐       ┌──────────────────────┐       ┌─────────────┐
│    users    │       │    user_inventory     │       │ ingredients │
│─────────────│       │──────────────────────│       │─────────────│
│ id (PK)     │──┐    │ id (PK)              │──────▶│ id (PK)     │
│ email       │  │    │ user_id (FK)         │       │ name        │
│ password_   │  └───▶│ ingredient_id (FK)   │       │ category_id │
│   hash      │       │ quantity             │       │ default_unit│
│ created_at  │       │ unit                 │       │ weight_per_ │
│ updated_at  │       │ purchased_at         │       │   unit_g    │
└─────────────┘       │ expires_at           │       │ carbon_per_ │
       │              │ status               │       │   100g      │
       │              │ created_at           │       │ created_at  │
       │              │ updated_at           │       └─────────────┘
       │              └──────────────────────┘             │
       │                        │                          │
       │              ┌──────────────────────┐      ┌──────────────┐
       │              │  consumption_logs    │      │  categories  │
       │              │──────────────────────│      │──────────────│
       └─────────────▶│ id (PK)              │      │ id (PK)      │
                      │ user_id (FK)         │      │ name         │
                      │ inventory_id (FK)    │      │ icon         │
                      │ ingredient_id (FK)   │      │ sort_order   │
                      │ type (cooked/wasted) │      │ created_at   │
                      │ quantity_used        │      └──────────────┘
                      │ unit                 │
                      │ weight_g             │
                      │ youtube_video_id     │
                      │ logged_at            │
                      └──────────────────────┘
```

---

## 테이블 정의

### `categories`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| name | VARCHAR(50) | 채소, 육류, 유제품 등 |
| icon | VARCHAR(10) | 이모지 또는 아이콘명 |
| sort_order | INT | 탭 노출 순서 |
| created_at | TIMESTAMP | |

### `ingredients` (재료 마스터)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| name | VARCHAR(100) UNIQUE | 감자, 달걀 등 |
| category_id | INT FK | |
| default_unit | VARCHAR(20) | 개, g, ml, 팩 |
| weight_per_unit_g | DECIMAL(8,2) | 1단위 기본 무게 (감자 1개=150g) |
| carbon_per_100g | DECIMAL(8,4) | 탄소 발자국 (kg CO₂) |
| created_at | TIMESTAMP | |

### `users`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `user_inventory` (냉장고 재고)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| user_id | INT FK | MVP: guest=1 고정, 멀티유저 시 실제 ID |
| ingredient_id | INT FK | |
| quantity | DECIMAL(8,2) | 수량 |
| unit | VARCHAR(20) | 개, g, ml |
| expires_at | DATE | 유통기한 |
| status | ENUM | active / used / wasted |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `consumption_logs` (소진 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| user_id | INT FK | |
| inventory_id | INT FK | |
| ingredient_id | INT FK | 리포트 집계용 비정규화 |
| type | ENUM | cooked / wasted |
| quantity_used | DECIMAL(8,2) | |
| unit | VARCHAR(20) | |
| weight_g | DECIMAL(10,2) | quantity × weight_per_unit_g |
| youtube_video_id | VARCHAR(20) | NULL 허용 |
| logged_at | TIMESTAMP | |

---

## 인덱스

```sql
-- 재고 대시보드 핵심 쿼리 성능
CREATE INDEX idx_inventory_user_status_expires
  ON user_inventory (user_id, status, expires_at);

-- 환경 리포트 집계 성능
CREATE INDEX idx_logs_user_type_date
  ON consumption_logs (user_id, type, logged_at);
```

> `status + expires_at` 복합 인덱스로 D-day 정렬 쿼리 full scan 방지.
> `consumption_logs` 트랜잭션 정책: `user_inventory.status` 변경과 로그 INSERT는 반드시 같은 트랜잭션으로 처리.

---

## 핵심 쿼리

**재고 대시보드 (D-day 정렬)**
```sql
SELECT ui.*, i.name, i.carbon_per_100g, i.weight_per_unit_g,
       DATEDIFF(ui.expires_at, CURDATE()) AS days_left
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
WHERE ui.user_id = :userId AND ui.status = 'active'
ORDER BY ui.expires_at ASC;
```

**YouTube 추천 쿼리 생성 (임박 재료 TOP 3)**
```sql
SELECT i.name
FROM user_inventory ui
JOIN ingredients i ON ui.ingredient_id = i.id
WHERE ui.user_id = :userId AND ui.status = 'active'
ORDER BY ui.expires_at ASC
LIMIT 3;
```

**월간 환경 리포트**
```sql
SELECT
  SUM(cl.weight_g)                              AS total_saved_g,
  SUM(cl.weight_g * i.carbon_per_100g / 100)   AS carbon_saved_kg,
  COUNT(*)                                       AS cooked_count
FROM consumption_logs cl
JOIN ingredients i ON cl.ingredient_id = i.id
WHERE cl.user_id = :userId
  AND cl.type = 'cooked'
  AND cl.logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');
```

**폐기 분석**
```sql
SELECT COUNT(*) AS wasted_count, SUM(weight_g) AS wasted_g
FROM consumption_logs
WHERE user_id = :userId
  AND type = 'wasted'
  AND logged_at >= DATE_FORMAT(NOW(), '%Y-%m-01');
```

**재료 자동완성 검색**
```sql
SELECT i.*, c.name AS category_name
FROM ingredients i
JOIN categories c ON i.category_id = c.id
WHERE i.name LIKE CONCAT('%', :keyword, '%')
LIMIT 10;
```

**카테고리별 재료 목록**
```sql
SELECT i.*
FROM ingredients i
WHERE i.category_id = :categoryId
ORDER BY i.name;
```

---

## 설계 결정 사항 (Decision Log)

| 항목 | 결정 | 이유 |
|------|------|------|
| 재료명 관리 | 마스터 테이블 | 자동완성·카테고리 탭 기반 |
| 카테고리 관리 | 별도 테이블 | 코드 배포 없이 DB에서 수정 가능 |
| 수량 저장 | quantity + unit 분리 | 차감 계산 및 집계 가능 |
| 소진 기록 | 단일 테이블 (type 구분) | 리포트 쿼리 단순화 |
| 탄소 데이터 | 재료 마스터 컬럼 | 1:1 대응, 조인 불필요 |
| 무게 환산 | 마스터 기본값 사용 | 사용자 입력 부담 제거 |
| 자주 사는 재료 | 미구현 (Phase 2) | 현 단계 범위 제외 |
| 레시피 DB | 미보유 (YouTube API) | 저작권 리스크 없음 |
| user_id MVP 처리 | guest=1 고정 | 데모/제출 쿼리 명확성 |
| purchased_at | 컬럼 제거 | MVP 불필요, D-day는 expires_at만으로 계산 |
| 인덱스 | 2개 추가 | 핵심 쿼리 full scan 방지 |

---

*이 문서는 fridge.ai ERD의 기준점이며, 스키마 변경 시 함께 갱신한다.*

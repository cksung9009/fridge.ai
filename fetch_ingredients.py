"""
fridge.ai — 식품안전나라 식품영양성분 DB 수집 스크립트

사용법:
    python fetch_ingredients.py <API_KEY>

API 키 발급:
    1. https://www.data.go.kr/data/15127578/openapi.do 접속
    2. 회원가입 → 활용신청 → 승인 (보통 1~2일)
    3. 마이페이지 → 인증키 확인

출력:
    ingredients_from_api.sql — seed_ingredients.sql에 병합 가능한 INSERT문
"""

import sys
import json
import time
import urllib.request
import urllib.parse

API_BASE  = "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02"
OPERATION = "getFoodNtrCpntDbInq02"
PAGE_SIZE = 100

# 가공식품 제외 키워드
EXCLUDE_KEYWORDS = [
    "통조림", "레토르트", "즉석", "냉동", "과자", "사탕", "초콜릿",
    "음료", "주스", "탄산", "커피", "아이스크림", "빙과", "햄버거",
    "피자", "도넛", "케이크", "빵류(가공)", "스낵"
]

# 생재료로 분류할 식품군 (food_group 필드 기준)
RAW_GROUPS = [
    "곡류및그제품", "감자및전분류", "당류및그제품", "두류및그제품",
    "채소및그제품", "버섯류및그제품", "과실류및그제품", "육류및그제품",
    "어패류및그제품", "해조류및그제품", "유제품및기타동물성식품", "난류및그제품",
    "유지류및그제품", "조미료및향신료류"
]

# fridge.ai 카테고리 매핑
CATEGORY_MAP = {
    "채소및그제품":          1,
    "버섯류및그제품":        6,
    "감자및전분류":          1,
    "육류및그제품":          2,
    "어패류및그제품":        3,
    "해조류및그제품":        10,
    "난류및그제품":          4,
    "유제품및기타동물성식품": 4,
    "두류및그제품":          5,
    "곡류및그제품":          7,
    "과실류및그제품":        8,
    "조미료및향신료류":      9,
    "유지류및그제품":        9,
}

# 단위 기본값 (API에서 단위 정보가 없을 경우 사용)
DEFAULT_UNITS = {
    1: "개", 2: "팩", 3: "마리", 4: "개",
    5: "모", 6: "팩", 7: "봉",  8: "개",
    9: "병", 10: "봉"
}

# 탄소 발자국 기본값 (식품군별 평균, kg CO₂eq / 100g)
CARBON_DEFAULTS = {
    1: 0.0400,  # 채소
    2: 0.7000,  # 육류
    3: 0.2000,  # 해산물
    4: 0.2000,  # 달걀/유제품
    5: 0.0750,  # 두부/콩류
    6: 0.0200,  # 버섯류
    7: 0.1200,  # 곡류/면류
    8: 0.0700,  # 과일
    9: 0.1000,  # 조미료
    10: 0.0500, # 기타
}


def fetch_page(api_key: str, page_no: int) -> dict:
    params = urllib.parse.urlencode({
        "serviceKey": api_key,
        "pageNo":     page_no,
        "numOfRows":  PAGE_SIZE,
        "type":       "json",
    })
    url = f"{API_BASE}/{OPERATION}?{params}"
    with urllib.request.urlopen(url, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def is_raw(name: str, group: str) -> bool:
    for kw in EXCLUDE_KEYWORDS:
        if kw in name:
            return False
    return any(g in group for g in RAW_GROUPS)


def to_sql_row(name: str, category_id: int) -> str:
    unit   = DEFAULT_UNITS.get(category_id, "개")
    carbon = CARBON_DEFAULTS.get(category_id, 0.0500)
    safe   = name.replace("'", "''")
    return (
        f"('{safe}', {category_id}, '{unit}', 100.00, {carbon})"
    )


def main():
    if len(sys.argv) < 2:
        print("사용법: python fetch_ingredients.py <API_KEY>")
        sys.exit(1)

    api_key = sys.argv[1]
    print(f"[INFO] API 키: {api_key[:6]}***")

    # 1페이지로 전체 건수 확인
    try:
        data = fetch_page(api_key, 1)
    except Exception as e:
        print(f"[ERROR] API 연결 실패: {e}")
        sys.exit(1)

    body  = data.get("response", {}).get("body", {})
    total = int(body.get("totalCount", 0))
    print(f"[INFO] 전체 데이터: {total:,}건")

    rows     = []
    seen     = set()
    page_no  = 1
    total_pages = -(-total // PAGE_SIZE)  # ceil division

    while page_no <= total_pages:
        print(f"[FETCH] {page_no}/{total_pages} 페이지 ...", end=" ", flush=True)
        try:
            data = fetch_page(api_key, page_no)
        except Exception as e:
            print(f"실패 ({e}), 재시도 중...")
            time.sleep(2)
            continue

        items_wrap = data.get("response", {}).get("body", {}).get("items", {})
        # 단건일 때 dict, 복수일 때 list
        items = items_wrap.get("item", [])
        if isinstance(items, dict):
            items = [items]

        count = 0
        for item in items:
            name  = (item.get("FOOD_NM_KR") or item.get("FOOD_NM") or "").strip()
            group = (item.get("FOOD_CATEGRY_NM") or item.get("FOOD_GROUP") or "").strip()

            if not name or name in seen:
                continue
            if not is_raw(name, group):
                continue

            category_id = next(
                (v for k, v in CATEGORY_MAP.items() if k in group), 10
            )
            rows.append(to_sql_row(name, category_id))
            seen.add(name)
            count += 1

        print(f"수집 {count}건 (누적 {len(rows)}건)")
        page_no += 1
        time.sleep(0.3)   # API 호출 간격

    # SQL 파일 출력
    out_path = "ingredients_from_api.sql"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- 식품안전나라 API 수집 결과\n")
        f.write(f"-- 총 {len(rows)}건\n\n")
        f.write(
            "INSERT INTO ingredients "
            "(name, category_id, default_unit, weight_per_unit_g, carbon_per_100g) VALUES\n"
        )
        f.write(",\n".join(rows))
        f.write(";\n")

    print(f"\n[DONE] {out_path} 저장 완료 ({len(rows)}건)")
    print("※ weight_per_unit_g는 100g 기본값으로 설정됨 — 주요 재료 수동 보정 필요")


if __name__ == "__main__":
    main()

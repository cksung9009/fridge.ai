"""
COOKRCP01 API -> web/recipes_cookrcp.js 생성기

사용법:
  python scripts/fetch_cookrcp.py               # sample 모드 (5개)
  python scripts/fetch_cookrcp.py --key API_KEY # 전체 1,146개

API 키 발급:
  1. https://www.data.go.kr 회원가입
  2. '식품의약품안전처_조리식품의 레시피 DB' 활용 신청
  3. 발급된 일반 인증키(Encoding) 사용
"""
import urllib.request
import json
import re
import os
import argparse

BASE_URL   = "http://openapi.foodsafetykorea.go.kr/api/{key}/COOKRCP01/json/{s}/{e}"
SAMPLE_URL = "http://openapi.foodsafetykorea.go.kr/api/sample/COOKRCP01/json/{s}/{e}"

CAT_MAP = {
    "국&찌개":"국/찌개", "국_찌개":"국/찌개",
    "반찬":"볶음", "밥":"밥/면", "면":"밥/면", "죽":"밥/면",
    "구이":"구이", "조림":"조림", "무침":"무침",
    "찜":"기타", "일품":"기타", "후식":"기타", "간식":"기타", "양식":"기타",
}
EMOJI_MAP = {
    "국/찌개":"🍲", "볶음":"🍳", "전/부침":"🥞",
    "구이":"🔥", "조림":"🍖", "밥/면":"🍚", "무침":"🥬", "기타":"🍽",
}
SEASONINGS_SET = {
    "간장","국간장","진간장","소금","설탕","후추","참기름","들기름",
    "식용유","올리브오일","고춧가루","고추장","된장","쌈장",
    "액젓","멸치액젓","새우젓","식초","케첩","마요네즈","굴소스",
    "청주","미림","요리당","매실액","물엿","조청","전분",
    "밀가루","참깨","깨소금","통깨",
}
REMOVE_PREFIX = [
    "다진","삶은","볶은","데친","갈은","썬","채썬","채 썬",
    "저염","무염","조선","말린","불린","건","생","날","손질된",
    "얇게 썬","깍둑 썬","편 썬",
]
SKIP_NAMES = {"재료","양념","소스","고명","물","육수","국물","양념장","소스장","기타"}

SECTION_RE  = re.compile(r'[●▶◆▷■□*]\s*[^:\n]*[\s:]')
BRACKET_RE  = re.compile(r'\[[^\]]*\]')
AMOUNT_RE   = re.compile(
    r'[\d½⅓⅔¼¾/]+\s*'
    r'(g|ml|mL|kg|L|l|개|마리|장|봉|팩|모|컵|큰술|작은술|스푼|줄기|쪽|대|통|인분|인|조각|토막|줌|cm|mm|T|t)\b'
)
TRAIL_NUM   = re.compile(r'\s+[\d.]+\s*$')
MISC_AMOUNT = re.compile(r'\s+(약간|적당량|조금|소량|조금씩|각각|필요시|살짝).*$')


def normalize(raw):
    s = raw.strip()
    # "양념장 : 저염간장" → 콜론 뒤 내용만 사용
    m = re.match(r'^[\w\s]+:\s*(.+)', s)
    if m:
        s = m.group(1).strip()
    s = re.sub(r'\(.*?\)', '', s)
    s = AMOUNT_RE.sub('', s)
    s = MISC_AMOUNT.sub('', s)
    s = TRAIL_NUM.sub('', s)
    s = re.sub(r'[-·•∙]', '', s)
    for pf in REMOVE_PREFIX:
        if s.startswith(pf + " "):
            s = s[len(pf):].strip()
    return s.strip()


def parse_ingredients(text, recipe_name=""):
    if not text:
        return [], []
    # 첫 줄이 레시피명과 같으면 제거
    lines = text.split('\n')
    if lines and re.sub(r'\s', '', lines[0]) == re.sub(r'\s', '', recipe_name):
        text = '\n'.join(lines[1:])

    text = SECTION_RE.sub('\n', text)
    text = BRACKET_RE.sub('', text)
    text = text.replace('·', ',').replace('•', ',')
    parts = re.split(r'[,\n]', text)

    main_ings, sea_ings, seen = [], [], set()
    for part in parts:
        name = normalize(part)
        if not name or len(name) < 2 or len(name) > 12:
            continue
        if re.match(r'^[\d\s.]+$', name):
            continue
        if ':' in name:
            continue
        if name in SKIP_NAMES or name in seen:
            continue
        seen.add(name)
        if name in SEASONINGS_SET:
            sea_ings.append(name)
        else:
            main_ings.append(name)
    return main_ings, sea_ings


def fetch_page(key, s, e):
    url = (SAMPLE_URL if key == "sample" else BASE_URL).format(key=key, s=s, e=e)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fridge.ai/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as ex:
        print(f"  오류 {s}-{e}: {ex}")
        return None


def fetch_all(key, page=100):
    first = fetch_page(key, 1, 1)
    if not first:
        print("API 응답 없음. sample 모드로 전환합니다.")
        key = "sample"
        first = fetch_page(key, 1, 5)
        if not first:
            return [], key

    total = int(first.get("COOKRCP01", {}).get("total_count", 0))
    if key == "sample":
        total = min(total, 5)
    print(f"  총 레시피 {total}개 수신 시작...")

    rows, s = [], 1
    while s <= total:
        e = min(s + page - 1, total)
        data = fetch_page(key, s, e)
        if data:
            chunk = data.get("COOKRCP01", {}).get("row", [])
            rows.extend(chunk)
            print(f"  [{e}/{total}]", end="\r")
        s += page

    print(f"\n  {len(rows)}개 수신 완료")
    return rows, key


def build_recipes(rows):
    recipes, skip = [], 0
    for i, row in enumerate(rows):
        name = (row.get("RCP_NM") or "").strip()
        if not name:
            skip += 1; continue

        cat   = CAT_MAP.get((row.get("RCP_PAT2") or "기타").strip(), "기타")
        emoji = EMOJI_MAP.get(cat, "🍽")

        main_ings, sea_ings = parse_ingredients(
            row.get("RCP_PARTS_DTLS") or "", recipe_name=name
        )
        if len(main_ings) < 1:
            skip += 1; continue

        recipes.append({
            "id":          5000 + i,
            "name":        name,
            "cat":         cat,
            "emoji":       emoji,
            "ingredients": main_ings[:8],
            "seasonings":  sea_ings[:6],
        })

    print(f"  유효 {len(recipes)}개 / 제외 {skip}개")
    return recipes


def write_js(recipes, out_path):
    lines = [
        "/* fridge.ai — COOKRCP01 기반 레시피 (자동 생성) */",
        "(function () {",
        '  "use strict";',
        "  window.FRIDGE_RECIPES_EXT = [",
    ]
    for r in recipes:
        ing = json.dumps(r["ingredients"], ensure_ascii=False)
        sea = json.dumps(r["seasonings"],  ensure_ascii=False)
        nm  = json.dumps(r["name"],        ensure_ascii=False)
        ct  = json.dumps(r["cat"],         ensure_ascii=False)
        em  = json.dumps(r["emoji"],       ensure_ascii=False)
        lines.append(
            "    {id:" + str(r["id"]) + ",name:" + nm +
            ",cat:" + ct + ",emoji:" + em +
            ",ingredients:" + ing + ",seasonings:" + sea + "},"
        )
    lines += ["  ];", "})();", ""]

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  저장: {out_path}  ({len(recipes)}개, {os.path.getsize(out_path)//1024}KB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default="sample", help="COOKRCP01 API 인증키")
    args = ap.parse_args()

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out  = os.path.join(base, "web", "recipes_cookrcp.js")

    print("[1/3] API 호출...")
    rows, used_key = fetch_all(args.key)
    if not rows:
        print("데이터 없음, 종료."); raise SystemExit(1)

    print("[2/3] 재료 파싱...")
    recipes = build_recipes(rows)

    print("[3/3] JS 파일 생성...")
    write_js(recipes, out)

    if used_key == "sample":
        print("\n[!] sample 모드: 5개만 생성됐습니다.")
        print("    전체를 받으려면: python scripts/fetch_cookrcp.py --key 발급받은_API_키")

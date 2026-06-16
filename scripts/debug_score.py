import json, re

seed = [
  ("우유",0),("두부",1),("대파",1),("새우",1),("숙주나물",1),
  ("고등어",2),("시금치",2),("상추",2),("딸기",2),("오징어",2),("바지락",2),("소고기(불고기용)",2),
  ("달걀",4),("닭가슴살",3),("돼지고기(삼겹살)",3),("애호박",5),("콩나물",4),("바나나",3),
  ("순두부",3),("팽이버섯",3),("깻잎",3),("부추",3),("표고버섯",4),("브로콜리",4),("오이",4),
  ("쪽파",4),("플레인요거트",5),("파프리카",5),("토마토",5),("청양고추",5),("포도",5),
  ("닭다리",6),("새송이버섯",6),("방울토마토",6),("생크림",6),("감자",8),("어묵",8),
  ("떡(떡볶이용)",9),("베이컨",8),("소시지",10),("양파",14),("당근",10),("배추",7),
  ("사과",7),("귤",10),("무",12),("슬라이스치즈",12),("양배추",10),("고구마",15),
  ("마늘",20),("버터",25),("된장",30),("고추장",45),("간장",60),("참기름",90),
  ("고춧가루",60),("소금",120),("설탕",120),("참치(캔)",200),("쌀",180),("라면",120),
]

CANONICAL = {
  "돼지고기(삼겹살)":"돼지고기","돼지고기(불고기용)":"돼지고기","돼지고기(앞다리)":"돼지고기",
  "삼겹살":"돼지고기","목살":"돼지고기",
  "소고기(불고기용)":"소고기","소고기(국거리)":"소고기",
  "닭가슴살":"닭고기","닭볶음탕용":"닭고기","닭다리살":"닭고기","닭안심":"닭고기",
  "대파":"파류","파":"파류","쪽파":"파류","실파":"파류",
  "두부":"두부류","연두부":"두부류","순두부":"두부류",
  "표고버섯":"버섯","느타리버섯":"버섯","새송이버섯":"버섯","팽이버섯":"버섯","양송이버섯":"버섯",
  "새우":"새우류","칵테일새우":"새우류","냉동새우":"새우류",
  "청양고추":"고추류","홍고추":"고추류","풋고추":"고추류",
  "계란":"달걀",
  "배추":"배추류","알배추":"배추류",
  "애호박":"호박류","단호박":"호박류",
  "갈치":"생선류","삼치":"생선류","조기":"생선류","고등어":"생선류","연어":"생선류"
}
SEASONINGS = {
  "간장","국간장","진간장","소금","설탕","후추","참기름","들기름","식용유","올리브오일",
  "고춧가루","고추장","된장","쌈장","액젓","멸치액젓","새우젓","식초","케첩","마요네즈",
  "굴소스","청주","미림","요리당","매실액","물엿","조청","전분","밀가루","참깨","깨소금","통깨"
}

def to_can(n): return CANONICAL.get(n, n)

owned_exact = {n: d for n, d in seed}
owned_canon, d_canon = {}, {}
for n, d in seed:
    c = to_can(n)
    owned_canon[c] = True
    if c not in d_canon or d < d_canon[c]: d_canon[c] = d

def owns(n): return n in owned_exact or to_can(n) in owned_canon
def dday(n):
    if n in owned_exact: return owned_exact[n]
    return d_canon.get(to_can(n), 999)
def status(n):
    d = dday(n)
    if d <= 2: return "urgent"
    if d <= 5: return "warn"
    return "fresh"

with open("web/recipes_cookrcp.js", encoding="utf-8") as f:
    content = f.read()

pat = re.compile(
    r'\{id:(\d+),name:"([^"]+)",cat:"([^"]+)",emoji:"([^"]+)",'
    r'ingredients:(\[[^\]]*\]),seasonings:(\[[^\]]*\])\}'
)

total = 0
pass_cur = 0  # 현재 필터 (missing > 60%)
pass_new = 0  # 새 필터 (임박+주의 >= 1 AND missing <= 40%)

no_urgent_warn = 0  # 임박/주의 하나도 없는 레시피
for m in pat.finditer(content):
    id_, name, cat, emoji, ings_s, seas_s = m.groups()
    main_req = json.loads(ings_s)
    sea_req  = json.loads(seas_s)
    main_match = [n for n in main_req if owns(n)]
    sea_match  = [n for n in sea_req  if owns(n)]
    missing    = [n for n in main_req if not owns(n)]
    urgent = [n for n in main_match if status(n) == "urgent"]
    warn   = [n for n in main_match if status(n) == "warn"]
    fresh  = [n for n in main_match if status(n) == "fresh"]

    mlen = max(len(main_req), 1)
    completeness = len(main_match) / mlen
    urgent_ratio = len(urgent) / max(len(main_match), 1)
    abs_bonus    = min(len(main_match), 8) / 8
    sea_ratio    = len(sea_match) / max(len(sea_req), 1)

    score = 40*urgent_ratio + 35*completeness + 15*abs_bonus + 10*sea_ratio

    if not main_match: continue
    total += 1

    # 현재 필터
    if score > 0 and len(missing) <= mlen * 0.6:
        pass_cur += 1

    # 새 필터 후보
    has_urgent_warn = (len(urgent) + len(warn)) >= 1
    has_enough = len(missing) <= mlen * 0.4   # 주재료 60% 이상 보유

    if has_urgent_warn and has_enough and score > 0:
        pass_new += 1
    elif not has_urgent_warn and len(missing) <= mlen * 0.4:
        no_urgent_warn += 1

print(f"주재료 매칭 레시피: {total}개")
print(f"현재 필터 통과:     {pass_cur}개  (missing <= 60%)")
print(f"새 필터 통과:       {pass_new}개  (임박/주의 1개+ AND missing <= 40%)")
print(f"임박/주의 없는 것:  {no_urgent_warn}개  (재료는 충분하나 임박/주의 없음)")

print()
print("=== 새 필터 TOP 15 ===")
results = []
for m in pat.finditer(content):
    id_, name, cat, emoji, ings_s, seas_s = m.groups()
    main_req = json.loads(ings_s)
    sea_req  = json.loads(seas_s)
    main_match = [n for n in main_req if owns(n)]
    sea_match  = [n for n in sea_req  if owns(n)]
    missing    = [n for n in main_req if not owns(n)]
    urgent = [n for n in main_match if status(n) == "urgent"]
    warn   = [n for n in main_match if status(n) == "warn"]
    fresh  = [n for n in main_match if status(n) == "fresh"]

    mlen = max(len(main_req), 1)
    if not main_match: continue
    if (len(urgent)+len(warn)) < 1: continue
    if len(missing) > mlen * 0.4: continue

    urgent_ratio = len(urgent) / max(len(main_match), 1)
    completeness = len(main_match) / mlen
    abs_bonus    = min(len(main_match), 8) / 8
    sea_ratio    = len(sea_match) / max(len(sea_req), 1)
    score = 40*urgent_ratio + 35*completeness + 15*abs_bonus + 10*sea_ratio
    if score > 0:
        results.append((score, name, urgent, warn, fresh, missing))

results.sort(reverse=True)
for i, (score, name, urg, wrn, frsh, miss) in enumerate(results[:15], 1):
    all_match = urg + wrn + frsh
    print(f"{i:2}. [{score:5.1f}] {name}")
    print(f"       보유: {all_match}")
    if miss: print(f"       부족: {miss}")

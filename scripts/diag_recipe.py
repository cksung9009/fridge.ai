"""레시피 데이터 품질 진단 - 대표 레시피 재료 확인"""
import json, re

with open("web/recipes_cookrcp.js", encoding="utf-8") as f:
    content = f.read()

pat = re.compile(
    r'\{id:(\d+),name:"([^"]+)",cat:"([^"]+)",emoji:"([^"]+)",'
    r'ingredients:(\[[^\]]*\]),seasonings:(\[[^\]]*\])\}'
)

recipes = []
for m in pat.finditer(content):
    id_, name, cat, emoji, ings_s, seas_s = m.groups()
    recipes.append({
        "id": int(id_),
        "name": name,
        "ingredients": json.loads(ings_s),
        "seasonings": json.loads(seas_s),
    })

# 1) 특정 레시피 검색
targets = ["갈치", "된장찌개", "김치찌개", "삼겹살", "계란", "두부", "고등어", "오징어"]
print("=== 키워드별 레시피 재료 샘플 ===")
shown = set()
for kw in targets:
    for r in recipes:
        if kw in r["name"] and r["id"] not in shown:
            shown.add(r["id"])
            total = len(r["ingredients"]) + len(r["seasonings"])
            print(f"\n[{r['name']}] (총 {total}개)")
            print(f"  주재료: {r['ingredients']}")
            print(f"  양념:   {r['seasonings']}")
            break

# 2) 주재료 개수 분포
from collections import Counter
dist = Counter(len(r["ingredients"]) for r in recipes)
print("\n=== 주재료 개수 분포 ===")
for k in sorted(dist):
    print(f"  {k}개: {dist[k]}개 레시피")

# 3) 주재료 0개인 레시피 샘플
zero = [r for r in recipes if len(r["ingredients"]) == 0]
print(f"\n주재료 0개 레시피: {len(zero)}개")
for r in zero[:5]:
    print(f"  {r['name']}")

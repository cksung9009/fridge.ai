import re

with open("web/index.html", encoding="utf-8") as f:
    html = f.read()
with open("web/app.js", encoding="utf-8") as f:
    js = f.read()

ids = re.findall(r'id="(rp[^"]+)"', html)
print("HTML rp* IDs:", ids)
print()

for id_ in ids:
    ok = id_ in js
    print(("OK" if ok else "NG") + "  " + id_)

print()
for fn in ["seedLog", "loadLog", "saveLog", "renderReport", "LOG_KEY"]:
    ok = fn in js
    print(("OK" if ok else "NG") + "  " + fn)

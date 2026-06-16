with open("web/app.js", encoding="utf-8") as f:
    js = f.read()
with open("web/styles.css", encoding="utf-8") as f:
    css = f.read()

checks = [
    ("STORE_KEY v4",     "fridge.ai.items.v4" in js),
    ("blogUrl 함수",      "function blogUrl" in js),
    ("reco-card div",    'class="reco-card"' in js and "<div" in js[js.index('class="reco-card"')-5:js.index('class="reco-card"')]),
    ("reco-link-yt",     "reco-link-yt" in js),
    ("reco-link-blog",   "reco-link-blog" in js),
    ("홈 3개",           "scored.slice(0,3)" in js),
    ("탭 20개",          "scored.slice(0,20)" in js),
    ("CSS reco-links",   ".reco-links" in css),
    ("CSS reco-link-yt", ".reco-link-yt" in css),
]

for label, ok in checks:
    print(("OK" if ok else "NG") + "  " + label)

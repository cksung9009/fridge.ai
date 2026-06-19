(function () {
  "use strict";

  /* ---- 재료 마스터 ---- */
  var DATA = window.FRIDGE_DATA || { categories: [], catIcon: {}, ingredients: [] };
  var CATEGORIES = DATA.categories.map(function(c){ return c.name; });
  var CAT_ICON = DATA.catIcon;
  var MASTER = {};
  DATA.ingredients.forEach(function(it){ MASTER[it.name] = it; });
  var MASTER_NAMES = DATA.ingredients.map(function(it){ return it.name; });
  var QUICK = ["달걀","우유","양파","대파","두부","감자","당근","닭가슴살","애호박"];
  var DEMO_USER = { name: "임스", initial: "임", displayName: "스" };

  /* ---- 재료 정규화: 별칭 → 표준명 ---- */
  var CANONICAL = {
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
  };

  var SEASONINGS_SET = {
    "간장":1,"국간장":1,"진간장":1,"소금":1,"설탕":1,"후추":1,
    "참기름":1,"들기름":1,"식용유":1,"올리브오일":1,
    "고춧가루":1,"고추장":1,"된장":1,"쌈장":1,
    "액젓":1,"멸치액젓":1,"새우젓":1,"식초":1,
    "케첩":1,"마요네즈":1,"굴소스":1,"청주":1,"미림":1,
    "요리당":1,"매실액":1,"물엿":1,"조청":1,
    "전분":1,"밀가루":1,"참깨":1,"깨소금":1,"통깨":1
  };

  function toCanonical(name) { return CANONICAL[name] || name; }
  function isSeasoning(name) { return !!SEASONINGS_SET[name]; }

  function isValidIngredient(name) {
    return Object.prototype.hasOwnProperty.call(MASTER, name);
  }
  function emojiFor(name) {
    return MASTER[name] ? MASTER[name].emoji : "🥗";
  }

  /* ---- 날짜 유틸 ---- */
  var MS_DAY = 86400000;
  function startOfDay(d) { var x = new Date(d); x.setHours(0,0,0,0); return x; }
  var TODAY = startOfDay(new Date());
  function addDays(n) { var d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }
  function toISO(d) {
    var x = startOfDay(d);
    var m = String(x.getMonth() + 1).padStart(2, "0");
    var day = String(x.getDate()).padStart(2, "0");
    return x.getFullYear() + "-" + m + "-" + day;
  }
  function parseISO(s) {
    var parts = String(s).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function ddayOf(iso) { return Math.round((parseISO(iso) - TODAY) / MS_DAY); }
  function ddayLabel(d) {
    if (d < 0) return "만료";
    if (d === 0) return "D-day";
    return "D-" + d;
  }
  function ddayClass(d) {
    if (d < 0) return "dday-expired";
    if (d <= 2) return "dday-urgent";
    if (d <= 5) return "dday-warn";
    return "dday-ok";
  }

  /* ---- 소비 로그 ---- */
  var LOG_KEY = "fridge.ai.log.v1";
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch(e) { return []; } }
  function saveLog(log) { try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch(e) {} }

  function seedLog() {
    if (loadLog().length > 0) return;
    var base = new Date(TODAY);
    var names = [
      "달걀","두부","시금치","대파","닭가슴살","콩나물","양파","표고버섯",
      "오이","고등어","새우","돼지고기(삼겹살)","당근","애호박","배추",
      "달걀","대파","두부","시금치","양파","닭가슴살"
    ];
    var log = names.map(function(name, i) {
      var d = new Date(base); d.setDate(d.getDate() - (21 - i));
      return { date: toISO(d), name: name, act: i % 8 === 0 ? "discard" : "cook" };
    });
    saveLog(log);
  }

  /* ---- 상태 ---- */
  var STORE_KEY = "fridge.ai.items.v4";
  var items = load();
  var activeCat = "전체";
  var searchText = "";
  var statusFilter = "all";

  var STATUS = {
    urgent: { label: "임박", cls: "is-urgent", test: function(d){ return d <= 2; } },
    warn:   { label: "주의", cls: "is-warn",   test: function(d){ return d >= 3 && d <= 5; } },
    fresh:  { label: "신선", cls: "is-fresh",  test: function(d){ return d >= 6; } }
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch(e) {}
  }
  function seed() {
    function mk(name, qty, days) {
      return { id: uid(), name: name, cat: MASTER[name] ? MASTER[name].cat : "기타", qty: qty, expiry: toISO(addDays(days)) };
    }
    return [
      /* ── 임박 (0-2일) ── */
      mk("달걀",             "10개",         0),
      mk("두부",             "1모",          1),
      mk("대파",             "1단",          1),
      mk("새우",             "200g",         1),
      mk("숙주나물",         "1봉",          1),
      mk("고등어",           "2마리",         2),
      mk("시금치",           "1단",          2),
      mk("상추",             "1봉",          2),
      mk("딸기",             "1팩",          2),
      mk("오징어",           "1마리",         2),
      mk("바지락",           "1봉",          2),
      mk("소고기(불고기용)", "300g",          2),

      /* ── 주의 (3-5일) ── */
      mk("우유",             "900mL 1팩",    4),
      mk("닭가슴살",         "400g",         3),
      mk("돼지고기(삼겹살)", "500g",         3),
      mk("애호박",           "1개",          5),
      mk("콩나물",           "1봉",          4),
      mk("바나나",           "3개",          3),
      mk("순두부",           "1팩",          3),
      mk("팽이버섯",         "1봉",          3),
      mk("깻잎",             "1단",          3),
      mk("부추",             "1단",          3),
      mk("표고버섯",         "1팩",          4),
      mk("브로콜리",         "1개",          4),
      mk("오이",             "3개",          4),
      mk("쪽파",             "1단",          4),
      mk("플레인요거트",     "2개",          5),
      mk("파프리카",         "2개",          5),
      mk("토마토",           "4개",          5),
      mk("청양고추",         "10개",         5),
      mk("포도",             "1송이",        5),

      /* ── 신선 (6일+) ── */
      mk("닭다리",           "4개",          6),
      mk("새송이버섯",       "1팩",          6),
      mk("방울토마토",       "1팩",          6),
      mk("생크림",           "1팩",          6),
      mk("감자",             "5개",          8),
      mk("어묵",             "1팩",          8),
      mk("떡(떡볶이용)",     "1봉",          9),
      mk("베이컨",           "1팩",          8),
      mk("소시지",           "1봉",         10),
      mk("양파",             "6개",         14),
      mk("당근",             "3개",         10),
      mk("배추",             "1/4통",        7),
      mk("사과",             "4개",          7),
      mk("귤",               "8개",         10),
      mk("무",               "1개",         12),
      mk("슬라이스치즈",     "10장",        12),
      mk("양배추",           "1/2통",       10),
      mk("고구마",           "4개",         15),
      mk("마늘",             "1통",         20),
      mk("버터",             "1팩",         25),
      mk("된장",             "1통",         30),
      mk("고추장",           "1통",         45),
      mk("간장",             "1병",         60),
      mk("참기름",           "1병",         90),
      mk("고춧가루",         "1봉",         60),
      mk("소금",             "1봉",        120),
      mk("설탕",             "1봉",        120),
      mk("참치(캔)",         "3캔",        200),
      mk("쌀",               "5kg",        180),
      mk("라면",             "5개",        120),
    ];
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  /* ---- DOM ---- */
  function $(sel) { return document.querySelector(sel); }
  var el = {
    today:        $("#todayLabel"),
    fridgeName:   $("#fridgeName"),
    userInitial:  $("#userInitial"),
    userDisplayName: $("#userDisplayName"),
    sumUrgent:    $("#sumUrgent"),
    sumWarn:      $("#sumWarn"),
    sumFresh:     $("#sumFresh"),
    sumTotal:     $("#sumTotal"),
    bellDot:      $("#bellDot"),
    urgentScroll: $("#urgentScroll"),
    guardianBanner: $("#guardianBanner"),
    homeReco:     $("#homeReco"),
    recoQueryHint:$("#recoQueryHint"),
    stockSearch:  $("#stockSearch"),
    catChips:     $("#catChips"),
    statusChips:  $("#statusChips"),
    stockList:    $("#stockList"),
    stockEmpty:   $("#stockEmpty"),
    recoQuery:    $("#recoQuery"),
    recipeList:   $("#recipeList"),
    reportBars:   $("#reportBars"),
    fab:          $("#fab"),
    tabs:         document.querySelectorAll(".tab"),
    overlay:      $("#sheetOverlay"),
    sheetClose:   $("#sheetClose"),
    levelModalOverlay: $("#levelModalOverlay"),
    levelModalClose:   $("#levelModalClose"),
    levelModalBody:    $("#levelModalBody"),
    editOverlay:  $("#editOverlay"),
    editSheetClose: $("#editSheetClose"),
    editQtyForm:  $("#editQtyForm"),
    editQtyInput: $("#editQtyInput"),
    editItemName: $("#editItemName"),
    quickAdd:     $("#quickAdd"),
    addForm:      $("#addForm"),
    inName:           $("#inName"),
    inQty:            $("#inQty"),
    inExpiry:         $("#inExpiry"),
    inSellBy:         $("#inSellBy"),
    expiryHint:       $("#expiryHint"),
    expiryLabel:      $("#expiryLabel"),
    expiryModeChips:  $("#expiryModeChips"),
    ingredientList: $("#ingredientList"),
    catAuto:      $("#catAuto"),
    nameHint:     $("#nameHint"),
    toast:        $("#toast")
  };

  /* ---- 렌더 ---- */
  function sorted() {
    return items.slice().sort(function(a,b){ return ddayOf(a.expiry) - ddayOf(b.expiry); });
  }

  function renderHeader() {
    var d = TODAY;
    var days = ["일","월","화","수","목","금","토"];
    el.today.textContent = (d.getMonth()+1) + "월 " + d.getDate() + "일 (" + days[d.getDay()] + ")";
    el.fridgeName.textContent = DEMO_USER.name + "네 냉장고";
    el.userInitial.textContent = DEMO_USER.initial;
    el.userDisplayName.textContent = DEMO_USER.displayName;
  }

  function renderSummary() {
    var u = 0, w = 0, f = 0;
    items.forEach(function(it) {
      var d = ddayOf(it.expiry);
      if (d <= 2) u++;
      else if (d <= 5) w++;
      else f++;
    });
    el.sumUrgent.textContent = u;
    el.sumWarn.textContent = w;
    el.sumFresh.textContent = f;
    el.sumTotal.textContent = items.length;
    el.bellDot.hidden = (u === 0);
  }

  function renderUrgent() {
    var list = sorted().filter(function(it){ return ddayOf(it.expiry) <= 5; });
    if (!list.length) {
      el.urgentScroll.innerHTML = '<div class="u-card" style="flex-basis:auto"><div class="u-name">임박 재료 없음 🎉</div><div class="u-qty">모두 신선해요</div></div>';
      return;
    }
    el.urgentScroll.innerHTML = list.map(function(it) {
      var d = ddayOf(it.expiry);
      return '<div class="u-card">'
        + '<div class="u-emoji">' + emojiFor(it.name) + '</div>'
        + '<div class="u-info">'
        + '<div class="u-name">' + esc(it.name) + '</div>'
        + '<div class="u-qty">' + esc(it.qty || "") + '</div>'
        + '</div>'
        + '<div class="u-dday"><span class="dday ' + ddayClass(d) + '">' + ddayLabel(d) + '</span></div>'
        + '</div>';
    }).join("");
  }

  /* ---- 요리/메뉴 DB 기반 추천 엔진 ---- */
  function ytUrl(q) {
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  }
  function blogUrl(q) {
    return "https://search.naver.com/search.naver?where=blog&query=" + encodeURIComponent(q);
  }

  function scoreRecipes() {
    var RECIPES = (window.FRIDGE_RECIPES || []).concat(window.FRIDGE_RECIPES_EXT || []);
    if (!items.length || !RECIPES.length) return [];

    var ownedExact = {}, ownedCanon = {}, dExact = {}, dCanon = {};
    items.forEach(function(it) {
      var d = ddayOf(it.expiry);
      ownedExact[it.name] = true;
      dExact[it.name] = d;
      var c = toCanonical(it.name);
      ownedCanon[c] = true;
      if (dCanon[c] === undefined || d < dCanon[c]) dCanon[c] = d;
    });

    function owns(n) { return ownedExact[n] || ownedCanon[toCanonical(n)]; }
    function dday(n) {
      if (dExact[n] !== undefined) return dExact[n];
      return dCanon[toCanonical(n)];
    }
    function ingStatus(n) {
      var d = dday(n);
      if (d === undefined) return "fresh";
      if (d <= 2) return "urgent";
      if (d <= 5) return "warn";
      return "fresh";
    }

    var scored = RECIPES.map(function(dish) {
      var mainReq = dish.ingredients ? dish.ingredients.slice() : [];
      var seaReq  = dish.seasonings  ? dish.seasonings.slice()  : [];

      if (!dish.seasonings) {
        var autoMain = [], autoSea = [];
        mainReq.forEach(function(n){ (isSeasoning(n) ? autoSea : autoMain).push(n); });
        mainReq = autoMain; seaReq = autoSea;
      }

      var mainMatch  = mainReq.filter(owns);
      var seaMatch   = seaReq.filter(owns);
      var missing    = mainReq.filter(function(n){ return !owns(n); });
      var urgentMain = mainMatch.filter(function(n){ return ingStatus(n) === "urgent"; });
      var warnMain   = mainMatch.filter(function(n){ return ingStatus(n) === "warn"; });
      var freshMain  = mainMatch.filter(function(n){ return ingStatus(n) === "fresh"; });

      var mLen         = Math.max(mainReq.length, 1);
      var completeness = mainMatch.length / mLen;
      var urgentRatio  = urgentMain.length / Math.max(mainMatch.length, 1);
      var absBonus     = Math.min(urgentMain.length + warnMain.length, 5) / 5;
      var seaRatio     = seaMatch.length / Math.max(seaReq.length, 1);

      var score = 35 * urgentRatio    /* 매칭 중 임박 비율 → 소진 유도 */
                + 15 * completeness   /* 주재료 충족률 */
                + 40 * absBonus       /* 임박·주의 재료 절대 개수 보너스 (다재료 요리 우대) */
                + 10 * seaRatio;      /* 양념 갖춤 정도 */

      /* 임박/주의 재료 없는 레시피 제외 (냉장고 소진 목적과 무관) */
      if (urgentMain.length + warnMain.length === 0) score = 0;
      /* 주재료 60% 미만 보유 시 제외 */
      if (missing.length > mLen * 0.4) score = 0;

      return {
        id: dish.id, name: dish.name, cat: dish.cat, emoji: dish.emoji,
        score: score,
        mainMatch: mainMatch, seaMatch: seaMatch, missing: missing,
        urgentMain: urgentMain, warnMain: warnMain, freshMain: freshMain
      };
    });

    var seen = {};
    return scored
      .filter(function(r){ return r.mainMatch.length > 0 && r.score > 0; })
      .sort(function(a,b){ return b.score - a.score; })
      .filter(function(r){
        if (seen[r.name]) return false;
        seen[r.name] = true;
        return true;
      });
  }

  function recoCardHTML(r) {
    /* 매칭 재료 태그: 임박(빨강) → 주의(노랑) → 신선(초록), 최대 4개 */
    var matchTags = [];
    r.urgentMain.forEach(function(n){
      matchTags.push('<span class="tag tag-urgent">' + esc(n) + '</span>');
    });
    r.warnMain.forEach(function(n){
      matchTags.push('<span class="tag tag-warn">' + esc(n) + '</span>');
    });
    r.freshMain.forEach(function(n){
      matchTags.push('<span class="tag tag-fresh">' + esc(n) + '</span>');
    });
    var tagsHtml = matchTags.slice(0, 4).join("");

    /* 부족 재료: 이름 직접 표시 (최대 2개), 초과분은 "외 N개" */
    var missHtml = "";
    if (r.missing.length) {
      var shownMiss = r.missing.slice(0, 2).map(function(n){
        return '<span class="tag tag-miss">✕ ' + esc(n) + '</span>';
      }).join("");
      var moreMiss = r.missing.length > 2
        ? '<span class="tag tag-miss-more">외 ' + (r.missing.length - 2) + '개</span>'
        : "";
      missHtml = '<div class="reco-miss">' + shownMiss + moreMiss + '</div>';
    }

    var urgentBadge = r.urgentMain.length
      ? '<span class="uses">임박 ' + r.urgentMain.length + '개 소진</span>' : "";

    var yt   = ytUrl(r.name + " 레시피");
    var blog = blogUrl(r.name + " 레시피");

    return '<div class="reco-card">'
      + '<div class="reco-thumb">' + (r.emoji || "🍳") + '</div>'
      + '<div class="reco-body">'
      + '<div class="reco-title">' + esc(r.name) + '</div>'
      + '<div class="reco-tags">' + tagsHtml + '</div>'
      + missHtml
      + '<div class="reco-meta">' + urgentBadge + '</div>'
      + '<div class="reco-links">'
      + '<a class="reco-link reco-link-yt" href="' + yt + '" target="_blank" rel="noopener">▶ YouTube</a>'
      + '<a class="reco-link reco-link-blog" href="' + blog + '" target="_blank" rel="noopener">📝 블로그</a>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  /* ---- Guardian: AI 설명 룩업 ---- */
  function getExplanation(top) {
    var EXPL = window.FRIDGE_EXPLANATIONS;
    if (!EXPL || !top) return null;
    var urgent = top.urgentMain.slice().sort();
    var warn   = top.warnMain.slice().sort();
    var combined = urgent.concat(warn).sort();
    var tries = [
      combined.join("+"),
      urgent.join("+"),
      urgent.slice(0, 2).sort().join("+"),
      urgent.slice(0, 1).join("+"),
      warn.slice(0, 1).join("+")
    ];
    for (var i = 0; i < tries.length; i++) {
      if (tries[i] && EXPL[tries[i]]) return EXPL[tries[i]];
    }
    return null;
  }

  /* ---- Guardian: 탄소 절약량 계산 (kg CO₂) ---- */
  function findItem(name) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].name === name || toCanonical(items[i].name) === toCanonical(name)) return items[i];
    }
    return null;
  }
  function calcCarbonSaved(top) {
    var CARBON = window.FRIDGE_CARBON;
    if (!CARBON || !top) return 0;
    var urgentNames = top.urgentMain.concat(top.warnMain);
    var total = 0;
    urgentNames.forEach(function(name) {
      var c = CARBON[name];
      if (!c) return;
      var item = findItem(name);
      var qty = item ? (parseFloat(item.qty) || 1) : 1;
      total += qty * c.weightPerUnit * c.carbonPer100g / 100;
    });
    return Math.round(total * 100) / 100;
  }

  /* ---- Guardian: 설명 없을 때 템플릿 폴백 ---- */
  function templateExplanation(top) {
    var names = top.urgentMain.slice(0, 2);
    if (!names.length) names = top.warnMain.slice(0, 1);
    if (!names.length) return top.name + "을(를) 오늘 만들어보세요.";
    var dStr = names.map(function(n) {
      var it = findItem(n);
      var d = it ? ddayOf(it.expiry) : 0;
      return n + (d === 0 ? "(오늘 만료)" : d === 1 ? "(내일 만료)" : "(D-" + d + ")");
    });
    return dStr.join(", ") + "가 있어서 " + top.name + "을(를) 추천드려요.";
  }

  /* ---- Guardian 배너 렌더링 ---- */
  function renderGuardian(scored) {
    if (!el.guardianBanner) return;
    if (!scored || !scored.length) {
      el.guardianBanner.innerHTML = "";
      el.guardianBanner.classList.remove("is-active");
      return;
    }
    var top  = scored[0];
    var expl = getExplanation(top);
    var text = expl ? expl.text : templateExplanation(top);
    var co2  = calcCarbonSaved(top);
    var co2Html = co2 > 0
      ? '<span class="guardian-carbon">🌱 CO₂ ' + co2.toFixed(2) + 'kg 절약</span>'
      : "";
    el.guardianBanner.innerHTML =
      '<div class="guardian-head">'
      + '<span class="guardian-label">오늘의 냉장고 가이드</span>'
      + '</div>'
      + '<p class="guardian-text">' + esc(text) + '</p>'
      + '<div class="guardian-foot">'
      + '<span class="guardian-recipe">' + esc((expl && expl.emoji) || top.emoji || "🍳") + " " + esc((expl && expl.recipe) || top.name) + '</span>'
      + co2Html
      + '</div>';
    el.guardianBanner.classList.add("is-active");
  }

  function renderReco() {
    var scored = scoreRecipes();
    if (!scored.length) {
      var empty = '<div class="reco-empty">재료를 추가하면 맞춤 요리를 추천해드려요</div>';
      el.homeReco.innerHTML = empty;
      el.recipeList.innerHTML = empty;
      el.recoQueryHint.textContent = "";
      el.recoQuery.textContent = "재료를 추가해 주세요";
      renderGuardian(null);
      return;
    }
    el.recoQueryHint.textContent = "";
    el.recoQuery.textContent = scored[0].name;
    el.homeReco.innerHTML = scored.slice(0,3).map(recoCardHTML).join("");
    el.recipeList.innerHTML = scored.slice(0,20).map(recoCardHTML).join("");
    renderGuardian(scored);
  }

  function renderChips() {
    var cats = ["전체"].concat(CATEGORIES);
    el.catChips.innerHTML = cats.map(function(c) {
      var active = c === activeCat ? " is-active" : "";
      return '<button class="chip' + active + '" data-cat="' + c + '">' + c + '</button>';
    }).join("");
  }

  function renderStatusChips() {
    var defs = [
      { key: "all", label: "전체" },
      { key: "urgent", label: "임박" },
      { key: "warn", label: "주의" },
      { key: "fresh", label: "신선" }
    ];
    el.statusChips.innerHTML = defs.map(function(d) {
      var count = d.key === "all"
        ? items.length
        : items.filter(function(it){ return STATUS[d.key].test(ddayOf(it.expiry)); }).length;
      var active = statusFilter === d.key;
      var color = (active && STATUS[d.key]) ? STATUS[d.key].cls : "";
      return '<button class="chip status-chip' + (active ? " is-active" : "") + " " + color
        + '" data-status-chip="' + d.key + '">' + d.label + ' <em>' + count + '</em></button>';
    }).join("");
  }

  function renderStock() {
    var list = sorted();
    if (STATUS[statusFilter]) list = list.filter(function(it){ return STATUS[statusFilter].test(ddayOf(it.expiry)); });
    if (activeCat !== "전체") list = list.filter(function(it){ return it.cat === activeCat; });
    if (searchText) list = list.filter(function(it){ return it.name.indexOf(searchText) !== -1; });

    renderStatusChips();
    el.stockEmpty.hidden = list.length > 0;

    // 같은 재료끼리 묶기 (그룹 순서는 가장 이른 소비기한 기준)
    var seen = {}, groupOrder = [], groups = {};
    list.forEach(function(it) {
      if (!seen[it.name]) { seen[it.name] = true; groupOrder.push(it.name); groups[it.name] = []; }
      groups[it.name].push(it);
    });

    function itemHtml(it, isSibling) {
      var d = ddayOf(it.expiry);
      return '<div class="stock-item' + (isSibling ? ' si-sibling' : '') + '" data-id="' + it.id + '">'
        + '<div class="si-emoji">' + (isSibling ? '<span class="si-branch">└</span>' : emojiFor(it.name)) + '</div>'
        + '<div class="si-body">'
        + '<div class="si-name">' + esc(it.name) + '</div>'
        + '<div class="si-sub">' + esc(it.cat) + ' · ' + esc(it.qty || "-") + '</div>'
        + '</div>'
        + '<div class="si-right">'
        + '<span class="dday ' + ddayClass(d) + '">' + ddayLabel(d) + '</span>'
        + '<div class="si-actions">'
        + '<button class="mini-btn cook" data-act="cook" data-id="' + it.id + '">조리완료</button>'
        + '<button class="mini-btn edit-qty" data-act="editqty" data-id="' + it.id + '">부분사용</button>'
        + '<button class="mini-btn" data-act="trash" data-id="' + it.id + '">폐기</button>'
        + '</div></div></div>';
    }

    el.stockList.innerHTML = groupOrder.map(function(name) {
      var grp = groups[name];
      if (grp.length === 1) return itemHtml(grp[0], false);
      return '<div class="stock-group">'
        + grp.map(function(it, i) { return itemHtml(it, i > 0); }).join("")
        + '</div>';
    }).join("");
  }

  var LEVELS = [
    { lv: 1, e: "🥕", name: "냉장고 새내기", min: 0,   max: 5   },
    { lv: 2, e: "🌱", name: "새싹 절약가",   min: 5,   max: 15  },
    { lv: 3, e: "🌿", name: "그린 쿠커",     min: 15,  max: 30  },
    { lv: 4, e: "♻️", name: "절약 고수",     min: 30,  max: 50  },
    { lv: 5, e: "🌍", name: "지구 지킴이",   min: 50,  max: 80  },
    { lv: 6, e: "🏆", name: "냉장고 마스터", min: 80,  max: 120 },
    { lv: 7, e: "👑", name: "전설의 냉장고", min: 120, max: Infinity },
  ];

  function renderReport() {
    seedLog();
    var log     = loadLog();
    var month   = toISO(new Date()).slice(0, 7);
    var mLog    = log.filter(function(e){ return e.date.startsWith(month); });
    var cooked   = mLog.filter(function(e){ return e.act === "cook"; });
    var partials = mLog.filter(function(e){ return e.act === "partial"; });

    /* ── 핵심 수치 계산 ── */
    var saved      = cooked.length;                      /* 구출 재료 수 (완전 소진만) */
    var partialG   = partials.reduce(function(s,e){ return s + (e.weightG || 0); }, 0);
    var wasteG     = saved * 150 + partialG;             /* 완전소진 평균150g + 부분사용 실측값 */
    var bags       = Math.floor(wasteG / 500);           /* 3L 봉투 1장 = 500g */
    var envCost    = Math.round(wasteG * 3);             /* 3,000원/kg — 사회적 처리비용 */
    var totalUses  = cooked.length + partials.length;    /* 조리완료 + 부분사용 합산 */
    var co2        = (wasteG * 0.00087).toFixed(1);     /* 음식물 폐기 CO₂ 0.87kg/kg */
    var water      = Math.round(wasteG * 0.2);          /* 절약 물 0.2L/g */

    /* ── 뱃지 ── */
    var badge = saved >= 25 ? { e: "🏆", t: "냉장고 마스터" }
              : saved >= 15 ? { e: "🌿", t: "환경 지킴이" }
              : saved >= 7  ? { e: "🌱", t: "새싹 절약가" }
              :               { e: "🥕", t: "첫 걸음" };

    /* ── 히어로 ── */
    var wasteStr = wasteG >= 1000 ? (wasteG / 1000).toFixed(1) + "kg" : wasteG + "g";
    set("rpHeroSaved", saved);
    set("rpWasteG",    wasteStr);
    set("rpBags",      bags + "장");
    set("rpBadgeChip", badge.e + " " + badge.t);

    /* ── 수치 카드 ── */
    set("rpEnvCost",   "₩" + envCost.toLocaleString());
    set("rpCook",      totalUses + "회");
    set("rpCO2",       co2 + "kg");
    set("rpWater",     water + "L");

    /* ── 레벨 진행도 (누적 전체 기준) ── */
    var totalCooked = log.filter(function(e){ return e.act === "cook"; }).length;
    var curLv = LEVELS[LEVELS.length - 1];
    for (var li = 0; li < LEVELS.length; li++) {
      if (totalCooked < LEVELS[li].max) { curLv = LEVELS[li]; break; }
    }
    var nextLv = LEVELS[Math.min(curLv.lv, LEVELS.length - 1)];
    var isMax  = curLv.lv === LEVELS[LEVELS.length - 1].lv;
    var pct    = isMax ? 100 : Math.round((totalCooked - curLv.min) / (curLv.max - curLv.min) * 100);
    var remain = isMax ? 0 : curLv.max - totalCooked;

    currentLevelLv = curLv.lv;
    set("rpLevelEmoji",    curLv.e);
    set("rpLevelLabel",    "Lv." + curLv.lv + " " + curLv.name);
    set("rpLevelSub",      totalCooked + " / " + (isMax ? "∞" : curLv.max) + "개 구출");
    set("rpLevelNextBadge", isMax ? "최고 레벨 👑" : "다음 " + nextLv.e);
    set("rpLevelMsg", isMax
      ? "최고 레벨 달성! 당신은 냉장고의 전설 👑"
      : "딱 " + remain + "개만 더 구출하면 " + nextLv.e + " " + nextLv.name + "! 🔥");
    requestAnimationFrame(function() {
      var bar = $("#rpLevelBarFill");
      if (bar) bar.style.width = pct + "%";
    });

    /* ── 구출 재료 목록 ── */
    var names  = cooked.map(function(e){ return e.name; });
    var unique = names.filter(function(n, i){ return names.indexOf(n) === i; });
    var listEl = $("#rpSavedItems");
    if (listEl) listEl.innerHTML = unique.length
      ? unique.slice(0, 16).map(function(n){
          return '<span class="rp-item-chip">' + esc(n) + '</span>';
        }).join("")
      : '<span class="rp-empty-msg">조리완료 버튼을 눌러 재료를 소진해보세요</span>';

    /* ── 주간 소진 추이 (최근 7일) ── */
    var dayNames = ["일","월","화","수","목","금","토"];
    var dayCounts = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(TODAY); d.setDate(d.getDate() - i);
      var iso = toISO(d);
      var cookC = log.filter(function(e){ return e.date === iso && e.act === "cook"; }).length;
      var partC = log.filter(function(e){ return e.date === iso && e.act === "partial"; }).length;
      dayCounts.push({ label: dayNames[d.getDay()], cookCnt: cookC, partCnt: partC, cnt: cookC + partC, isToday: i === 0 });
    }
    var maxCnt = Math.max.apply(null, dayCounts.map(function(d){ return d.cnt; })) || 1;
    var hasData = dayCounts.some(function(d){ return d.cnt > 0; });
    var daysEl  = $("#rpBarDays");

    if (!hasData) {
      el.reportBars.innerHTML = '<div class="bar-empty">이번 주 아직 기록이 없어요 🌱</div>';
      if (daysEl) daysEl.innerHTML = "";
    } else {
      var MAX_H = 90;
      el.reportBars.innerHTML = dayCounts.map(function(d) {
        var h = d.cnt > 0 ? Math.max(6, Math.round((d.cnt / maxCnt) * MAX_H)) : 4;
        var segs = "";
        if (d.cookCnt > 0) segs += '<div class="seg seg-cook" style="flex:' + d.cookCnt + '"></div>';
        if (d.partCnt > 0) segs += '<div class="seg seg-partial" style="flex:' + d.partCnt + '"></div>';
        if (!segs) segs = '<div class="seg seg-cook" style="flex:1;opacity:0.15"></div>';
        return '<div class="bar-col' + (d.isToday ? ' is-today' : '') + '">'
          + '<span class="bar-num">' + (d.cnt > 0 ? d.cnt : '') + '</span>'
          + '<div class="bar" style="height:0" data-h="' + h + '">' + segs + '</div>'
          + '</div>';
      }).join("");
      if (daysEl) daysEl.innerHTML = dayCounts.map(function(d) {
        return '<span' + (d.isToday ? ' class="is-today"' : '') + '>' + d.label + '</span>';
      }).join("");
      requestAnimationFrame(function() {
        el.reportBars.querySelectorAll(".bar").forEach(function(b) {
          b.style.height = b.dataset.h + "px";
        });
      });
    }

    function set(id, val) { var el = $("#" + id); if (el) el.textContent = val; }
  }

  function renderAll() {
    renderSummary();
    renderUrgent();
    renderReco();
    renderChips();
    renderStock();
    save();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---- 뷰 전환 ---- */
  function switchView(name) {
    document.querySelectorAll(".view").forEach(function(v){ v.classList.remove("is-active"); });
    $("#view-" + name).classList.add("is-active");
    el.tabs.forEach(function(t){ t.classList.toggle("is-active", t.dataset.view === name); });
    if (name === "report") renderReport();
    el.fab.style.display = (name === "report" || name === "recipes") ? "none" : "grid";
    $("#content").scrollTop = 0;
  }

  /* ---- 시트 ---- */
  var expiryInputMode = "consume";

  function setExpiryMode(mode, extDays) {
    expiryInputMode = mode;
    el.expiryModeChips.querySelectorAll(".emode-chip").forEach(function(c) {
      c.classList.toggle("is-active", c.dataset.mode === mode);
    });
    if (mode === "sellby") {
      el.expiryLabel.textContent = "유통기한";
      el.inSellBy.style.display = "";
      el.inExpiry.style.display = "none";
      el.inExpiry.removeAttribute("required");
      el.inSellBy.setAttribute("required", "");
      el.expiryHint.textContent = "";
    } else {
      el.expiryLabel.textContent = "소비기한";
      el.inSellBy.style.display = "none";
      el.inExpiry.style.display = "";
      el.inExpiry.setAttribute("required", "");
      el.inSellBy.removeAttribute("required");
    }
  }

  function openSheet() {
    el.overlay.classList.add("open");
    setExpiryMode("consume");
    el.inExpiry.value = toISO(addDays(5));
    el.inName.value = "";
    updateNameState();
    setTimeout(function(){ el.inName.focus(); }, 50);
  }
  function closeSheet() {
    el.overlay.classList.remove("open");
    setExpiryMode("consume");
    el.addForm.reset();
    updateNameState();
  }

  function openLevelModal(currentLv) {
    el.levelModalBody.innerHTML = LEVELS.map(function(lv) {
      var range = lv.max === Infinity ? lv.min + "개 이상" : lv.min + "~" + (lv.max - 1) + "개";
      var isCur = lv.lv === currentLv;
      return '<div class="level-row' + (isCur ? ' is-current' : '') + '">'
        + '<span class="level-row-emoji">' + lv.e + '</span>'
        + '<div class="level-row-info">'
        + '<div class="level-row-name">' + lv.name + (isCur ? ' ← 현재' : '') + '</div>'
        + '<div class="level-row-range">' + range + '</div>'
        + '</div>'
        + '<span class="level-row-lv">Lv.' + lv.lv + '</span>'
        + '</div>';
    }).join("");
    el.levelModalOverlay.classList.add("open");
  }
  function closeLevelModal() {
    el.levelModalOverlay.classList.remove("open");
  }

  var currentLevelLv = 1;

  var editTargetId = null;
  function openEditSheet(it) {
    editTargetId = it.id;
    el.editItemName.textContent = it.name + (it.qty ? "  현재: " + it.qty : "  (수량 미등록)");
    el.editQtyInput.value = "";
    var unitHint = it.qty ? it.qty.replace(/^[\d.]+\s*/, "") : "";
    el.editQtyInput.placeholder = unitHint
      ? "사용한 양 (예: 1" + unitHint + ", 2" + unitHint + ")"
      : "사용한 양 (예: 2개, 200g)";
    el.editOverlay.classList.add("open");
    setTimeout(function(){ el.editQtyInput.focus(); }, 50);
  }
  function closeEditSheet() {
    el.editOverlay.classList.remove("open");
    editTargetId = null;
  }
  function renderIngredientOptions() {
    el.ingredientList.innerHTML = MASTER_NAMES.map(function(n){
      return '<option value="' + esc(n) + '"></option>';
    }).join("");
  }
  function updateNameState() {
    var name = el.inName.value.trim();
    if (!name) {
      el.catAuto.textContent = "재료를 선택하면 자동으로 정해져요";
      el.catAuto.className = "cat-auto";
      el.nameHint.textContent = "";
      el.expiryHint.textContent = "";
      el.expiryModeChips.querySelector("[data-mode='sellby']").disabled = true;
      if (expiryInputMode === "sellby") setExpiryMode("consume");
      return;
    }
    var m = MASTER[name];
    if (m) {
      el.catAuto.textContent = (CAT_ICON[m.cat] || "") + " " + m.cat;
      el.catAuto.className = "cat-auto is-set";
      el.nameHint.textContent = "";
      el.inQty.placeholder = "예: 1" + m.unit;
      var sellbyBtn = el.expiryModeChips.querySelector("[data-mode='sellby']");
      if (m.expiryExtDays) {
        sellbyBtn.disabled = false;
        sellbyBtn.title = "유통기한 + " + m.expiryExtDays + "일 → 소비기한";
      } else {
        sellbyBtn.disabled = true;
        if (expiryInputMode === "sellby") setExpiryMode("consume");
      }
      if (expiryInputMode === "consume" && m.shelfDays) {
        el.inExpiry.value = toISO(addDays(m.shelfDays));
        el.expiryHint.textContent = "냉장 소비기한 기준 " + m.shelfDays + "일";
      }
    } else {
      el.catAuto.textContent = "—";
      el.catAuto.className = "cat-auto";
      el.nameHint.innerHTML = "DB에 없는 재료예요. <button type=\"button\" class=\"req-btn\" data-req=\"" + esc(name) + "\">+ 추가 요청</button>";
      el.expiryHint.textContent = "";
      el.expiryModeChips.querySelector("[data-mode='sellby']").disabled = true;
      if (expiryInputMode === "sellby") setExpiryMode("consume");
    }
  }
  function renderQuickAdd() {
    el.quickAdd.innerHTML = QUICK.map(function(n){
      return '<button type="button" class="qa-btn" data-quick="' + n + '">' + emojiFor(n) + " " + n + "</button>";
    }).join("");
  }

  function mergeQty(a, b) {
    if (!a) return b;
    if (!b) return a;
    var mA = a.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    var mB = b.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (mA && mB && mA[2] === mB[2]) {
      var sum = parseFloat(mA[1]) + parseFloat(mB[1]);
      var num = sum % 1 === 0 ? String(Math.round(sum)) : String(sum);
      return num + (mA[2] ? mA[2] : "");
    }
    return a + " + " + b;
  }

  function subtractQty(current, used) {
    var mC = current.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    var mU = used.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (!mC || !mU) return null;
    var unitC = mC[2].trim(), unitU = mU[2].trim();
    if (unitC !== unitU) return null;
    var rem = parseFloat(mC[1]) - parseFloat(mU[1]);
    var usedNum = parseFloat(mU[1]);
    if (rem <= 0) return { remaining: null, usedNum: usedNum, unit: unitU };
    var s = rem % 1 === 0 ? String(Math.round(rem)) : String(rem);
    return { remaining: s + (unitU ? unitU : ""), usedNum: usedNum, unit: unitU };
  }

  function weightFromUsed(usedNum, unit) {
    var u = (unit || "").toLowerCase();
    if (u === "g") return usedNum;
    if (u === "kg") return Math.round(usedNum * 1000);
    if (u === "ml") return usedNum;
    if (u === "l") return Math.round(usedNum * 1000);
    return Math.round(usedNum * 150);
  }

  function addItem(name, cat, qty, expiry) {
    var trimName = name.trim();
    var trimQty  = qty.trim();
    var sameSlot = items.filter(function(x){ return x.name === trimName && x.expiry === expiry; });
    if (sameSlot.length > 0) {
      var targetId = sameSlot[0].id;
      var merged   = mergeQty(sameSlot[0].qty, trimQty);
      items = items.map(function(x){
        return x.id === targetId ? Object.assign({}, x, { qty: merged }) : x;
      });
    } else {
      items.push({ id: uid(), name: trimName, cat: cat, qty: trimQty, expiry: expiry });
    }
    renderAll();
  }

  /* F10: 신규 재료 요청 큐 */
  function requestIngredient(name) {
    var KEY = "fridge.ai.requests.v1";
    try {
      var q = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (q.indexOf(name) === -1) { q.push(name); localStorage.setItem(KEY, JSON.stringify(q)); }
    } catch(e) {}
    toast('"' + name + '" 추가 요청을 접수했어요');
  }

  /* ---- 토스트 ---- */
  var toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    requestAnimationFrame(function(){ el.toast.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      el.toast.classList.remove("show");
      setTimeout(function(){ el.toast.hidden = true; }, 240);
    }, 1900);
  }

  /* ---- 이벤트 ---- */
  function bind() {
    el.tabs.forEach(function(t){
      t.addEventListener("click", function(){ switchView(t.dataset.view); });
    });
    document.querySelectorAll("[data-goto]").forEach(function(b){
      b.addEventListener("click", function(){ switchView(b.dataset.goto); });
    });

    el.fab.addEventListener("click", openSheet);
    el.sheetClose.addEventListener("click", closeSheet);
    el.overlay.addEventListener("click", function(e){ if (e.target === el.overlay) closeSheet(); });

    /* 요약 카드 -> 재고 탭 필터 이동 */
    document.querySelectorAll("[data-status]").forEach(function(card){
      card.addEventListener("click", function() {
        statusFilter = card.dataset.status;
        activeCat = "전체";
        searchText = "";
        el.stockSearch.value = "";
        renderChips();
        renderStock();
        switchView("stock");
      });
    });

    /* 상태 필터 칩 */
    el.statusChips.addEventListener("click", function(e) {
      var c = e.target.closest("[data-status-chip]");
      if (!c) return;
      statusFilter = c.dataset.statusChip;
      renderStock();
    });

    /* 카테고리 필터 */
    el.catChips.addEventListener("click", function(e) {
      var c = e.target.closest("[data-cat]");
      if (!c) return;
      activeCat = c.dataset.cat;
      renderChips();
      renderStock();
    });

    /* 검색 */
    el.stockSearch.addEventListener("input", function(e) {
      searchText = e.target.value.trim();
      renderStock();
    });

    /* 재고 액션 */
    el.stockList.addEventListener("click", function(e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var it = items.filter(function(x){ return x.id === btn.dataset.id; })[0];
      if (btn.dataset.act === "editqty") {
        if (it) openEditSheet(it);
        return;
      }
      items = items.filter(function(x){ return x.id !== btn.dataset.id; });
      renderAll();
      var log = loadLog();
      log.push({ date: toISO(new Date()), name: it ? it.name : "?", act: btn.dataset.act });
      saveLog(log);
      if (btn.dataset.act === "cook") {
        toast((it ? it.name : "재료") + " 조리 완료! 소진했어요");
      } else {
        toast((it ? it.name : "재료") + " 폐기 처리했어요");
      }
    });

    /* 레벨 모달 */
    el.levelModalClose.addEventListener("click", closeLevelModal);
    el.levelModalOverlay.addEventListener("click", function(e){ if (e.target === el.levelModalOverlay) closeLevelModal(); });
    document.addEventListener("click", function(e) {
      if (e.target.id === "rpLevelEmoji" || e.target.id === "rpLevelNextBadge")
        openLevelModal(currentLevelLv);
    });

    /* 수량 수정 시트 */
    el.editSheetClose.addEventListener("click", closeEditSheet);
    el.editOverlay.addEventListener("click", function(e){ if (e.target === el.editOverlay) closeEditSheet(); });
    el.editQtyForm.addEventListener("submit", function(e) {
      e.preventDefault();
      var usedInput = el.editQtyInput.value.trim();
      if (!usedInput || !editTargetId) return;
      var it = items.filter(function(x){ return x.id === editTargetId; })[0];
      if (!it) return;

      if (!it.qty || !/^\d/.test(it.qty)) {
        toast("수량이 등록되지 않아 부분사용을 기록할 수 없어요");
        closeEditSheet();
        return;
      }

      var result = subtractQty(it.qty, usedInput);
      if (!result) {
        var unitHint = it.qty.replace(/^[\d.]+\s*/, "");
        toast("단위를 맞춰주세요 (예: " + unitHint + ")");
        el.editQtyInput.focus();
        return;
      }

      var wg = weightFromUsed(result.usedNum, result.unit);
      var log = loadLog();

      if (result.remaining === null) {
        items = items.filter(function(x){ return x.id !== editTargetId; });
        log.push({ date: toISO(new Date()), name: it.name, act: "cook" });
        saveLog(log);
        renderAll();
        closeEditSheet();
        toast(emojiFor(it.name) + " " + it.name + " 전량 사용 — 재고에서 제거했어요");
      } else {
        items = items.map(function(x){
          return x.id === editTargetId ? Object.assign({}, x, { qty: result.remaining }) : x;
        });
        log.push({ date: toISO(new Date()), name: it.name, act: "partial", usedQty: usedInput, weightG: wg });
        saveLog(log);
        save();
        renderAll();
        closeEditSheet();
        toast(emojiFor(it.name) + " " + usedInput + " 사용 → 남은 수량: " + result.remaining);
      }
    });

    /* 소비기한/유통기한 모드 토글 */
    el.expiryModeChips.addEventListener("click", function(e) {
      var chip = e.target.closest(".emode-chip");
      if (!chip || chip.disabled) return;
      var m = MASTER[el.inName.value.trim()];
      setExpiryMode(chip.dataset.mode, m ? m.expiryExtDays : 0);
      if (chip.dataset.mode === "consume" && m && m.shelfDays) {
        el.inExpiry.value = toISO(addDays(m.shelfDays));
        el.expiryHint.textContent = "냉장 소비기한 기준 " + m.shelfDays + "일";
      }
    });

    /* 유통기한 입력 → 소비기한 자동계산 */
    el.inSellBy.addEventListener("change", function() {
      var sellVal = el.inSellBy.value;
      if (!sellVal) { el.expiryHint.textContent = ""; return; }
      var m = MASTER[el.inName.value.trim()];
      var ext = m ? (m.expiryExtDays || 0) : 0;
      var sobi = new Date(sellVal);
      sobi.setDate(sobi.getDate() + ext);
      el.inExpiry.value = toISO(sobi);
      var sellFmt = sellVal.slice(5).replace("-", "/");
      var sobiFmt = toISO(sobi).slice(5).replace("-", "/");
      el.expiryHint.textContent = ext
        ? "유통기한 " + sellFmt + " → 소비기한 " + sobiFmt + " (+" + ext + "일)"
        : "유통기한 = 소비기한 (연장 기준 없음)";
    });

    /* 재료 이름 입력 */
    el.inName.addEventListener("input", updateNameState);

    /* F10: 신규 요청 버튼 */
    el.nameHint.addEventListener("click", function(e) {
      var b = e.target.closest(".req-btn");
      if (!b) return;
      requestIngredient(b.dataset.req);
    });

    /* 자주 사는 재료 */
    el.quickAdd.addEventListener("click", function(e) {
      var b = e.target.closest("[data-quick]");
      if (!b) return;
      el.inName.value = b.dataset.quick;
      updateNameState();
      el.inName.focus();
    });

    /* 추가 폼 제출 */
    el.addForm.addEventListener("submit", function(e) {
      e.preventDefault();
      var name = el.inName.value.trim();
      if (!name) return;
      if (!isValidIngredient(name)) {
        updateNameState();
        el.nameHint.textContent = "DB에 등록된 재료만 추가할 수 있어요.";
        toast("목록에 있는 재료만 추가할 수 있어요");
        el.inName.focus();
        return;
      }
      if (expiryInputMode === "sellby" && !el.inSellBy.value) {
        el.expiryHint.textContent = "유통기한을 입력해주세요";
        el.inSellBy.focus();
        return;
      }
      var expiry = el.inExpiry.value;
      var isMerge = items.some(function(x){ return x.name === name && x.expiry === expiry; });
      addItem(name, MASTER[name].cat, el.inQty.value || "", expiry);
      closeSheet();
      switchView("stock");
      toast(isMerge
        ? emojiFor(name) + " " + name + " 수량 합산됐어요!"
        : emojiFor(name) + " " + name + " 추가 완료!");
    });

    /* ESC */
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && el.overlay.classList.contains("open")) closeSheet();
    });
  }

  /* ---- 시작 ---- */
  renderHeader();
  renderQuickAdd();
  renderIngredientOptions();
  bind();
  renderAll();

})();

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
  var DEMO_USER = { name: "김민준", initial: "김", displayName: "민준" };

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
      mk("우유",             "900mL 1팩",   0),
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
      mk("달걀",             "10개",         4),
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
    quickAdd:     $("#quickAdd"),
    addForm:      $("#addForm"),
    inName:       $("#inName"),
    inQty:        $("#inQty"),
    inExpiry:     $("#inExpiry"),
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
      var absBonus     = Math.min(mainMatch.length, 8) / 8;
      var seaRatio     = seaMatch.length / Math.max(seaReq.length, 1);

      var score = 40 * urgentRatio    /* 매칭 중 임박 비율 → 소진 유도 */
                + 35 * completeness   /* 주재료 충족률 */
                + 15 * absBonus       /* 절대 매칭 수 보너스 (최대 8개 기준) */
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

    return scored
      .filter(function(r){ return r.mainMatch.length > 0 && r.score > 0; })
      .sort(function(a,b){ return b.score - a.score; });
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

  function renderReco() {
    var scored = scoreRecipes();
    if (!scored.length) {
      var empty = '<div class="reco-empty">재료를 추가하면 맞춤 요리를 추천해드려요</div>';
      el.homeReco.innerHTML = empty;
      el.recipeList.innerHTML = empty;
      el.recoQueryHint.textContent = "";
      el.recoQuery.textContent = "재료를 추가해 주세요";
      return;
    }
    el.recoQueryHint.textContent = "";
    el.recoQuery.textContent = scored[0].name;
    el.homeReco.innerHTML = scored.slice(0,3).map(recoCardHTML).join("");
    el.recipeList.innerHTML = scored.slice(0,20).map(recoCardHTML).join("");
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
    el.stockList.innerHTML = list.map(function(it) {
      var d = ddayOf(it.expiry);
      return '<div class="stock-item" data-id="' + it.id + '">'
        + '<div class="si-emoji">' + emojiFor(it.name) + '</div>'
        + '<div class="si-body">'
        + '<div class="si-name">' + esc(it.name) + '</div>'
        + '<div class="si-sub">' + esc(it.cat) + ' · ' + esc(it.qty || "-") + '</div>'
        + '</div>'
        + '<div class="si-right">'
        + '<span class="dday ' + ddayClass(d) + '">' + ddayLabel(d) + '</span>'
        + '<div class="si-actions">'
        + '<button class="mini-btn cook" data-act="cook" data-id="' + it.id + '">조리완료</button>'
        + '<button class="mini-btn" data-act="trash" data-id="' + it.id + '">폐기</button>'
        + '</div></div></div>';
    }).join("");
  }

  function renderReport() {
    seedLog();
    var log     = loadLog();
    var month   = toISO(new Date()).slice(0, 7);
    var mLog    = log.filter(function(e){ return e.date.startsWith(month); });
    var cooked  = mLog.filter(function(e){ return e.act === "cook"; });

    /* ── 핵심 수치 계산 ── */
    var saved   = cooked.length;
    var wasteG  = saved * 150;                         /* 재료당 평균 150g */
    var bags    = Math.floor(wasteG / 500);            /* 3L 봉투 1장 = 500g */
    var money   = saved * 2500;                        /* 재료당 평균 ₩2,500 */
    var co2     = (saved * 0.13).toFixed(1);           /* 재료당 CO₂ 0.13kg */
    var water   = saved * 30;                          /* 재료당 물 30L */

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
    set("rpSaveMoney", "₩" + money.toLocaleString());
    set("rpCook",      cooked.length + "회");
    set("rpCO2",       co2 + "kg");
    set("rpWater",     water + "L");

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
      var cnt = log.filter(function(e){ return e.date === iso && e.act === "cook"; }).length;
      dayCounts.push({ label: dayNames[d.getDay()], cnt: cnt });
    }
    var maxCnt = Math.max.apply(null, dayCounts.map(function(d){ return d.cnt; })) || 1;

    var daysEl = $("#rpBarDays");
    el.reportBars.innerHTML = dayCounts.map(function(d){
      var pct = Math.round((d.cnt / maxCnt) * 100) || 6;
      return '<div class="bar" style="height:0" data-h="' + pct + '"></div>';
    }).join("");
    if (daysEl) daysEl.innerHTML = dayCounts.map(function(d){
      return '<span>' + d.label + '</span>';
    }).join("");

    requestAnimationFrame(function() {
      el.reportBars.querySelectorAll(".bar").forEach(function(b){
        b.style.height = b.dataset.h + "%";
      });
    });

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
  function openSheet() {
    el.overlay.classList.add("open");
    el.inExpiry.value = toISO(addDays(5));
    el.inName.value = "";
    updateNameState();
    setTimeout(function(){ el.inName.focus(); }, 50);
  }
  function closeSheet() {
    el.overlay.classList.remove("open");
    el.addForm.reset();
    updateNameState();
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
      return;
    }
    var m = MASTER[name];
    if (m) {
      el.catAuto.textContent = (CAT_ICON[m.cat] || "") + " " + m.cat;
      el.catAuto.className = "cat-auto is-set";
      el.nameHint.textContent = "";
      el.inQty.placeholder = "예: 1" + m.unit;
    } else {
      el.catAuto.textContent = "—";
      el.catAuto.className = "cat-auto";
      el.nameHint.innerHTML = "DB에 없는 재료예요. <button type=\"button\" class=\"req-btn\" data-req=\"" + esc(name) + "\">+ 추가 요청</button>";
    }
  }
  function renderQuickAdd() {
    el.quickAdd.innerHTML = QUICK.map(function(n){
      return '<button type="button" class="qa-btn" data-quick="' + n + '">' + emojiFor(n) + " " + n + "</button>";
    }).join("");
  }

  function addItem(name, cat, qty, expiry) {
    items.push({ id: uid(), name: name.trim(), cat: cat, qty: qty.trim(), expiry: expiry });
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
      addItem(name, MASTER[name].cat, el.inQty.value || "", el.inExpiry.value);
      closeSheet();
      switchView("stock");
      toast(emojiFor(name) + " " + name + " 추가 완료!");
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

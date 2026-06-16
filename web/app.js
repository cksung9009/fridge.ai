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

  /* ---- 상태 ---- */
  var STORE_KEY = "fridge.ai.items.v3";
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
      mk("우유",             "900mL 1팩",  0),
      mk("두부",             "1모",         1),
      mk("대파",             "1단",         1),
      mk("고등어",           "2마리",        2),
      mk("시금치",           "1단",         2),
      mk("달걀",             "10개",        4),
      mk("닭가슴살",         "400g",        3),
      mk("돼지고기(삼겹살)", "500g",        3),
      mk("애호박",           "1개",         5),
      mk("콩나물",           "1봉",         4),
      mk("바나나",           "3개",         3),
      mk("감자",             "5개",         8),
      mk("양파",             "6개",        14),
      mk("당근",             "3개",        10),
      mk("배추",             "1/4통",       7),
      mk("사과",             "4개",         7),
      mk("슬라이스치즈",     "10장",       12),
      mk("버터",             "1팩",        25),
      mk("떡(떡볶이용)",     "1봉",         9),
      mk("어묵",             "1팩",         8),
      mk("마늘",             "1통",        20),
      mk("간장",             "1병",        60),
      mk("고추장",           "1통",        45),
      mk("된장",             "1통",        30),
      mk("참기름",           "1병",        90)
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
        + '<div class="u-name">' + esc(it.name) + '</div>'
        + '<div class="u-qty">' + esc(it.qty || "") + '</div>'
        + '<div class="u-dday"><span class="dday ' + ddayClass(d) + '">' + ddayLabel(d) + '</span></div>'
        + '</div>';
    }).join("");
  }

  /* ---- 요리/메뉴 DB 기반 추천 엔진 ---- */
  function ytUrl(q) {
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  }

  function scoreRecipes() {
    var RECIPES = window.FRIDGE_RECIPES || [];
    if (!items.length || !RECIPES.length) return [];

    var ownedSet = {};
    items.forEach(function(it){ ownedSet[it.name] = true; });
    var dMap = {};
    items.forEach(function(it){ dMap[it.name] = ddayOf(it.expiry); });

    var scored = RECIPES.map(function(dish) {
      var req = dish.ingredients;
      var matched = req.filter(function(n){ return ownedSet[n]; });
      var missing = req.filter(function(n){ return !ownedSet[n]; });
      var urgentUsed = matched.filter(function(n){ return dMap[n] <= 2; });
      var warnUsed   = matched.filter(function(n){ return dMap[n] >= 3 && dMap[n] <= 5; });

      var urgentRatio = urgentUsed.length / Math.max(req.length, 1);
      var matchRate   = matched.length / Math.max(req.length, 1);
      var urgencyWeight = matched.reduce(function(sum, n) {
        var d = dMap[n];
        return sum + (d <= 2 ? 1 : d <= 5 ? 0.5 : 0.1);
      }, 0) / Math.max(req.length, 1);
      var missingPenalty = missing.length / Math.max(req.length, 1);
      var score = 40*urgentRatio + 30*matchRate + 20*urgencyWeight - 10*missingPenalty;

      return { id: dish.id, name: dish.name, cat: dish.cat, emoji: dish.emoji,
               score: score, matched: matched, missing: missing,
               urgentUsed: urgentUsed, warnUsed: warnUsed };
    });

    return scored
      .filter(function(r){ return r.matched.length > 0; })
      .sort(function(a,b){ return b.score - a.score; });
  }

  function recoCardHTML(r) {
    var urgentTags = r.urgentUsed.slice(0,2).map(function(n){
      return '<span class="tag tag-urgent">' + esc(n) + '</span>';
    }).join("");
    var warnOnly = r.warnUsed.filter(function(n){ return r.urgentUsed.indexOf(n) === -1; });
    var warnTags = warnOnly.slice(0,1).map(function(n){
      return '<span class="tag tag-warn">' + esc(n) + '</span>';
    }).join("");
    var missBadge = r.missing.length ? '<span class="tag tag-miss">+' + r.missing.length + '개 부족</span>' : "";
    var urgentBadge = r.urgentUsed.length ? '<span class="uses">임박 ' + r.urgentUsed.length + '개 소진</span>' : "";
    var link = ytUrl(r.name + " 레시피");
    return '<a class="reco-card" href="' + link + '" target="_blank" rel="noopener">'
      + '<div class="reco-thumb">' + (r.emoji || "🍳") + '</div>'
      + '<div class="reco-body">'
      + '<div class="reco-title">' + esc(r.name) + '</div>'
      + '<div class="reco-tags">' + urgentTags + warnTags + missBadge + '</div>'
      + '<div class="reco-meta">' + urgentBadge + '<span>YouTube에서 보기</span></div>'
      + '</div>'
      + '<span class="reco-go">&#9654;</span>'
      + '</a>';
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
    el.recoQueryHint.textContent = "임박 재료 기반으로 " + scored.length + "가지 요리를 추천해요";
    el.recoQuery.textContent = scored[0].name;
    el.homeReco.innerHTML = scored.slice(0,2).map(recoCardHTML).join("");
    el.recipeList.innerHTML = scored.slice(0,12).map(recoCardHTML).join("");
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
    $("#rpSaveMoney").textContent = "23,800원";
    $("#rpSaved").textContent = "12개";
    $("#rpRate").textContent = "76%";
    $("#rpCook").textContent = "19회";
    var hero = $(".report-hero strong");
    if (hero) hero.innerHTML = "&#8722;2.1<small>kg CO&#8322;</small>";
    var heights = [45, 68, 52, 80, 92, 71, 87];
    el.reportBars.innerHTML = heights.map(function(){ return '<div class="bar" style="height:0"></div>'; }).join("");
    requestAnimationFrame(function() {
      var bars = el.reportBars.querySelectorAll(".bar");
      bars.forEach(function(b, i){ b.style.height = heights[i] + "%"; });
    });
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

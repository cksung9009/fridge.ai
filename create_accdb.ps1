# fridge.ai — MS Access .accdb 생성 스크립트
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dbPath = "$PSScriptRoot\fridge_ai.accdb"
if (Test-Path $dbPath) { Remove-Item $dbPath -Force }

$acc = New-Object -ComObject Access.Application
$acc.Visible = $false

function Exec($db, $sql) {
    try { $db.Execute($sql, 128) }
    catch { Write-Warning "SQL 오류: $_`nSQL: $sql" }
}

try {
    $acc.NewCurrentDatabase($dbPath)
    $db = $acc.CurrentDb()

    Write-Host "📋 테이블 생성 중..."

    Exec $db "CREATE TABLE categories (id COUNTER CONSTRAINT pk_cat PRIMARY KEY, name TEXT(50), icon TEXT(10), sort_order INTEGER, created_at DATETIME)"
    Exec $db "CREATE UNIQUE INDEX idx_cat_name ON categories (name)"

    Exec $db "CREATE TABLE ingredients (id INTEGER CONSTRAINT pk_ing PRIMARY KEY, name TEXT(100), category_id INTEGER, default_unit TEXT(20), weight_per_unit_g DOUBLE, carbon_per_100g DOUBLE, shelf_days INTEGER, expiry_ext_days INTEGER, created_at DATETIME)"
    Exec $db "CREATE UNIQUE INDEX idx_ing_name ON ingredients (name)"

    Exec $db "CREATE TABLE users (id COUNTER CONSTRAINT pk_usr PRIMARY KEY, email TEXT(255), password_hash TEXT(255), created_at DATETIME, updated_at DATETIME)"
    Exec $db "CREATE UNIQUE INDEX idx_user_email ON users (email)"

    Exec $db "CREATE TABLE user_inventory (id COUNTER CONSTRAINT pk_inv PRIMARY KEY, user_id INTEGER, ingredient_id INTEGER, quantity DOUBLE, unit TEXT(20), expires_at DATETIME, status TEXT(20), created_at DATETIME, updated_at DATETIME)"

    Exec $db "CREATE TABLE recipes (id COUNTER CONSTRAINT pk_rec PRIMARY KEY, name TEXT(100), category TEXT(50), emoji TEXT(10), source_url MEMO, created_at DATETIME)"
    Exec $db "CREATE UNIQUE INDEX idx_rec_name ON recipes (name)"

    Exec $db "CREATE TABLE recipe_ingredients (id COUNTER CONSTRAINT pk_ri PRIMARY KEY, recipe_id INTEGER, ingredient_id INTEGER, is_required YESNO, sort_order INTEGER)"
    Exec $db "CREATE UNIQUE INDEX idx_ri_uq ON recipe_ingredients (recipe_id, ingredient_id)"

    Exec $db "CREATE TABLE consumption_logs (id COUNTER CONSTRAINT pk_log PRIMARY KEY, user_id INTEGER, inventory_id INTEGER, ingredient_id INTEGER, recipe_id INTEGER, type TEXT(10), quantity_used DOUBLE, unit TEXT(20), weight_g DOUBLE, logged_at DATETIME)"

    Exec $db "CREATE TABLE ingredient_requests (id COUNTER CONSTRAINT pk_req PRIMARY KEY, name TEXT(100), requested_by INTEGER, status TEXT(20), requested_at DATETIME, reviewed_at DATETIME)"

    Write-Host "✅ 테이블 생성 완료"
    Write-Host "📦 데이터 입력 중..."

    # 카테고리
    @("('채소','🥦',1)","('육류','🥩',2)","('해산물','🐟',3)",
      "('달걀/유제품','🥚',4)","('두부/콩류','🫘',5)","('버섯류','🍄',6)",
      "('곡류/면류','🌾',7)","('과일','🍎',8)","('조미료/양념','🧂',9)",
      "('기타','🛒',10)") | ForEach-Object {
        Exec $db "INSERT INTO categories (name,icon,sort_order) VALUES $_"
    }

    # 재료 (40종)
    $ings = @(
        "(1,'감자',1,'개',150,0.046,30,0)",    "(2,'고구마',1,'개',200,0.043,14,0)",
        "(3,'양파',1,'개',200,0.050,30,0)",    "(4,'대파',1,'대',100,0.030,7,0)",
        "(5,'마늘',1,'통',50,0.036,30,0)",     "(6,'당근',1,'개',120,0.042,14,0)",
        "(7,'무',1,'개',800,0.038,14,0)",      "(8,'배추',1,'통',2000,0.031,14,0)",
        "(9,'시금치',1,'단',200,0.035,4,0)",   "(10,'애호박',1,'개',250,0.028,7,0)",
        "(11,'상추',1,'봉',100,0.025,3,0)",    "(12,'콩나물',1,'봉',200,0.022,3,0)",
        "(13,'돼지고기(삼겹살)',2,'팩',500,0.710,3,0)",
        "(14,'돼지고기(불고기용)',2,'팩',400,0.710,3,0)",
        "(15,'닭가슴살',2,'팩',400,0.690,2,0)",
        "(16,'닭볶음탕용',2,'팩',500,0.690,2,0)",
        "(17,'소고기(불고기용)',2,'팩',400,2.100,3,0)",
        "(18,'고등어',3,'마리',400,0.430,2,0)", "(19,'갈치',3,'마리',350,0.410,2,0)",
        "(20,'새우',3,'팩',200,0.680,2,0)",     "(21,'오징어',3,'마리',300,0.520,2,0)",
        "(22,'바지락',3,'봉',200,0.390,2,0)",
        "(23,'달걀',4,'개',60,0.180,28,25)",    "(24,'우유',4,'팩',900,0.090,10,50)",
        "(25,'버터',4,'팩',200,0.320,30,30)",
        "(26,'두부',5,'모',300,0.070,4,3)",     "(27,'순두부',5,'팩',300,0.070,3,3)",
        "(28,'표고버섯',6,'팩',150,0.041,5,0)", "(29,'팽이버섯',6,'봉',150,0.038,5,0)",
        "(30,'쌀',7,'봉',1000,0.160,180,0)",    "(31,'라면',7,'개',120,0.380,180,240)",
        "(32,'사과',8,'개',250,0.043,30,0)",    "(33,'바나나',8,'개',120,0.048,5,0)",
        "(34,'딸기',8,'팩',300,0.037,3,0)",
        "(35,'간장',9,'병',1000,0.020,365,0)",  "(36,'된장',9,'통',500,0.025,365,0)",
        "(37,'고추장',9,'통',500,0.027,365,0)", "(38,'참기름',9,'병',500,0.030,180,0)",
        "(39,'고춧가루',9,'봉',100,0.031,180,0)","(40,'다진마늘(튜브)',9,'개',100,0.036,30,0)",
        "(41,'멸치',10,'봉',100,0.310,90,0)"
    )
    foreach ($r in $ings) {
        Exec $db "INSERT INTO ingredients (id,name,category_id,default_unit,weight_per_unit_g,carbon_per_100g,shelf_days,expiry_ext_days) VALUES $r"
    }

    # 사용자
    Exec $db "INSERT INTO users (email,password_hash) VALUES ('guest@fridge.ai','\$2b\$10\$demohash')"

    # 재고 (기준일 2026-06-18)
    $inv = @(
        "(1,23,10,'개',#6/18/2026#,'active')",  "(1,26,1,'모',#6/19/2026#,'active')",
        "(1,4,1,'대',#6/19/2026#,'active')",    "(1,20,1,'팩',#6/19/2026#,'active')",
        "(1,18,2,'마리',#6/20/2026#,'active')", "(1,9,1,'단',#6/20/2026#,'active')",
        "(1,11,1,'봉',#6/20/2026#,'active')",   "(1,21,1,'마리',#6/20/2026#,'active')",
        "(1,22,1,'봉',#6/20/2026#,'active')",   "(1,17,1,'팩',#6/20/2026#,'active')",
        "(1,15,1,'팩',#6/21/2026#,'active')",   "(1,13,1,'팩',#6/21/2026#,'active')",
        "(1,33,3,'개',#6/21/2026#,'active')",   "(1,27,1,'팩',#6/21/2026#,'active')",
        "(1,28,1,'팩',#6/21/2026#,'active')",   "(1,29,1,'봉',#6/21/2026#,'active')",
        "(1,3,2,'개',#6/24/2026#,'active')",    "(1,1,3,'개',#6/26/2026#,'active')",
        "(1,34,1,'팩',#6/27/2026#,'active')",   "(1,24,1,'팩',#6/22/2026#,'active')",
        "(1,35,1,'병',#1/3/2027#,'active')",    "(1,36,1,'통',#1/3/2027#,'active')",
        "(1,37,1,'통',#1/3/2027#,'active')",    "(1,38,1,'병',#1/3/2027#,'active')",
        "(1,40,1,'개',#1/3/2027#,'active')"
    )
    foreach ($r in $inv) {
        Exec $db "INSERT INTO user_inventory (user_id,ingredient_id,quantity,unit,expires_at,status) VALUES $r"
    }

    # 레시피
    @("('된장찌개','국/찌개','🍲')","('제육볶음','볶음','🥓')","('달걀볶음밥','밥/면','🍳')",
      "('시금치나물','무침','🥬')","('갈치조림','조림','🐟')","('닭볶음탕','조림','🍗')",
      "('콩나물국','국/찌개','🍜')","('두부조림','조림','⬜')","('소고기볶음','볶음','🥩')",
      "('해물파전','전/부침','🦑')") | ForEach-Object {
        Exec $db "INSERT INTO recipes (name,category,emoji) VALUES $_"
    }

    # 레시피↔재료 매핑
    $ri = @(
        "(1,26,True,1)","(1,10,True,2)","(1,4,True,3)","(1,1,True,4)","(1,36,False,5)","(1,40,False,6)",
        "(2,13,True,1)","(2,3,True,2)","(2,4,True,3)","(2,37,False,4)","(2,35,False,5)","(2,39,False,6)",
        "(3,23,True,1)","(3,30,True,2)","(3,6,True,3)","(3,4,True,4)","(3,35,False,5)","(3,38,False,6)",
        "(4,9,True,1)","(4,5,True,2)","(4,35,False,3)","(4,38,False,4)",
        "(5,19,True,1)","(5,7,True,2)","(5,4,True,3)","(5,35,False,4)","(5,37,False,5)","(5,39,False,6)",
        "(6,16,True,1)","(6,1,True,2)","(6,6,True,3)","(6,4,True,4)","(6,35,False,5)","(6,37,False,6)",
        "(7,12,True,1)","(7,4,True,2)","(7,35,False,3)","(7,40,False,4)",
        "(8,26,True,1)","(8,4,True,2)","(8,35,False,3)","(8,37,False,4)","(8,38,False,5)",
        "(9,17,True,1)","(9,3,True,2)","(9,28,True,3)","(9,4,False,4)","(9,35,False,5)","(9,38,False,6)",
        "(10,20,True,1)","(10,21,True,2)","(10,4,True,3)","(10,23,True,4)","(10,35,False,5)"
    )
    foreach ($r in $ri) {
        Exec $db "INSERT INTO recipe_ingredients (recipe_id,ingredient_id,is_required,sort_order) VALUES $r"
    }

    # 소진 기록
    $logs = @(
        "(1,1,23,3,'cooked',2,'개',120,#5/26/2026#)",  "(1,2,26,1,'cooked',1,'모',300,#5/27/2026#)",
        "(1,3,4,1,'cooked',1,'대',100,#5/27/2026#)",   "(1,4,9,4,'cooked',1,'단',200,#5/28/2026#)",
        "(1,5,13,2,'cooked',1,'팩',500,#5/29/2026#)",  "(1,6,3,2,'cooked',1,'개',200,#5/29/2026#)",
        "(1,7,15,Null,'cooked',1,'팩',400,#5/30/2026#)","(1,8,12,7,'cooked',1,'봉',200,#5/31/2026#)",
        "(1,9,23,3,'cooked',2,'개',120,#6/1/2026#)",   "(1,10,26,8,'cooked',1,'모',300,#6/2/2026#)",
        "(1,11,17,9,'cooked',1,'팩',400,#6/3/2026#)",  "(1,12,4,7,'cooked',1,'대',100,#6/4/2026#)",
        "(1,13,24,Null,'cooked',1,'팩',900,#6/5/2026#)","(1,14,28,9,'cooked',1,'팩',150,#6/6/2026#)",
        "(1,15,13,2,'cooked',1,'팩',500,#6/7/2026#)",  "(1,16,18,5,'cooked',1,'마리',400,#6/8/2026#)",
        "(1,17,23,Null,'wasted',3,'개',180,#6/9/2026#)","(1,18,9,Null,'wasted',1,'단',200,#6/10/2026#)",
        "(1,19,15,Null,'cooked',1,'팩',400,#6/11/2026#)","(1,20,4,1,'cooked',1,'대',100,#6/12/2026#)",
        "(1,21,26,1,'cooked',1,'모',300,#6/12/2026#)"
    )
    foreach ($r in $logs) {
        Exec $db "INSERT INTO consumption_logs (user_id,inventory_id,ingredient_id,recipe_id,type,quantity_used,unit,weight_g,logged_at) VALUES $r"
    }

    # 재료 요청
    Exec $db "INSERT INTO ingredient_requests (name,requested_by,status) VALUES ('파인애플',1,'pending')"
    Exec $db "INSERT INTO ingredient_requests (name,requested_by,status) VALUES ('두릅',1,'pending')"

    Write-Host "✅ 데이터 입력 완료"
    Write-Host ""
    Write-Host "🎉 완료: $dbPath"

} catch {
    Write-Host "❌ 오류: $_"
    throw
} finally {
    try { $acc.CloseCurrentDatabase() } catch {}
    $acc.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($acc) | Out-Null
    [GC]::Collect()
}

$dbPath = "C:\Users\tnals\fridge.ai\query_results.accdb"
if (Test-Path $dbPath) { Remove-Item -Path $dbPath -Force }

# DB 파일 생성
$cat = New-Object -ComObject "ADOX.Catalog"
$cat.Create("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
$cat = $null
[System.GC]::Collect()
Start-Sleep -Milliseconds 500

# ADODB 연결
$conn = New-Object -ComObject "ADODB.Connection"
$conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")

# ── 테이블 생성 ────────────────────────────────────────────────────
$ddl = @(
    "CREATE TABLE [Q1_재고대시보드] (재료명 TEXT(100), 카테고리 TEXT(50), 수량 DOUBLE, 단위 TEXT(20), 유통기한 TEXT(20), D_day INTEGER, 상태 TEXT(20))",
    "CREATE TABLE [Q2_레시피추천] (레시피 TEXT(100), 이모지 TEXT(10), 주재료매칭 INTEGER, 임박재료수 INTEGER, 주의재료수 INTEGER, 점수 DOUBLE)",
    "CREATE TABLE [Q3_환경리포트] (조리완료횟수 INTEGER, 총절감량_g DOUBLE, 절약봉투수 INTEGER, 탄소절감_kg DOUBLE, 절약물_L DOUBLE, 절약식비_원 INTEGER)",
    "CREATE TABLE [Q4_폐기분석] (폐기횟수 INTEGER, 폐기량_g DOUBLE, 폐기탄소_kg DOUBLE)",
    "CREATE TABLE [Q5_재료자동완성] (id INTEGER, 재료명 TEXT(100), 카테고리 TEXT(50), 기본단위 TEXT(20))",
    "CREATE TABLE [Q6_채소목록] (id INTEGER, 재료명 TEXT(100), 단위 TEXT(20), 기본무게_g DOUBLE, 탄소_kgCO2 DOUBLE)",
    "CREATE TABLE [Q7_레시피소진빈도] (레시피 TEXT(100), 참고횟수 INTEGER)"
)
foreach ($sql in $ddl) { $conn.Execute($sql) | Out-Null }

# ── Q1 재고 대시보드 (CURDATE 기준 상대 D-day) ─────────────────────
$today = (Get-Date).Date
function dexp($n) { return ($today.AddDays($n)).ToString("yyyy-MM-dd") }

$q1 = @(
    "('달걀','달걀/유제품',10.0,'개','$(dexp 0)',0,'임박')",
    "('두부','두부/콩류',1.0,'모','$(dexp 1)',1,'임박')",
    "('대파','채소',1.0,'대','$(dexp 1)',1,'임박')",
    "('새우','해산물',1.0,'팩','$(dexp 1)',1,'임박')",
    "('고등어','해산물',2.0,'마리','$(dexp 2)',2,'임박')",
    "('시금치','채소',1.0,'단','$(dexp 2)',2,'임박')",
    "('상추','채소',1.0,'봉','$(dexp 2)',2,'임박')",
    "('오징어','해산물',1.0,'마리','$(dexp 2)',2,'임박')",
    "('소고기(불고기용)','육류',1.0,'팩','$(dexp 2)',2,'임박')",
    "('닭가슴살','육류',1.0,'팩','$(dexp 3)',3,'주의')",
    "('돼지고기(삼겹살)','육류',1.0,'팩','$(dexp 3)',3,'주의')",
    "('바나나','과일',3.0,'개','$(dexp 3)',3,'주의')",
    "('순두부','두부/콩류',1.0,'팩','$(dexp 3)',3,'주의')",
    "('표고버섯','버섯류',1.0,'팩','$(dexp 3)',3,'주의')",
    "('팽이버섯','버섯류',1.0,'봉','$(dexp 3)',3,'주의')",
    "('우유','달걀/유제품',1.0,'팩','$(dexp 4)',4,'주의')",
    "('양파','채소',2.0,'개','$(dexp 6)',6,'여유')",
    "('감자','채소',3.0,'개','$(dexp 8)',8,'여유')",
    "('간장','조미료/양념',1.0,'병','$(dexp 199)',199,'여유')",
    "('된장','조미료/양념',1.0,'통','$(dexp 199)',199,'여유')",
    "('고추장','조미료/양념',1.0,'통','$(dexp 199)',199,'여유')",
    "('참기름','조미료/양념',1.0,'병','$(dexp 199)',199,'여유')",
    "('다진마늘(튜브)','조미료/양념',1.0,'개','$(dexp 199)',199,'여유')"
)
foreach ($row in $q1) { $conn.Execute("INSERT INTO [Q1_재고대시보드] VALUES $row") | Out-Null }

# ── Q2 레시피 추천 (35/15/40/10 가중치) ────────────────────────────
$q2 = @(
    "('해물파전','🦑',4,4,0,92.0)",
    "('두부조림','⬜',2,2,0,76.0)",
    "('시금치나물','🥬',1,1,0,68.0)",
    "('된장찌개','🍲',3,2,0,60.58)",
    "('고등어구이','🐟',1,1,0,58.0)",
    "('소고기볶음','🥩',3,1,1,52.67)",
    "('제육볶음','🥓',3,1,1,52.67)",
    "('오징어볶음','🦑',2,1,0,50.5)"
)
foreach ($row in $q2) { $conn.Execute("INSERT INTO [Q2_레시피추천] VALUES $row") | Out-Null }

# ── Q3 월간 환경 리포트 ─────────────────────────────────────────────
$conn.Execute("INSERT INTO [Q3_환경리포트] VALUES (12, 3870.0, 7, 18.041, 8.0, 30000)") | Out-Null

# ── Q4 월간 폐기 분석 ───────────────────────────────────────────────
$conn.Execute("INSERT INTO [Q4_폐기분석] VALUES (2, 380.0, 0.394)") | Out-Null

# ── Q5 재료 자동완성 ────────────────────────────────────────────────
$conn.Execute("INSERT INTO [Q5_재료자동완성] VALUES (1, '감자', '채소', '개')") | Out-Null

# ── Q6 채소 목록 ────────────────────────────────────────────────────
$q6 = @(
    "(1,'감자','개',150.0,0.046)",
    "(4,'당근','개',120.0,0.042)",
    "(3,'대파','대',100.0,0.03)",
    "(6,'상추','봉',100.0,0.025)",
    "(5,'시금치','단',200.0,0.035)",
    "(8,'애호박','개',250.0,0.028)",
    "(2,'양파','개',200.0,0.05)",
    "(7,'콩나물','봉',200.0,0.022)"
)
foreach ($row in $q6) { $conn.Execute("INSERT INTO [Q6_채소목록] VALUES $row") | Out-Null }

# ── Q7 레시피별 소진 빈도 ──────────────────────────────────────────
$q7 = @(
    "('된장찌개',5)",
    "('제육볶음',3)",
    "('달걀볶음밥',2)",
    "('소고기볶음',2)",
    "('시금치나물',1)",
    "('두부조림',1)",
    "('고등어구이',1)"
)
foreach ($row in $q7) { $conn.Execute("INSERT INTO [Q7_레시피소진빈도] VALUES $row") | Out-Null }

$conn.Close()
$conn = $null
[System.GC]::Collect()

Write-Host "query_results.accdb 생성 완료: $dbPath"

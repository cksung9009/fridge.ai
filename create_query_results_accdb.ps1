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

# ── 테이블 생성 ────────────────────────────────────────────────
$ddl = @(
    "CREATE TABLE [Q1_재고대시보드] (재료명 TEXT(100), 카테고리 TEXT(50), 수량 DOUBLE, 단위 TEXT(20), 유통기한 TEXT(20), D_day INTEGER, 상태 TEXT(20))",
    "CREATE TABLE [Q2_유튜브쿼리] (YouTube검색쿼리 TEXT(255))",
    "CREATE TABLE [Q3_환경리포트] (총절감량_g DOUBLE, 탄소절감_kg DOUBLE, 조리완료횟수 INTEGER)",
    "CREATE TABLE [Q4_폐기분석] (폐기횟수 INTEGER, 폐기량_g DOUBLE, 폐기탄소_kg DOUBLE)",
    "CREATE TABLE [Q5_재료자동완성] (id INTEGER, 재료명 TEXT(100), 카테고리 TEXT(50), 기본단위 TEXT(20))",
    "CREATE TABLE [Q6_채소목록] (id INTEGER, 재료명 TEXT(100), 단위 TEXT(20), 기본무게_g DOUBLE, 탄소_kg DOUBLE)"
)
foreach ($sql in $ddl) { $conn.Execute($sql) | Out-Null }

# ── Q1 재고 대시보드 ──────────────────────────────────────────
$q1 = @(
    "('감자','채소',3.0,'개','2026-06-15',1,'위험')",
    "('양파','채소',1.0,'개','2026-06-16',2,'위험')",
    "('달걀','유제품',6.0,'개','2026-06-17',3,'임박')",
    "('두부','두부/콩',1.0,'모','2026-06-19',5,'임박')",
    "('돼지고기','육류',1.0,'팩','2026-06-20',6,'여유')",
    "('우유','유제품',1.0,'팩','2026-06-22',8,'여유')",
    "('대파','채소',2.0,'개','2026-06-28',14,'여유')",
    "('간장','조미료',1.0,'병','2026-12-31',200,'여유')"
)
foreach ($row in $q1) { $conn.Execute("INSERT INTO [Q1_재고대시보드] VALUES $row") | Out-Null }

# ── Q2 YouTube 추천 검색어 ────────────────────────────────────
$conn.Execute("INSERT INTO [Q2_유튜브쿼리] VALUES ('감자 양파 달걀')") | Out-Null

# ── Q3 월간 환경 리포트 ───────────────────────────────────────
$conn.Execute("INSERT INTO [Q3_환경리포트] VALUES (1520.0, 1.264, 4)") | Out-Null

# ── Q4 월간 폐기 분석 ─────────────────────────────────────────
$conn.Execute("INSERT INTO [Q4_폐기분석] VALUES (2, 800.0, 3.76)") | Out-Null

# ── Q5 재료 자동완성 ──────────────────────────────────────────
$conn.Execute("INSERT INTO [Q5_재료자동완성] VALUES (1, '감자', '채소', '개')") | Out-Null

# ── Q6 채소 목록 ──────────────────────────────────────────────
$q6 = @(
    "(1,'감자','개',150.0,0.046)",
    "(4,'당근','개',120.0,0.042)",
    "(3,'대파','개',100.0,0.03)",
    "(5,'시금치','봉',200.0,0.035)",
    "(2,'양파','개',200.0,0.05)"
)
foreach ($row in $q6) { $conn.Execute("INSERT INTO [Q6_채소목록] VALUES $row") | Out-Null }

$conn.Close()
$conn = $null
[System.GC]::Collect()

Write-Host "query_results.accdb 생성 완료: $dbPath"

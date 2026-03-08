# Family News Hub — Phase 1 설치 가이드

## 0. 준비사항

```bash
# Proxmox VM 권장 스펙
# CPU: 2 vCPU, RAM: 4GB, Disk: 32GB
# OS: Ubuntu 22.04 LTS

# Docker + Docker Compose 설치
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin
```

---

## 1. Supabase 설치 (Proxmox VM)

### 1-1. 파일 복사

```bash
# VM에 접속 후
mkdir -p /opt/supabase && cd /opt/supabase

# 이 폴더의 파일들 복사
# docker-compose.yml, .env, generate-keys.sh
```

### 1-2. 필수 볼륨 디렉토리 생성

```bash
mkdir -p volumes/db/data
mkdir -p volumes/db/init
mkdir -p volumes/storage
mkdir -p volumes/api
```

### 1-3. Kong 설정 파일 다운로드

```bash
# 공식 Supabase self-hosting에서 Kong 설정 가져오기
curl -sL https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/api/kong.yml \
  -o volumes/api/kong.yml
```

### 1-4. JWT 키 자동 생성

```bash
chmod +x generate-keys.sh
bash generate-keys.sh
```

> ⚠️ 생성된 키를 반드시 메모해두세요!

### 1-5. .env에서 IP 주소 수정

```bash
nano .env

# 아래 항목을 Proxmox VM IP로 변경
# API_EXTERNAL_URL=http://192.168.0.XXX:8000
# SITE_URL=http://192.168.0.XXX:3000
# PUBLIC_REST_URL=http://192.168.0.XXX:8000/rest/v1/

# 공공 API 키 입력
# WEATHER_API_KEY=data.go.kr에서 발급받은 키
# AIRKOREA_API_KEY=위와 동일한 키 가능
```

### 1-6. Supabase 시작

```bash
docker compose up -d

# 상태 확인 (모든 컨테이너 healthy 될 때까지 대기)
docker compose ps
```

### 1-7. 접속 확인

```
Studio:  http://[VM-IP]:3000
API:     http://[VM-IP]:8000
```

---

## 2. DB 스키마 적용

### 방법 A: Supabase Studio SQL Editor (추천)

1. `http://[VM-IP]:3000` 접속
2. 좌측 메뉴 → **SQL Editor**
3. `schema.sql` 내용 전체 붙여넣기
4. **Run** 클릭

### 방법 B: psql 직접 실행

```bash
docker exec -it supabase-db-1 psql -U postgres -f /docker-entrypoint-initdb.d/schema.sql
```

---

## 3. n8n에 Supabase 연결 설정

n8n에서 PostgreSQL Credentials 추가:

```
이름:     Supabase PostgreSQL
Host:     [Supabase VM IP]
Port:     5432
Database: postgres
User:     postgres
Password: [POSTGRES_PASSWORD from .env]
SSL:      disable (내부 네트워크)
```

---

## 4. n8n 환경 변수 추가

n8n Settings → Environment Variables:

```
WEATHER_API_KEY   = [기상청 API 키]
AIRKOREA_API_KEY  = [에어코리아 API 키]
OPINET_API_KEY    = F260226239
```

---

## 5. n8n 워크플로우 Import

각 JSON 파일을 n8n에 Import:

1. n8n 대시보드 → **Workflows** → **Import from File**
2. 파일 선택:
   - `WF-04-weather.json`
   - `WF-05-dust.json`
   - `WF-06-fuel.json`
3. Import 후 각 워크플로우 → **Credentials** 탭에서 `Supabase PostgreSQL` 선택
4. 워크플로우 **Activate** (토글 ON)

---

## 6. 수동 테스트 실행

n8n 각 워크플로우에서 **Test workflow** 버튼 클릭:

```
WF-04 → Supabase Studio → Table Editor → weather_cache 확인
WF-05 → Supabase Studio → Table Editor → dust_cache 확인
WF-06 → Supabase Studio → Table Editor → fuel_cache 확인
```

---

## 7. 데이터 확인 쿼리

Supabase Studio SQL Editor에서 실행:

```sql
-- 최신 날씨
SELECT temp, sky, humidity, wind_dir, wind_speed, pop, pty, fetched_at
FROM weather_cache
ORDER BY fetched_at DESC LIMIT 1;

-- 최신 미세먼지
SELECT pm10, pm25, fetched_at
FROM dust_cache
ORDER BY fetched_at DESC LIMIT 1;

-- 최신 유가
SELECT region, gasoline, diesel, lpg, gasoline_chg, diesel_chg, fetched_at
FROM fuel_cache
ORDER BY fetched_at DESC;
```

---

## Phase 1 완료 체크리스트

- [ ] Supabase Docker 기동 (모든 컨테이너 healthy)
- [ ] Studio 접속 확인 (http://[IP]:3000)
- [ ] schema.sql 적용 (6개 테이블 생성)
- [ ] n8n PostgreSQL Credential 등록
- [ ] WF-04 테스트 → weather_cache 데이터 확인
- [ ] WF-05 테스트 → dust_cache 데이터 확인
- [ ] WF-06 테스트 → fuel_cache 데이터 확인
- [ ] 3개 워크플로우 Active 상태 확인

✅ 완료되면 Phase 2 (RSS + Claude 요약) 시작 가능!

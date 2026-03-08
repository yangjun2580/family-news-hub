# Family News Hub — Phase 1 설치 가이드

## 📋 전체 흐름

```
[Step 1] Proxmox CT 생성
    ↓
[Step 2] Docker + Supabase 설치
    ↓
[Step 3] DB 스키마 적용 (01_schema.sql)
    ↓
[Step 4] n8n 크리덴셜 등록
    ↓
[Step 5] WF-04/05/06 워크플로우 import
    ↓
[Step 6] 테스트 실행 + 데이터 확인
```

---

## Step 1: Proxmox LXC Container 생성

Proxmox 웹 UI → Create CT:

| 설정 | 권장값 |
|------|--------|
| OS | Ubuntu 22.04 LTS |
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB |
| 이름 | supabase-hub |

```bash
# CT 내부 기본 설정
apt update && apt upgrade -y
apt install -y curl git nano ufw
ufw allow 8000 && ufw allow 3001 && ufw allow 5432
ufw enable
```

---

## Step 2: Docker + Supabase 설치

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# docker-compose v2 설치
curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Supabase 공식 volumes 가져오기
mkdir -p /opt/supabase && cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase tmp-supabase
cp -r tmp-supabase/docker/volumes ./volumes
rm -rf tmp-supabase

# 이 패키지의 파일 복사
cp /path/to/family-news-hub/supabase/docker-compose.yml .
cp /path/to/family-news-hub/supabase/.env .
cp /path/to/family-news-hub/supabase/generate_keys.sh .
```

### 키 생성

```bash
# .env 에서 실제 Proxmox IP 입력
sed -i 's/YOUR_PROXMOX_IP/192.168.0.XXX/g' .env   # ← IP 변경

chmod +x generate_keys.sh
./generate_keys.sh   # ANON_KEY, SERVICE_ROLE_KEY 출력됨 → 저장해두기

docker-compose up -d

# 헬스체크 (30초 후)
curl http://localhost:8000/health    # → {"status":"healthy"}
# Studio: http://YOUR_IP:3001
```

---

## Step 3: DB 스키마 적용

1. `http://YOUR_IP:3001` 접속 (Supabase Studio)
2. 좌측 → **SQL Editor** → **New query**
3. `supabase/01_schema.sql` 전체 붙여넣기 → **Run**
4. Table Editor에서 6개 테이블 확인:
   `articles` / `weather_cache` / `dust_cache` / `fuel_cache` / `profiles` / `push_subscriptions`

### UNIQUE 제약 추가 (UPSERT용)

SQL Editor에서 추가 실행:
```sql
ALTER TABLE weather_cache ADD CONSTRAINT uq_weather_station UNIQUE (station);
ALTER TABLE dust_cache    ADD CONSTRAINT uq_dust_station    UNIQUE (station);
ALTER TABLE fuel_cache    ADD CONSTRAINT uq_fuel_region     UNIQUE (region);
```

---

## Step 4: n8n 크리덴셜 + 환경변수 등록

**크리덴셜 등록:**
n8n → Settings → Credentials → Add → Supabase

| 필드 | 값 |
|------|----|
| Name | Supabase (Family News Hub) |
| Host | http://YOUR_PROXMOX_IP:8000 |
| Service Role Secret | (generate_keys.sh 출력 SERVICE_ROLE_KEY) |

**환경변수 등록:**
n8n이 Docker라면 docker-compose.yml에 추가:
```yaml
environment:
  - WEATHER_API_KEY=e086fc...    # 공공데이터포털 키
  - AIRKOREA_API_KEY=e086fc...   # 동일 키 사용 가능
```

---

## Step 5: 워크플로우 Import

n8n → Workflows → **Add Workflow** 옆 ▼ → **Import from file**

1. `n8n-workflows/WF-04_weather.json`
2. `n8n-workflows/WF-05_dust.json`
3. `n8n-workflows/WF-06_fuel.json`

Import 후 각 워크플로우에서:
- Supabase 노드의 크리덴셜 → `Supabase (Family News Hub)` 선택

---

## Step 6: 테스트 실행

각 워크플로우 → **Execute Workflow** (수동 1회 실행):

```
WF-04 실행 → Studio → weather_cache → 1행 확인 (temp, sky 등)
WF-05 실행 → Studio → dust_cache   → 1행 확인 (pm10, pm25)
WF-06 실행 → Studio → fuel_cache   → 1행 확인 (diesel, gasoline)
```

✅ 3개 테이블 데이터 확인되면 **Active 토글 ON** → 자동 수집 시작!

---

## 트러블슈팅

| 증상 | 원인/해결 |
|------|----------|
| 기상청 resultCode 03 | 발표 전 시각 요청 → baseTime 계산 로직 자동 처리됨 |
| 에어코리아 측정소 없음 | stationName을 `이천시`로 변경 |
| Supabase 연결 실패 | Host에 `http://` 포함 여부 확인, 포트 8000 방화벽 확인 |
| UPSERT 오류 | UNIQUE 제약 추가 쿼리 실행 (Step 3 참고) |
| Kong 502 | `docker-compose logs kong` 확인, volumes/api/kong.yml 존재 여부 |

---

## Phase 2 예고

Phase 1 데이터 파이프라인 확인 후:
- **WF-01** RSS 수집 (40+ 피드)
- **WF-03** Claude Haiku 요약 + 카테고리 자동 분류
- **WF-07** pg_trgm 기반 중복 제거

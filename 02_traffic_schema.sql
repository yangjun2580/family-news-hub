-- ============================================================
-- Family News Hub — ITS 교통 데이터 스키마 마이그레이션
-- 실행: Supabase Studio > SQL Editor 에서 전체 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. traffic_flow — 교통소통정보 캐시
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_flow (
  id              BIGSERIAL PRIMARY KEY,
  link_id         VARCHAR(20) NOT NULL,
  road_name       VARCHAR(100),
  road_type       VARCHAR(10) NOT NULL DEFAULT 'all',  -- ex, its, all
  speed           REAL NOT NULL,                        -- km/h
  travel_time     INTEGER,                              -- 초
  direction       VARCHAR(10),                          -- up, down, start, end
  coord_x         DOUBLE PRECISION,                     -- 경도
  coord_y         DOUBLE PRECISION,                     -- 위도
  source_created_at TIMESTAMPTZ,                        -- ITS 원본 생성시간
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_traffic_flow_link UNIQUE (link_id, fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_traffic_flow_fetched ON traffic_flow (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_flow_bbox ON traffic_flow (coord_x, coord_y);
CREATE INDEX IF NOT EXISTS idx_traffic_flow_road ON traffic_flow (road_type, road_name);

-- ────────────────────────────────────────────────────────────
-- 2. traffic_incident — 돌발상황정보 캐시
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_incident (
  id              BIGSERIAL PRIMARY KEY,
  incident_id     VARCHAR(30),
  incident_type   VARCHAR(30) NOT NULL,
  road_name       VARCHAR(100),
  road_type       VARCHAR(10),
  description     TEXT,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  coord_x         DOUBLE PRECISION NOT NULL,
  coord_y         DOUBLE PRECISION NOT NULL,
  congestion_length REAL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_incident UNIQUE (incident_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_active ON traffic_incident (is_active, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_bbox ON traffic_incident (coord_x, coord_y) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_incident_type ON traffic_incident (incident_type) WHERE is_active = TRUE;

-- ────────────────────────────────────────────────────────────
-- 3. traffic_cctv — CCTV 정보 캐시
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_cctv (
  id              BIGSERIAL PRIMARY KEY,
  cctv_name       VARCHAR(200) NOT NULL,
  cctv_url        TEXT NOT NULL,
  cctv_type       SMALLINT NOT NULL,                    -- 1:HLS, 2:MP4, 3:정지, 4:HLS-S, 5:MP4-S
  road_section_id VARCHAR(30),
  road_type       VARCHAR(10),
  coord_x         DOUBLE PRECISION NOT NULL,
  coord_y         DOUBLE PRECISION NOT NULL,
  resolution      VARCHAR(20),
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cctv UNIQUE (cctv_name, road_type)
);

CREATE INDEX IF NOT EXISTS idx_cctv_bbox ON traffic_cctv (coord_x, coord_y);
CREATE INDEX IF NOT EXISTS idx_cctv_type ON traffic_cctv (road_type, cctv_type);

-- ────────────────────────────────────────────────────────────
-- 4. traffic_fetch_log — API 호출 로그
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_fetch_log (
  id              BIGSERIAL PRIMARY KEY,
  api_type        VARCHAR(20) NOT NULL,                 -- traffic, incident, cctv
  status          VARCHAR(10) NOT NULL,                 -- success, error
  record_count    INTEGER DEFAULT 0,
  error_message   TEXT,
  response_time_ms INTEGER,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fetch_log_type ON traffic_fetch_log (api_type, fetched_at DESC);

-- ────────────────────────────────────────────────────────────
-- 5. RLS 설정
-- ────────────────────────────────────────────────────────────
ALTER TABLE traffic_flow     ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_incident ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_cctv     ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_fetch_log ENABLE ROW LEVEL SECURITY;

-- anon 키로 읽기 허용 (Next.js 프론트엔드용)
CREATE POLICY "anon_read_traffic_flow"     ON traffic_flow     FOR SELECT USING (true);
CREATE POLICY "anon_read_traffic_incident" ON traffic_incident FOR SELECT USING (true);
CREATE POLICY "anon_read_traffic_cctv"     ON traffic_cctv     FOR SELECT USING (true);
CREATE POLICY "anon_read_traffic_log"      ON traffic_fetch_log FOR SELECT USING (true);

-- service_role 키로 모든 작업 허용 (n8n 서버사이드용)
CREATE POLICY "service_all_traffic_flow"     ON traffic_flow     USING (auth.role() = 'service_role');
CREATE POLICY "service_all_traffic_incident" ON traffic_incident USING (auth.role() = 'service_role');
CREATE POLICY "service_all_traffic_cctv"     ON traffic_cctv     USING (auth.role() = 'service_role');
CREATE POLICY "service_all_traffic_log"      ON traffic_fetch_log USING (auth.role() = 'service_role');

-- Realtime (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE traffic_incident;

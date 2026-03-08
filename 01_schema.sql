-- ============================================================
-- Family News Hub — Supabase 스키마 마이그레이션
-- 실행: Supabase Studio > SQL Editor 에서 전체 실행
--       또는: psql -U postgres -d postgres -f 01_schema.sql
-- ============================================================

-- pg_trgm (유사도 검색용, 중복 제거에 사용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ────────────────────────────────────────────────────────────
-- 1. articles — 뉴스 기사 (Claude 요약 포함)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,             -- Claude Haiku 요약 (4-6문장)
  source        TEXT NOT NULL,             -- 언론사/출처명
  source_url    TEXT,                      -- 원문 링크
  category      TEXT NOT NULL,             -- 축구, IT/Tech, 교통, 건강, 경제 등
  region        TEXT DEFAULT '국내',        -- 국내/해외
  is_x_post     BOOLEAN DEFAULT FALSE,     -- X(트위터) 출처 여부
  profiles      TEXT[] NOT NULL,           -- {all, dad, mom, minhyuk, junhyeok}
  feed_url      TEXT,                      -- 수집된 RSS 피드 URL
  original_guid TEXT UNIQUE,              -- RSS guid (1차 중복 방지)
  published_at  TIMESTAMPTZ,              -- 원본 기사 발행일
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_articles_profiles  ON articles USING GIN (profiles);
CREATE INDEX IF NOT EXISTS idx_articles_created   ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category  ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_guid      ON articles (original_guid);
-- 2차 중복 방지용 title 트라이그램 인덱스
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING GIN (title gin_trgm_ops);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articles_updated_at ON articles;
CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE articles;

-- ────────────────────────────────────────────────────────────
-- 2. weather_cache — 날씨 캐시 (기상청 초단기실황)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_cache (
  id          SERIAL PRIMARY KEY,
  station     TEXT NOT NULL DEFAULT '이천시 부발읍',
  nx          INT  DEFAULT 60,             -- 기상청 격자 X
  ny          INT  DEFAULT 125,            -- 기상청 격자 Y
  temp        REAL,                        -- 기온 (°C)
  temp_high   REAL,                        -- 최고기온 (초단기예보)
  temp_low    REAL,                        -- 최저기온 (초단기예보)
  sky         TEXT,                        -- 맑음 / 구름많음 / 흐림
  humidity    INT,                         -- 습도 (%)
  wind_dir    TEXT,                        -- 풍향 (N/NE/E...)
  wind_speed  REAL,                        -- 풍속 (m/s)
  pop         INT  DEFAULT 0,             -- 강수확률 (%)
  pty         TEXT DEFAULT '없음',         -- 강수형태
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 최신 1건만 유지 (UPSERT 방식 사용)
CREATE INDEX IF NOT EXISTS idx_weather_fetched ON weather_cache (fetched_at DESC);

-- ────────────────────────────────────────────────────────────
-- 3. dust_cache — 미세먼지 캐시 (에어코리아)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dust_cache (
  id          SERIAL PRIMARY KEY,
  station     TEXT NOT NULL DEFAULT '이천',
  pm10        INT,                         -- PM10 μg/m³
  pm25        INT,                         -- PM2.5 μg/m³
  -- 등급 판정은 프론트엔드에서 처리 (8단계 커스텀 기준)
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dust_fetched ON dust_cache (fetched_at DESC);

-- ────────────────────────────────────────────────────────────
-- 4. fuel_cache — 유가 캐시 (오피넷)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_cache (
  id           SERIAL PRIMARY KEY,
  diesel       INT,                        -- 경유 원/L
  gasoline     INT,                        -- 휘발유 원/L
  lpg          INT,                        -- LPG 원/L
  diesel_chg   INT DEFAULT 0,             -- 전일 대비 변동
  gasoline_chg INT DEFAULT 0,
  lpg_chg      INT DEFAULT 0,
  region       TEXT DEFAULT '전국평균',
  fetched_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_fetched ON fuel_cache (fetched_at DESC);

-- ────────────────────────────────────────────────────────────
-- 5. profiles — 가족 프로필
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY,            -- all, dad, mom, minhyuk, junhyeok
  name        TEXT NOT NULL,              -- 종합, 아빠, 엄마, 민혁, 준혁
  icon        TEXT NOT NULL,              -- 이모지
  categories  TEXT[],                     -- 관심 카테고리
  feeds       JSONB DEFAULT '[]'          -- RSS 피드 목록 [{url, name, category}]
);

-- 기본 프로필 데이터 삽입
INSERT INTO profiles (id, name, icon, categories) VALUES
  ('all',      '종합',  '📰', ARRAY['종합','경제','사회','문화','IT/Tech','크립토','교통','건강']),
  ('dad',      '아빠',  '🚌', ARRAY['교통','도로','유가']),
  ('mom',      '엄마',  '💜', ARRAY['건강','생활','문화','관광']),
  ('minhyuk',  '민혁',  '⚽', ARRAY['축구']),
  ('junhyeok', '준혁',  '💻', ARRAY['IT/Tech','크립토'])
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. push_subscriptions — Web Push 구독
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_profile ON push_subscriptions (profile_id);

-- ────────────────────────────────────────────────────────────
-- 7. Row Level Security (RLS) — 기본 설정
-- ────────────────────────────────────────────────────────────
ALTER TABLE articles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dust_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- anon 키로 읽기 허용 (Next.js 프론트엔드용)
CREATE POLICY "anon_read_articles"      ON articles           FOR SELECT USING (true);
CREATE POLICY "anon_read_weather"       ON weather_cache      FOR SELECT USING (true);
CREATE POLICY "anon_read_dust"          ON dust_cache         FOR SELECT USING (true);
CREATE POLICY "anon_read_fuel"          ON fuel_cache         FOR SELECT USING (true);
CREATE POLICY "anon_read_profiles"      ON profiles           FOR SELECT USING (true);

-- service_role 키로 모든 작업 허용 (n8n 서버사이드용)
CREATE POLICY "service_all_articles"    ON articles           USING (auth.role() = 'service_role');
CREATE POLICY "service_all_weather"     ON weather_cache      USING (auth.role() = 'service_role');
CREATE POLICY "service_all_dust"        ON dust_cache         USING (auth.role() = 'service_role');
CREATE POLICY "service_all_fuel"        ON fuel_cache         USING (auth.role() = 'service_role');
CREATE POLICY "service_all_push"        ON push_subscriptions USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 검증 쿼리 (실행 후 확인용)
-- ────────────────────────────────────────────────────────────
SELECT table_name, (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════════
-- Family News Hub — Phase 1 DB 스키마
-- Supabase SQL Editor 또는 psql에서 실행
-- ═══════════════════════════════════════════════════════════════

-- ── 확장 기능 활성화 ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- 뉴스 중복 제거용

-- ═══════════════════════════════════════════════════════════════
-- 1. profiles — 가족 프로필
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY,          -- all, dad, mom, minhyuk, junhyeok
  name        TEXT NOT NULL,             -- 종합, 아빠, 엄마, 민혁, 준혁
  icon        TEXT NOT NULL,             -- 이모지
  categories  TEXT[],                    -- 관심 카테고리 목록
  feeds       JSONB,                     -- RSS 피드 메타
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 프로필 삽입
INSERT INTO profiles (id, name, icon, categories) VALUES
  ('all',      '종합',  '📰', ARRAY['종합','경제','사회','문화']),
  ('dad',      '아빠',  '🚌', ARRAY['교통','도로','유가']),
  ('mom',      '엄마',  '💜', ARRAY['건강','생활','문화','관광']),
  ('minhyuk',  '민혁',  '⚽', ARRAY['축구']),
  ('junhyeok', '준혁',  '💻', ARRAY['IT/Tech','크립토'])
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. articles — 뉴스 기사
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS articles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,           -- Claude 요약 (4-6문장)
  source        TEXT NOT NULL,           -- 언론사/출처명
  source_url    TEXT,                    -- 원문 링크
  category      TEXT NOT NULL,           -- 카테고리
  region        TEXT DEFAULT '국내',      -- 국내/해외
  is_x_post     BOOLEAN DEFAULT FALSE,   -- X(트위터) 출처 여부
  profiles      TEXT[] NOT NULL,         -- 대상 프로필 배열
  feed_url      TEXT,                    -- 수집된 RSS 피드 URL
  original_guid TEXT UNIQUE,             -- RSS guid (중복 방지 핵심)
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_articles_profiles  ON articles USING GIN (profiles);
CREATE INDEX IF NOT EXISTS idx_articles_created   ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category  ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_guid      ON articles (original_guid);
-- 제목 유사도 검색 (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING GIN (title gin_trgm_ops);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE articles;

-- ═══════════════════════════════════════════════════════════════
-- 3. weather_cache — 날씨 캐시
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS weather_cache (
  id          SERIAL PRIMARY KEY,
  station     TEXT NOT NULL DEFAULT '이천시 부발읍',
  nx          INT DEFAULT 60,
  ny          INT DEFAULT 125,
  temp        REAL,                      -- 기온 (T1H)
  temp_high   REAL,                      -- 최고기온 (TMX)
  temp_low    REAL,                      -- 최저기온 (TMN)
  sky         TEXT,                      -- 맑음/구름많음/흐림 (SKY)
  humidity    INT,                       -- 습도 % (REH)
  wind_dir    TEXT,                      -- 풍향 (VEC → 방위)
  wind_speed  REAL,                      -- 풍속 m/s (WSD)
  pop         INT,                       -- 강수확률 % (POP)
  pty         TEXT,                      -- 강수형태 (PTY)
  rain_1h     REAL,                      -- 1시간 강수량 (RN1)
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 최신 1건 빠른 조회
CREATE INDEX IF NOT EXISTS idx_weather_fetched ON weather_cache (fetched_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. dust_cache — 미세먼지 캐시
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dust_cache (
  id          SERIAL PRIMARY KEY,
  station     TEXT NOT NULL DEFAULT '이천',
  pm10        INT,                       -- 미세먼지 μg/m³
  pm25        INT,                       -- 초미세먼지 μg/m³
  -- 등급은 프론트에서 계산 (커스텀 8단계)
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dust_fetched ON dust_cache (fetched_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 5. fuel_cache — 유가 캐시
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fuel_cache (
  id           SERIAL PRIMARY KEY,
  region       TEXT DEFAULT '전국평균',   -- 전국평균 or 경기도이천
  diesel       INT,                       -- 경유 원/L
  gasoline     INT,                       -- 휘발유 원/L
  lpg          INT,                       -- LPG 원/L
  diesel_chg   INT DEFAULT 0,             -- 전일 대비 경유 변동
  gasoline_chg INT DEFAULT 0,             -- 전일 대비 휘발유 변동
  lpg_chg      INT DEFAULT 0,             -- 전일 대비 LPG 변동
  fetched_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_fetched ON fuel_cache (fetched_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 6. push_subscriptions — Web Push
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 7. RLS (Row Level Security) — 기본 정책
-- 가족 내부 서비스이므로 anon 읽기 허용, 쓰기는 service_role만
-- ═══════════════════════════════════════════════════════════════

-- articles
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_articles"    ON articles FOR SELECT USING (true);
CREATE POLICY "service_write_articles" ON articles FOR ALL USING (auth.role() = 'service_role');

-- weather_cache
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_weather"     ON weather_cache FOR SELECT USING (true);
CREATE POLICY "service_write_weather" ON weather_cache FOR ALL USING (auth.role() = 'service_role');

-- dust_cache
ALTER TABLE dust_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_dust"        ON dust_cache FOR SELECT USING (true);
CREATE POLICY "service_write_dust"    ON dust_cache FOR ALL USING (auth.role() = 'service_role');

-- fuel_cache
ALTER TABLE fuel_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_fuel"        ON fuel_cache FOR SELECT USING (true);
CREATE POLICY "service_write_fuel"    ON fuel_cache FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 8. 유틸리티 함수 — 날씨 코드 변환
-- ═══════════════════════════════════════════════════════════════

-- SKY 코드 → 텍스트
CREATE OR REPLACE FUNCTION sky_code_to_text(code INT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE code
    WHEN 1 THEN '맑음'
    WHEN 3 THEN '구름많음'
    WHEN 4 THEN '흐림'
    ELSE '알수없음'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PTY 코드 → 텍스트
CREATE OR REPLACE FUNCTION pty_code_to_text(code INT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE code
    WHEN 0 THEN '없음'
    WHEN 1 THEN '비'
    WHEN 2 THEN '비/눈'
    WHEN 3 THEN '눈'
    WHEN 4 THEN '소나기'
    ELSE '없음'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- VEC(풍향각도) → 16방위 텍스트
CREATE OR REPLACE FUNCTION vec_to_direction(vec REAL)
RETURNS TEXT AS $$
DECLARE
  dirs TEXT[] := ARRAY['N','NNE','NE','ENE','E','ESE','SE','SSE',
                        'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  idx INT;
BEGIN
  idx := ((vec + 11.25) / 22.5)::INT % 16 + 1;
  RETURN CASE idx
    WHEN 1 THEN '북'   WHEN 2 THEN '북북동' WHEN 3 THEN '북동'
    WHEN 4 THEN '동북동' WHEN 5 THEN '동'   WHEN 6 THEN '동남동'
    WHEN 7 THEN '남동' WHEN 8 THEN '남남동' WHEN 9 THEN '남'
    WHEN 10 THEN '남남서' WHEN 11 THEN '남서' WHEN 12 THEN '서남서'
    WHEN 13 THEN '서'  WHEN 14 THEN '서북서' WHEN 15 THEN '북서'
    WHEN 16 THEN '북북서'
    ELSE '알수없음'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════
-- 완료 확인
-- ═══════════════════════════════════════════════════════════════
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles','articles','weather_cache','dust_cache','fuel_cache','push_subscriptions')
ORDER BY tablename;

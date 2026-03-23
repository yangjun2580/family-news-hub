-- ═══════════════════════════════════════════════════════════════
-- Family News Hub — 키즈노트 연동 스키마
-- ═══════════════════════════════════════════════════════════════

-- 이준이 프로필 추가
INSERT INTO profiles (id, name, icon, categories) VALUES
  ('ijun', '이준이', '🧒', ARRAY['알림장','식단표','가정통신문','앨범'])
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- kidsnote_cache — 키즈노트 알림장 캐시
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kidsnote_cache (
  id            SERIAL PRIMARY KEY,
  kidsnote_id   TEXT NOT NULL UNIQUE,        -- 키즈노트 내부 ID (중복 방지)
  child_name    TEXT NOT NULL DEFAULT '이준이',
  report_type   TEXT NOT NULL DEFAULT '알림장', -- 알림장/식단표/가정통신문/앨범
  title         TEXT NOT NULL,
  content       TEXT DEFAULT '',              -- 알림장 본문
  author        TEXT DEFAULT '',              -- 작성 선생님
  photos        TEXT[] DEFAULT '{}',          -- 사진 URL 배열
  report_date   TIMESTAMPTZ NOT NULL,        -- 알림장 작성일
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kidsnote_report_date ON kidsnote_cache (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_kidsnote_type ON kidsnote_cache (report_type);

-- RLS
ALTER TABLE kidsnote_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_kidsnote"     ON kidsnote_cache FOR SELECT USING (true);
CREATE POLICY "service_write_kidsnote" ON kidsnote_cache FOR ALL USING (auth.role() = 'service_role');

-- Realtime (선택: 새 알림장 실시간 알림)
ALTER PUBLICATION supabase_realtime ADD TABLE kidsnote_cache;

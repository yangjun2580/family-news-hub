import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchReports, mapReportType } from '@/lib/kidsnote'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CACHE_TTL = 30 * 60 * 1000 // 30분

export async function GET() {
  try {
    // 1. 캐시 확인 — 30분 이내 데이터가 있으면 바로 반환
    const { data: cached } = await supabaseAdmin
      .from('kidsnote_cache')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(20)

    const latestFetch = cached?.[0]?.fetched_at
    if (latestFetch && Date.now() - new Date(latestFetch).getTime() < CACHE_TTL) {
      return NextResponse.json({ entries: cached, fromCache: true })
    }

    // 2. 키즈노트 API에서 새로 가져오기
    const childId = process.env.KIDSNOTE_CHILD_ID
    if (!childId) {
      // 환경변수 미설정 시 캐시된 데이터라도 반환
      if (cached && cached.length > 0) {
        return NextResponse.json({ entries: cached, fromCache: true })
      }
      return NextResponse.json({ entries: [], error: 'KIDSNOTE_CHILD_ID 미설정' })
    }

    const reports = await fetchReports(childId)

    // 3. Supabase에 캐시 저장 (upsert)
    const rows = reports.map((r) => ({
      kidsnote_id: String(r.id),
      child_name: process.env.KIDSNOTE_CHILD_NAME ?? '이준이',
      report_type: mapReportType(r.type),
      title: r.title || mapReportType(r.type),
      content: r.content_text || '',
      author: r.writer_name || '',
      photos: (r.images ?? []).map((img) => img.url),
      report_date: r.created,
      fetched_at: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      await supabaseAdmin
        .from('kidsnote_cache')
        .upsert(rows, { onConflict: 'kidsnote_id' })
    }

    // 4. 최신 데이터 반환
    const { data: fresh } = await supabaseAdmin
      .from('kidsnote_cache')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(20)

    return NextResponse.json({ entries: fresh ?? rows })
  } catch (err) {
    console.error('[kidsnote] API error:', err)

    // 에러 시에도 캐시 데이터 반환 시도
    const { data: fallback } = await supabaseAdmin
      .from('kidsnote_cache')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(20)

    if (fallback && fallback.length > 0) {
      return NextResponse.json({ entries: fallback, fromCache: true })
    }

    return NextResponse.json(
      { entries: [], error: '키즈노트 데이터를 가져올 수 없습니다' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchReports, fetchAlbums, mapReportType } from '@/lib/kidsnote'

export const dynamic = 'force-dynamic'

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
      if (cached && cached.length > 0) {
        return NextResponse.json({ entries: cached, fromCache: true })
      }
      return NextResponse.json({ entries: [], error: 'KIDSNOTE_CHILD_ID 미설정' })
    }

    // 알림장 + 앨범 병렬 조회
    const [reports, albums] = await Promise.all([
      fetchReports(childId),
      fetchAlbums(childId).catch(() => []),
    ])

    const childName = process.env.KIDSNOTE_CHILD_NAME ?? '이준이'
    const now = new Date().toISOString()

    // 3. 실제 API 응답 구조에 맞춰 파싱
    const reportRows = reports.map((r) => ({
      kidsnote_id: String(r.id),
      child_name: r.child_name || childName,
      report_type: mapReportType(r.type),
      title: `${r.date_written} ${r.class_name || '알림장'}`,
      content: r.content || '',
      author: r.author_name || r.author?.name || '',
      photos: (r.images ?? []).map((img) => img.original || img.large || img.small),
      report_date: r.created,
      fetched_at: now,
    }))

    const albumRows = albums.map((a) => ({
      kidsnote_id: `album_${a.id}`,
      child_name: childName,
      report_type: '앨범',
      title: a.title || '앨범',
      content: a.content || '',
      author: a.author_name || a.author?.name || '',
      photos: (a.images ?? []).map((img) => img.original || img.large || img.small),
      report_date: a.created,
      fetched_at: now,
    }))

    const rows = [...reportRows, ...albumRows]

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

    console.log('[kidsnote] success: fresh=', fresh?.length, 'rows=', rows.length)
    return NextResponse.json({ entries: fresh ?? rows })
  } catch (err) {
    console.error('[kidsnote] API error:', err)

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

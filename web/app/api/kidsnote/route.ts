import { NextResponse } from 'next/server'
import { fetchReports, fetchAlbums, mapReportType } from '@/lib/kidsnote'

export const dynamic = 'force-dynamic'

// 인메모리 캐시 (DB SELECT 문제 우회)
let memCache: { entries: Record<string, unknown>[]; ts: number } | null = null
const CACHE_TTL = 30 * 60 * 1000 // 30분

export async function GET() {
  try {
    // 1. 인메모리 캐시 확인
    if (memCache && Date.now() - memCache.ts < CACHE_TTL) {
      return NextResponse.json({ entries: memCache.entries, fromCache: true })
    }

    // 2. 키즈노트 API에서 가져오기
    const childId = process.env.KIDSNOTE_CHILD_ID
    if (!childId) {
      if (memCache) return NextResponse.json({ entries: memCache.entries, fromCache: true })
      return NextResponse.json({ entries: [], error: 'KIDSNOTE_CHILD_ID 미설정' })
    }

    const childName = process.env.KIDSNOTE_CHILD_NAME ?? '이준이'

    const [reports, albums] = await Promise.all([
      fetchReports(childId),
      fetchAlbums(childId).catch(() => []),
    ])

    const reportRows = reports.map((r) => ({
      id: r.id,
      kidsnote_id: String(r.id),
      child_name: r.child_name || childName,
      report_type: mapReportType(r.type),
      title: `${r.date_written} ${r.class_name || '알림장'}`,
      content: r.content || '',
      author: r.author_name || r.author?.name || '',
      photos: (r.attached_images ?? []).map((img) => img.large_resize || img.large || img.original),
      report_date: r.created,
    }))

    const albumRows = albums.map((a) => ({
      id: a.id,
      kidsnote_id: `album_${a.id}`,
      child_name: childName,
      report_type: '앨범',
      title: a.title || '앨범',
      content: a.content || '',
      author: a.author_name || a.author?.name || '',
      photos: (a.attached_images ?? []).map((img) => img.large_resize || img.large || img.original),
      report_date: a.created,
    }))

    const entries = [...reportRows, ...albumRows]
      .filter((e) => (e.content.split('\n').length >= 5 || e.content.length >= 200) && !e.author.includes('엄마'))
      .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())

    memCache = { entries, ts: Date.now() }

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[kidsnote] API error:', err)

    if (memCache) {
      return NextResponse.json({ entries: memCache.entries, fromCache: true })
    }

    return NextResponse.json(
      { entries: [], error: '키즈노트 데이터를 가져올 수 없습니다' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { webpush, buildNotification, PushPayload } from '@/lib/push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const PUSH_SECRET = process.env.PUSH_SEND_SECRET || ''

export async function POST(req: NextRequest) {
  try {
    // 인증: n8n 또는 내부 시스템만 호출 가능
    const authHeader = req.headers.get('authorization')
    if (!PUSH_SECRET || authHeader !== `Bearer ${PUSH_SECRET}`) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }

    const body = await req.json()
    const { profileIds, payload } = body as {
      profileIds?: string[]
      payload: PushPayload
    }

    if (!payload?.title || !payload?.body) {
      return NextResponse.json({ error: 'title과 body가 필요합니다' }, { status: 400 })
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 대상 구독 조회
    let query = supabase.from('push_subscriptions').select('*')
    if (profileIds && profileIds.length > 0) {
      query = query.in('profile_id', profileIds)
    }

    const { data: subscriptions, error } = await query
    if (error) {
      console.error('Push query error:', error)
      return NextResponse.json({ error: '구독 조회 실패' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: '구독자 없음' })
    }

    const notification = buildNotification(payload)

    let sent = 0
    let failed = 0
    const expiredEndpoints: string[] = []

    // 병렬 발송
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            notification
          )
          return 'sent'
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode
          // 410 Gone 또는 404 = 구독 만료
          if (statusCode === 410 || statusCode === 404) {
            expiredEndpoints.push(sub.endpoint)
          }
          throw err
        }
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') sent++
      else failed++
    }

    // 만료된 구독 삭제
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    return NextResponse.json({
      sent,
      failed,
      expired: expiredEndpoints.length,
      total: subscriptions.length,
    })
  } catch (e) {
    console.error('Push send error:', e)
    return NextResponse.json({ error: '알림 발송 실패' }, { status: 500 })
  }
}

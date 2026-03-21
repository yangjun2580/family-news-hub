import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { subscription, profileId } = body

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: '유효하지 않은 구독 데이터입니다' }, { status: 400 })
    }

    if (!profileId || typeof profileId !== 'string') {
      return NextResponse.json({ error: 'profileId가 필요합니다' }, { status: 400 })
    }

    // 유효한 프로필 ID 검증
    const validProfiles = ['all', 'dad', 'mom', 'minhyuk', 'junhyeok']
    if (!validProfiles.includes(profileId)) {
      return NextResponse.json({ error: '유효하지 않은 프로필입니다' }, { status: 400 })
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          profile_id: profileId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: req.headers.get('user-agent') || null,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('Push subscribe error:', error)
      return NextResponse.json({ error: '구독 등록에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Push subscribe error:', e)
    return NextResponse.json({ error: '요청 처리 실패' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint가 필요합니다' }, { status: 400 })
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)

    if (error) {
      console.error('Push unsubscribe error:', error)
      return NextResponse.json({ error: '구독 해제에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Push unsubscribe error:', e)
    return NextResponse.json({ error: '요청 처리 실패' }, { status: 500 })
  }
}

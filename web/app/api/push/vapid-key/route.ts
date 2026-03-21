import { NextResponse } from 'next/server'
import { VAPID_PUBLIC_KEY } from '@/lib/push'

export async function GET() {
  if (!VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'VAPID 키가 설정되지 않았습니다' }, { status: 503 })
  }
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY })
}

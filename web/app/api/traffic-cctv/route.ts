import { NextRequest, NextResponse } from 'next/server'

const ITS_API_KEY = process.env.ITS_API_KEY || ''
const ITS_BASE = 'https://openapi.its.go.kr:9443'

// CCTV 캐시 (1시간 TTL — 위치는 잘 변하지 않음)
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 60 * 60 * 1000

type CctvItem = {
  cctvname: string
  cctvurl: string
  cctvresolution?: string
  coordx: number
  coordy: number
  roadsectionid?: string
  filecreatetime?: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') || '37.5')
  const lon = parseFloat(searchParams.get('lon') || '127.0')
  const roadType = searchParams.get('type') || 'ex'    // ex(고속도로), its(국도)
  const cctvType = searchParams.get('cctvType') || '4'  // 4: HLS HTTPS

  if (!ITS_API_KEY) {
    return NextResponse.json({ error: 'ITS API 키가 설정되지 않았습니다' }, { status: 503 })
  }

  // 유효성 검증
  if (!['ex', 'its'].includes(roadType)) {
    return NextResponse.json({ error: '유효하지 않은 도로 유형입니다 (ex, its)' }, { status: 400 })
  }
  if (!['1', '2', '3', '4', '5'].includes(cctvType)) {
    return NextResponse.json({ error: '유효하지 않은 CCTV 유형입니다 (1-5)' }, { status: 400 })
  }

  // 위치 기반 ±0.1도 범위
  const range = 0.1
  const bbox = {
    minX: lon - range,
    maxX: lon + range,
    minY: lat - range,
    maxY: lat + range,
  }

  const cacheKey = `cctv:${roadType}:${cctvType}:${bbox.minX.toFixed(2)},${bbox.minY.toFixed(2)}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ ...(cached.data as Record<string, unknown>), cached: true })
  }

  try {
    const url = `${ITS_BASE}/cctvInfo?apiKey=${ITS_API_KEY}&type=${roadType}&cctvType=${cctvType}&getType=json&minX=${bbox.minX}&maxX=${bbox.maxX}&minY=${bbox.minY}&maxY=${bbox.maxY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()

    const items: CctvItem[] = data?.response?.data ?? []

    const cctvList = items.map(item => ({
      name: item.cctvname,
      url: item.cctvurl,
      resolution: item.cctvresolution,
      coordX: item.coordx,
      coordY: item.coordy,
      roadSectionId: item.roadsectionid,
    }))

    const result = { cctvs: cctvList, count: cctvList.length, cached: false }
    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL })

    return NextResponse.json(result)
  } catch (e) {
    console.error('CCTV API error:', e)
    return NextResponse.json({ error: 'CCTV 데이터를 가져올 수 없습니다', cctvs: [], count: 0 }, { status: 502 })
  }
}

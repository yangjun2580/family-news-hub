import { NextRequest, NextResponse } from 'next/server'

const ITS_API_KEY = process.env.ITS_API_KEY || ''
const ITS_BASE = 'https://openapi.its.go.kr:9443'

// 서울/경기 기본 bounding box
type BBox = { minX: number; maxX: number; minY: number; maxY: number }

// 인메모리 캐시 (5분 TTL, 최대 50개)
const MAX_CACHE = 50
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) return entry.data as T
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

type TrafficFlowItem = {
  linkId: string
  roadName: string
  speed: number
  travelTime: number
  createdDate: string
}

type IncidentItem = {
  incidentId?: string
  type?: string
  incidentType?: string
  roadName?: string
  description?: string
  startDate?: string
  endDate?: string
  coordX?: number
  coordY?: number
  coord_x?: number
  coord_y?: number
  congestionLength?: number
}

async function fetchTrafficFlow(bbox: BBox): Promise<TrafficFlowItem[]> {
  const url = `${ITS_BASE}/trafficInfo?apiKey=${ITS_API_KEY}&type=all&getType=json&minX=${bbox.minX}&maxX=${bbox.maxX}&minY=${bbox.minY}&maxY=${bbox.maxY}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  const data = await res.json()

  if (data?.header?.resultCode !== 0 && data?.header?.resultCode !== '0') {
    throw new Error(`ITS API error: ${data?.header?.resultMsg || 'unknown'}`)
  }

  const body = data?.body ?? data?.data ?? []
  return Array.isArray(body) ? body : []
}

async function fetchIncidents(bbox: BBox): Promise<IncidentItem[]> {
  const url = `${ITS_BASE}/incidentInfo?apiKey=${ITS_API_KEY}&type=all&getType=json&minX=${bbox.minX}&maxX=${bbox.maxX}&minY=${bbox.minY}&maxY=${bbox.maxY}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  const data = await res.json()

  const body = data?.body ?? data?.data ?? []
  return Array.isArray(body) ? body : []
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') || '37.5')
  const lon = parseFloat(searchParams.get('lon') || '127.0')
  const range = parseFloat(searchParams.get('range') || '0.3')

  if (!ITS_API_KEY) {
    return NextResponse.json({ error: 'ITS API 키가 설정되지 않았습니다' }, { status: 503 })
  }

  // 좌표 기반 bounding box (범위 제한: 최대 ±0.5도)
  const clampedRange = Math.min(Math.max(range, 0.05), 0.5)
  const bbox = {
    minX: lon - clampedRange,
    maxX: lon + clampedRange,
    minY: lat - clampedRange,
    maxY: lat + clampedRange,
  }

  const cacheKey = `traffic:${bbox.minX.toFixed(2)},${bbox.minY.toFixed(2)},${bbox.maxX.toFixed(2)},${bbox.maxY.toFixed(2)}`

  // 캐시 확인
  const cached = getCached<{ flow: unknown[]; incidents: unknown[] }>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  // 교통소통 + 돌발정보 병렬 호출
  const [flowResult, incidentResult] = await Promise.allSettled([
    fetchTrafficFlow(bbox),
    fetchIncidents(bbox),
  ])

  const flow = flowResult.status === 'fulfilled'
    ? flowResult.value.map(item => ({
        linkId: item.linkId,
        roadName: item.roadName,
        speed: item.speed,
        travelTime: item.travelTime,
      }))
    : []

  const incidents = incidentResult.status === 'fulfilled'
    ? incidentResult.value.map(item => ({
        incidentId: item.incidentId,
        type: item.type || item.incidentType,
        roadName: item.roadName,
        description: item.description,
        startDate: item.startDate,
        endDate: item.endDate,
        coordX: item.coordX ?? item.coord_x,
        coordY: item.coordY ?? item.coord_y,
        congestionLength: item.congestionLength,
      }))
    : []

  // 요약 통계
  const avgSpeed = flow.length > 0
    ? Math.round(flow.reduce((sum, f) => sum + f.speed, 0) / flow.length)
    : null

  const congestionCount = flow.filter(f => f.speed < 30).length
  const activeIncidents = incidents.length

  const result = {
    flow,
    incidents,
    summary: {
      avgSpeed,
      congestionCount,
      activeIncidents,
      totalLinks: flow.length,
    },
    errors: {
      flow: flowResult.status === 'rejected' ? String(flowResult.reason) : null,
      incidents: incidentResult.status === 'rejected' ? String(incidentResult.reason) : null,
    },
    cached: false,
  }

  // 최소 하나 성공 시 캐시
  if (flow.length > 0 || incidents.length > 0) {
    setCache(cacheKey, result)
  }

  return NextResponse.json(result)
}

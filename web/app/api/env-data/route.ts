import { NextRequest, NextResponse } from 'next/server'

const WEATHER_KEY = process.env.WEATHER_API_KEY!
const AIRKOREA_KEY = process.env.AIRKOREA_API_KEY!
const OPINET_KEY = process.env.OPINET_API_KEY!

// 위도/경도 → 기상청 격자(nx, ny) 변환
function latLonToGrid(lat: number, lon: number) {
  const RE = 6371.00877, GRID = 5.0
  const SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0
  const XO = 43, YO = 136, DEGRAD = Math.PI / 180.0
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lon * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  }
}

// AirKorea API 검증된 측정소 (서울 전체 구 + 수도권 + 광역시 일부)
const STATIONS = [
  // 서울 (모두 API 검증됨)
  { name: '중구',     lat: 37.5635, lon: 126.9780 },
  { name: '종로구',   lat: 37.5720, lon: 126.9794 },
  { name: '강남구',   lat: 37.5172, lon: 127.0473 },
  { name: '강서구',   lat: 37.5509, lon: 126.8495 },
  { name: '강북구',   lat: 37.6396, lon: 127.0256 },
  { name: '노원구',   lat: 37.6542, lon: 127.0568 },
  { name: '도봉구',   lat: 37.6688, lon: 127.0471 },
  { name: '은평구',   lat: 37.6176, lon: 126.9227 },
  { name: '마포구',   lat: 37.5664, lon: 126.9017 },
  { name: '서대문구', lat: 37.5791, lon: 126.9368 },
  { name: '관악구',   lat: 37.4784, lon: 126.9516 },
  { name: '동작구',   lat: 37.5124, lon: 126.9393 },
  { name: '영등포구', lat: 37.5264, lon: 126.8962 },
  { name: '구로구',   lat: 37.4955, lon: 126.8874 },
  { name: '금천구',   lat: 37.4568, lon: 126.8955 },
  { name: '양천구',   lat: 37.5270, lon: 126.8560 },
  { name: '서초구',   lat: 37.4837, lon: 127.0324 },
  { name: '송파구',   lat: 37.5145, lon: 127.1050 },
  { name: '성동구',   lat: 37.5633, lon: 127.0371 },
  { name: '광진구',   lat: 37.5385, lon: 127.0823 },
  { name: '동대문구', lat: 37.5744, lon: 127.0397 },
  { name: '중랑구',   lat: 37.5953, lon: 127.0927 },
  { name: '성북구',   lat: 37.5894, lon: 127.0167 },
  // 인천 (API 검증됨)
  { name: '부평',     lat: 37.5074, lon: 126.7219 },
  { name: '남동',     lat: 37.4490, lon: 126.7310 },
  // 부산 (API 검증됨)
  { name: '좌동',     lat: 35.1840, lon: 129.2190 },
]

async function fetchDust(stationName: string, key: string) {
  const url = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${key}&returnType=json&numOfRows=1&pageNo=1&stationName=${encodeURIComponent(stationName)}&dataTerm=DAILY&ver=1.0`
  const res = await fetch(url)
  const data = await res.json()
  const item = data.response.body.items[0] || {}
  return {
    pm10: parseInt(item.pm10Value || '0') || 0,
    pm25: parseInt(item.pm25Value || '0') || 0,
  }
}

async function nearestStation(lat: number, lon: number, key: string): Promise<{ name: string; pm10: number; pm25: number }> {
  let minDist = Infinity, best = STATIONS[0]
  for (const s of STATIONS) {
    const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2
    if (d < minDist) { minDist = d; best = s }
  }
  const dust = await fetchDust(best.name, key)
  // 값이 0이면 서울 중구로 fallback
  if (dust.pm10 === 0 && dust.pm25 === 0) {
    const fallback = await fetchDust('중구', key)
    return { name: '중구(서울)', ...fallback }
  }
  return { name: best.name, ...dust }
}

async function getLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'family-news-hub/1.0' }, signal: AbortSignal.timeout(3000) }
    )
    const data = await res.json()
    const addr = data.address || {}
    return addr.city_district || addr.suburb || addr.borough || addr.county || addr.city || addr.state || '현재 위치'
  } catch {
    return '현재 위치'
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') || '37.5665')
  const lon = parseFloat(searchParams.get('lon') || '126.9780')

  try {
    // ── 위치명 (병렬로 실행) ──
    const locationNamePromise = getLocationName(lat, lon)

    // ── 날씨 ──
    const { nx, ny } = latLonToGrid(lat, lon)
    const now = new Date(Date.now() + 9 * 3600000)
    const base_date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const h = now.getUTCHours()
    const candidates = [2,5,8,11,14,17,20,23].filter(t => h >= t)
    const bt = candidates.length ? candidates[candidates.length - 1] : 2
    const base_time = String(bt).padStart(2, '0') + '00'

    const wRes = await fetch(`http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${WEATHER_KEY}&pageNo=1&numOfRows=300&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`)
    const wData = await wRes.json()
    const wItems: { category: string; fcstValue: string }[] = wData.response.body.items.item
    const cats: Record<string, string> = {}
    for (const i of wItems) {
      if (['TMP','TMX','TMN','SKY','REH','VEC','WSD','POP','PTY'].includes(i.category) && !cats[i.category])
        cats[i.category] = i.fcstValue
    }
    const weather = {
      station: `${lat.toFixed(2)},${lon.toFixed(2)}`,
      nx, ny,
      temp: parseFloat(cats.TMP || '0'),
      temp_high: parseFloat(cats.TMX || '0'),
      temp_low: parseFloat(cats.TMN || '0'),
      sky: parseInt(cats.SKY || '1'),
      humidity: parseInt(cats.REH || '0'),
      wind_dir: parseInt(cats.VEC || '0'),
      wind_speed: parseFloat(cats.WSD || '0'),
      pop: parseInt(cats.POP || '0'),
      pty: parseInt(cats.PTY || '0'),
    }

    // ── 미세먼지 ──
    const { name: stationName, pm10, pm25 } = await nearestStation(lat, lon, AIRKOREA_KEY)
    const dust = { station: stationName, pm10, pm25 }

    // ── 유가 ──
    const fRes = await fetch(`http://www.opinet.co.kr/api/avgRecentPrice.do?code=${OPINET_KEY}&out=json`)
    const fText = await fRes.text()
    const fData = JSON.parse(fText.trim())
    const oils: { DATE: string; PRODCD: string; PRICE: string }[] = fData.RESULT.OIL
    const dates = [...new Set(oils.map(o => o.DATE))].sort()
    const [prev, latest] = [dates[dates.length - 2], dates[dates.length - 1]]
    const gp = (d: string, c: string) => parseFloat(oils.find(o => o.DATE === d && o.PRODCD === c)?.PRICE || '0')
    const fuel = {
      region: '전국평균',
      gasoline: gp(latest, 'B027'),
      diesel: gp(latest, 'C004'),
      lpg: gp(latest, 'K015'),
      gasoline_chg: Math.round((gp(latest,'B027') - gp(prev,'B027')) * 100) / 100,
      diesel_chg: Math.round((gp(latest,'C004') - gp(prev,'C004')) * 100) / 100,
      lpg_chg: Math.round((gp(latest,'K015') - gp(prev,'K015')) * 100) / 100,
    }

    const locationName = await locationNamePromise
    return NextResponse.json({ weather, dust, fuel, locationName })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

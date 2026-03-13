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

// 위도/경도 기준 가장 가까운 AirKorea 측정소 찾기
const STATIONS = [
  { name: '중구',   lat: 37.5665, lon: 126.9780 },
  { name: '강남구', lat: 37.5172, lon: 127.0473 },
  { name: '강서구', lat: 37.5509, lon: 126.8495 },
  { name: '노원구', lat: 37.6542, lon: 127.0568 },
  { name: '관악구', lat: 37.4784, lon: 126.9516 },
  { name: '인천',   lat: 37.4563, lon: 126.7052 },
  { name: '수원',   lat: 37.2636, lon: 127.0286 },
  { name: '성남',   lat: 37.4449, lon: 127.1388 },
  { name: '고양',   lat: 37.6583, lon: 126.8320 },
  { name: '부산',   lat: 35.1796, lon: 129.0756 },
  { name: '대구',   lat: 35.8714, lon: 128.6014 },
  { name: '광주',   lat: 35.1595, lon: 126.8526 },
  { name: '대전',   lat: 36.3504, lon: 127.3845 },
  { name: '울산',   lat: 35.5384, lon: 129.3114 },
  { name: '세종',   lat: 36.4801, lon: 127.2890 },
  { name: '청주',   lat: 36.6424, lon: 127.4890 },
  { name: '전주',   lat: 35.8242, lon: 127.1480 },
  { name: '포항',   lat: 36.0190, lon: 129.3435 },
  { name: '창원',   lat: 35.2280, lon: 128.6811 },
  { name: '제주',   lat: 33.4996, lon: 126.5312 },
]

function nearestStation(lat: number, lon: number): string {
  let minDist = Infinity, best = '중구'
  for (const s of STATIONS) {
    const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2
    if (d < minDist) { minDist = d; best = s.name }
  }
  return best
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') || '37.5665')
  const lon = parseFloat(searchParams.get('lon') || '126.9780')

  try {
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
    const stationName = nearestStation(lat, lon)
    const aRes = await fetch(`http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${AIRKOREA_KEY}&returnType=json&numOfRows=1&pageNo=1&stationName=${encodeURIComponent(stationName)}&dataTerm=DAILY&ver=1.0`)
    const aData = await aRes.json()
    const aItem = aData.response.body.items[0] || {}
    const dust = {
      station: stationName,
      pm10: parseInt(aItem.pm10Value || '0') || 0,
      pm25: parseInt(aItem.pm25Value || '0') || 0,
    }

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

    return NextResponse.json({ weather, dust, fuel })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

const WEATHER_KEY = process.env.WEATHER_API_KEY || ''
const AIRKOREA_KEY = process.env.AIRKOREA_API_KEY || ''
const OPINET_KEY = process.env.OPINET_API_KEY || ''

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

// 위도/경도 → 시도명 매핑 (getCtprvnRltmMesureDnsty 용)
function latToSido(lat: number, lon: number): string {
  // 제주
  if (lat < 34.0) return '제주'
  // 부산 (동남쪽)
  if (lat < 35.5 && lon > 128.5) return '부산'
  // 울산
  if (lat >= 35.4 && lat < 35.7 && lon > 129.0) return '울산'
  // 경남
  if (lat < 35.5 && lon >= 127.5) return '경남'
  // 대구
  if (lat >= 35.7 && lat < 36.1 && lon >= 128.3 && lon < 129.0) return '대구'
  // 광주
  if (lat >= 35.0 && lat < 35.3 && lon >= 126.7 && lon < 127.0) return '광주'
  // 전남
  if (lat < 35.5 && lon < 127.5) return '전남'
  // 전북
  if (lat >= 35.5 && lat < 36.2 && lon >= 126.5 && lon < 127.5) return '전북'
  // 대전
  if (lat >= 36.2 && lat < 36.5 && lon >= 127.2 && lon < 127.6) return '대전'
  // 세종
  if (lat >= 36.4 && lat < 36.6 && lon >= 127.1 && lon < 127.4) return '세종'
  // 충남
  if (lat >= 36.0 && lat < 37.0 && lon < 127.2) return '충남'
  // 충북
  if (lat >= 36.5 && lat < 37.3 && lon >= 127.4 && lon < 128.5) return '충북'
  // 강원
  if (lon >= 128.0 && lat >= 37.0) return '강원'
  // 경북
  if (lat >= 36.1 && lat < 37.3 && lon >= 128.0) return '경북'
  // 인천
  if (lat >= 37.3 && lat < 37.7 && lon < 126.8) return '인천'
  // 서울 (남단 서초/강남 37.43 이상)
  // 동쪽 경계: 강동구 동단 127.17이나 구리시(37.60/127.13) 제외 필요
  // 구리/남양주: lat 37.56~37.66, lon 127.10~127.22
  // 하남: lat 37.52~37.56, lon 127.18~127.22
  if (lat >= 37.43 && lat < 37.7 && lon >= 126.8 && lon < 127.18) {
    // 구리/남양주 영역 (lon >= 127.10 && lat >= 37.56) → 경기
    if (lon >= 127.10 && lat >= 37.56) return '경기'
    return '서울'
  }
  // 경기
  if (lat >= 37.0 && lat < 38.3 && lon >= 126.5 && lon < 127.9) return '경기'
  // 기본값
  return '서울'
}

async function fetchCityDust(sidoName: string, key: string): Promise<{ name: string; pm10: number; pm25: number }> {
  const url = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${key}&returnType=json&numOfRows=10&pageNo=1&sidoName=${encodeURIComponent(sidoName)}&ver=1.0`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  const data = await res.json()
  const items: { stationName: string; pm10Value: string; pm25Value: string }[] = data?.response?.body?.items ?? []
  // 첫 번째로 유효한(0이 아닌) 데이터 반환
  for (const item of items) {
    const pm10 = parseInt(item.pm10Value || '0') || 0
    const pm25 = parseInt(item.pm25Value || '0') || 0
    if (pm10 > 0 || pm25 > 0) {
      return { name: `${item.stationName}(${sidoName})`, pm10, pm25 }
    }
  }
  // 유효 데이터 없으면 첫 항목 반환
  if (items.length > 0) {
    return {
      name: `${items[0].stationName}(${sidoName})`,
      pm10: parseInt(items[0].pm10Value || '0') || 0,
      pm25: parseInt(items[0].pm25Value || '0') || 0,
    }
  }
  return { name: sidoName, pm10: 0, pm25: 0 }
}

async function getLocationInfo(lat: number, lon: number): Promise<{ name: string; sido: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'family-news-hub/1.0' }, signal: AbortSignal.timeout(3000) }
    )
    const data = await res.json()
    const addr = data.address || {}
    const name = addr.city_district || addr.suburb || addr.borough || addr.county || addr.city || addr.state || '현재 위치'

    // 시도명 추출 (역지오코딩이 정확)
    const state = addr.state || ''
    const sidoMap: Record<string, string> = {
      '서울특별시': '서울', '서울': '서울',
      '부산광역시': '부산', '부산': '부산',
      '대구광역시': '대구', '대구': '대구',
      '인천광역시': '인천', '인천': '인천',
      '광주광역시': '광주', '광주': '광주',
      '대전광역시': '대전', '대전': '대전',
      '울산광역시': '울산', '울산': '울산',
      '세종특별자치시': '세종', '세종': '세종',
      '경기도': '경기', '경기': '경기',
      '강원특별자치도': '강원', '강원도': '강원', '강원': '강원',
      '충청북도': '충북', '충북': '충북',
      '충청남도': '충남', '충남': '충남',
      '전북특별자치도': '전북', '전라북도': '전북', '전북': '전북',
      '전라남도': '전남', '전남': '전남',
      '경상북도': '경북', '경북': '경북',
      '경상남도': '경남', '경남': '경남',
      '제주특별자치도': '제주', '제주도': '제주', '제주': '제주',
    }
    const sido = sidoMap[state] || ''

    return { name, sido }
  } catch {
    return { name: '현재 위치', sido: '' }
  }
}

async function fetchWeather(lat: number, lon: number) {
  const { nx, ny } = latLonToGrid(lat, lon)
  const now = new Date(Date.now() + 9 * 3600000)
  const base_date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const h = now.getUTCHours()
  const candidates = [2, 5, 8, 11, 14, 17, 20, 23].filter(t => h >= t)
  const bt = candidates.length ? candidates[candidates.length - 1] : 2
  const base_time = String(bt).padStart(2, '0') + '00'

  const wRes = await fetch(
    `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${WEATHER_KEY}&pageNo=1&numOfRows=300&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`,
    { signal: AbortSignal.timeout(8000) }
  )
  const wData = await wRes.json()
  const wItems: { category: string; fcstValue: string }[] = wData?.response?.body?.items?.item ?? []
  const cats: Record<string, string> = {}
  for (const i of wItems) {
    if (['TMP', 'TMX', 'TMN', 'SKY', 'REH', 'VEC', 'WSD', 'POP', 'PTY'].includes(i.category) && !cats[i.category])
      cats[i.category] = i.fcstValue
  }
  return {
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
}

async function fetchFuel() {
  const fRes = await fetch(
    `http://www.opinet.co.kr/api/avgRecentPrice.do?code=${OPINET_KEY}&out=json`,
    { signal: AbortSignal.timeout(8000) }
  )
  const fText = await fRes.text()
  const fData = JSON.parse(fText.trim())
  const oils: { DATE: string; PRODCD: string; PRICE: string }[] = fData?.RESULT?.OIL ?? []
  if (oils.length === 0) return null
  const dates = [...new Set(oils.map(o => o.DATE))].sort()
  const [prev, latest] = [dates[dates.length - 2], dates[dates.length - 1]]
  const gp = (d: string, c: string) => parseFloat(oils.find(o => o.DATE === d && o.PRODCD === c)?.PRICE || '0')
  return {
    region: '전국평균',
    gasoline: gp(latest, 'B027'),
    diesel: gp(latest, 'C004'),
    lpg: gp(latest, 'K015'),
    gasoline_chg: Math.round((gp(latest, 'B027') - gp(prev, 'B027')) * 100) / 100,
    diesel_chg: Math.round((gp(latest, 'C004') - gp(prev, 'C004')) * 100) / 100,
    lpg_chg: Math.round((gp(latest, 'K015') - gp(prev, 'K015')) * 100) / 100,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawLat = parseFloat(searchParams.get('lat') || '37.5665')
  const rawLon = parseFloat(searchParams.get('lon') || '126.9780')

  // 입력 검증: 한반도 범위 (lat 33~39, lon 124~132)
  const lat = (isNaN(rawLat) || rawLat < 33 || rawLat > 39) ? 37.5665 : rawLat
  const lon = (isNaN(rawLon) || rawLon < 124 || rawLon > 132) ? 126.9780 : rawLon

  // 먼저 역지오코딩으로 정확한 시도 확보 (미세먼지 API에 필요)
  const locationInfo = await getLocationInfo(lat, lon)
  const sidoName = locationInfo.sido || latToSido(lat, lon)

  // 나머지 API를 병렬로 호출 — 부분 실패 허용
  const [weatherResult, dustResult, fuelResult] = await Promise.allSettled([
    fetchWeather(lat, lon),
    fetchCityDust(sidoName, AIRKOREA_KEY),
    fetchFuel(),
  ])

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null
  const dustData = dustResult.status === 'fulfilled' ? dustResult.value : null
  const dust = dustData ? { station: dustData.name, pm10: dustData.pm10, pm25: dustData.pm25 } : null
  const fuel = fuelResult.status === 'fulfilled' ? fuelResult.value : null
  const locationName = locationInfo.name || '현재 위치'

  // 모든 API 실패 시에만 에러 반환
  if (!weather && !dust && !fuel) {
    console.error('All env-data APIs failed:', {
      weather: weatherResult.status === 'rejected' ? String(weatherResult.reason) : 'ok',
      dust: dustResult.status === 'rejected' ? String(dustResult.reason) : 'ok',
      fuel: fuelResult.status === 'rejected' ? String(fuelResult.reason) : 'ok',
    })
    return NextResponse.json({ error: '환경 데이터를 가져올 수 없습니다' }, { status: 502 })
  }

  return NextResponse.json({ weather, dust, fuel, locationName })
}

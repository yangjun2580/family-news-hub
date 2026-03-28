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

// 경기도 시/군 → 대표 측정소 매핑 (AirKorea 측정소명 기준)
const GYEONGGI_CITY_STATION: Record<string, string> = {
  '구리시': '교문동', '남양주시': '별내동', '하남시': '미사', '성남시': '상대원동',
  '의정부시': '의정부동', '양주시': '고읍', '동두천시': '보산동', '포천시': '선단동',
  '가평군': '가평', '연천군': '연천', '양평군': '양평읍',
  '수원시': '인계동', '화성시': '동탄', '오산시': '오산동', '평택시': '비전동',
  '안성시': '공도읍', '용인시': '기흥', '이천시': '창전동', '여주시': '가남읍',
  '광주시': '경안동', '안양시': '안양8동', '과천시': '과천동', '군포시': '산본동',
  '의왕시': '고천동', '부천시': '소사본동', '광명시': '철산동', '시흥시': '정왕동',
  '안산시': '고잔동', '고양시': '행신동', '파주시': '금촌동', '김포시': '사우동',
}

function getItemValue(item: { pm10Value: string; pm25Value: string }) {
  return {
    pm10: parseInt(item.pm10Value || '-1') === -1 ? 0 : parseInt(item.pm10Value) || 0,
    pm25: parseInt(item.pm25Value || '-1') === -1 ? 0 : parseInt(item.pm25Value) || 0,
  }
}

// TM 중부원점 좌표 변환 (AirKorea getNearbyMsrstnList용)
function wgs84ToTm(lon: number, lat: number): { tmX: number; tmY: number } {
  const a = 6377397.155, f = 1 / 299.1528128, b = a * (1 - f)
  const e2 = (a * a - b * b) / (a * a), ep2 = e2 / (1 - e2)
  const lon0 = (127.0 * Math.PI) / 180.0, lat0 = (38.0 * Math.PI) / 180.0
  const k0 = 1.0, FE = 200000.0, FN = 500000.0
  const lonR = (lon * Math.PI) / 180.0, latR = (lat * Math.PI) / 180.0
  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2)
  const T = Math.tan(latR) ** 2, C = ep2 * Math.cos(latR) ** 2
  const A = (lonR - lon0) * Math.cos(latR)
  const calcM = (phi: number) => a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi -
    (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) +
    (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) -
    (35 * e2 ** 3 / 3072) * Math.sin(6 * phi)
  )
  const M = calcM(latR), M0 = calcM(lat0)
  const tmX = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + FE
  const tmY = k0 * (M - M0 + N * Math.tan(latR) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720)) + FN
  return { tmX: Math.round(tmX), tmY: Math.round(tmY) }
}

// getNearbyMsrstnList → 가장 가까운 측정소 이름 반환 (API 권한 있을 때만 동작)
async function getNearestStationName(lat: number, lon: number, key: string): Promise<string | null> {
  try {
    const { tmX, tmY } = wgs84ToTm(lon, lat)
    const url = `http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList?serviceKey=${key}&returnType=json&tmX=${tmX}&tmY=${tmY}&ver=1.1`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const data = await res.json()
    const items: { stationName: string; tm: string }[] = data?.response?.body?.items ?? []
    return items[0]?.stationName ?? null
  } catch {
    return null
  }
}

async function fetchCityDust(
  sidoName: string,
  key: string,
  suburb: string,
  district: string,
  city: string,
  lat: number,
  lon: number,
): Promise<{ name: string; pm10: number; pm25: number }> {
  // 1순위: getNearbyMsrstnList로 가장 가까운 측정소 직접 조회 (API 권한 있을 때)
  const nearestStation = await getNearestStationName(lat, lon, key)
  if (nearestStation) {
    try {
      const url = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${key}&returnType=json&stationName=${encodeURIComponent(nearestStation)}&dataTerm=DAILY&pageNo=1&numOfRows=1&ver=1.0`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      const item = data?.response?.body?.items?.[0]
      if (item) {
        return {
          name: nearestStation,
          pm10: parseInt(item.pm10Value || '0') || 0,
          pm25: parseInt(item.pm25Value || '0') || 0,
        }
      }
    } catch { /* fallthrough */ }
  }

  // 2순위 이하: 시도 전체 목록에서 이름 매칭 (정적 fallback)
  const url = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${key}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent(sidoName)}&ver=1.0`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  const data = await res.json()
  const items: { stationName: string; pm10Value: string; pm25Value: string }[] = data?.response?.body?.items ?? []
  if (items.length === 0) return { name: sidoName, pm10: 0, pm25: 0 }

  const makeResult = (item: typeof items[0]) => {
    const { pm10, pm25 } = getItemValue(item)
    return { name: item.stationName, pm10, pm25 }
  }

  if (suburb) {
    const norm = suburb.replace(/[동읍면리]$/, '')
    const match = items.find(s => s.stationName.includes(norm) || norm.includes(s.stationName))
    if (match) return makeResult(match)
  }
  if (district) {
    const norm = district.replace(/[구군]$/, '')
    const match = items.find(s => s.stationName.includes(norm) || norm.includes(s.stationName))
    if (match) return makeResult(match)
  }
  if (city && GYEONGGI_CITY_STATION[city]) {
    const match = items.find(s => s.stationName === GYEONGGI_CITY_STATION[city])
    if (match) return makeResult(match)
  }
  if (city) {
    const norm = city.replace(/[시군구]$/, '')
    const match = items.find(s => s.stationName.includes(norm))
    if (match) return makeResult(match)
  }
  for (const item of items) {
    const { pm10, pm25 } = getItemValue(item)
    if (pm10 > 0 || pm25 > 0) return makeResult(item)
  }
  return makeResult(items[0])
}

async function getLocationInfo(lat: number, lon: number): Promise<{ name: string; sido: string; suburb: string; district: string; city: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'family-news-hub/1.0' }, signal: AbortSignal.timeout(3000) }
    )
    const data = await res.json()
    const addr = data.address || {}
    const name = addr.city_district || addr.suburb || addr.borough || addr.county || addr.city || addr.state || '현재 위치'
    const suburb = addr.suburb || addr.neighbourhood || ''
    const district = addr.city_district || addr.borough || ''
    const city = addr.city || addr.county || ''

    const state = addr.state || addr.province || ''
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

    return { name, sido, suburb, district, city }
  } catch {
    return { name: '현재 위치', sido: '', suburb: '', district: '', city: '' }
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

// WGS84 → KATEC (한국 TM 좌표) 변환
function wgs84ToKatec(lon: number, lat: number): { x: number; y: number } {
  const a = 6377397.155
  const f = 1 / 299.1528128
  const b = a * (1 - f)
  const e2 = (a * a - b * b) / (a * a)
  const ep2 = e2 / (1 - e2)
  const lon0 = (128.0 * Math.PI) / 180.0
  const lat0 = (38.0 * Math.PI) / 180.0
  const k0 = 0.9999
  const FE = 400000.0
  const FN = 600000.0
  const lonR = (lon * Math.PI) / 180.0
  const latR = (lat * Math.PI) / 180.0
  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2)
  const T = Math.tan(latR) ** 2
  const C = ep2 * Math.cos(latR) ** 2
  const A = (lonR - lon0) * Math.cos(latR)
  const calcM = (phi: number) =>
    a * (
      (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi -
      (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) +
      (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) -
      (35 * e2 ** 3 / 3072) * Math.sin(6 * phi)
    )
  const M = calcM(latR)
  const M0 = calcM(lat0)
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + FE
  const y = k0 * (M - M0 + N * Math.tan(latR) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720)) + FN
  return { x: Math.round(x), y: Math.round(y) }
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

function katecToWgs84(x: number, y: number): { lat: number; lon: number } {
  const a = 6377397.155
  const f = 1 / 299.1528128
  const b = a * (1 - f)
  const e2 = (a * a - b * b) / (a * a)
  const ep2 = e2 / (1 - e2)
  const lon0 = (128.0 * Math.PI) / 180.0
  const lat0 = (38.0 * Math.PI) / 180.0
  const k0 = 0.9999
  const FE = 400000.0
  const FN = 600000.0
  const calcM = (phi: number) =>
    a * (
      (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi -
      (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) +
      (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) -
      (35 * e2 ** 3 / 3072) * Math.sin(6 * phi)
    )
  const M0 = calcM(lat0)
  const M = M0 + (y - FN) / k0
  const n1 = (a - b) / (a + b)
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
  const phi1 = mu
    + (3 * n1 / 2 - 27 * n1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * n1 ** 2 / 16 - 55 * n1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * n1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * n1 ** 4 / 512) * Math.sin(8 * mu)
  const sinPhi1 = Math.sin(phi1)
  const tanPhi1 = Math.tan(phi1)
  const cosPhi1 = Math.cos(phi1)
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 ** 2)
  const T1 = tanPhi1 ** 2
  const C1 = ep2 * cosPhi1 ** 2
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi1 ** 2, 1.5)
  const D = (x - FE) / (N1 * k0)
  const latR = phi1 - (N1 * tanPhi1 / R1) * (
    D ** 2 / 2 -
    (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720
  )
  const lonR = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / cosPhi1
  return {
    lat: parseFloat(((latR * 180) / Math.PI).toFixed(6)),
    lon: parseFloat(((lonR * 180) / Math.PI).toFixed(6)),
  }
}

async function fetchNearbyStations(lat: number, lon: number) {
  const { x, y } = wgs84ToKatec(lon, lat)
  const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&out=json&prodcd=B027&x=${x}&y=${y}&radius=5000&sort=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  const text = await res.text()
  const data = JSON.parse(text.replace(/\s+/g, ' ').trim())
  const oils: { OS_NM: string; PRICE: number; DISTANCE: number; POLL_DIV_CD: string; GIS_X_COOR: number; GIS_Y_COOR: number }[] = data?.RESULT?.OIL ?? []
  return oils.slice(0, 5).map(o => {
    const coords = katecToWgs84(o.GIS_X_COOR, o.GIS_Y_COOR)
    return {
      name: o.OS_NM,
      price: o.PRICE,
      distance: Math.round(o.DISTANCE),
      brand: o.POLL_DIV_CD,
      lat: coords.lat,
      lon: coords.lon,
    }
  })
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
  const [weatherResult, dustResult, fuelResult, nearbyResult] = await Promise.allSettled([
    fetchWeather(lat, lon),
    fetchCityDust(sidoName, AIRKOREA_KEY, locationInfo.suburb, locationInfo.district, locationInfo.city, lat, lon),
    fetchFuel(),
    fetchNearbyStations(lat, lon),
  ])

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null
  const dustData = dustResult.status === 'fulfilled' ? dustResult.value : null
  const dust = dustData ? { station: dustData.name, pm10: dustData.pm10, pm25: dustData.pm25 } : null
  const fuel = fuelResult.status === 'fulfilled' ? fuelResult.value : null
  const nearbyStations = nearbyResult.status === 'fulfilled' ? nearbyResult.value : []
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

  return NextResponse.json({ weather, dust, fuel, nearbyStations, locationName })
}

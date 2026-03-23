const KIDSNOTE_BASE = 'https://www.kidsnote.com/api'

const CENTER_ID = process.env.KIDSNOTE_CENTER_ID ?? '66080'
const CLASS_ID = process.env.KIDSNOTE_CLASS_ID ?? '1127255'

type KidsNoteImage = {
  original: string
  large: string
  small: string
}

export type KidsNoteReport = {
  id: number
  type?: string
  content: string
  author: { name: string }
  author_name: string
  child_name: string
  class_name: string
  date_written: string
  created: string
  images: KidsNoteImage[]
}

export type KidsNoteAlbum = {
  id: number
  title: string
  content: string
  author: { name: string }
  author_name: string
  created: string
  images: KidsNoteImage[]
}

type KidsNoteSession = {
  cookie: string
  expiresAt: number
}

let cachedSession: KidsNoteSession | null = null

async function login(): Promise<string> {
  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return cachedSession.cookie
  }

  const username = process.env.KIDSNOTE_USERNAME
  const password = process.env.KIDSNOTE_PASSWORD
  if (!username || !password) {
    throw new Error('KIDSNOTE_USERNAME, KIDSNOTE_PASSWORD 환경변수가 필요합니다')
  }

  const res = await fetch('https://www.kidsnote.com/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://www.kidsnote.com/login',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
    },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    redirect: 'manual',
  })

  const setCookies = res.headers.getSetCookie?.() ?? []
  const sessionCookie = setCookies
    .map((c) => c.split(';')[0])
    .filter((c) => c.startsWith('sessionid='))
    .join('; ')

  if (!sessionCookie) {
    throw new Error('키즈노트 로그인 실패: 세션 쿠키를 받지 못했습니다')
  }

  cachedSession = {
    cookie: sessionCookie,
    expiresAt: Date.now() + 30 * 60 * 1000,
  }

  return sessionCookie
}

async function fetchWithRetry(url: string): Promise<Response> {
  const cookie = await login()
  const res = await fetch(url, { headers: { Cookie: cookie } })

  if (res.status === 401 || res.status === 403) {
    cachedSession = null
    const newCookie = await login()
    const retry = await fetch(url, { headers: { Cookie: newCookie } })
    if (!retry.ok) throw new Error(`키즈노트 API 오류: ${retry.status}`)
    return retry
  }

  if (!res.ok) throw new Error(`키즈노트 API 오류: ${res.status}`)
  return res
}

export async function fetchReports(childId: string): Promise<KidsNoteReport[]> {
  const url = `${KIDSNOTE_BASE}/v1_2/children/${childId}/reports/?page_size=20&tz=Asia/Seoul&center_id=${CENTER_ID}&cls=${CLASS_ID}&child=${childId}`
  const res = await fetchWithRetry(url)
  const data = await res.json()
  return data.results ?? []
}

export async function fetchAlbums(childId: string): Promise<KidsNoteAlbum[]> {
  const url = `${KIDSNOTE_BASE}/v1_3/children/${childId}/albums/?tz=Asia/Seoul&page_size=12&center=${CENTER_ID}&cls=${CLASS_ID}&child=${childId}`
  const res = await fetchWithRetry(url)
  const data = await res.json()
  return data.results ?? []
}

export function mapReportType(type: string | undefined): string {
  const map: Record<string, string> = {
    report: '알림장',
    notice: '가정통신문',
    album: '앨범',
    menu: '식단표',
    medication: '투약의뢰',
    absent: '결석/귀가',
  }
  return map[type ?? ''] ?? '알림장'
}

const KIDSNOTE_BASE = 'https://www.kidsnote.com/api/v1_2'

type KidsNoteReport = {
  id: number
  type: string
  title: string
  content_text: string
  writer_name: string
  images: { url: string }[]
  created: string
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

  const res = await fetch('https://www.kidsnote.com/api/v1_2/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  })

  const setCookies = res.headers.getSetCookie?.() ?? []
  const sessionCookie = setCookies
    .map((c) => c.split(';')[0])
    .filter((c) => c.startsWith('sessionid=') || c.startsWith('csrftoken='))
    .join('; ')

  if (!sessionCookie) {
    throw new Error('키즈노트 로그인 실패: 세션 쿠키를 받지 못했습니다')
  }

  cachedSession = {
    cookie: sessionCookie,
    expiresAt: Date.now() + 30 * 60 * 1000, // 30분
  }

  return sessionCookie
}

export async function fetchReports(childId: string): Promise<KidsNoteReport[]> {
  const cookie = await login()

  const res = await fetch(
    `${KIDSNOTE_BASE}/children/${childId}/reports/?page_size=20&tz=Asia/Seoul&child=${childId}`,
    {
      headers: { Cookie: cookie },
    }
  )

  if (!res.ok) {
    // 세션 만료 시 재로그인
    if (res.status === 401 || res.status === 403) {
      cachedSession = null
      const newCookie = await login()
      const retry = await fetch(
        `${KIDSNOTE_BASE}/children/${childId}/reports/?page_size=20&tz=Asia/Seoul&child=${childId}`,
        { headers: { Cookie: newCookie } }
      )
      if (!retry.ok) throw new Error(`키즈노트 API 오류: ${retry.status}`)
      const data = await retry.json()
      return data.results ?? []
    }
    throw new Error(`키즈노트 API 오류: ${res.status}`)
  }

  const data = await res.json()
  return data.results ?? []
}

const REPORT_TYPE_MAP: Record<string, string> = {
  report: '알림장',
  notice: '가정통신문',
  album: '앨범',
  menu: '식단표',
  medication: '투약의뢰',
  absent: '결석/귀가',
}

export function mapReportType(type: string): string {
  return REPORT_TYPE_MAP[type] ?? type
}

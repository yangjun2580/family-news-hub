import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || ''
const LLM_BASE = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
const LLM_MODEL = process.env.LLM_SUMMARIZE_MODEL || 'anthropic/claude-sonnet-4-6'
const SUMMARIZE_SECRET = process.env.SUMMARIZE_SECRET || ''
const BATCH_SIZE = 5

function extractBody(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')

  // 다양한 셀렉터로 본문 추출 시도
  const selectors = [
    /<article[^>]*class=['"][^'"]*story-news[^'"]*['"][^>]*>([\s\S]*?)<\/article>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /class=['"][^'"]*article[_-]?body[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i,
    /class=['"][^'"]*post[_-]?content[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i,
    /class=['"][^'"]*entry[_-]?content[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ]

  for (const sel of selectors) {
    const match = text.match(sel)
    if (match) { text = match[1]; break }
  }

  text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > 3000) text = text.substring(0, 3000)
  return text
}

function isEnglishTitle(title: string): boolean {
  const koreanChars = (title.match(/[가-힣]/g) || []).length
  return koreanChars === 0 && title.trim().length > 3
}

async function summarizeArticle(
  title: string,
  body: string,
  isEng: boolean
): Promise<string> {
  const systemPrompt = `당신은 뉴스 기사 요약 전문가입니다. 반드시 한국어로 요약하세요.`

  const userPrompt = isEng
    ? `다음 영어 기사를 한국어로 요약해주세요.

제목: ${title}
본문: ${body}

지시사항:
1. 첫 줄에 📌 기호와 함께 제목을 자연스러운 한국어로 번역하세요
2. 그 다음 줄부터 기사 핵심 내용을 한국어 6~7줄로 요약하세요
3. 요약은 자연스럽고 읽기 쉬운 한국어로 작성하세요`
    : `다음 기사를 요약해주세요.

제목: ${title}
본문: ${body}

지시사항:
1. 기사 핵심 내용을 한국어 6~7줄로 요약하세요
2. 구체적 수치나 사실 관계를 포함하세요
3. 자연스럽고 읽기 쉬운 한국어로 작성하세요`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (OPENROUTER_KEY) {
    headers['Authorization'] = `Bearer ${OPENROUTER_KEY}`
  }

  const endpoint = LLM_BASE.includes('openrouter') ? `${LLM_BASE}/chat/completions` : `${LLM_BASE}/v1/chat/completions`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  })

  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

export async function POST(req: NextRequest) {
  // 인증 확인
  if (SUMMARIZE_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${SUMMARIZE_SECRET}`) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 2일 이내 요약 없는 기사 조회
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, source_url, summary')
    .is('summary', null)
    .gte('published_at', twoDaysAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(BATCH_SIZE)

  if (error) {
    return NextResponse.json({ error: '기사 조회 실패: ' + error.message }, { status: 500 })
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: '요약할 기사 없음', processed: 0 })
  }

  const results: { id: string; status: string; error?: string }[] = []

  for (const article of articles) {
    try {
      // 기사 HTML 가져오기
      let body = ''
      if (article.source_url) {
        try {
          const htmlRes = await fetch(article.source_url, {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FamilyNewsBot/1.0)' },
          })
          if (htmlRes.ok) {
            const html = await htmlRes.text()
            body = extractBody(html)
          }
        } catch {
          // HTML 가져오기 실패 시 제목만으로 요약
        }
      }

      // 본문이 너무 짧으면 제목만으로 요약
      const isEng = isEnglishTitle(article.title)
      if (body.length < 50) {
        if (isEng) {
          // 영문 제목만 있는 경우 번역만 제공
          const summary = await summarizeArticle(article.title, article.title, true)
          if (summary) {
            await supabase.from('articles').update({ summary, updated_at: new Date().toISOString() }).eq('id', article.id)
            results.push({ id: article.id, status: 'title_only' })
          } else {
            results.push({ id: article.id, status: 'skip', error: '요약 생성 실패' })
          }
        } else {
          results.push({ id: article.id, status: 'skip', error: '본문 부족' })
        }
        continue
      }

      // LLM으로 요약 생성
      const summary = await summarizeArticle(article.title, body, isEng)
      if (!summary) {
        results.push({ id: article.id, status: 'error', error: 'LLM 응답 없음' })
        continue
      }

      // DB 업데이트
      const { error: updateError } = await supabase
        .from('articles')
        .update({ summary, updated_at: new Date().toISOString() })
        .eq('id', article.id)

      if (updateError) {
        results.push({ id: article.id, status: 'error', error: updateError.message })
      } else {
        results.push({ id: article.id, status: 'success' })
      }
    } catch (e) {
      results.push({ id: article.id, status: 'error', error: String(e) })
    }
  }

  return NextResponse.json({
    processed: results.length,
    success: results.filter(r => r.status === 'success' || r.status === 'title_only').length,
    failed: results.filter(r => r.status === 'error').length,
    skipped: results.filter(r => r.status === 'skip').length,
    details: results,
  })
}

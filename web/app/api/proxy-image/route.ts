import { NextRequest, NextResponse } from 'next/server'
import https from 'https'

export const dynamic = 'force-dynamic'

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
        'Referer': 'https://www.kidsnote.com/',
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] ?? 'image/jpeg',
      }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url || !url.startsWith('https://')) {
    return NextResponse.json({ error: '유효하지 않은 URL' }, { status: 400 })
  }

  try {
    const { buffer, contentType } = await fetchImageBuffer(url)
    const filename = url.split('/').pop()?.split('?')[0] ?? 'photo.jpg'
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: '이미지 다운로드 실패' }, { status: 502 })
  }
}

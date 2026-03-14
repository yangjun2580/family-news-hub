import { Article } from '@/lib/supabase'
import { timeAgo, getCategoryConfig } from '@/lib/utils'

type Props = {
  article: Article
  isNew?: boolean
}

function parseTranslation(summary: string | null): { translated: string | null; body: string | null } {
  if (!summary) return { translated: null, body: null }
  if (summary.startsWith('📌')) {
    const newline = summary.indexOf('\n')
    if (newline > 0) {
      return {
        translated: summary.slice(0, newline).replace('📌', '').trim(),
        body: summary.slice(newline + 1).trim(),
      }
    }
    return { translated: summary.replace('📌', '').trim(), body: null }
  }
  return { translated: null, body: summary }
}

function isEnglishTitle(title: string): boolean {
  const koreanChars = (title.match(/[가-힣]/g) || []).length
  return koreanChars === 0 && title.trim().length > 3
}

function getArticleUrl(url: string | null): string {
  if (!url) return '#'
  // 연합뉴스 URL → AMP 버전 (빈 화면 방지)
  if (url.includes('yna.co.kr/view/')) {
    return url.replace('yna.co.kr/view/', 'yna.co.kr/amp/view/')
  }
  return url
}

export default function ArticleCard({ article, isNew }: Props) {
  const cat = getCategoryConfig(article.category)
  const ago = timeAgo(article.published_at)
  const { translated, body } = parseTranslation(article.summary)

  const displayTitle = (isEnglishTitle(article.title) && translated) ? translated : article.title
  const articleUrl = getArticleUrl(article.source_url)

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow)',
        borderLeft: `3px solid ${cat.color}`,
      }}
    >
      {/* Top row: category badge + new badge + time */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
          style={{ color: cat.color, backgroundColor: cat.bg }}
        >
          {cat.label}
        </span>
        {isNew && (
          <span className="new-badge shrink-0 rounded-md bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
            NEW
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          {ago}
        </span>
      </div>

      {/* Title */}
      <h3
        className="mb-1 text-sm font-semibold leading-snug"
        style={{ color: 'var(--text-primary)' }}
      >
        {displayTitle}
      </h3>

      {/* Summary */}
      {body && (
        <p
          className="mb-3 text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {body}
        </p>
      )}

      {/* Bottom: source + 기사 원문보기 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {article.source}
        </span>
        <a
          href={articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded px-1.5 py-0.5 text-xs transition-colors"
          style={{
            color: cat.color,
            backgroundColor: `${cat.bg}99`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          원문 ↗
        </a>
      </div>
    </div>
  )
}

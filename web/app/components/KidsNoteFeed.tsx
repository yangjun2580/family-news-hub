'use client'

import { useEffect, useState } from 'react'
import { KidsNoteEntry } from '@/lib/supabase'
import { timeAgo, getCategoryConfig } from '@/lib/utils'

function KidsNoteCard({ entry }: { entry: KidsNoteEntry }) {
  const cat = getCategoryConfig(entry.report_type)
  const ago = timeAgo(entry.report_date)
  const [expanded, setExpanded] = useState(false)

  const isLong = entry.content.length > 150
  const displayContent = expanded ? entry.content : entry.content.slice(0, 150)

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow)',
        borderLeft: `3px solid ${cat.color}`,
      }}
    >
      {/* Top row */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
          style={{ color: cat.color, backgroundColor: cat.bg }}
        >
          {cat.label}
        </span>
        <span className="ml-auto shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          {ago}
        </span>
      </div>

      {/* Title */}
      <h3
        className="mb-1 text-sm font-semibold leading-snug"
        style={{ color: 'var(--text-primary)' }}
      >
        {entry.title}
      </h3>

      {/* Content */}
      {entry.content && (
        <div className="mb-2">
          <p
            className="whitespace-pre-line text-xs leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {displayContent}
            {isLong && !expanded && '...'}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs font-medium"
              style={{ color: cat.color }}
            >
              {expanded ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      )}

      {/* Photos */}
      {entry.photos && entry.photos.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {entry.photos.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`사진 ${i + 1}`}
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ))}
          {entry.photos.length > 4 && (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg text-xs font-medium"
              style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
            >
              +{entry.photos.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Author */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {entry.author ? `${entry.author} 선생님` : '키즈노트'}
        </span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderLeft: '3px solid var(--border)' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="skeleton h-4 w-16 rounded-md" />
        <div className="skeleton ml-auto h-3 w-10" />
      </div>
      <div className="skeleton mb-1 h-4 w-full" />
      <div className="skeleton mb-1 h-4 w-4/5" />
      <div className="skeleton mt-2 h-3 w-20" />
    </div>
  )
}

export default function KidsNoteFeed() {
  const [entries, setEntries] = useState<KidsNoteEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/kidsnote')
        if (!res.ok) throw new Error('API 오류')
        const data = await res.json()
        setEntries(data.entries ?? [])
      } catch {
        setEntries([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <span className="text-4xl">📋</span>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          아직 알림장이 없어요
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          키즈노트 연동 설정을 확인해 주세요
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-6">
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className="article-enter"
          style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
        >
          <KidsNoteCard entry={entry} />
        </div>
      ))}
    </div>
  )
}

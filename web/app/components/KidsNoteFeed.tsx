'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { KidsNoteEntry } from '@/lib/supabase'
import { timeAgo, getCategoryConfig } from '@/lib/utils'

/* ── 라이트박스 (사진 크게 보기) ── */
function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: string[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)

  // 원본 URL (large_resize → large 또는 original)
  const fullUrl = photos[idx].replace('/img_640_resize.jpg', '/img_l.jpg')

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx((i) => Math.min(photos.length - 1, i + 1)), [photos.length])

  // 키보드
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  // 터치 스와이프
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
  }
  const onTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }
  const onTouchEnd = () => {
    if (touchDeltaX.current > 60) prev()
    else if (touchDeltaX.current < -60) next()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 상단 카운터 + 닫기 */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2 z-10">
        <span className="text-sm font-medium text-white/80">
          {idx + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:bg-white/10"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 사진 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fullUrl}
        alt={`사진 ${idx + 1}`}
        className="max-h-[85vh] max-w-[95vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* 좌우 버튼 (데스크탑) */}
      {idx > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white active:bg-black/60"
          onClick={(e) => { e.stopPropagation(); prev() }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </button>
      )}
      {idx < photos.length - 1 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white active:bg-black/60"
          onClick={(e) => { e.stopPropagation(); next() }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M7 4l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ── 사진 갤러리 (횡스크롤 썸네일) ── */
function PhotoGallery({ photos }: { photos: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollPos, setScrollPos] = useState(0)
  const [maxScroll, setMaxScroll] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setScrollPos(el.scrollLeft)
      setMaxScroll(el.scrollWidth - el.clientWidth)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [photos])

  return (
    <>
      <div className="relative mb-2 -mx-4">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto px-4 pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {photos.map((url, i) => (
            <button
              key={i}
              className="shrink-0 snap-start"
              onClick={() => setLightboxIdx(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`사진 ${i + 1}`}
                className="h-48 w-48 rounded-xl object-cover transition-transform active:scale-95"
                loading="lazy"
              />
            </button>
          ))}
        </div>

        {photos.length > 2 && (
          <div className="flex items-center justify-center gap-1 pt-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {Math.min(Math.floor(scrollPos / 200) + 2, photos.length)}/{photos.length}
            </span>
            <div
              className="ml-1 h-1 w-12 overflow-hidden rounded-full"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  background: 'var(--text-muted)',
                  width: maxScroll > 0 ? `${Math.max(20, (scrollPos / maxScroll) * 100)}%` : '100%',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
}

/* ── 알림장 카드 ── */
function KidsNoteCard({ entry }: { entry: KidsNoteEntry }) {
  const cat = getCategoryConfig(entry.report_type)
  const ago = timeAgo(entry.report_date)
  const [expanded, setExpanded] = useState(false)

  const isLong = entry.content.length > 150
  const displayContent = expanded ? entry.content : entry.content.slice(0, 150)
  const hasPhotos = entry.photos && entry.photos.length > 0

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow)',
        borderLeft: `3px solid ${cat.color}`,
      }}
    >
      <div className="p-4 pb-2">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ color: cat.color, backgroundColor: cat.bg }}
          >
            {cat.label}
          </span>
          {hasPhotos && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {entry.photos.length}장
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            {ago}
          </span>
        </div>

        <h3
          className="mb-1 text-sm font-semibold leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {entry.title}
        </h3>

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
      </div>

      {hasPhotos && <PhotoGallery photos={entry.photos} />}

      <div className="px-4 pb-3">
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
      <div className="flex gap-2 mt-2">
        <div className="skeleton h-32 w-32 rounded-xl" />
        <div className="skeleton h-32 w-32 rounded-xl" />
      </div>
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

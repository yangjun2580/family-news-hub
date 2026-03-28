'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

async function savePhotoToGallery(proxyUrl: string, filename: string) {
  const res = await fetch(proxyUrl)
  const blob = await res.blob()
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })

  // 모바일: Web Share API로 네이티브 사진앱/갤러리에 저장
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: '이준이 사진' })
    return
  }

  // 데스크탑 fallback: 파일 다운로드
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
import { createPortal } from 'react-dom'
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
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(fullUrl)}`
  const filename = fullUrl.split('/').pop()?.split('?')[0] ?? 'photo.jpg'

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
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)', zIndex: 9999 }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 상단 버튼 — 닫기(우) + 다운로드(좌) */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,0.5)', zIndex: 10000 }}
      >
        <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2L2 12M2 2l10 10" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); savePhotoToGallery(proxyUrl, filename) }}
        className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,0.5)', zIndex: 10000 }}
      >
        <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2v8M4 7l3 3 3-3M2 12h10" />
        </svg>
      </button>

      {/* 카운터 — 하단 중앙 */}
      <div className="absolute bottom-4 left-0 right-0 text-center" style={{ zIndex: 10000 }}>
        <span className="rounded-full px-3 py-1 text-xs text-white/70" style={{ background: 'rgba(0,0,0,0.4)' }}>
          {idx + 1} / {photos.length}
        </span>
      </div>

      {/* 사진 — 프록시 URL 사용: 길게 누르기 → iOS "사진에 저장" / Android "이미지 저장" */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyUrl}
        alt={`사진 ${idx + 1}`}
        className="max-h-[90vh] max-w-[100vw] object-contain"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
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

      {lightboxIdx !== null && createPortal(
        <Lightbox
          photos={photos}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />,
        document.body
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

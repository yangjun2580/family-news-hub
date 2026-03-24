'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Article } from '@/lib/supabase'
import ProfileTabs from './ProfileTabs'

const EnvWidgets = dynamic(() => import('./EnvWidgets'), {
  loading: () => <div className="flex gap-3 px-4 pb-2"><div className="skeleton h-24 w-40 rounded-xl" /><div className="skeleton h-24 w-48 rounded-xl" /></div>,
})

const ArticleFeed = dynamic(() => import('./ArticleFeed'), {
  loading: () => (
    <div className="flex flex-col gap-3 px-4 pb-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderLeft: '3px solid var(--border)' }}>
          <div className="mb-2 flex items-center gap-2"><div className="skeleton h-4 w-16 rounded-md" /><div className="skeleton ml-auto h-3 w-10" /></div>
          <div className="skeleton mb-1 h-4 w-full" /><div className="skeleton mb-1 h-4 w-4/5" /><div className="skeleton mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  ),
})

const PROFILE_IDS = ['all', 'dad', 'mom', 'junhyeok', 'minhyuk']

type Props = {
  initialArticles: Article[]
}

export default function NewsFeedPage({ initialArticles }: Props) {
  const [profile, setProfile] = useState('all')
  const [lastUpdate, setLastUpdate] = useState('')
  const [isLive, setIsLive] = useState(false)

  // Swipe state
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)

  // 새로고침 후 탭 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('profile')
    if (saved) setProfile(saved)
  }, [])

  const handleProfileChange = useCallback((id: string) => {
    setProfile(id)
    sessionStorage.setItem('profile', id)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    setLastUpdate(fmt())
    setIsLive(true)
    const t = setInterval(() => setLastUpdate(fmt()), 60000)
    return () => clearInterval(t)
  }, [])

  // Swipe handlers for tab switching
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // Only trigger if horizontal swipe > 80px and more horizontal than vertical
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.5) return

    const currentIdx = PROFILE_IDS.indexOf(profile)
    if (dx < 0 && currentIdx < PROFILE_IDS.length - 1) {
      handleProfileChange(PROFILE_IDS[currentIdx + 1])
    } else if (dx > 0 && currentIdx > 0) {
      handleProfileChange(PROFILE_IDS[currentIdx - 1])
    }
  }, [profile, handleProfileChange])

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <header
        className="sticky top-0 z-20 pb-0"
        style={{ background: 'var(--bg)' }}
      >
        {/* App title */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏡</span>
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              우리 집 뉴스
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {lastUpdate ? `${lastUpdate} 업데이트` : '실시간'}
            </span>
          </div>
        </div>

        {/* Profile tabs */}
        <ProfileTabs active={profile} onChange={handleProfileChange} />

        {/* Thin divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
      </header>

      {/* Swipeable content area */}
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Env widgets */}
        <div className="pt-3">
          <EnvWidgets profile={profile} />
        </div>

        {/* Section label */}
        <div className="px-4 pb-2 pt-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            최신 뉴스
          </h2>
        </div>

        {/* Article feed */}
        <ArticleFeed
          profile={profile}
          initialArticles={profile === 'all' ? initialArticles : []}
          onNewArticle={() => setLastUpdate(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))}
        />
      </div>
    </div>
  )
}

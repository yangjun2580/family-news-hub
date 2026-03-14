'use client'

import { useState, useEffect } from 'react'
import { Article } from '@/lib/supabase'
import ProfileTabs from './ProfileTabs'
import EnvWidgets from './EnvWidgets'
import ArticleFeed from './ArticleFeed'

type Props = {
  initialArticles: Article[]
}

export default function NewsFeedPage({ initialArticles }: Props) {
  const [profile, setProfile] = useState('all')
  const [lastUpdate, setLastUpdate] = useState('')
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    setLastUpdate(fmt())
    setIsLive(true)
    const t = setInterval(() => setLastUpdate(fmt()), 60000)
    return () => clearInterval(t)
  }, [])

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
        <ProfileTabs active={profile} onChange={setProfile} />

        {/* Thin divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
      </header>

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
  )
}

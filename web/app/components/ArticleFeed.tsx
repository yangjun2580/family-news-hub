'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, Article } from '@/lib/supabase'
import ArticleCard from './ArticleCard'

const PAGE_SIZE = 20

function getTwoDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return d.toISOString()
}

type Props = {
  profile: string
  initialArticles: Article[]
  onNewArticle?: () => void
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

// 프로필별 캐시 (탭 전환 지연 감소)
const profileCache = new Map<string, { articles: Article[]; ts: number }>()
const CACHE_TTL = 60000 // 1분

export default function ArticleFeed({ profile, initialArticles, onNewArticle }: Props) {
  // 2일 이내 기사만 필터
  const filtered = initialArticles.filter(a => a.published_at >= getTwoDaysAgo())
  const [articles, setArticles] = useState<Article[]>(filtered)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(filtered.length === PAGE_SIZE)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [fetchedOnce, setFetchedOnce] = useState(profile === 'all' && filtered.length > 0)
  const pageRef = useRef(1)
  const isInitialMount = useRef(true)
  const currentProfileRef = useRef(profile)

  // Reload when profile changes
  useEffect(() => {
    currentProfileRef.current = profile

    if (isInitialMount.current) {
      isInitialMount.current = false
      if (profile === 'all' && filtered.length > 0) {
        profileCache.set('all', { articles: filtered, ts: Date.now() })
        setFetchedOnce(true)
        return
      }
    }

    // 캐시 확인
    const cached = profileCache.get(profile)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setArticles(cached.articles)
      setHasMore(cached.articles.length === PAGE_SIZE)
      setFetchedOnce(true)
      return
    }

    // 새 프로필: 로딩 상태로 전환 (빈 상태 플래시 방지)
    setLoading(true)
    setArticles([])

    const abortController = new AbortController()

    async function reload() {
      pageRef.current = 1
      const twoDaysAgo = getTwoDaysAgo()

      let query = supabase
        .from('articles')
        .select('*')
        .gte('published_at', twoDaysAgo)
        .order('published_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (profile !== 'all') {
        query = query.contains('profiles', [profile])
      }

      const { data } = await query

      // 프로필이 변경됐으면 결과 무시 (stale closure 방지)
      if (abortController.signal.aborted || currentProfileRef.current !== profile) return

      const result = data ?? []
      setArticles(result)
      setHasMore(result.length === PAGE_SIZE)
      profileCache.set(profile, { articles: result, ts: Date.now() })
      setLoading(false)
      setFetchedOnce(true)
    }
    reload()

    return () => { abortController.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`articles-realtime-${profile}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'articles' },
        (payload) => {
          const newArticle = payload.new as Article
          if (profile !== 'all' && !newArticle.profiles?.includes(profile)) return
          setArticles((prev) => {
            if (prev.find((a) => a.id === newArticle.id)) return prev
            return [newArticle, ...prev]
          })
          setNewIds((prev) => new Set([...prev, newArticle.id]))
          onNewArticle?.()
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev)
              next.delete(newArticle.id)
              return next
            })
          }, 10000)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // UPDATE 이벤트 구독 — 요약이 추가될 때 실시간 반영
  useEffect(() => {
    const channel = supabase
      .channel(`articles-updates-${profile}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'articles' },
        (payload) => {
          const updated = payload.new as Article
          setArticles((prev) =>
            prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const loadMore = useCallback(async () => {
    setLoading(true)
    const page = pageRef.current + 1
    const offset = page * PAGE_SIZE - PAGE_SIZE
    const twoDaysAgo = getTwoDaysAgo()

    let query = supabase
      .from('articles')
      .select('*')
      .gte('published_at', twoDaysAgo)
      .order('published_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (profile !== 'all') {
      query = query.contains('profiles', [profile])
    }

    const { data } = await query
    const newData = data ?? []
    setArticles((prev) => {
      const ids = new Set(prev.map((a) => a.id))
      return [...prev, ...newData.filter((a) => !ids.has(a.id))]
    })
    setHasMore(newData.length === PAGE_SIZE)
    pageRef.current = page
    setLoading(false)
  }, [profile])

  // 로딩 중이거나 아직 첫 fetch가 안됐으면 스켈레톤 표시
  if (loading || !fetchedOnce) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <span className="text-4xl">📭</span>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>최근 2일간 기사가 없어요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-6">
      {articles.map((article, i) => (
        <div
          key={article.id}
          className="article-enter"
          style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
        >
          <ArticleCard article={article} isNew={newIds.has(article.id)} />
        </div>
      ))}

      {loading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {!loading && hasMore && (
        <button
          onClick={loadMore}
          className="mt-2 w-full rounded-xl py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98]"
          style={{
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow)',
          }}
        >
          더 불러오기
        </button>
      )}

      {!loading && !hasMore && articles.length > 0 && (
        <p className="py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          모든 기사를 불러왔어요
        </p>
      )}
    </div>
  )
}

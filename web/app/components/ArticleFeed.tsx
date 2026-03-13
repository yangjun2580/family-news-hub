'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, Article } from '@/lib/supabase'
import ArticleCard from './ArticleCard'

const PAGE_SIZE = 20

type Props = {
  profile: string
  initialArticles: Article[]
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

export default function ArticleFeed({ profile, initialArticles }: Props) {
  const [articles, setArticles] = useState<Article[]>(initialArticles)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialArticles.length === PAGE_SIZE)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const pageRef = useRef(1)
  const isInitialMount = useRef(true)

  // Reload when profile changes (skip first render for 'all' - use SSR data)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (profile === 'all' && initialArticles.length > 0) return
    }
    async function reload() {
      setLoading(true)
      pageRef.current = 1
      let query = supabase
        .from('articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (profile !== 'all') {
        query = query.contains('profiles', [profile])
      }

      const { data } = await query
      setArticles(data ?? [])
      setHasMore((data?.length ?? 0) === PAGE_SIZE)
      setLoading(false)
    }
    reload()
  }, [profile])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('articles-realtime')
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
  }, [profile])

  const loadMore = useCallback(async () => {
    setLoading(true)
    const page = pageRef.current + 1
    const offset = page * PAGE_SIZE - PAGE_SIZE

    let query = supabase
      .from('articles')
      .select('*')
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

  if (!loading && articles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <span className="text-4xl">📭</span>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>아직 기사가 없어요</p>
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

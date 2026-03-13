import { createClient } from '@supabase/supabase-js'
import { Article } from '@/lib/supabase'
import NewsFeedPage from './components/NewsFeedPage'

async function getInitialArticles(): Promise<Article[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('articles')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(20)

  return data ?? []
}

export const revalidate = 300

export default async function Home() {
  const initialArticles = await getInitialArticles()
  return <NewsFeedPage initialArticles={initialArticles} />
}

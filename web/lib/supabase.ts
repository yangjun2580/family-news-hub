import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Article = {
  id: string
  title: string
  summary: string | null
  source: string
  source_url: string
  category: string
  region: string
  is_x_post: boolean
  profiles: string[]
  feed_url: string
  original_guid: string
  published_at: string
  created_at: string
}

export type Profile = {
  id: string
  name: string
  icon: string
  categories: string[]
  feeds: Record<string, unknown>
}

export type WeatherCache = {
  id: number
  station: string
  temp: number | null
  temp_high: number | null
  temp_low: number | null
  sky: string | null
  humidity: number | null
  wind_dir: string | null
  wind_speed: number | null
  pop: number | null
  pty: string | null
  fetched_at: string
}

export type DustCache = {
  id: number
  station: string
  pm10: number | null
  pm25: number | null
  fetched_at: string
}

export type FuelCache = {
  id: number
  diesel: number | null
  gasoline: number | null
  lpg: number | null
  diesel_chg: number | null
  gasoline_chg: number | null
  lpg_chg: number | null
  region: string
  fetched_at: string
}

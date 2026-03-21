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
  sky: number | string | null
  humidity: number | null
  wind_dir: number | string | null
  wind_speed: number | null
  pop: number | null
  pty: number | string | null
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

export type TrafficFlow = {
  id: number
  link_id: string
  road_name: string | null
  road_type: string
  speed: number
  travel_time: number | null
  direction: string | null
  coord_x: number | null
  coord_y: number | null
  source_created_at: string | null
  fetched_at: string
}

export type TrafficIncident = {
  id: number
  incident_id: string | null
  incident_type: string
  road_name: string | null
  road_type: string | null
  description: string | null
  start_date: string | null
  end_date: string | null
  coord_x: number
  coord_y: number
  congestion_length: number | null
  is_active: boolean
  fetched_at: string
}

export type TrafficCctv = {
  id: number
  cctv_name: string
  cctv_url: string
  cctv_type: number
  road_section_id: string | null
  road_type: string | null
  coord_x: number
  coord_y: number
  resolution: string | null
  fetched_at: string
}

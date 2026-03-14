'use client'

import { useEffect, useState } from 'react'
import { supabase, WeatherCache, DustCache, FuelCache } from '@/lib/supabase'

const SKY_EMOJI: Record<string, string> = {
  '1': '☀️', '2': '⛅', '3': '🌤️', '4': '☁️',
}
const PTY_EMOJI: Record<string, string> = {
  '1': '🌧️', '2': '🌨️', '3': '❄️', '4': '🌦️',
}

function getDustLevel(pm25: number | null): { label: string; color: string } {
  if (pm25 === null) return { label: '–', color: '#9CA3AF' }
  if (pm25 <= 15) return { label: '좋음', color: '#10B981' }
  if (pm25 <= 35) return { label: '보통', color: '#F59E0B' }
  if (pm25 <= 75) return { label: '나쁨', color: '#EF4444' }
  return { label: '매우나쁨', color: '#7C3AED' }
}

function ChangeArrow({ val }: { val: number | null }) {
  if (val === null || val === 0) return <span className="text-xs text-gray-400">–</span>
  const up = val > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-red-500' : 'text-blue-500'}`}>
      {up ? '▲' : '▼'}{Math.abs(val)}
    </span>
  )
}

function EmptyWidget({ label }: { label: string }) {
  return (
    <div
      className="flex min-w-[140px] flex-col gap-1 rounded-xl p-3"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>수집 중...</p>
    </div>
  )
}

function SkeletonWidget() {
  return (
    <div
      className="flex min-w-[140px] flex-col gap-2 rounded-xl p-3"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      <div className="skeleton h-3 w-16" />
      <div className="skeleton h-6 w-20" />
      <div className="skeleton h-3 w-24" />
    </div>
  )
}

type Props = {
  profile: string
}

export default function EnvWidgets({ profile }: Props) {
  const [weather, setWeather] = useState<WeatherCache | null>(null)
  const [dust, setDust] = useState<DustCache | null>(null)
  const [fuel, setFuel] = useState<FuelCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationLabel, setLocationLabel] = useState<string>('내 위치')

  useEffect(() => {
    async function fetchWithLocation(lat: number, lon: number) {
      try {
        const res = await fetch(`/api/env-data?lat=${lat}&lon=${lon}`)
        if (!res.ok) throw new Error('API 오류')
        const data = await res.json()
        setWeather(data.weather)
        setDust(data.dust)
        setFuel(data.fuel)
        if (data.locationName) setLocationLabel(`현재 위치(${data.locationName})`)
      } catch {
        // 위치 기반 실패 시 DB 캐시 fallback
        await fetchFromDB()
      } finally {
        setLoading(false)
      }
    }

    async function fetchFromDB() {
      const [{ data: w }, { data: d }, { data: f }] = await Promise.all([
        supabase.from('weather_cache').select('*').order('fetched_at', { ascending: false }).limit(1),
        supabase.from('dust_cache').select('*').order('fetched_at', { ascending: false }).limit(1),
        supabase.from('fuel_cache').select('*').order('fetched_at', { ascending: false }).limit(1),
      ])
      setWeather(w?.[0] ?? null)
      setDust(d?.[0] ?? null)
      setFuel(f?.[0] ?? null)
      setLoading(false)
    }

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setLocationLabel('현재 위치')
          fetchWithLocation(latitude, longitude)
        },
        () => {
          // 위치 거부 시 DB 캐시
          fetchFromDB()
        },
        { timeout: 5000, maximumAge: 300000 }
      )
    } else {
      fetchFromDB()
    }
  }, [])

  const weatherEmoji =
    weather?.pty && String(weather.pty) !== '0'
      ? PTY_EMOJI[String(weather.pty)] ?? '🌧️'
      : SKY_EMOJI[String(weather?.sky ?? '')] ?? '🌤️'

  const dustLevel = getDustLevel(dust?.pm25 ?? null)
  const showFuel = profile === 'dad'

  return (
    <div className="tabs-scroll flex gap-3 overflow-x-auto px-4 pb-2">
      {/* Weather */}
      {loading ? <SkeletonWidget /> : !weather ? <EmptyWidget label="날씨" /> : (
        <div
          className="flex min-w-[160px] flex-col gap-1 rounded-xl p-3"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            날씨 · {locationLabel}
          </p>
          <div className="flex items-end gap-1.5">
            <span className="text-2xl">{weatherEmoji}</span>
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {weather.temp != null ? `${weather.temp}°` : '–'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            최고 {weather.temp_high ?? '–'}° · 최저 {weather.temp_low ?? '–'}°
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            습도 {weather.humidity ?? '–'}% · 강수 {weather.pop ?? 0}%
          </p>
        </div>
      )}

      {/* Dust */}
      {loading ? <SkeletonWidget /> : !dust ? <EmptyWidget label="미세먼지" /> : (
        <div
          className="flex min-w-[140px] flex-col gap-1 rounded-xl p-3"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            미세먼지 · {dust.station}
          </p>
          <span
            className="w-fit rounded-md px-2 py-0.5 text-sm font-bold text-white"
            style={{ backgroundColor: dustLevel.color }}
          >
            {dustLevel.label}
          </span>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            PM2.5: {dust.pm25 ?? '–'} μg/m³
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            PM10: {dust.pm10 ?? '–'} μg/m³
          </p>
        </div>
      )}

      {/* Fuel - 아빠 탭에서만 표시 */}
      {showFuel && (
        loading ? <SkeletonWidget /> : !fuel ? <EmptyWidget label="유가" /> : (
          <div
            className="flex min-w-[160px] flex-col gap-1 rounded-xl p-3"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              유가 · {fuel.region}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>휘발유</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {fuel.gasoline ? `${fuel.gasoline.toLocaleString()}원` : '–'}
                </span>
                <ChangeArrow val={fuel.gasoline_chg ?? null} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>경유</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {fuel.diesel ? `${fuel.diesel.toLocaleString()}원` : '–'}
                </span>
                <ChangeArrow val={fuel.diesel_chg ?? null} />
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

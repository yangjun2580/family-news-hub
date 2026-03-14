'use client'

import { PROFILE_COLORS } from '@/lib/utils'

type ProfileTab = {
  id: string
  name: string
  emoji: string
  gradient: string
}

const PROFILES: ProfileTab[] = [
  {
    id: 'all',
    name: '전체',
    emoji: '🏡',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'dad',
    name: '아빠',
    emoji: '💼',
    gradient: 'linear-gradient(135deg, #2196F3 0%, #0D47A1 100%)',
  },
  {
    id: 'mom',
    name: '엄마',
    emoji: '🌸',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #c2185b 100%)',
  },
  {
    id: 'junhyeok',
    name: '준혁',
    emoji: '🎧',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #0f9b58 100%)',
  },
  {
    id: 'minhyuk',
    name: '민혁',
    emoji: '⚽',
    gradient: 'linear-gradient(135deg, #fa8231 0%, #e55039 100%)',
  },
]

type Props = {
  active: string
  onChange: (id: string) => void
}

export default function ProfileTabs({ active, onChange }: Props) {
  return (
    <div className="tabs-scroll flex gap-2 overflow-x-auto px-4 py-3">
      {PROFILES.map((p) => {
        const isActive = p.id === active
        const color = PROFILE_COLORS[p.id]
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            style={
              isActive
                ? { backgroundColor: color, color: '#fff', borderColor: color }
                : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
            }
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm"
              style={{
                background: p.gradient,
                boxShadow: isActive
                  ? '0 2px 8px rgba(0,0,0,0.25)'
                  : '0 1px 4px rgba(0,0,0,0.15)',
              }}
            >
              {p.emoji}
            </span>
            <span>{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}

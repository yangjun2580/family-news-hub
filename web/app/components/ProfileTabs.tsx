'use client'

import { PROFILE_COLORS } from '@/lib/utils'

type ProfileTab = {
  id: string
  name: string
  icon: string
}

const PROFILES: ProfileTab[] = [
  { id: 'all',      name: '전체',  icon: '🏠' },
  { id: 'dad',      name: '아빠',  icon: '👨' },
  { id: 'mom',      name: '엄마',  icon: '👩' },
  { id: 'junhyeok', name: '준혁',  icon: '👦' },
  { id: 'minhyuk',  name: '민혁',  icon: '🧒' },
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
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200"
          >
            <span>{p.icon}</span>
            <span>{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}

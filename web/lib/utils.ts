export function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return '방금 전'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}달 전`
  return `${Math.floor(months / 12)}년 전`
}

export const CATEGORY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'AI/Tech': { color: '#2563EB', bg: '#EFF6FF', label: 'AI/테크' },
  'AI/Tech/글로벌': { color: '#2563EB', bg: '#EFF6FF', label: 'AI/테크' },
  'IT/Tech': { color: '#0891B2', bg: '#ECFEFF', label: 'IT/테크' },
  'IT/Tech/국내': { color: '#0891B2', bg: '#ECFEFF', label: 'IT/테크' },
  '경제': { color: '#059669', bg: '#ECFDF5', label: '경제' },
  '경제/국내': { color: '#059669', bg: '#ECFDF5', label: '경제' },
  '글로벌경제': { color: '#0284C7', bg: '#F0F9FF', label: '글로벌경제' },
  '건강': { color: '#DB2777', bg: '#FDF2F8', label: '건강' },
  '건강/국내': { color: '#DB2777', bg: '#FDF2F8', label: '건강' },
  '스포츠': { color: '#EA580C', bg: '#FFF7ED', label: '스포츠' },
  '스포츠/국내': { color: '#EA580C', bg: '#FFF7ED', label: '스포츠' },
  '크립토': { color: '#7C3AED', bg: '#F5F3FF', label: '크립토' },
  '크립토/국내': { color: '#7C3AED', bg: '#F5F3FF', label: '크립토' },
  '종합': { color: '#4B5563', bg: '#F9FAFB', label: '종합' },
  '종합/국내': { color: '#4B5563', bg: '#F9FAFB', label: '종합' },
  '사회': { color: '#DC2626', bg: '#FEF2F2', label: '사회' },
  '사회/국내': { color: '#DC2626', bg: '#FEF2F2', label: '사회' },
  '관광버스': { color: '#CA8A04', bg: '#FEFCE8', label: '관광버스' },
  '관광버스/국내': { color: '#CA8A04', bg: '#FEFCE8', label: '관광버스' },
}

export function getCategoryConfig(category: string) {
  return (
    CATEGORY_CONFIG[category] ||
    CATEGORY_CONFIG[category + '/국내'] ||
    { color: '#6B7280', bg: '#F3F4F6', label: category }
  )
}

export const PROFILE_COLORS: Record<string, string> = {
  all: '#374151',
  dad: '#1D4ED8',
  mom: '#BE185D',
  minhyuk: '#059669',
  junhyeok: '#7C3AED',
}

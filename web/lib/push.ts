import webpush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@family-news-hub.local'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export { webpush, VAPID_PUBLIC_KEY }

export type PushPayload = {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

export function buildNotification(payload: PushPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    data: {
      url: payload.url || '/',
    },
    tag: payload.tag || 'news-update',
  })
}

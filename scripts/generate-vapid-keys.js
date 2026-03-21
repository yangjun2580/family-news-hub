#!/usr/bin/env node
/**
 * VAPID 키 쌍 생성 스크립트
 * 사용: node scripts/generate-vapid-keys.js
 *
 * 생성된 키를 .env.local에 추가:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
 *   VAPID_PRIVATE_KEY=<private key>
 *   VAPID_SUBJECT=mailto:your@email.com
 */
const webpush = require('web-push')

const vapidKeys = webpush.generateVAPIDKeys()

console.log('VAPID Keys Generated:\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
console.log(`VAPID_SUBJECT=mailto:admin@family-news-hub.local`)
console.log('\n위 값들을 .env.local 파일에 추가하세요.')

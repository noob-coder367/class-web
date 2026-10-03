/* Service Worker — app shell/offline entry + Web Push cho 10A4 */
const CACHE_NAME = 'classweb-app-shell-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/favicon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('classweb-app-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => {})
        return response
      }).catch(() => caches.match('/index.html'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'font')) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
      }
      return response
    }))
  )
})

function pickReceipt(data) {
  const nested = data && typeof data.data === 'object' ? data.data : {}
  const token = data?.__pushReceiptToken || nested.__pushReceiptToken || ''
  const url = data?.__pushReceiptUrl || nested.__pushReceiptUrl || ''
  return { token, url }
}

function publicNotificationData(data) {
  const nested = data && typeof data.data === 'object' ? { ...data.data } : {}
  delete nested.__pushReceiptToken
  delete nested.__pushReceiptUrl
  return { url: data.url || '/#/classroom/announcements', ...nested }
}

async function sendPushReceipt(token, url) {
  if (!token || !url) return
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiptToken: token }), keepalive: true })
  } catch { console.error('[sw] gửi receipt thất bại') }
}

self.addEventListener('push', (event) => {
  let data = { title: '10A4', body: 'Có cập nhật mới.', url: '/#/classroom/announcements', tag: 'class-web', urgency: 'normal', requireInteraction: false }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch { try { data.body = event.data.text() } catch { /* ignore */ } }
  const isUrgent = data.urgency === 'high' || data.urgency === 'urgent' || data.requireInteraction
  const { token: receiptToken, url: receiptUrl } = pickReceipt(data)
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) client.postMessage({ type: 'CLASS_REFRESH', data: data.data || {}, url: data.url })
    await self.registration.showNotification(data.title || '10A4', {
      body: data.body || '', icon: '/favicon.png', badge: '/favicon.png', tag: data.tag || 'class-web', renotify: true,
      requireInteraction: Boolean(isUrgent), silent: false, vibrate: isUrgent ? [200, 100, 200, 100, 200] : [100, 50, 100], data: publicNotificationData(data),
    })
    await sendPushReceipt(receiptToken, receiptUrl)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/#/classroom/announcements'
  const absolute = new URL(targetUrl, self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) { client.focus(); client.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl }); client.postMessage({ type: 'CLASS_REFRESH' }); return }
    }
    if (self.clients.openWindow) return self.clients.openWindow(absolute)
  }))
})

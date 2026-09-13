/* Service Worker — Web Push cho 10A4 */
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {
    title: '10A4',
    body: 'Có cập nhật mới.',
    url: '/#/classroom/announcements',
    tag: 'class-web',
  }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    }
  } catch {
    try {
      data.body = event.data.text()
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    (async () => {
      // Báo mọi tab đang mở reload nội dung lớp ngay (không cần click noti)
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clients) {
        client.postMessage({
          type: 'CLASS_REFRESH',
          data: data.data || {},
          url: data.url,
        })
      }

      await self.registration.showNotification(data.title || '10A4', {
        body: data.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: data.tag || 'class-web',
        renotify: true,
        data: {
          url: data.url || '/#/classroom/announcements',
          ...(data.data || {}),
        },
      })
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    '/#/classroom/announcements'
  const absolute = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl })
          client.postMessage({ type: 'CLASS_REFRESH' })
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute)
      }
    })
  )
})

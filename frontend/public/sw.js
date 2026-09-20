/* Service Worker — Web Push cho 10A4 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
  return {
    url: data.url || '/#/classroom/announcements',
    ...nested,
  }
}

async function sendPushReceipt(token, url) {
  if (!token || !url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptToken: token }),
      keepalive: true,
    })
  } catch {
    console.error('[sw] gửi receipt thất bại')
  }
}

self.addEventListener('push', (event) => {
  let data = {
    title: '10A4',
    body: 'Có cập nhật mới.',
    url: '/#/classroom/announcements',
    tag: 'class-web',
    urgency: 'normal',
    requireInteraction: false,
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

  const isUrgent = data.urgency === 'high' || data.urgency === 'urgent' || data.requireInteraction
  const { token: receiptToken, url: receiptUrl } = pickReceipt(data)

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
        // Khẩn cấp: giữ noti trên màn hình cho đến khi user tương tác (nếu trình duyệt hỗ trợ)
        requireInteraction: Boolean(isUrgent),
        // Một số trình duyệt/Android dùng silent=false + vibrate để nổi bật
        silent: false,
        vibrate: isUrgent ? [200, 100, 200, 100, 200] : [100, 50, 100],
        data: publicNotificationData(data),
      })

      // Telemetry — lỗi receipt không được làm hỏng notification.
      await sendPushReceipt(receiptToken, receiptUrl)
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

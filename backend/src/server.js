import { createApp } from './app.js'
import { env } from './config/env.js'
import { startCleaningDutyPushScheduler } from './services/cleaningDutyPush.service.js'
import { startExamReminderScheduler } from './services/examReminder.service.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`[class-web backend] listening on port ${env.PORT} (${env.NODE_ENV})`)
  // Web Push nhắc lịch trực vệ sinh: 17:00 hôm trước + 05:45 sáng ngày trực
  try {
    startCleaningDutyPushScheduler()
  } catch (err) {
    console.warn('[server] không khởi động cleaningDutyPush scheduler:', err?.message || err)
  }
  // Nhắc kiểm tra: 00:00 đẩy thông báo hôm nay, 17:00 gỡ khỏi Thông báo chung
  try {
    startExamReminderScheduler()
  } catch (err) {
    console.warn('[server] không khởi động examReminder scheduler:', err?.message || err)
  }
})

// Render / proxy cắt kết nối ~60s. Giữ keep-alive lâu hơn một chút
// để tránh đóng nhầm khi cả lớp cùng poll.
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
server.timeout = 30_000
server.requestTimeout = 30_000

import { createApp } from './app.js'
import { env } from './config/env.js'
import { startCleaningDutyPushScheduler } from './services/cleaningDutyPush.service.js'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(`[class-web backend] listening on port ${env.PORT} (${env.NODE_ENV})`)
  // Web Push nhắc lịch trực vệ sinh: 17:00 hôm trước + 05:45 sáng ngày trực
  try {
    startCleaningDutyPushScheduler()
  } catch (err) {
    console.warn('[server] không khởi động cleaningDutyPush scheduler:', err?.message || err)
  }
})

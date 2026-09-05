import { createApp } from './app.js'
import { env } from './config/env.js'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(`[class-web backend] listening on port ${env.PORT} (${env.NODE_ENV})`)
})

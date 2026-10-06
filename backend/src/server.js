import { createApp } from './app.js'
import { env } from './config/env.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`[quizly API] listening on port ${env.PORT} (${env.NODE_ENV})`)
})

server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
server.timeout = 30_000
server.requestTimeout = 30_000

import { createApp } from './app.js'
import { env } from './config/env.js'
import { listGeminiModels } from './services/ai/geminiProvider.js'

const app = createApp()

if (env.GEMINI_API_KEY) {
  listGeminiModels({ apiKey: env.GEMINI_API_KEY })
    .then((models) => console.info('[ai:gemini] startup configuration', { model: env.GEMINI_MODEL, models }))
    .catch((error) => console.error('[ai:gemini] startup models.list failed', { model: env.GEMINI_MODEL, message: error.message }))
}

const server = app.listen(env.PORT, () => {
  console.log(`[quizly API] listening on port ${env.PORT} (${env.NODE_ENV})`)
})

server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
server.timeout = 30_000
server.requestTimeout = 30_000

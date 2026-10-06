import { env } from '../config/env.js'
import { startAiGradingWorker } from '../services/ai-grading/index.js'

if (!env.AI_GRADING_ENABLED) {
  console.log('[ai-grading-worker] disabled by AI_GRADING_ENABLED')
  process.exit(0)
}

const stop = startAiGradingWorker({ workerId: `ai-worker-${process.pid}` })
let closing = false
async function shutdown(signal) {
  if (closing) return
  closing = true
  console.log(`[ai-grading-worker] shutting down (${signal})`)
  stop?.()
  await new Promise((resolve) => setTimeout(resolve, 100))
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('uncaughtException', (error) => console.error('[ai-grading-worker] uncaught exception', { message: error?.message || String(error) }))
process.on('unhandledRejection', (error) => console.error('[ai-grading-worker] unhandled rejection', { message: error?.message || String(error) }))

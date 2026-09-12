import webpush from 'web-push'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'
import { AppError } from './auth.service.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'push-subscriptions.json'

let memoryCache = null
let vapidReady = false

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

function ensureVapid() {
  if (vapidReady) return true
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('[push] Thiếu VAPID keys — bỏ qua gửi Web Push.')
    return false
  }
  webpush.setVapidDetails(
    env.VAPID_SUBJECT || 'mailto:admin@10a4.local',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  )
  vapidReady = true
  return true
}

async function ensureDataBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(DATA_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho dữ liệu: ' + error.message, 502)
    }
  }
}

async function readStore() {
  const { data, error } = await supabaseAdmin.storage.from(DATA_BUCKET).download(DATA_PATH)
  if (error || !data) return { subscriptions: [] }
  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return { subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [] }
  } catch {
    return { subscriptions: [] }
  }
}

async function writeStore(store) {
  await ensureDataBucket()
  const body = Buffer.from(JSON.stringify(store, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(DATA_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new AppError('Không lưu được subscription: ' + error.message, 502)
}

async function loadAll() {
  if (memoryCache) return clone(memoryCache)
  await ensureDataBucket()
  const store = await readStore()
  memoryCache = store
  return clone(memoryCache)
}

async function saveAll(subscriptions) {
  memoryCache = { subscriptions }
  await writeStore({ subscriptions })
}

export function getPublicVapidKey() {
  return env.VAPID_PUBLIC_KEY || ''
}

/**
 * Lưu/ cập nhật subscription của user.
 * endpoint là khóa duy nhất.
 */
export async function saveSubscription(userId, subscription, userAgent = '') {
  if (!userId) throw new AppError('Thiếu user.', 401)
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new AppError('Subscription không hợp lệ.')
  }

  const data = await loadAll()
  const endpoint = String(subscription.endpoint)
  const next = data.subscriptions.filter((s) => s.endpoint !== endpoint)
  next.push({
    userId: String(userId),
    endpoint,
    keys: {
      p256dh: String(subscription.keys.p256dh),
      auth: String(subscription.keys.auth),
    },
    userAgent: String(userAgent || '').slice(0, 200),
    updatedAt: new Date().toISOString(),
  })
  await saveAll(next)
  return { ok: true }
}

export async function removeSubscription(userId, endpoint) {
  const data = await loadAll()
  const ep = String(endpoint || '')
  const next = data.subscriptions.filter((s) => {
    if (ep) return s.endpoint !== ep
    return s.userId !== String(userId)
  })
  await saveAll(next)
  return { ok: true }
}

async function sendOne(sub, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 }
    )
    return true
  } catch (err) {
    const code = err?.statusCode
    if (code === 404 || code === 410) {
      return 'gone'
    }
    console.warn('[push] gửi thất bại:', err?.message || err)
    return false
  }
}

/**
 * payload: { title, body, url, tag?, data? }
 * options: { userIds?: string[] } — nếu có chỉ gửi cho các user đó; không có thì broadcast member subscriptions
 */
export async function sendPushNotification(payload, options = {}) {
  if (!ensureVapid()) return { sent: 0, skipped: true }

  const title = String(payload?.title || '10A4').slice(0, 120)
  const body = String(payload?.body || '').slice(0, 240)
  const url = String(payload?.url || '/#/classroom/announcements')
  const tag = String(payload?.tag || 'class-web')
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}

  const message = {
    title,
    body,
    url,
    tag,
    data,
  }

  const store = await loadAll()
  let targets = store.subscriptions
  if (Array.isArray(options.userIds) && options.userIds.length) {
    const set = new Set(options.userIds.map(String))
    targets = targets.filter((s) => set.has(String(s.userId)))
  }

  const gone = []
  let sent = 0
  for (const sub of targets) {
    const result = await sendOne(sub, message)
    if (result === true) sent += 1
    if (result === 'gone') gone.push(sub.endpoint)
  }

  if (gone.length) {
    const next = store.subscriptions.filter((s) => !gone.includes(s.endpoint))
    await saveAll(next)
  }

  return { sent, removed: gone.length }
}

/** Gửi cho mọi subscription (thành viên đã đăng ký). */
export async function broadcastPush(payload) {
  return sendPushNotification(payload, {})
}

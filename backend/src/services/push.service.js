import { randomBytes } from 'node:crypto'
import webpush from 'web-push'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'
import { AppError } from './auth.service.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'push-subscriptions.json'
const TABLE = 'push_subscriptions'

let vapidReady = false
/** 'unknown' | 'table' | 'json' */
let storeMode = 'unknown'
let jsonMigrated = false

/** Serialize JSON-storage writes trong cùng process để tránh đọc-sửa-ghi chồng chéo. */
const jsonWriteChain = { p: Promise.resolve() }

function enqueueJsonWrite(fn) {
  const run = jsonWriteChain.p.then(fn, fn)
  jsonWriteChain.p = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function newReceiptToken() {
  return randomBytes(32).toString('hex')
}

function isMissingTableError(error) {
  if (!error) return false
  const msg = `${error.code || ''} ${error.message || ''} ${error.details || ''}`
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  )
}

function defaultReceiptUrl() {
  const configured = String(env.API_PUBLIC_URL || '').replace(/\/$/, '')
  if (configured) return `${configured}/push/receipt`
  const render = String(process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '')
  if (render) return `${render}/api/push/receipt`
  return ''
}

export function receiptUrlFromRequest(req) {
  const configured = defaultReceiptUrl()
  if (configured) return configured
  if (!req) return ''
  const proto = String(req.headers?.['x-forwarded-proto'] || req.protocol || 'https')
    .split(',')[0]
    .trim()
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .split(',')[0]
    .trim()
  if (!host) return ''
  return `${proto}://${host}/api/push/receipt`
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

function normalizeSub(raw) {
  if (!raw || typeof raw !== 'object') return null
  const endpoint = String(raw.endpoint || '').trim()
  const p256dh = String(raw.keys?.p256dh || raw.p256dh || '').trim()
  const auth = String(raw.keys?.auth || raw.auth || '').trim()
  if (!endpoint || !p256dh || !auth) return null
  const last =
    raw.lastReceivedAt || raw.last_received_at || raw.lastReceived_at || null
  let lastIso = null
  if (last) {
    const t = new Date(last)
    if (Number.isFinite(t.getTime())) lastIso = t.toISOString()
  }
  return {
    userId: String(raw.userId || raw.user_id || ''),
    endpoint,
    keys: { p256dh, auth },
    userAgent: String(raw.userAgent || raw.user_agent || '').slice(0, 200),
    receiptToken: String(raw.receiptToken || raw.receipt_token || ''),
    receiptUrl: String(raw.receiptUrl || raw.receipt_url || ''),
    lastReceivedAt: lastIso,
    createdAt: raw.createdAt || raw.created_at || null,
    updatedAt: raw.updatedAt || raw.updated_at || null,
  }
}

function rowToSub(row) {
  return normalizeSub(row)
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
    const list = Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []
    return { subscriptions: list.map(normalizeSub).filter(Boolean) }
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

async function mutateJson(mutator) {
  return enqueueJsonWrite(async () => {
    await ensureDataBucket()
    const store = await readStore()
    const current = store.subscriptions || []
    const next = await mutator(current)
    const list = Array.isArray(next) ? next : current
    await writeStore({ subscriptions: list })
    return list
  })
}

async function detectStoreMode() {
  if (storeMode !== 'unknown') return storeMode
  const { error } = await supabaseAdmin.from(TABLE).select('id').limit(1)
  if (!error) {
    storeMode = 'table'
    await maybeMigrateJsonToTable()
    return storeMode
  }
  if (isMissingTableError(error)) {
    storeMode = 'json'
    console.warn(
      '[push] Bảng push_subscriptions chưa có — dùng JSON storage. Hãy chạy supabase/push-subscriptions.sql trên Supabase.'
    )
    return storeMode
  }
  console.warn('[push] không kiểm tra được bảng push_subscriptions:', error.message)
  storeMode = 'json'
  return storeMode
}

async function maybeMigrateJsonToTable() {
  if (jsonMigrated) return
  jsonMigrated = true
  try {
    await ensureDataBucket()
    const store = await readStore()
    const list = store.subscriptions || []
    if (!list.length) return

    let moved = 0
    for (const sub of list) {
      if (!sub.userId || !sub.endpoint) continue
      const token = sub.receiptToken || newReceiptToken()
      const row = {
        user_id: sub.userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: sub.userAgent || '',
        receipt_token: token,
        receipt_url: sub.receiptUrl || null,
        last_received_at: sub.lastReceivedAt || null,
        updated_at: sub.updatedAt || new Date().toISOString(),
        created_at: sub.createdAt || new Date().toISOString(),
      }
      const { error } = await supabaseAdmin.from(TABLE).upsert(row, { onConflict: 'endpoint' })
      if (error) {
        console.warn('[push] migrate 1 subscription thất bại:', error.message)
        continue
      }
      moved += 1
    }
    if (moved) {
      console.log(`[push] đã migrate ${moved}/${list.length} subscription từ JSON sang bảng.`)
    }
  } catch (err) {
    jsonMigrated = false
    console.warn('[push] migrate JSON → table thất bại:', err?.message || err)
  }
}

async function listSubscriptions() {
  const mode = await detectStoreMode()
  if (mode === 'table') {
    const { data, error } = await supabaseAdmin.from(TABLE).select('*')
    if (error) {
      if (isMissingTableError(error)) {
        storeMode = 'json'
        return (await readStore()).subscriptions
      }
      throw new AppError('Không đọc được subscription: ' + error.message, 502)
    }
    return (data || []).map(rowToSub).filter(Boolean)
  }
  await ensureDataBucket()
  return (await readStore()).subscriptions
}

async function removeByEndpoints(endpoints) {
  const gone = new Set((endpoints || []).map(String).filter(Boolean))
  if (!gone.size) return
  const mode = await detectStoreMode()
  if (mode === 'table') {
    const { error } = await supabaseAdmin.from(TABLE).delete().in('endpoint', [...gone])
    if (error) {
      if (isMissingTableError(error)) {
        storeMode = 'json'
      } else {
        console.warn('[push] xóa subscription chết thất bại:', error.message)
        return
      }
    } else {
      return
    }
  }
  await mutateJson((current) => current.filter((s) => !gone.has(s.endpoint)))
}

export function getPublicVapidKey() {
  return env.VAPID_PUBLIC_KEY || ''
}

/**
 * Lưu/ cập nhật subscription của user.
 * endpoint là khóa duy nhất — một user có thể có nhiều thiết bị.
 */
export async function saveSubscription(userId, subscription, userAgent = '', extras = {}) {
  if (!userId) throw new AppError('Thiếu user.', 401)
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new AppError('Subscription không hợp lệ.')
  }

  const endpoint = String(subscription.endpoint)
  const now = new Date().toISOString()
  const receiptUrl = String(extras.receiptUrl || defaultReceiptUrl() || '')

  const mode = await detectStoreMode()
  if (mode === 'table') {
    const { data: existing, error: readError } = await supabaseAdmin
      .from(TABLE)
      .select('receipt_token, receipt_url, last_received_at, created_at')
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (readError && isMissingTableError(readError)) {
      storeMode = 'json'
    } else if (readError) {
      throw new AppError('Không đọc được subscription: ' + readError.message, 502)
    }

    if (storeMode === 'table') {
      const row = {
        user_id: String(userId),
        endpoint,
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth),
        user_agent: String(userAgent || '').slice(0, 200),
        receipt_token: existing?.receipt_token || newReceiptToken(),
        receipt_url: receiptUrl || existing?.receipt_url || null,
        updated_at: now,
        created_at: existing?.created_at || now,
      }
      const { error } = await supabaseAdmin.from(TABLE).upsert(row, { onConflict: 'endpoint' })
      if (error) {
        if (isMissingTableError(error)) {
          storeMode = 'json'
        } else {
          throw new AppError('Không lưu được subscription: ' + error.message, 502)
        }
      } else {
        return { ok: true }
      }
    }
  }

  await mutateJson((current) => {
    const prev = current.find((s) => s.endpoint === endpoint)
    const next = current.filter((s) => s.endpoint !== endpoint)
    next.push({
      userId: String(userId),
      endpoint,
      keys: {
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth),
      },
      userAgent: String(userAgent || '').slice(0, 200),
      receiptToken: prev?.receiptToken || newReceiptToken(),
      receiptUrl: receiptUrl || prev?.receiptUrl || '',
      lastReceivedAt: prev?.lastReceivedAt || null,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    })
    return next
  })
  return { ok: true }
}

export async function removeSubscription(userId, endpoint) {
  const ep = String(endpoint || '')
  const uid = String(userId || '')
  const mode = await detectStoreMode()

  if (mode === 'table') {
    let query = supabaseAdmin.from(TABLE).delete()
    if (ep) query = query.eq('endpoint', ep)
    else query = query.eq('user_id', uid)
    const { error } = await query
    if (error) {
      if (isMissingTableError(error)) {
        storeMode = 'json'
      } else {
        throw new AppError('Không hủy được subscription: ' + error.message, 502)
      }
    } else {
      return { ok: true }
    }
  }

  await mutateJson((current) =>
    current.filter((s) => {
      if (ep) return s.endpoint !== ep
      return s.userId !== uid
    })
  )
  return { ok: true }
}

export async function removeSubscriptionsForUser(userId) {
  return removeSubscription(userId, '')
}

function isValidReceiptToken(token) {
  return typeof token === 'string' && /^[a-fA-F0-9]{32,128}$/.test(token)
}

/**
 * Service Worker báo đã nhận payload và showNotification thành công.
 * Không chứng minh OS đã vẽ noti 100% — chỉ mức web app kiểm chứng được.
 */
export async function recordReceipt(receiptToken) {
  const token = String(receiptToken || '').trim()
  if (!isValidReceiptToken(token)) {
    throw new AppError('Receipt không hợp lệ.', 400)
  }
  const now = new Date().toISOString()
  const mode = await detectStoreMode()

  if (mode === 'table') {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({ last_received_at: now, updated_at: now })
      .eq('receipt_token', token)
    if (error) {
      if (isMissingTableError(error)) {
        storeMode = 'json'
      } else {
        console.warn('[push] ghi receipt thất bại:', error.message)
        return { ok: false }
      }
    } else {
      return { ok: true }
    }
  }

  await mutateJson((current) => {
    let found = false
    const next = current.map((s) => {
      if (s.receiptToken !== token) return s
      found = true
      return { ...s, lastReceivedAt: now, updatedAt: now }
    })
    return found ? next : current
  })
  return { ok: true }
}

/**
 * Thống kê push theo user cho Admin.
 * Không trả endpoint / keys / receiptToken.
 */
export async function getPushStatsByUserId(userIds) {
  const subs = await listSubscriptions()
  const want = Array.isArray(userIds) && userIds.length ? new Set(userIds.map(String)) : null
  const map = new Map()

  for (const s of subs) {
    const uid = String(s.userId || '')
    if (!uid) continue
    if (want && !want.has(uid)) continue
    const cur = map.get(uid) || { push_devices: 0, push_last_received_at: null }
    cur.push_devices += 1
    if (s.lastReceivedAt) {
      if (!cur.push_last_received_at || s.lastReceivedAt > cur.push_last_received_at) {
        cur.push_last_received_at = s.lastReceivedAt
      }
    }
    map.set(uid, cur)
  }
  return map
}

function payloadUrgency(raw) {
  if (raw === 'urgent') return 'urgent'
  if (raw === 'high') return 'high'
  return 'normal'
}

function protocolUrgency(raw) {
  return raw === 'high' || raw === 'urgent' ? 'high' : 'normal'
}

async function ensureSubReceiptFields(sub) {
  if (sub.receiptToken && (sub.receiptUrl || defaultReceiptUrl())) {
    if (!sub.receiptUrl) sub.receiptUrl = defaultReceiptUrl()
    return sub
  }
  const token = sub.receiptToken || newReceiptToken()
  const url = sub.receiptUrl || defaultReceiptUrl()
  const now = new Date().toISOString()
  const mode = await detectStoreMode()
  if (mode === 'table') {
    const patch = { receipt_token: token, updated_at: now }
    if (url) patch.receipt_url = url
    const { error } = await supabaseAdmin.from(TABLE).update(patch).eq('endpoint', sub.endpoint)
    if (error && !isMissingTableError(error)) {
      console.warn('[push] backfill receipt token thất bại:', error.message)
    }
  } else {
    await mutateJson((current) =>
      current.map((s) =>
        s.endpoint === sub.endpoint
          ? { ...s, receiptToken: token, receiptUrl: url || s.receiptUrl, updatedAt: now }
          : s
      )
    )
  }
  return { ...sub, receiptToken: token, receiptUrl: url }
}

async function sendOne(sub, payload, urgency = 'normal') {
  try {
    const options = {
      TTL: 60 * 60 * 12,
      urgency: protocolUrgency(urgency),
    }

    let ready = sub
    try {
      ready = await ensureSubReceiptFields(sub)
    } catch (err) {
      console.warn('[push] backfill receipt fields thất bại:', err?.message || err)
    }

    const body = {
      ...payload,
    }
    if (ready.receiptToken) {
      body.__pushReceiptToken = ready.receiptToken
      if (ready.receiptUrl) body.__pushReceiptUrl = ready.receiptUrl
    }

    await webpush.sendNotification(
      {
        endpoint: ready.endpoint,
        keys: ready.keys,
      },
      JSON.stringify(body),
      options
    )

    console.log('[push] GỬI THÀNH CÔNG:', {
      userId: ready.userId,
      endpoint: String(ready.endpoint || '').slice(0, 80),
      title: payload?.title || '',
    })

    return true
  } catch (err) {
    const code = err?.statusCode

    if (code === 404 || code === 410) {
      console.warn('[push] Subscription không còn tồn tại:', {
        userId: sub.userId,
        statusCode: code,
      })
      return 'gone'
    }

    console.warn('[push] gửi thất bại:', err?.message || err)

    return false
  }
}

/**
 * payload: { title, body, url, tag?, data?, urgency?, requireInteraction? }
 * options: { userIds?: string[] } — nếu có chỉ gửi cho các user đó; không có thì broadcast
 */
export async function sendPushNotification(payload, options = {}) {
  if (!ensureVapid()) return { sent: 0, skipped: true }

  const title = String(payload?.title || '10A4').slice(0, 120)
  const body = String(payload?.body || '').slice(0, 240)
  const url = String(payload?.url || '/#/classroom/announcements')
  const tag = String(payload?.tag || 'class-web')
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const urgency = payloadUrgency(payload?.urgency)
  const requireInteraction = Boolean(payload?.requireInteraction)

  const message = {
    title,
    body,
    url,
    tag,
    urgency,
    requireInteraction,
    data,
  }

  const all = await listSubscriptions()
  let targets = all
  if (Array.isArray(options.userIds) && options.userIds.length) {
    const set = new Set(options.userIds.map(String))
    targets = targets.filter((s) => set.has(String(s.userId)))
  }

  console.log('[push] BẮT ĐẦU GỬI:', {
    totalSubscriptions: targets.length,
    title,
  })

  const gone = []
  let sent = 0
  for (const sub of targets) {
    const result = await sendOne(sub, message, urgency)
    if (result === true) sent += 1
    if (result === 'gone') gone.push(sub.endpoint)
  }

  if (gone.length) {
    await removeByEndpoints(gone)
  }

  return { sent, removed: gone.length }
}

/** Gửi cho mọi subscription (thành viên đã đăng ký). */
export async function broadcastPush(payload) {
  return sendPushNotification(payload, {})
}
